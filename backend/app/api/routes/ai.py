import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.proposal import AISSummary, Proposal
from app.models.review import Review, ReviewAssignment
from app.models.user import User, UserRole
from app.schemas.letter import AIAssistantRequest, DraftRevisionLetterRequest, LetterOut
from app.models.letter import Letter, LetterType
from app.services.ai import draft_revision_letter, pi_assistant_stream, summarize_proposal
from app.services.audit import log_action

router = APIRouter(tags=["ai"])


@router.post("/proposals/{proposal_id}/summarize")
async def generate_summary(
    proposal_id: uuid.UUID,
    user: User = require_role(UserRole.ADMIN),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal).where(
            Proposal.id == proposal_id,
            Proposal.institution_id == user.institution_id,
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(404, "Proposal not found")

    summary_data = await summarize_proposal(proposal.form_data or {}, proposal.title)

    ai_summary = AISSummary(
        proposal_id=proposal.id,
        summary=summary_data,
        model_used="gpt-4o",
    )
    db.add(ai_summary)
    await db.flush()

    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="ai_summary_generated",
        entity_type="ai_summary",
        entity_id=str(ai_summary.id),
    )

    return {"id": ai_summary.id, "summary": summary_data}


@router.post("/proposals/{proposal_id}/draft-revision-letter", response_model=LetterOut)
async def generate_revision_letter(
    proposal_id: uuid.UUID,
    body: DraftRevisionLetterRequest,
    user: User = require_role(UserRole.ADMIN),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal).where(
            Proposal.id == proposal_id,
            Proposal.institution_id == user.institution_id,
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(404, "Proposal not found")

    reviews_result = await db.execute(
        select(Review)
        .join(ReviewAssignment)
        .where(ReviewAssignment.proposal_id == proposal_id)
    )
    reviews = reviews_result.scalars().all()
    if not reviews:
        raise HTTPException(400, "No reviews submitted for this proposal yet")

    reviewer_comments = [
        {"decision": r.decision.value, "comments": r.comments} for r in reviews
    ]

    letter_content = await draft_revision_letter(
        proposal.title,
        proposal.form_data or {},
        reviewer_comments,
        body.additional_instructions,
    )

    letter = Letter(
        proposal_id=proposal.id,
        type=LetterType.REVISION,
        content=letter_content,
        generated_by_ai=True,
        edited_by=user.id,
    )
    db.add(letter)
    await db.flush()

    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="revision_letter_drafted",
        entity_type="letter",
        entity_id=str(letter.id),
    )
    await db.refresh(letter)
    return letter


@router.post("/proposals/{proposal_id}/assistant")
async def pi_assistant(
    proposal_id: uuid.UUID,
    body: AIAssistantRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal).where(
            Proposal.id == proposal_id,
            Proposal.institution_id == user.institution_id,
            Proposal.pi_user_id == user.id,
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(404, "Proposal not found")

    async def event_stream():
        async for chunk in pi_assistant_stream(
            body.question,
            form_data=proposal.form_data,
            section_context=body.section_context,
        ):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
