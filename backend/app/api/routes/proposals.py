import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.proposal import ALLOWED_TRANSITIONS, Proposal, ProposalDocument, ProposalStatus
from app.models.review import ReviewAssignment
from app.models.user import User, UserRole
from app.schemas.proposal import (
    DownloadUrlResponse,
    ProposalCreate,
    ProposalDetail,
    ProposalOut,
    ProposalStatusUpdate,
    ProposalUpdate,
    UploadUrlResponse,
)
from app.services.audit import log_action
from app.services.storage import create_presigned_download_url, create_presigned_upload_url, generate_s3_key

router = APIRouter(prefix="/proposals", tags=["proposals"])


@router.post("", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    body: ProposalCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    proposal = Proposal(
        institution_id=user.institution_id,
        pi_user_id=user.id,
        title=body.title,
        review_type=body.review_type,
        form_data=body.form_data or {},
        status=ProposalStatus.DRAFT,
    )
    db.add(proposal)
    await db.flush()
    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="proposal_created",
        entity_type="proposal",
        entity_id=str(proposal.id),
    )
    await db.refresh(proposal)
    return _to_proposal_out(proposal)


@router.get("", response_model=list[ProposalOut])
async def list_proposals(
    user: CurrentUser,
    status_filter: ProposalStatus | None = Query(None, alias="status"),
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Proposal).where(Proposal.institution_id == user.institution_id)

    if user.role == UserRole.PI:
        query = query.where(Proposal.pi_user_id == user.id)
    elif user.role == UserRole.REVIEWER:
        query = query.join(ReviewAssignment).where(
            ReviewAssignment.reviewer_user_id == user.id
        )

    if status_filter:
        query = query.where(Proposal.status == status_filter)
    if search:
        query = query.where(Proposal.title.ilike(f"%{search}%"))

    query = query.order_by(Proposal.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    proposals = result.scalars().all()
    return [_to_proposal_out(p) for p in proposals]


@router.get("/{proposal_id}", response_model=ProposalDetail)
async def get_proposal(
    proposal_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    proposal = await _get_proposal_for_user(proposal_id, user, db)
    docs = [d for d in proposal.documents if not d.is_deleted]
    out = ProposalDetail(
        **_to_proposal_out(proposal).model_dump(),
        documents=[
            {"id": d.id, "file_name": d.file_name, "file_type": d.file_type, "uploaded_at": d.uploaded_at}
            for d in docs
        ],
    )
    return out


@router.patch("/{proposal_id}", response_model=ProposalOut)
async def update_proposal(
    proposal_id: uuid.UUID,
    body: ProposalUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    proposal = await _get_proposal_for_user(proposal_id, user, db)
    if proposal.status not in (ProposalStatus.DRAFT, ProposalStatus.REVISIONS_REQUESTED):
        raise HTTPException(400, "Proposal can only be edited in draft or revisions_requested state")
    if body.title is not None:
        proposal.title = body.title
    if body.review_type is not None:
        proposal.review_type = body.review_type
    if body.form_data is not None:
        proposal.form_data = body.form_data
    await db.flush()
    await db.refresh(proposal)
    return _to_proposal_out(proposal)


@router.post("/{proposal_id}/submit", response_model=ProposalOut)
async def submit_proposal(
    proposal_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    proposal = await _get_proposal_for_user(proposal_id, user, db)
    if proposal.status != ProposalStatus.DRAFT:
        raise HTTPException(400, "Only draft proposals can be submitted")
    proposal.status = ProposalStatus.SUBMITTED
    proposal.submitted_at = datetime.now(timezone.utc)
    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="proposal_submitted",
        entity_type="proposal",
        entity_id=str(proposal.id),
    )
    await db.flush()
    await db.refresh(proposal)
    return _to_proposal_out(proposal)


@router.post("/{proposal_id}/resubmit", response_model=ProposalOut)
async def resubmit_proposal(
    proposal_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    proposal = await _get_proposal_for_user(proposal_id, user, db)
    if proposal.status != ProposalStatus.REVISIONS_REQUESTED:
        raise HTTPException(400, "Only proposals with revisions requested can be resubmitted")
    proposal.status = ProposalStatus.RESUBMITTED
    proposal.submitted_at = datetime.now(timezone.utc)
    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="proposal_resubmitted",
        entity_type="proposal",
        entity_id=str(proposal.id),
    )
    await db.flush()
    await db.refresh(proposal)
    return _to_proposal_out(proposal)


@router.patch("/{proposal_id}/status", response_model=ProposalOut)
async def update_proposal_status(
    proposal_id: uuid.UUID,
    body: ProposalStatusUpdate,
    user: User = require_role(UserRole.ADMIN),
    db: AsyncSession = Depends(get_db),
):
    proposal = await _get_proposal_for_user(proposal_id, user, db)
    allowed = ALLOWED_TRANSITIONS.get(proposal.status, [])
    if body.status not in allowed:
        raise HTTPException(
            400,
            f"Cannot transition from {proposal.status.value} to {body.status.value}. "
            f"Allowed: {[s.value for s in allowed]}",
        )
    proposal.status = body.status
    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="proposal_status_changed",
        entity_type="proposal",
        entity_id=str(proposal.id),
        metadata={"new_status": body.status.value},
    )
    await db.flush()
    await db.refresh(proposal)
    return _to_proposal_out(proposal)


# --- Document endpoints ---

@router.post("/{proposal_id}/documents/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    proposal_id: uuid.UUID,
    file_name: str = Query(...),
    file_type: str = Query(...),
    user: CurrentUser = Depends(),
    db: AsyncSession = Depends(get_db),
):
    proposal = await _get_proposal_for_user(proposal_id, user, db)
    s3_key = generate_s3_key(proposal.id, file_name)
    upload_url = create_presigned_upload_url(s3_key)

    doc = ProposalDocument(
        proposal_id=proposal.id,
        file_name=file_name,
        s3_key=s3_key,
        file_type=file_type,
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()
    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="document_uploaded",
        entity_type="proposal_document",
        entity_id=str(doc.id),
    )
    return UploadUrlResponse(upload_url=upload_url, document_id=doc.id, s3_key=s3_key)


@router.get("/{proposal_id}/documents/{doc_id}/download-url", response_model=DownloadUrlResponse)
async def get_download_url(
    proposal_id: uuid.UUID,
    doc_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_proposal_for_user(proposal_id, user, db)
    result = await db.execute(
        select(ProposalDocument).where(
            ProposalDocument.id == doc_id,
            ProposalDocument.proposal_id == proposal_id,
            ProposalDocument.is_deleted == False,  # noqa: E712
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    download_url = create_presigned_download_url(doc.s3_key)
    return DownloadUrlResponse(download_url=download_url, file_name=doc.file_name)


@router.delete("/{proposal_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    proposal_id: uuid.UUID,
    doc_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    proposal = await _get_proposal_for_user(proposal_id, user, db)
    result = await db.execute(
        select(ProposalDocument).where(
            ProposalDocument.id == doc_id,
            ProposalDocument.proposal_id == proposal_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.is_deleted = True


# --- Helpers ---

async def _get_proposal_for_user(
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
        assignment_result = await db.execute(
            select(ReviewAssignment).where(
                ReviewAssignment.proposal_id == proposal_id,
                ReviewAssignment.reviewer_user_id == user.id,
            )
        )
        if not assignment_result.scalar_one_or_none():
            raise HTTPException(403, "Not assigned to this proposal")
    return proposal


def _to_proposal_out(p: Proposal) -> ProposalOut:
    return ProposalOut(
        id=p.id,
        institution_id=p.institution_id,
        pi_user_id=p.pi_user_id,
        pi_name=p.pi.full_name if p.pi else None,
        title=p.title,
        review_type=p.review_type,
        status=p.status,
        form_data=p.form_data,
        submitted_at=p.submitted_at,
        updated_at=p.updated_at,
        created_at=p.created_at,
        document_count=len([d for d in p.documents if not d.is_deleted]) if p.documents else 0,
    )
