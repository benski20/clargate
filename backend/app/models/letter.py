import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LetterType(str, enum.Enum):
    REVISION = "revision"
    APPROVAL = "approval"


class Letter(Base):
    __tablename__ = "letters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proposals.id"), nullable=False
    )
    type: Mapped[LetterType] = mapped_column(
        Enum(LetterType, name="letter_type"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    edited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    proposal = relationship("Proposal", back_populates="letters")
    editor = relationship("User", lazy="selectin")
