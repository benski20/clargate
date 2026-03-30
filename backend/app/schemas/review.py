import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.review import AssignmentStatus, ReviewDecision


class ReviewAssignCreate(BaseModel):
    reviewer_user_ids: list[uuid.UUID]


class ReviewSubmit(BaseModel):
    decision: ReviewDecision
    comments: dict


class ReviewAssignmentOut(BaseModel):
    id: uuid.UUID
    proposal_id: uuid.UUID
    reviewer_user_id: uuid.UUID
    reviewer_name: str | None = None
    status: AssignmentStatus
    assigned_at: datetime

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    decision: ReviewDecision
    comments: dict
    submitted_at: datetime

    model_config = {"from_attributes": True}
