
import io
import uuid
import logging
from pathlib import Path
from typing import Literal
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Depends,
    HTTPException
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from PIL import Image, UnidentifiedImageError

from backend.database import engine, get_db, Base
from backend import models
from backend.predict import predict_waste
from backend.auth_routes import (
    router as auth_router,
    get_current_user,
    require_roles
)


# ==================================================
# ENVIRONMENT AND LOGGING
# ==================================================

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==================================================
# DATABASE INITIALIZATION
# ==================================================

Base.metadata.create_all(bind=engine)


# ==================================================
# PYDANTIC MODELS
# ==================================================

class FeedbackRequest(BaseModel):
    classification_id: int = Field(gt=0)
    feedback_type: Literal["correct", "incorrect"]
    corrected_category: str | None = Field(default=None, max_length=100)
    comments: str | None = Field(default=None, max_length=1000)


class ReviewRequest(BaseModel):
    classification_id: int = Field(gt=0)
    action: Literal["approve", "correct"]
    corrected_category: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)


class GuidanceCreateRequest(BaseModel):
    category_code: str = Field(min_length=1, max_length=50)
    locality_id: int = Field(gt=0)
    instruction_title: str = Field(min_length=1, max_length=200)
    instruction_text: str = Field(min_length=1)
    accepted_status: Literal[
        "Accepted",
        "Conditional",
        "Not accepted",
        "Unknown"
    ] = "Unknown"
    preparation_advice: str | None = None
    exceptions: str | None = None
    source_name: str | None = Field(default=None, max_length=200)
    source_url: str | None = Field(default=None, max_length=1000)
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class GuidanceUpdateRequest(BaseModel):
    category_code: str | None = None
    locality_id: int | None = None
    instruction_title: str | None = None
    instruction_text: str | None = None
    accepted_status: Literal[
        "Accepted",
        "Conditional",
        "Not accepted",
        "Unknown"
    ] | None = None
    preparation_advice: str | None = None
    exceptions: str | None = None
    source_name: str | None = None
    source_url: str | None = None
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class GuidanceApprovalRequest(BaseModel):
    reviewed_by: str = Field(min_length=1, max_length=150)
    

class UserRoleUpdateRequest(BaseModel):
    role: Literal["user", "reviewer", "admin"]


class UserStatusUpdateRequest(BaseModel):
    is_active: bool

# ==================================================
# APPLICATION
# ==================================================

app = FastAPI(
    title="WasteWise Intelligence API",
    description="AI-powered Waste Classification and Analytics System",
    version="2.0.0"
)


# ==================================================
# AUTHENTICATION ROUTES
# ==================================================

app.include_router(auth_router)


# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ==================================================
# CONFIGURATION
# ==================================================

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000

WASTE_CATEGORIES = {
    "cardboard",
    "glass",
    "metal",
    "paper",
    "plastic",
    "trash"
}


# ==================================================
# GUIDANCE HELPERS
# ==================================================

def get_current_utc_time():
    return datetime.now(timezone.utc)


def normalize_datetime(value):
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def validate_effective_dates(effective_from, effective_to):
    start = normalize_datetime(effective_from)
    end = normalize_datetime(effective_to)

    if start and end and end <= start:
        raise HTTPException(
            status_code=422,
            detail="Effective end date must be later than start date."
        )


def is_guidance_current(guidance):
    now = get_current_utc_time()

    if not guidance.is_approved:
        return False

    if guidance.is_archived:
        return False

    if guidance.reviewed_at is None:
        return False

    effective_from = normalize_datetime(
        guidance.effective_from
    )

    effective_to = normalize_datetime(
        guidance.effective_to
    )

    if effective_from and effective_from > now:
        return False

    if effective_to and effective_to < now:
        return False

    return True


def guidance_to_dict(record):
    return {
        "id": record.id,
        "category_code": record.category_code,
        "locality_id": record.locality_id,
        "instruction_title": record.instruction_title,
        "instruction_text": record.instruction_text,
        "accepted_status": record.accepted_status,
        "preparation_advice": record.preparation_advice,
        "exceptions": record.exceptions,
        "source_name": record.source_name,
        "source_url": record.source_url,
        "reviewed_by": record.reviewed_by,
        "reviewed_at": record.reviewed_at,
        "effective_from": record.effective_from,
        "effective_to": record.effective_to,
        "is_approved": record.is_approved,
        "is_archived": record.is_archived,
        "version": record.version,
        "created_at": record.created_at,
        "updated_at": record.updated_at
    }


def get_guidance_record_or_404(db, guidance_id):
    record = (
        db.query(models.WasteGuidance)
        .filter(models.WasteGuidance.id == guidance_id)
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Guidance record not found."
        )

    return record


# ==================================================
# HOME
# ==================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to WasteWise Intelligence API",
        "status": "running",
        "version": "2.0.0"
    }


# ==================================================
# HEALTH CHECK
# ==================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "WasteWise Intelligence API"
    }


# ==================================================
# LOCALITIES
# AUTHENTICATED USERS
# ==================================================

@app.get("/api/localities")
def get_localities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    records = (
        db.query(models.Locality)
        .filter(models.Locality.is_active.is_(True))
        .order_by(models.Locality.city.asc())
        .all()
    )

    return [
        {
            "id": record.id,
            "name": record.name,
            "city": record.city,
            "state": record.state,
            "country": record.country,
            "is_active": record.is_active
        }
        for record in records
    ]


# ==================================================
# LOCAL GUIDANCE LOOKUP
# AUTHENTICATED USERS
# ==================================================

@app.get("/api/guidance")
def get_local_guidance(
    category: str,
    locality: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    category = category.strip().lower()
    locality = locality.strip()

    if category not in WASTE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail="Invalid waste category."
        )

    if not locality:
        raise HTTPException(
            status_code=422,
            detail="Locality is required."
        )

    locality_record = (
        db.query(models.Locality)
        .filter(
            func.lower(models.Locality.city) == locality.lower(),
            models.Locality.is_active.is_(True)
        )
        .first()
    )

    if not locality_record:
        return {
            "guidance": None,
            "message": (
                "No configured locality was found. "
                "Check local rules."
            ),
            "fallback": True
        }

    guidance_records = (
        db.query(models.WasteGuidance)
        .filter(
            models.WasteGuidance.category_code == category,
            models.WasteGuidance.locality_id == locality_record.id
        )
        .order_by(
            models.WasteGuidance.version.desc(),
            models.WasteGuidance.created_at.desc()
        )
        .all()
    )

    current_guidance = next(
        (
            record
            for record in guidance_records
            if is_guidance_current(record)
        ),
        None
    )

    if current_guidance is None:
        return {
            "guidance": None,
            "message": (
                "No approved and current guidance is available "
                "for this category and locality. Check local rules."
            ),
            "fallback": True,
            "category": category,
            "locality": locality_record.city
        }

    return {
        "guidance": {
            "id": current_guidance.id,
            "category": current_guidance.category_code,
            "locality": locality_record.city,
            "instruction_title": current_guidance.instruction_title,
            "instruction_text": current_guidance.instruction_text,
            "accepted_status": current_guidance.accepted_status,
            "preparation_advice": current_guidance.preparation_advice,
            "exceptions": current_guidance.exceptions,
            "source_name": current_guidance.source_name,
            "source_url": current_guidance.source_url,
            "reviewed_by": current_guidance.reviewed_by,
            "reviewed_at": current_guidance.reviewed_at,
            "effective_from": current_guidance.effective_from,
            "effective_to": current_guidance.effective_to,
            "version": current_guidance.version
        },
        "message": "Verified local guidance found.",
        "fallback": False
    }


# ==================================================
# ADMIN: LIST ALL GUIDANCE
# ==================================================

@app.get("/api/admin/guidance")
def admin_list_guidance(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    records = (
        db.query(models.WasteGuidance)
        .order_by(models.WasteGuidance.created_at.desc())
        .all()
    )

    return [
        guidance_to_dict(record)
        for record in records
    ]


# ==================================================
# ADMIN: CREATE GUIDANCE
# ==================================================

@app.post("/api/admin/guidance", status_code=201)
def admin_create_guidance(
    data: GuidanceCreateRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    category = data.category_code.strip().lower()

    if category not in WASTE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail="Invalid waste category."
        )

    locality = (
        db.query(models.Locality)
        .filter(
            models.Locality.id == data.locality_id,
            models.Locality.is_active.is_(True)
        )
        .first()
    )

    if not locality:
        raise HTTPException(
            status_code=404,
            detail="Active locality not found."
        )

    validate_effective_dates(
        data.effective_from,
        data.effective_to
    )

    if not data.instruction_title.strip():
        raise HTTPException(
            status_code=422,
            detail="Instruction title cannot be empty."
        )

    if not data.instruction_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Instruction text cannot be empty."
        )

    record = models.WasteGuidance(
        category_code=category,
        locality_id=data.locality_id,
        instruction_title=data.instruction_title.strip(),
        instruction_text=data.instruction_text.strip(),
        accepted_status=data.accepted_status,
        preparation_advice=data.preparation_advice,
        exceptions=data.exceptions,
        source_name=data.source_name,
        source_url=data.source_url,
        effective_from=data.effective_from,
        effective_to=data.effective_to,
        reviewed_by=None,
        reviewed_at=None,
        is_approved=False,
        is_archived=False,
        version=1
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "message": "Guidance draft created successfully.",
            "guidance": guidance_to_dict(record)
        }

    except Exception:
        db.rollback()
        logger.exception("Guidance creation failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not create guidance."
        )


# ==================================================
# ADMIN: UPDATE GUIDANCE
# ==================================================

@app.put("/api/admin/guidance/{guidance_id}")
def admin_update_guidance(
    guidance_id: int,
    data: GuidanceUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    record = get_guidance_record_or_404(db, guidance_id)

    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=422,
            detail="No update fields provided."
        )

    required_fields = {
        "category_code",
        "locality_id",
        "instruction_title",
        "instruction_text",
        "accepted_status"
    }

    for field in required_fields:
        if field in updates and updates[field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null."
            )

    if "category_code" in updates:
        updates["category_code"] = updates["category_code"].strip().lower()

        if updates["category_code"] not in WASTE_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail="Invalid waste category."
            )

    if "locality_id" in updates:
        locality = (
            db.query(models.Locality)
            .filter(
                models.Locality.id == updates["locality_id"],
                models.Locality.is_active.is_(True)
            )
            .first()
        )

        if not locality:
            raise HTTPException(
                status_code=404,
                detail="Active locality not found."
            )

    if "instruction_title" in updates:
        updates["instruction_title"] = updates["instruction_title"].strip()

        if not updates["instruction_title"]:
            raise HTTPException(
                status_code=422,
                detail="Instruction title cannot be empty."
            )

    if "instruction_text" in updates:
        updates["instruction_text"] = updates["instruction_text"].strip()

        if not updates["instruction_text"]:
            raise HTTPException(
                status_code=422,
                detail="Instruction text cannot be empty."
            )

    new_start = updates.get("effective_from", record.effective_from)
    new_end = updates.get("effective_to", record.effective_to)

    validate_effective_dates(new_start, new_end)

    try:
        for field, value in updates.items():
            setattr(record, field, value)

        record.version += 1
        record.is_approved = False
        record.reviewed_by = None
        record.reviewed_at = None

        db.commit()
        db.refresh(record)

        return {
            "message": (
                "Guidance updated. Approval has been reset "
                "and the new version requires review."
            ),
            "guidance": guidance_to_dict(record)
        }

    except Exception:
        db.rollback()
        logger.exception("Guidance update failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not update guidance."
        )


# ==================================================
# ADMIN: APPROVE GUIDANCE
# ==================================================

@app.post("/api/admin/guidance/{guidance_id}/approve")
def admin_approve_guidance(
    guidance_id: int,
    data: GuidanceApprovalRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    record = get_guidance_record_or_404(db, guidance_id)

    if record.is_archived:
        raise HTTPException(
            status_code=409,
            detail="Archived guidance cannot be approved."
        )

    if not record.source_name or not record.source_name.strip():
        raise HTTPException(
            status_code=422,
            detail="Source name is required before approval."
        )

    if not record.source_url or not record.source_url.strip():
        raise HTTPException(
            status_code=422,
            detail="Source URL is required before approval."
        )

    validate_effective_dates(
        record.effective_from,
        record.effective_to
    )

    now = get_current_utc_time()

    effective_from = normalize_datetime(record.effective_from)
    effective_to = normalize_datetime(record.effective_to)

    if effective_from and effective_from > now:
        raise HTTPException(
            status_code=422,
            detail="Guidance cannot be approved before its effective start date."
        )

    if effective_to and effective_to < now:
        raise HTTPException(
            status_code=422,
            detail="Expired guidance cannot be approved."
        )

    try:
        # Use the authenticated administrator's identity.
        record.reviewed_by = current_admin.username
        record.reviewed_at = now
        record.is_approved = True

        db.commit()
        db.refresh(record)

        return {
            "message": "Guidance approved successfully.",
            "guidance": guidance_to_dict(record)
        }

    except Exception:
        db.rollback()
        logger.exception("Guidance approval failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not approve guidance."
        )


# ==================================================
# ADMIN: ARCHIVE GUIDANCE
# ==================================================

@app.post("/api/admin/guidance/{guidance_id}/archive")
def admin_archive_guidance(
    guidance_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    record = get_guidance_record_or_404(db, guidance_id)

    try:
        record.is_archived = True
        record.is_approved = False

        db.commit()
        db.refresh(record)

        return {
            "message": "Guidance archived successfully.",
            "guidance": guidance_to_dict(record)
        }

    except Exception:
        db.rollback()
        logger.exception("Guidance archiving failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not archive guidance."
        )


# ==================================================
# IMAGE CLASSIFICATION
# AUTHENTICATED USERS
# ==================================================

@app.post("/api/classify")
async def classify_waste(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    request_id = str(uuid.uuid4())

    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG and PNG images are supported."
        )

    image_bytes = await file.read(MAX_IMAGE_SIZE + 1)

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Empty image."
        )

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds maximum size of 5 MB."
        )

    image_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{extension}"

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            if image.format not in {"JPEG", "PNG"}:
                raise HTTPException(
                    status_code=400,
                    detail="Image content must be JPG or PNG."
                )

            width, height = image.size

            if width <= 0 or height <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid image dimensions."
                )

            if width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail="Image resolution is too large."
                )

            image.verify()

        with Image.open(io.BytesIO(image_bytes)) as image:
            image.convert("RGB").load()

        image_path.write_bytes(image_bytes)

    except HTTPException:
        raise

    except (
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image."
        )

    try:
        prediction = predict_waste(str(image_path))

        record = models.WasteClassification(
            user_id=current_user.id,
            image_path=str(image_path.relative_to(BASE_DIR)),
            predicted_class=prediction["predicted_class"],
            confidence=prediction["confidence"],
            review_required=int(prediction["review_required"])
        )

        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "message": "Classification completed successfully",
            "request_id": request_id,
            "classification_id": record.id,
            "predicted_class": prediction["predicted_class"],
            "confidence": prediction["confidence"],
            "confidence_percentage": prediction["confidence_percentage"],
            "confidence_threshold": prediction["confidence_threshold"],
            "review_required": prediction["review_required"],
            "status": prediction["status"],
            "model_version": prediction["model_version"],
            "top_predictions": prediction["top_predictions"]
        }

    except Exception:
        db.rollback()
        image_path.unlink(missing_ok=True)

        logger.exception(
            "Classification failed. Request ID: %s",
            request_id
        )

        raise HTTPException(
            status_code=500,
            detail="Classification failed. Check backend logs."
        )


# ==================================================
# CLASSIFICATION HISTORY
# EACH USER SEES OWN RECORDS
# ==================================================

@app.get("/api/history")
def classification_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    records = (
        db.query(models.WasteClassification)
        .filter(
            models.WasteClassification.user_id == current_user.id
        )
        .order_by(
            models.WasteClassification.created_at.desc()
        )
        .limit(100)
        .all()
    )

    return [
        {
            "id": record.id,
            "predicted_class": record.predicted_class,
            "confidence": record.confidence,
            "review_required": bool(record.review_required),
            "created_at": record.created_at
        }
        for record in records
    ]


# ==================================================
# ANALYTICS
# EACH USER SEES OWN ANALYTICS
# ==================================================

@app.get("/api/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    owner_filter = (
        models.WasteClassification.user_id == current_user.id
    )

    total = (
        db.query(func.count(models.WasteClassification.id))
        .filter(owner_filter)
        .scalar() or 0
    )

    review_count = (
        db.query(func.count(models.WasteClassification.id))
        .filter(
            owner_filter,
            models.WasteClassification.review_required == 1
        )
        .scalar() or 0
    )

    classified_count = total - review_count

    average_confidence = (
        db.query(func.avg(models.WasteClassification.confidence))
        .filter(owner_filter)
        .scalar() or 0
    )

    category_records = (
        db.query(
            models.WasteClassification.predicted_class,
            func.count(models.WasteClassification.id)
        )
        .filter(owner_filter)
        .group_by(
            models.WasteClassification.predicted_class
        )
        .order_by(
            func.count(models.WasteClassification.id).desc()
        )
        .all()
    )

    category_distribution = []

    for category, count in category_records:
        percentage = count / total * 100 if total else 0

        category_distribution.append({
            "category": category,
            "count": count,
            "percentage": round(percentage, 2)
        })

    daily_records = (
        db.query(
            func.date(models.WasteClassification.created_at),
            func.count(models.WasteClassification.id)
        )
        .filter(owner_filter)
        .group_by(
            func.date(models.WasteClassification.created_at)
        )
        .order_by(
            func.date(models.WasteClassification.created_at).desc()
        )
        .limit(30)
        .all()
    )

    daily_records.reverse()

    daily_trend = [
        {
            "date": str(date_value),
            "count": count
        }
        for date_value, count in daily_records
    ]

    return {
        "summary": {
            "total_classifications": total,
            "classified_count": classified_count,
            "manual_review_count": review_count,
            "average_confidence_percentage": round(
                float(average_confidence) * 100, 2
            ),
            "manual_review_percentage": round(
                review_count / total * 100, 2
            ) if total else 0,
            "classified_percentage": round(
                classified_count / total * 100, 2
            ) if total else 0
        },
        "category_distribution": category_distribution,
        "daily_trend": daily_trend
    }


# ==================================================
# SUBMIT FEEDBACK
# USERS CAN ONLY SUBMIT FEEDBACK ON OWN RECORDS
# ==================================================

@app.post("/api/feedback")
def submit_feedback(
    feedback: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    classification = (
        db.query(models.WasteClassification)
        .filter(
            models.WasteClassification.id == feedback.classification_id,
            models.WasteClassification.user_id == current_user.id
        )
        .first()
    )

    if not classification:
        raise HTTPException(
            status_code=404,
            detail="Classification record not found."
        )

    corrected_category = None

    if feedback.feedback_type == "incorrect":
        if (
            not feedback.corrected_category
            or not feedback.corrected_category.strip()
        ):
            raise HTTPException(
                status_code=422,
                detail="Please provide the correct category."
            )

        corrected_category = feedback.corrected_category.strip().lower()

        if corrected_category not in WASTE_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail="Invalid waste category."
            )

    comments = (
        feedback.comments.strip()
        if feedback.comments and feedback.comments.strip()
        else None
    )

    record = models.WasteFeedback(
        classification_id=feedback.classification_id,
        feedback_type=feedback.feedback_type,
        corrected_category=corrected_category,
        comments=comments
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "message": "Feedback submitted successfully.",
            "feedback": {
                "id": record.id,
                "classification_id": record.classification_id,
                "feedback_type": record.feedback_type,
                "corrected_category": record.corrected_category,
                "comments": record.comments,
                "created_at": record.created_at
            }
        }

    except Exception:
        db.rollback()
        logger.exception("Feedback submission failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not save feedback."
        )


# ==================================================
# GET FEEDBACK
# EACH USER SEES FEEDBACK ON OWN CLASSIFICATIONS
# ==================================================

@app.get("/api/feedback")
def get_feedback(
    classification_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = (
        db.query(models.WasteFeedback)
        .join(
            models.WasteClassification,
            models.WasteFeedback.classification_id
            == models.WasteClassification.id
        )
        .filter(
            models.WasteClassification.user_id == current_user.id
        )
    )

    if classification_id is not None:
        query = query.filter(
            models.WasteFeedback.classification_id == classification_id
        )

    records = (
        query
        .order_by(models.WasteFeedback.created_at.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "id": record.id,
            "classification_id": record.classification_id,
            "feedback_type": record.feedback_type,
            "corrected_category": record.corrected_category,
            "comments": record.comments,
            "created_at": record.created_at
        }
        for record in records
    ]


# ==================================================
# REVIEWER QUEUE
# REVIEWER AND ADMIN ONLY
# ==================================================

@app.get("/api/reviewer-queue")
def get_reviewer_queue(
    db: Session = Depends(get_db),
    current_reviewer: models.User = Depends(
        require_roles("reviewer", "admin")
    )
):
    records = (
        db.query(models.WasteClassification)
        .filter(
            models.WasteClassification.review_required == 1
        )
        .order_by(
            models.WasteClassification.created_at.asc()
        )
        .limit(100)
        .all()
    )

    return [
        {
            "classification_id": record.id,
            "predicted_class": record.predicted_class,
            "confidence": record.confidence,
            "confidence_percentage": round(
                record.confidence * 100, 2
            ),
            "created_at": record.created_at
        }
        for record in records
    ]


# ==================================================
# SUBMIT REVIEW DECISION
# REVIEWER AND ADMIN ONLY
# ==================================================

@app.post("/api/review")
def submit_review(
    review: ReviewRequest,
    db: Session = Depends(get_db),
    current_reviewer: models.User = Depends(
        require_roles("reviewer", "admin")
    )
):
    classification = (
        db.query(models.WasteClassification)
        .filter(
            models.WasteClassification.id == review.classification_id
        )
        .with_for_update()
        .first()
    )

    if not classification:
        raise HTTPException(
            status_code=404,
            detail="Classification record not found."
        )

    if classification.review_required != 1:
        raise HTTPException(
            status_code=409,
            detail="This classification has already been reviewed."
        )

    corrected_category = None

    if review.action == "correct":
        if (
            not review.corrected_category
            or not review.corrected_category.strip()
        ):
            raise HTTPException(
                status_code=422,
                detail="Please provide the corrected category."
            )

        corrected_category = review.corrected_category.strip().lower()

        if corrected_category not in WASTE_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail="Invalid waste category."
            )

    original_category = classification.predicted_class

    notes = (
        review.notes.strip()
        if review.notes and review.notes.strip()
        else None
    )

    try:
        if review.action == "correct":
            classification.predicted_class = corrected_category

        classification.review_required = 0

        final_category = classification.predicted_class

        history_record = models.ClassificationHistory(
            classification_id=classification.id,
            action=review.action,
            notes=(
                f"Reviewer: {current_reviewer.username}. "
                f"Original category: {original_category}. "
                f"Final category: {final_category}. "
                f"Reviewer notes: {notes or 'None'}"
            )
        )

        db.add(history_record)
        db.commit()

        db.refresh(classification)
        db.refresh(history_record)

        return {
            "message": "Review submitted successfully.",
            "review": {
                "classification_id": classification.id,
                "action": review.action,
                "original_category": original_category,
                "final_category": final_category,
                "review_required": bool(
                    classification.review_required
                ),
                "history_id": history_record.id,
                "reviewed_by": current_reviewer.username
            }
        }
    except Exception:
        db.rollback()
        logger.exception("Review submission failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not save review decision."
        )

        # ==================================================
# ADMIN: USER MANAGEMENT
# ==================================================

@app.get("/api/admin/users")
def admin_list_users(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    users = (
        db.query(models.User)
        .order_by(models.User.created_at.desc())
        .all()
    )

    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
        for user in users
    ]


@app.put("/api/admin/users/{user_id}/role")
def admin_update_user_role(
    user_id: int,
    data: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .with_for_update()
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    if user.id == current_admin.id and data.role != "admin":
        raise HTTPException(
            status_code=409,
            detail="You cannot remove your own administrator role."
        )

    if (
        user.role == "admin"
        and user.is_active
        and data.role != "admin"
    ):
        active_admin_count = (
            db.query(func.count(models.User.id))
            .filter(
                models.User.role == "admin",
                models.User.is_active.is_(True)
            )
            .scalar() or 0
        )

        if active_admin_count <= 1:
            raise HTTPException(
                status_code=409,
                detail="The last active administrator cannot be demoted."
            )

    try:
        user.role = data.role
        db.commit()
        db.refresh(user)

        return {
            "message": "User role updated successfully.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active
            }
        }

    except Exception:
        db.rollback()
        logger.exception("User role update failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not update user role."
        )


@app.put("/api/admin/users/{user_id}/status")
def admin_update_user_status(
    user_id: int,
    data: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_roles("admin"))
):
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .with_for_update()
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    if user.id == current_admin.id and not data.is_active:
        raise HTTPException(
            status_code=409,
            detail="You cannot deactivate your own account."
        )

    if (
        user.role == "admin"
        and user.is_active
        and not data.is_active
    ):
        active_admin_count = (
            db.query(func.count(models.User.id))
            .filter(
                models.User.role == "admin",
                models.User.is_active.is_(True)
            )
            .scalar() or 0
        )

        if active_admin_count <= 1:
            raise HTTPException(
                status_code=409,
                detail="The last active administrator cannot be deactivated."
            )

    try:
        user.is_active = data.is_active
        db.commit()
        db.refresh(user)

        return {
            "message": (
                "User activated successfully."
                if user.is_active
                else "User deactivated successfully."
            ),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active
            }
        }

    except Exception:
        db.rollback()
        logger.exception("User status update failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not update user status."
        )