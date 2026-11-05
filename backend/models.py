
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
    Boolean,
    UniqueConstraint
)
from sqlalchemy.sql import func

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    role = Column(
        String(20),
        nullable=False,
        default="user",
        server_default="user"
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class WasteClassification(Base):
    __tablename__ = "waste_classifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    image_path = Column(String(500), nullable=False)
    predicted_class = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)

    review_required = Column(Integer, default=0)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class ClassificationHistory(Base):
    __tablename__ = "classification_history"

    id = Column(Integer, primary_key=True, index=True)

    classification_id = Column(
        Integer,
        ForeignKey("waste_classifications.id"),
        nullable=False
    )

    action = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class WasteFeedback(Base):
    __tablename__ = "waste_feedback"

    id = Column(Integer, primary_key=True, index=True)

    classification_id = Column(
        Integer,
        ForeignKey("waste_classifications.id"),
        nullable=False
    )

    feedback_type = Column(String(30), nullable=False)
    corrected_category = Column(String(100), nullable=True)
    comments = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class Locality(Base):
    __tablename__ = "localities"

    __table_args__ = (
        UniqueConstraint(
            "city",
            "state",
            "country",
            name="uq_locality_city_state_country"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(150), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(
        String(100),
        nullable=False,
        default="India"
    )

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class WasteGuidance(Base):
    __tablename__ = "waste_guidance"

    id = Column(Integer, primary_key=True, index=True)

    category_code = Column(String(50), nullable=False)

    locality_id = Column(
        Integer,
        ForeignKey("localities.id"),
        nullable=False,
        index=True
    )

    instruction_title = Column(String(200), nullable=False)
    instruction_text = Column(Text, nullable=False)

    accepted_status = Column(
        String(30),
        nullable=False,
        default="Unknown"
    )

    preparation_advice = Column(Text, nullable=True)
    exceptions = Column(Text, nullable=True)

    source_name = Column(String(200), nullable=True)
    source_url = Column(String(1000), nullable=True)

    reviewed_by = Column(String(150), nullable=True)

    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    effective_from = Column(
        DateTime(timezone=True),
        nullable=True
    )

    effective_to = Column(
        DateTime(timezone=True),
        nullable=True
    )

    is_approved = Column(
        Boolean,
        nullable=False,
        default=False
    )

    is_archived = Column(
        Boolean,
        nullable=False,
        default=False
    )

    version = Column(
        Integer,
        nullable=False,
        default=1
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
