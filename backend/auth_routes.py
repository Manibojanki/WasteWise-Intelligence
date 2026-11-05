
import os
import secrets

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    status
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.database import get_db
from backend import models
from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

security = HTTPBearer(auto_error=False)


# --------------------------------------------------
# REQUEST SCHEMAS
# --------------------------------------------------

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    username_or_email: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=72)


class AdminRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


# --------------------------------------------------
# AUTHENTICATED USER DEPENDENCY
# --------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(credentials.credentials)

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token."
        )

    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is unavailable."
        )

    return user


# --------------------------------------------------
# ROLE-BASED ACCESS CONTROL
# --------------------------------------------------

def require_roles(*allowed_roles):
    def role_checker(
        current_user: models.User = Depends(get_current_user)
    ):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource."
            )

        return current_user

    return role_checker


# --------------------------------------------------
# USER REGISTRATION
# --------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = db.query(models.User).filter(
        (models.User.username == request.username) |
        (models.User.email == str(request.email))
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered."
        )

    try:
        user = models.User(
            username=request.username,
            email=str(request.email),
            password_hash=hash_password(request.password),
            role="user",
            is_active=True
        )

        db.add(user)
        db.commit()
        db.refresh(user)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered."
        )

    return {
        "message": "Registration successful.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }


# --------------------------------------------------
# INITIAL ADMINISTRATOR REGISTRATION
# --------------------------------------------------

@router.post(
    "/register-admin",
    status_code=status.HTTP_201_CREATED
)
def register_admin(
    request: AdminRegisterRequest,
    x_admin_key: str = Header(default=None),
    db: Session = Depends(get_db)
):
    admin_api_key = os.getenv("ADMIN_API_KEY")

    if not admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Administrator registration is not configured."
        )

    if not x_admin_key or not secrets.compare_digest(
        x_admin_key,
        admin_api_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator registration key."
        )

    existing_admin = db.query(models.User).filter(
        models.User.role == "admin"
    ).first()

    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An administrator account already exists."
        )

    existing_user = db.query(models.User).filter(
        (models.User.username == request.username) |
        (models.User.email == str(request.email))
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered."
        )

    try:
        admin = models.User(
            username=request.username,
            email=str(request.email),
            password_hash=hash_password(request.password),
            role="admin",
            is_active=True
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered."
        )

    return {
        "message": "Administrator account created successfully.",
        "user": {
            "id": admin.id,
            "username": admin.username,
            "email": admin.email,
            "role": admin.role
        }
    }


# --------------------------------------------------
# USER LOGIN
# --------------------------------------------------

@router.post("/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        (models.User.username == request.username_or_email) |
        (models.User.email == request.username_or_email)
    ).first()

    if not user or not verify_password(
        request.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated."
        )

    access_token = create_access_token(user.id)

    return {
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }


# --------------------------------------------------
# CURRENT USER DETAILS
# --------------------------------------------------

@router.get("/me")
def get_my_account(
    current_user: models.User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active
    }
