import os
from datetime import datetime, timedelta
from typing import Optional, Union, Any
import bcrypt
import jwt
from dotenv import load_dotenv

# Load env variables
load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET", "tripmate_super_secret_jwt_signing_key_2026_change_me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

def hash_password(password: str) -> str:
    """Hashes a plain-text password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against a bcrypt hashed password."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(subject: Union[str, dict, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a JWT access token containing the subject or payload dictionary."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    if isinstance(subject, dict):
        to_encode = subject.copy()
        to_encode["exp"] = expire
    else:
        to_encode = {"exp": expire, "sub": str(subject)}

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes a JWT access token and returns payload if valid, otherwise None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
