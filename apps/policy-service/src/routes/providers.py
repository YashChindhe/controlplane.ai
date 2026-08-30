from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import uuid

from src.db import get_db
from src.models.tenant_provider import TenantProvider
from src.crypto_utils import encrypt_key, decrypt_key

router = APIRouter(prefix="/providers", tags=["Providers"])

class ProviderCreate(BaseModel):
    provider_name: str
    base_url: str | None = None
    api_key: str | None = None

class ProviderResponse(BaseModel):
    id: str
    tenant_id: str
    provider_name: str
    base_url: str | None
    api_key_configured: bool

@router.post("/{tenant_id}", response_model=ProviderResponse)
async def create_or_update_provider(tenant_id: str, provider: ProviderCreate, db: AsyncSession = Depends(get_db)):
    # Check if exists
    result = await db.execute(
        select(TenantProvider).where(TenantProvider.tenant_id == tenant_id, TenantProvider.provider_name == provider.provider_name)
    )
    existing_provider = result.scalars().first()

    encrypted_key = encrypt_key(provider.api_key) if provider.api_key else None

    if existing_provider:
        existing_provider.base_url = provider.base_url
        if encrypted_key:
            existing_provider.api_key_encrypted = encrypted_key
        await db.commit()
        await db.refresh(existing_provider)
        return ProviderResponse(
            id=existing_provider.id,
            tenant_id=existing_provider.tenant_id,
            provider_name=existing_provider.provider_name,
            base_url=existing_provider.base_url,
            api_key_configured=bool(existing_provider.api_key_encrypted)
        )
    else:
        new_provider = TenantProvider(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            provider_name=provider.provider_name,
            base_url=provider.base_url,
            api_key_encrypted=encrypted_key
        )
        db.add(new_provider)
        await db.commit()
        await db.refresh(new_provider)
        return ProviderResponse(
            id=new_provider.id,
            tenant_id=new_provider.tenant_id,
            provider_name=new_provider.provider_name,
            base_url=new_provider.base_url,
            api_key_configured=bool(new_provider.api_key_encrypted)
        )

@router.get("/{tenant_id}", response_model=list[ProviderResponse])
async def get_providers(tenant_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TenantProvider).where(TenantProvider.tenant_id == tenant_id))
    providers = result.scalars().all()
    
    return [
        ProviderResponse(
            id=p.id,
            tenant_id=p.tenant_id,
            provider_name=p.provider_name,
            base_url=p.base_url,
            api_key_configured=bool(p.api_key_encrypted)
        )
        for p in providers
    ]

@router.get("/{tenant_id}/{provider_name}/credentials")
async def get_provider_credentials(tenant_id: str, provider_name: str, db: AsyncSession = Depends(get_db)):
    # INTERNAL ENDPOINT for Gateway. Do not expose this publicly.
    result = await db.execute(
        select(TenantProvider).where(TenantProvider.tenant_id == tenant_id, TenantProvider.provider_name == provider_name)
    )
    provider = result.scalars().first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found for this tenant")

    decrypted_key = decrypt_key(provider.api_key_encrypted) if provider.api_key_encrypted else ""
    return {
        "tenant_id": tenant_id,
        "provider_name": provider_name,
        "base_url": provider.base_url,
        "api_key": decrypted_key
    }
