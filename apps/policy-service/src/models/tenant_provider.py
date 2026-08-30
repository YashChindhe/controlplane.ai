from sqlalchemy import Column, String, DateTime
from datetime import datetime
from src.db import Base

class TenantProvider(Base):
    __tablename__ = "tenant_providers"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True, nullable=False)
    provider_name = Column(String, nullable=False) # e.g., 'openai', 'anthropic', 'custom'
    base_url = Column(String, nullable=True)
    api_key_encrypted = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
