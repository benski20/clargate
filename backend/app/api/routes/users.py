import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.user import User, UserRole
from app.schemas.user import InstitutionOut, UserInvite, UserOut, UserRoleUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/institution", tags=["institution"])


@router.get("", response_model=InstitutionOut)
async def get_institution(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    from app.models.institution import Institution

    result = await db.execute(
        select(Institution).where(Institution.id == user.institution_id)
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(404, "Institution not found")
    return institution


@router.get("/users", response_model=list[UserOut])
async def list_users(
    user: User = require_role(UserRole.ADMIN),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.institution_id == user.institution_id)
        .order_by(User.created_at.desc())
    )
    return result.scalars().all()


@router.post("/invite", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def invite_user(
    body: UserInvite,
    user: User = require_role(UserRole.ADMIN),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "User with this email already exists")

    new_user = User(
        supabase_uid=f"pending_{uuid.uuid4().hex[:12]}",
        institution_id=user.institution_id,
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        invited_by=user.id,
        is_active=False,
    )
    db.add(new_user)
    await db.flush()

    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="user_invited",
        entity_type="user",
        entity_id=str(new_user.id),
        metadata={"email": body.email, "role": body.role.value},
    )
    await db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: uuid.UUID,
    body: UserRoleUpdate,
    user: User = require_role(UserRole.ADMIN),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.institution_id == user.institution_id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    target.role = body.role
    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="user_role_changed",
        entity_type="user",
        entity_id=str(target.id),
        metadata={"new_role": body.role.value},
    )
    await db.flush()
    await db.refresh(target)
    return target
