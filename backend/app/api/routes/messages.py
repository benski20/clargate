import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.message import Message
from app.models.proposal import Proposal
from app.models.review import ReviewAssignment
from app.models.user import User, UserRole
from app.schemas.message import InboxItem, MessageCreate, MessageOut

router = APIRouter(tags=["messages"])


@router.get("/proposals/{proposal_id}/messages", response_model=list[MessageOut])
async def get_proposal_messages(
    proposal_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _verify_proposal_access(proposal_id, user, db)
    result = await db.execute(
        select(Message)
        .where(Message.proposal_id == proposal_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [_to_message_out(m) for m in messages]


@router.post("/proposals/{proposal_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    proposal_id: uuid.UUID,
    body: MessageCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _verify_proposal_access(proposal_id, user, db)
    message = Message(
        proposal_id=proposal_id,
        sender_user_id=user.id,
        body=body.body,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return _to_message_out(message)


@router.get("/messages/inbox", response_model=list[InboxItem])
async def get_inbox(
    user: User = require_role(UserRole.ADMIN),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    subq = (
        select(
            Message.proposal_id,
            func.max(Message.created_at).label("last_msg_time"),
            func.count().filter(Message.is_read == False).label("unread_count"),  # noqa: E712
        )
        .join(Proposal)
        .where(Proposal.institution_id == user.institution_id)
        .group_by(Message.proposal_id)
        .subquery()
    )

    result = await db.execute(
        select(Proposal, subq.c.last_msg_time, subq.c.unread_count)
        .join(subq, Proposal.id == subq.c.proposal_id)
        .order_by(desc(subq.c.last_msg_time))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for row in result.all():
        proposal = row[0]
        unread_count = row[2] or 0

        last_msg_result = await db.execute(
            select(Message)
            .where(Message.proposal_id == proposal.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()
        if last_msg:
            items.append(
                InboxItem(
                    proposal_id=proposal.id,
                    proposal_title=proposal.title,
                    last_message=_to_message_out(last_msg),
                    unread_count=unread_count,
                )
            )
    return items


async def _verify_proposal_access(
    proposal_id: uuid.UUID, user: User, db: AsyncSession
) -> Proposal:
    result = await db.execute(
        select(Proposal).where(
            Proposal.id == proposal_id,
            Proposal.institution_id == user.institution_id,
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    if user.role == UserRole.PI and proposal.pi_user_id != user.id:
        raise HTTPException(403, "Access denied")
    if user.role == UserRole.REVIEWER:
        ar = await db.execute(
            select(ReviewAssignment).where(
                ReviewAssignment.proposal_id == proposal_id,
                ReviewAssignment.reviewer_user_id == user.id,
            )
        )
        if not ar.scalar_one_or_none():
            raise HTTPException(403, "Not assigned to this proposal")
    return proposal


def _to_message_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        proposal_id=m.proposal_id,
        sender_user_id=m.sender_user_id,
        sender_name=m.sender.full_name if m.sender else None,
        body=m.body,
        is_read=m.is_read,
        attachments=[
            {"id": a.id, "file_name": a.file_name} for a in (m.attachments or [])
        ],
        created_at=m.created_at,
    )
