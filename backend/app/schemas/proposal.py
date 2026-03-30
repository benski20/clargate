import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.proposal import ProposalStatus, ReviewType


class ProposalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    review_type: ReviewType | None = None
    form_data: dict | None = None


class ProposalUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    review_type: ReviewType | None = None
    form_data: dict | None = None


class ProposalStatusUpdate(BaseModel):
    status: ProposalStatus


class ProposalDocumentOut(BaseModel):
    id: uuid.UUID
    file_name: str
    file_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class ProposalOut(BaseModel):
    id: uuid.UUID
    institution_id: uuid.UUID
    pi_user_id: uuid.UUID
    pi_name: str | None = None
    title: str
    review_type: ReviewType | None
    status: ProposalStatus
    form_data: dict | None
    submitted_at: datetime | None
    updated_at: datetime
    created_at: datetime
    document_count: int = 0

    model_config = {"from_attributes": True}


class ProposalDetail(ProposalOut):
    documents: list[ProposalDocumentOut] = []


class UploadUrlResponse(BaseModel):
    upload_url: str
    document_id: uuid.UUID
    s3_key: str


class DownloadUrlResponse(BaseModel):
    download_url: str
    file_name: str
