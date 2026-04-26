"""add lesson concept progress and quiz attempts

Revision ID: 20260426_0003
Revises: 20260426_0002
Create Date: 2026-04-26 00:30:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260426_0003"
down_revision = "20260426_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lesson_concept_progress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_graph_id", sa.Integer(), nullable=False),
        sa.Column("concept_key", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'not_started'")),
        sa.Column("study_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_study_minutes", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("quiz_attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("average_quiz_score", sa.Float(), nullable=True),
        sa.Column("best_quiz_score", sa.Float(), nullable=True),
        sa.Column("last_quiz_score", sa.Float(), nullable=True),
        sa.Column("last_studied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_quizzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["lesson_graph_id"], ["lesson_concept_graphs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_concept_progress_id"), "lesson_concept_progress", ["id"], unique=False)
    op.create_index(
        op.f("ix_lesson_concept_progress_lesson_graph_id"),
        "lesson_concept_progress",
        ["lesson_graph_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_concept_progress_concept_key"),
        "lesson_concept_progress",
        ["concept_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_concept_progress_user_id"),
        "lesson_concept_progress",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "lesson_quiz_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_graph_id", sa.Integer(), nullable=False),
        sa.Column("concept_key", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question", sa.String(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("response_label", sa.String(), nullable=False, server_default=sa.text("'manual'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["lesson_graph_id"], ["lesson_concept_graphs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_quiz_attempts_id"), "lesson_quiz_attempts", ["id"], unique=False)
    op.create_index(
        op.f("ix_lesson_quiz_attempts_lesson_graph_id"),
        "lesson_quiz_attempts",
        ["lesson_graph_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_quiz_attempts_concept_key"),
        "lesson_quiz_attempts",
        ["concept_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_quiz_attempts_user_id"),
        "lesson_quiz_attempts",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lesson_quiz_attempts_user_id"), table_name="lesson_quiz_attempts")
    op.drop_index(op.f("ix_lesson_quiz_attempts_concept_key"), table_name="lesson_quiz_attempts")
    op.drop_index(op.f("ix_lesson_quiz_attempts_lesson_graph_id"), table_name="lesson_quiz_attempts")
    op.drop_index(op.f("ix_lesson_quiz_attempts_id"), table_name="lesson_quiz_attempts")
    op.drop_table("lesson_quiz_attempts")

    op.drop_index(op.f("ix_lesson_concept_progress_user_id"), table_name="lesson_concept_progress")
    op.drop_index(op.f("ix_lesson_concept_progress_concept_key"), table_name="lesson_concept_progress")
    op.drop_index(op.f("ix_lesson_concept_progress_lesson_graph_id"), table_name="lesson_concept_progress")
    op.drop_index(op.f("ix_lesson_concept_progress_id"), table_name="lesson_concept_progress")
    op.drop_table("lesson_concept_progress")
