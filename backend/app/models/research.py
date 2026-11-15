from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ResearchSource(Base):
    __tablename__ = "research_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agency: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")

    documents: Mapped[list[ResearchDocument]] = relationship(
        "ResearchDocument", back_populates="source", cascade="all, delete-orphan"
    )


class ResearchDocument(Base):
    __tablename__ = "research_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("research_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section: Mapped[str] = mapped_column(String, nullable=False)
    extracted_content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    source: Mapped[ResearchSource] = relationship("ResearchSource", back_populates="documents")
    findings: Mapped[list[ResearchFinding]] = relationship(
        "ResearchFinding", back_populates="document", cascade="all, delete-orphan"
    )


class ResearchFinding(Base):
    __tablename__ = "research_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("research_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    health_domain: Mapped[str] = mapped_column(String, nullable=False)
    hazard: Mapped[str | None] = mapped_column(String, nullable=True)
    risk: Mapped[str | None] = mapped_column(String, nullable=True)
    finding: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_type: Mapped[str] = mapped_column(String, nullable=False)
    supporting_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_reference: Mapped[str | None] = mapped_column(String, nullable=True)

    document: Mapped[ResearchDocument] = relationship(
        "ResearchDocument", back_populates="findings"
    )
    mappings: Mapped[list[ResearchMapping]] = relationship(
        "ResearchMapping", back_populates="finding", cascade="all, delete-orphan"
    )


class RiskKnowledge(Base):
    __tablename__ = "risk_knowledge"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    risk_name: Mapped[str] = mapped_column(String, nullable=False)
    associated_hazard: Mapped[str | None] = mapped_column(String, nullable=True)
    health_domain: Mapped[str] = mapped_column(String, nullable=False)
    relevant_indicators: Mapped[str] = mapped_column(Text, nullable=False)
    monitoring_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_references: Mapped[str | None] = mapped_column(Text, nullable=True)


class ResearchMapping(Base):
    __tablename__ = "research_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    finding_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("research_findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric_name: Mapped[str] = mapped_column(String, nullable=False)
    monitoring_domain: Mapped[str] = mapped_column(String, nullable=False)
    relevance: Mapped[str] = mapped_column(String, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    finding: Mapped[ResearchFinding] = relationship("ResearchFinding", back_populates="mappings")
