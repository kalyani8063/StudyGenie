"""initial schema

Revision ID: 20260423_0001
Revises:
Create Date: 2026-04-23 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260423_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("education_level", sa.String(), nullable=True),
        sa.Column("study_goal", sa.String(), nullable=True),
        sa.Column("active_weekly_plan_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "student_performance",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("time_spent", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_student_performance_id"),
        "student_performance",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_student_performance_topic"),
        "student_performance",
        ["topic"],
        unique=False,
    )

    op.create_table(
        "study_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("time_spent", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(), server_default=sa.text("'manual'"), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_study_sessions_date"), "study_sessions", ["date"], unique=False)
    op.create_index(op.f("ix_study_sessions_id"), "study_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_study_sessions_topic"), "study_sessions", ["topic"], unique=False)
    op.create_index(op.f("ix_study_sessions_user_id"), "study_sessions", ["user_id"], unique=False)

    op.create_table(
        "break_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("break_type", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("study_session_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["study_session_id"], ["study_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_break_logs_break_type"), "break_logs", ["break_type"], unique=False)
    op.create_index(op.f("ix_break_logs_date"), "break_logs", ["date"], unique=False)
    op.create_index(op.f("ix_break_logs_id"), "break_logs", ["id"], unique=False)
    op.create_index(op.f("ix_break_logs_study_session_id"), "break_logs", ["study_session_id"], unique=False)
    op.create_index(op.f("ix_break_logs_topic"), "break_logs", ["topic"], unique=False)
    op.create_index(op.f("ix_break_logs_user_id"), "break_logs", ["user_id"], unique=False)

    op.create_table(
        "weekly_plans",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weekly_plans_id"), "weekly_plans", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_plans_user_id"), "weekly_plans", ["user_id"], unique=False)
    op.create_index(op.f("ix_weekly_plans_week_start"), "weekly_plans", ["week_start"], unique=False)

    op.create_table(
        "weekly_tasks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("plan_id", sa.String(), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("day", sa.String(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("priority", sa.String(), server_default=sa.text("'medium'"), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("completed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_minutes", sa.Integer(), nullable=True),
        sa.Column("linked_study_session_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["linked_study_session_id"], ["study_sessions.id"]),
        sa.ForeignKeyConstraint(["plan_id"], ["weekly_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weekly_tasks_day"), "weekly_tasks", ["day"], unique=False)
    op.create_index(op.f("ix_weekly_tasks_id"), "weekly_tasks", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_tasks_plan_id"), "weekly_tasks", ["plan_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_weekly_tasks_plan_id"), table_name="weekly_tasks")
    op.drop_index(op.f("ix_weekly_tasks_id"), table_name="weekly_tasks")
    op.drop_index(op.f("ix_weekly_tasks_day"), table_name="weekly_tasks")
    op.drop_table("weekly_tasks")

    op.drop_index(op.f("ix_weekly_plans_week_start"), table_name="weekly_plans")
    op.drop_index(op.f("ix_weekly_plans_user_id"), table_name="weekly_plans")
    op.drop_index(op.f("ix_weekly_plans_id"), table_name="weekly_plans")
    op.drop_table("weekly_plans")

    op.drop_index(op.f("ix_break_logs_user_id"), table_name="break_logs")
    op.drop_index(op.f("ix_break_logs_topic"), table_name="break_logs")
    op.drop_index(op.f("ix_break_logs_study_session_id"), table_name="break_logs")
    op.drop_index(op.f("ix_break_logs_id"), table_name="break_logs")
    op.drop_index(op.f("ix_break_logs_date"), table_name="break_logs")
    op.drop_index(op.f("ix_break_logs_break_type"), table_name="break_logs")
    op.drop_table("break_logs")

    op.drop_index(op.f("ix_study_sessions_user_id"), table_name="study_sessions")
    op.drop_index(op.f("ix_study_sessions_topic"), table_name="study_sessions")
    op.drop_index(op.f("ix_study_sessions_id"), table_name="study_sessions")
    op.drop_index(op.f("ix_study_sessions_date"), table_name="study_sessions")
    op.drop_table("study_sessions")

    op.drop_index(op.f("ix_student_performance_topic"), table_name="student_performance")
    op.drop_index(op.f("ix_student_performance_id"), table_name="student_performance")
    op.drop_table("student_performance")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
