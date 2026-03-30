"""Initial schema

Revision ID: 001
Revises: None
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    op.create_table(
        "institutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("settings", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute("""
        CREATE TYPE user_role AS ENUM ('admin', 'reviewer', 'pi')
    """)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("supabase_uid", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("institutions.id"), nullable=False),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("admin", "reviewer", "pi", name="user_role", create_type=False), nullable=False, server_default="pi"),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute("CREATE TYPE review_type AS ENUM ('exempt', 'expedited', 'full_board', 'not_sure')")
    op.execute("""
        CREATE TYPE proposal_status AS ENUM (
            'draft', 'submitted', 'initial_review', 'revisions_requested',
            'resubmitted', 'under_committee_review', 'approved', 'rejected', 'tabled'
        )
    """)
    op.create_table(
        "proposals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("institutions.id"), nullable=False),
        sa.Column("pi_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("review_type", sa.Enum("exempt", "expedited", "full_board", "not_sure", name="review_type", create_type=False), nullable=True),
        sa.Column("status", sa.Enum("draft", "submitted", "initial_review", "revisions_requested", "resubmitted", "under_committee_review", "approved", "rejected", "tabled", name="proposal_status", create_type=False), nullable=False, server_default="draft"),
        sa.Column("form_data", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "proposal_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("proposal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proposals.id"), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("s3_key", sa.String(1000), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false")),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute("CREATE TYPE assignment_status AS ENUM ('not_started', 'in_progress', 'submitted')")
    op.create_table(
        "review_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("proposal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proposals.id"), nullable=False),
        sa.Column("reviewer_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.Enum("not_started", "in_progress", "submitted", name="assignment_status", create_type=False), nullable=False, server_default="not_started"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.execute("CREATE TYPE review_decision AS ENUM ('approve', 'minor_modifications', 'revisions_required', 'reject', 'table')")
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("review_assignments.id"), unique=True, nullable=False),
        sa.Column("decision", sa.Enum("approve", "minor_modifications", "revisions_required", "reject", "table", name="review_decision", create_type=False), nullable=False),
        sa.Column("comments", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("proposal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proposals.id"), nullable=False),
        sa.Column("sender_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "message_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id"), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("s3_key", sa.String(1000), nullable=False),
    )

    op.execute("CREATE TYPE letter_type AS ENUM ('revision', 'approval')")
    op.create_table(
        "letters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("proposal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proposals.id"), nullable=False),
        sa.Column("type", sa.Enum("revision", "approval", name="letter_type", create_type=False), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("generated_by_ai", sa.Boolean, server_default=sa.text("false")),
        sa.Column("edited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_date", sa.Date, nullable=True),
        sa.Column("expiration_date", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "ai_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("proposal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proposals.id"), nullable=False),
        sa.Column("summary", postgresql.JSONB, nullable=False),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("institutions.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(255), nullable=True),
        sa.Column("metadata", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("proposal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proposals.id"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Enforce append-only audit log: prevent UPDATE and DELETE
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is append-only: UPDATE and DELETE are not allowed';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER audit_log_no_update
        BEFORE UPDATE OR DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    """)

    # Indexes for common queries
    op.create_index("ix_proposals_institution_status", "proposals", ["institution_id", "status"])
    op.create_index("ix_proposals_pi_user_id", "proposals", ["pi_user_id"])
    op.create_index("ix_messages_proposal_id", "messages", ["proposal_id", "created_at"])
    op.create_index("ix_audit_log_institution_created", "audit_log", ["institution_id", "created_at"])
    op.create_index("ix_review_assignments_reviewer", "review_assignments", ["reviewer_user_id"])
    op.create_index("ix_reminders_scheduled", "reminders", ["scheduled_for"])


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_modification()")

    tables = [
        "reminders", "audit_log", "ai_summaries", "letters",
        "message_attachments", "messages", "reviews", "review_assignments",
        "proposal_documents", "proposals", "users", "institutions",
    ]
    for table in tables:
        op.drop_table(table)

    for enum_name in [
        "letter_type", "review_decision", "assignment_status",
        "proposal_status", "review_type", "user_role",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
