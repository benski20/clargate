import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReviewType(str, enum.Enum):
    EXEMPT = "exempt"
    EXPEDITED = "expedited"
    FULL_BOARD = "full_board"
    NOT_SURE = "not_sure"


class ProposalStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    INITIAL_REVIEW = "initial_review"
    REVISIONS_REQUESTED = "revisions_requested"
    RESUBMITTED = "resubmitted"
    UNDER_COMMITTEE_REVIEW = "under_committee_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    TABLED = "tabled"


ALLOWED_TRANSITIONS: dict[ProposalStatus, list[ProposalStatus]] = {
    ProposalStatus.DRAFT: [ProposalStatus.SUBMITTED],
    ProposalStatus.SUBMITTED: [ProposalStatus.INITIAL_REVIEW],
    ProposalStatus.INITIAL_REVIEW: [
        ProposalStatus.REVISIONS_REQUESTED,
        ProposalStatus.UNDER_COMMITTEE_REVIEW,
        ProposalStatus.APPROVED,
        ProposalStatus.REJECTED,
    ],
    ProposalStatus.REVISIONS_REQUESTED: [ProposalStatus.RESUBMITTED],
    ProposalStatus.RESUBMITTED: [ProposalStatus.INITIAL_REVIEW],
    ProposalStatus.UNDER_COMMITTEE_REVIEW: [
        ProposalStatus.APPROVED,
        ProposalStatus.REJECTED,
        ProposalStatus.TABLED,
        ProposalStatus.REVISIONS_REQUESTED,
    ],
    ProposalStatus.TABLED: [ProposalStatus.UNDER_COMMITTEE_REVIEW],
    ProposalStatus.APPROVED: [],
    ProposalStatus.REJECTED: [],
}


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=False
    )
    pi_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    review_type: Mapped[ReviewType | None] = mapped_column(
        Enum(ReviewType, name="review_type"), nullable=True
    )
    status: Mapped[ProposalStatus] = mapped_column(
        Enum(ProposalStatus, name="proposal_status"),
        nullable=False,
        default=ProposalStatus.DRAFT,
    )
    form_data: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    institution = relationship("Institution", back_populates="proposals")
    pi = relationship("User", lazy="selectin")
    documents = relationship("ProposalDocument", back_populates="proposal", lazy="selectin")
    assignments = relationship("ReviewAssignment", back_populates="proposal", lazy="selectin")
    messages = relationship("Message", back_populates="proposal", lazy="selectin")
    letters = relationship("Letter", back_populates="proposal", lazy="selectin")
    ai_summaries = relationship("AISSummary", back_populates="proposal", lazy="selectin")


class ProposalDocument(Base):
    __tablename__ = "proposal_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proposals.id"), nullable=False
    )
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(default=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    proposal = relationship("Proposal", back_populates="documents")
    uploader = relationship("User", lazy="selectin")


class AISSummary(Base):
    __tablename__ = "ai_summaries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proposals.id"), nullable=False
    )
    summary: Mapped[dict] = mapped_column(JSONB, nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    proposal = relationship("Proposal", back_populates="ai_summaries")
