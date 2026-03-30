from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

import time

import httpx

bearer_scheme = HTTPBearer()

_jwks_cache: dict | None = None
_jwks_cache_expires_at: float = 0.0


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_expires_at
    now = time.time()
    if _jwks_cache and now < _jwks_cache_expires_at:
        return _jwks_cache

    jwks_url = (
        settings.SUPABASE_JWKS_URL
        or (
            f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
            if settings.SUPABASE_URL
            else ""
        )
    )
    if not jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase JWKS URL is not configured",
        )

    async with httpx.AsyncClient(timeout=5.0) as client:
        res = await client.get(jwks_url)
        res.raise_for_status()
        jwks = res.json()

    _jwks_cache = jwks
    _jwks_cache_expires_at = now + 600  # 10 minutes
    return jwks


async def _decode_supabase_jwt(token: str) -> dict:
    """
    Supports both legacy HS256 (shared secret) and modern Supabase signing keys (JWKS; e.g. ES256).
    """
    try:
        header = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {e}",
        )

    alg = header.get("alg")
    kid = header.get("kid")

    audience = settings.SUPABASE_JWT_AUDIENCE
    issuer = settings.SUPABASE_JWT_ISSUER or (
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if settings.SUPABASE_URL else None
    )

    if alg == "HS256" and settings.SUPABASE_JWT_SECRET:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=audience,
            issuer=issuer,
            options={"verify_iss": issuer is not None},
        )

    jwks = await _get_jwks()
    keys = jwks.get("keys", [])
    if not kid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT missing kid")
    if not alg:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT missing alg")

    key_dict = next((k for k in keys if k.get("kid") == kid), None)
    if not key_dict:
        # refresh once in case of rotation
        global _jwks_cache_expires_at
        _jwks_cache_expires_at = 0.0
        jwks = await _get_jwks()
        keys = jwks.get("keys", [])
        key_dict = next((k for k in keys if k.get("kid") == kid), None)
        if not key_dict:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown JWT kid")

    try:
        public_key = jwk.construct(key_dict, algorithm=alg)
        pem = public_key.to_pem().decode("utf-8")
        return jwt.decode(
            token,
            pem,
            algorithms=[alg],
            audience=audience,
            issuer=issuer,
            options={"verify_iss": issuer is not None},
        )
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = credentials.credentials
    try:
        payload = await _decode_supabase_jwt(token)
        supabase_uid: str | None = payload.get("sub")
        if supabase_uid is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing sub claim",
            )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )

    result = await db.execute(select(User).where(User.supabase_uid == supabase_uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Complete registration first.",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str):
    async def _check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' not allowed. Required: {roles}",
            )
        return user

    return Depends(_check)
