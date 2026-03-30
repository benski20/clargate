import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.proposal import Proposal
from app.models.review import AssignmentStatus, Review, ReviewAssignment
from app.models.user import User, UserRole
from app.schemas.review import ReviewAssignCreate, ReviewAssignmentOut, ReviewOut, ReviewSubmit
from app.services.audit import log_action
from app.services.email import send_reviewer_assignment

router = APIRouter(tags=["reviews"])


@router.post(
    "/proposals/{proposal_id}/assign",
    response_model=list[ReviewAssignmentOut],
    status_code=status.HTTP_201_CREATED,
)
async def assign_reviewers(
    proposal_id: uuid.UUID,
    body: ReviewAssignCreate,
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

    assignments = []
    for reviewer_id in body.reviewer_user_ids:
        reviewer_result = await db.execute(
            select(User).where(
                User.id == reviewer_id,
                User.institution_id == user.institution_id,
                User.role == UserRole.REVIEWER,
            )
        )
        reviewer = reviewer_result.scalar_one_or_none()
        if not reviewer:
            raise HTTPException(400, f"Reviewer {reviewer_id} not found or not a reviewer")

        existing = await db.execute(
            select(ReviewAssignment).where(
                ReviewAssignment.proposal_id == proposal_id,
                ReviewAssignment.reviewer_user_id == reviewer_id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        assignment = ReviewAssignment(
            proposal_id=proposal_id,
            reviewer_user_id=reviewer_id,
            assigned_by=user.id,
        )
        db.add(assignment)
        await db.flush()
        assignments.append(assignment)

        await log_action(
            db,
            institution_id=user.institution_id,
            user_id=user.id,
            action="reviewer_assigned",
            entity_type="review_assignment",
            entity_id=str(assignment.id),
            metadata={"reviewer_id": str(reviewer_id)},
        )

        await send_reviewer_assignment(
            reviewer.email, reviewer.full_name, proposal.title, str(proposal.id)
        )

    return [
        ReviewAssignmentOut(
            id=a.id,
            proposal_id=a.proposal_id,
            reviewer_user_id=a.reviewer_user_id,
            reviewer_name=a.reviewer.full_name if a.reviewer else None,
            status=a.status,
            assigned_at=a.assigned_at,
        )
        for a in assignments
    ]


@router.get("/reviews/my-assignments", response_model=list[ReviewAssignmentOut])
async def my_assignments(
    user: User = require_role(UserRole.REVIEWER),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReviewAssignment)
        .where(ReviewAssignment.reviewer_user_id == user.id)
        .order_by(ReviewAssignment.assigned_at.desc())
    )
    assignments = result.scalars().all()
    return [
        ReviewAssignmentOut(
            id=a.id,
            proposal_id=a.proposal_id,
            reviewer_user_id=a.reviewer_user_id,
            reviewer_name=user.full_name,
            status=a.status,
            assigned_at=a.assigned_at,
        )
        for a in assignments
    ]


@router.post("/reviews/{assignment_id}/submit", response_model=ReviewOut)
async def submit_review(
    assignment_id: uuid.UUID,
    body: ReviewSubmit,
    user: User = require_role(UserRole.REVIEWER),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReviewAssignment).where(
            ReviewAssignment.id == assignment_id,
            ReviewAssignment.reviewer_user_id == user.id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    if assignment.status == AssignmentStatus.SUBMITTED:
        raise HTTPException(400, "Review already submitted")

    review = Review(
        assignment_id=assignment.id,
        decision=body.decision,
        comments=body.comments,
    )
    assignment.status = AssignmentStatus.SUBMITTED
    db.add(review)
    await db.flush()

    await log_action(
        db,
        institution_id=user.institution_id,
        user_id=user.id,
        action="review_submitted",
        entity_type="review",
        entity_id=str(review.id),
        metadata={"decision": body.decision.value},
    )

    return ReviewOut(
        id=review.id,
        assignment_id=review.assignment_id,
        decision=review.decision,
        comments=review.comments,
        submitted_at=review.submitted_at,
    )


@router.get("/proposals/{proposal_id}/reviews", response_model=list[ReviewOut])
async def get_proposal_reviews(
    proposal_id: uuid.UUID,
    user: User = require_role(UserRole.ADMIN),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Review)
        .join(ReviewAssignment)
        .where(ReviewAssignment.proposal_id == proposal_id)
    )
    reviews = result.scalars().all()
    return [
        ReviewOut(
            id=r.id,
            assignment_id=r.assignment_id,
            decision=r.decision,
            comments=r.comments,
            submitted_at=r.submitted_at,
        )
        for r in reviews
    ]
