"""add concept retention graph tables

Revision ID: 20260426_0002
Revises: 20260423_0001
Create Date: 2026-04-26 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260426_0002"
down_revision = "20260423_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lesson_concept_graphs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("overview", sa.String(), nullable=False),
        sa.Column("source_name", sa.String(), nullable=True),
        sa.Column("slide_count", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_concept_graphs_id"), "lesson_concept_graphs", ["id"], unique=False)
    op.create_index(
        op.f("ix_lesson_concept_graphs_source_name"),
        "lesson_concept_graphs",
        ["source_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_concept_graphs_user_id"),
        "lesson_concept_graphs",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "lesson_concept_nodes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_graph_id", sa.Integer(), nullable=False),
        sa.Column("concept_key", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("parent_name", sa.String(), nullable=True),
        sa.Column("summary", sa.String(), nullable=False),
        sa.Column("difficulty", sa.String(), nullable=False),
        sa.Column("importance", sa.Float(), nullable=False),
        sa.Column("focus_terms", sa.JSON(), nullable=False),
        sa.Column("slide_numbers", sa.JSON(), nullable=False),
        sa.Column("related_concepts", sa.JSON(), nullable=False),
        sa.Column("search_text", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["lesson_graph_id"], ["lesson_concept_graphs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_concept_nodes_concept_key"), "lesson_concept_nodes", ["concept_key"], unique=False)
    op.create_index(op.f("ix_lesson_concept_nodes_id"), "lesson_concept_nodes", ["id"], unique=False)
    op.create_index(
        op.f("ix_lesson_concept_nodes_lesson_graph_id"),
        "lesson_concept_nodes",
        ["lesson_graph_id"],
        unique=False,
    )
    op.create_index(op.f("ix_lesson_concept_nodes_name"), "lesson_concept_nodes", ["name"], unique=False)

    op.create_table(
        "lesson_concept_edges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_graph_id", sa.Integer(), nullable=False),
        sa.Column("source_concept_key", sa.String(), nullable=False),
        sa.Column("target_concept_key", sa.String(), nullable=False),
        sa.Column("relation_type", sa.String(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["lesson_graph_id"], ["lesson_concept_graphs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_concept_edges_id"), "lesson_concept_edges", ["id"], unique=False)
    op.create_index(
        op.f("ix_lesson_concept_edges_lesson_graph_id"),
        "lesson_concept_edges",
        ["lesson_graph_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_concept_edges_source_concept_key"),
        "lesson_concept_edges",
        ["source_concept_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_concept_edges_target_concept_key"),
        "lesson_concept_edges",
        ["target_concept_key"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lesson_concept_edges_target_concept_key"), table_name="lesson_concept_edges")
    op.drop_index(op.f("ix_lesson_concept_edges_source_concept_key"), table_name="lesson_concept_edges")
    op.drop_index(op.f("ix_lesson_concept_edges_lesson_graph_id"), table_name="lesson_concept_edges")
    op.drop_index(op.f("ix_lesson_concept_edges_id"), table_name="lesson_concept_edges")
    op.drop_table("lesson_concept_edges")

    op.drop_index(op.f("ix_lesson_concept_nodes_name"), table_name="lesson_concept_nodes")
    op.drop_index(op.f("ix_lesson_concept_nodes_lesson_graph_id"), table_name="lesson_concept_nodes")
    op.drop_index(op.f("ix_lesson_concept_nodes_id"), table_name="lesson_concept_nodes")
    op.drop_index(op.f("ix_lesson_concept_nodes_concept_key"), table_name="lesson_concept_nodes")
    op.drop_table("lesson_concept_nodes")

    op.drop_index(op.f("ix_lesson_concept_graphs_user_id"), table_name="lesson_concept_graphs")
    op.drop_index(op.f("ix_lesson_concept_graphs_source_name"), table_name="lesson_concept_graphs")
    op.drop_index(op.f("ix_lesson_concept_graphs_id"), table_name="lesson_concept_graphs")
    op.drop_table("lesson_concept_graphs")
