
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

load_dotenv()

# Password hashing configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)


def hash_password(password: str) -> str:
    """Securely hash a user's password."""
    if not password:
        raise ValueError("Password cannot be empty.")

    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password cannot exceed 72 bytes.")

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Verify a password against its stored hash."""
    try:
        return pwd_context.verify(
            plain_password,
            hashed_password
        )
    except (ValueError, TypeError):
        return False


def create_access_token(
    user_id: int,
    expires_delta: timedelta | None = None
) -> str:
    """Create a signed JWT access token."""
    if not JWT_SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY is missing from the .env file."
        )

    if expires_delta is None:
        expires_delta = timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    expire = datetime.now(timezone.utc) + expires_delta

    payload = {
        "sub": str(user_id),
        "exp": expire
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict | None:
    """Decode and validate a JWT access token."""
    if not JWT_SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY is missing from the .env file."
        )

    try:
        return jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )
    except JWTError:
        return None
