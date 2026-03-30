import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    body: str = Field(..., min_length=1)


class MessageAttachmentOut(BaseModel):
    id: uuid.UUID
    file_name: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    proposal_id: uuid.UUID
    sender_user_id: uuid.UUID
    sender_name: str | None = None
    body: str
    is_read: bool
    attachments: list[MessageAttachmentOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class InboxItem(BaseModel):
    proposal_id: uuid.UUID
    proposal_title: str
    last_message: MessageOut
    unread_count: int
