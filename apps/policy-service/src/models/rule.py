import datetime
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float
from src.db import Base

class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_uuid = Column(String(36), default=lambda: str(uuid.uuid4()), nullable=False)
    tenant_id = Column(String(50), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    guard = Column(String(50), nullable=False)  # performance, cost, responsibility
    field = Column(String(50), nullable=False)  # score, entity_type, etc.
    operator = Column(String(20), nullable=False)  # >, <, contains, eq
    threshold = Column(String(255), nullable=False)
    action = Column(String(50), nullable=False)  # block, flag, redact, reroute
    version = Column(Integer, default=1, nullable=False)
    status = Column(String(20), default="staging", nullable=False)  # staging, production
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
