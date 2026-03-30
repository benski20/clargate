import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.letter import LetterType


class LetterCreate(BaseModel):
    type: LetterType
    content: str
    approval_date: date | None = None
    expiration_date: date | None = None


class LetterOut(BaseModel):
    id: uuid.UUID
    proposal_id: uuid.UUID
    type: LetterType
    content: str
    generated_by_ai: bool
    sent_at: datetime | None
    approval_date: date | None
    expiration_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DraftRevisionLetterRequest(BaseModel):
    additional_instructions: str | None = None


class AIAssistantRequest(BaseModel):
    question: str
    section_context: str | None = None
