import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: str | None
    metadata_: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogQuery(BaseModel):
    entity_type: str | None = None
    user_id: uuid.UUID | None = None
    action: str | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    page: int = 1
    page_size: int = 50
