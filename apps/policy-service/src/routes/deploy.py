from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from pydantic import BaseModel

from src.db import get_db
from src.models.rule import Rule

router = APIRouter()

class DeployRequest(BaseModel):
    rule_uuid: Optional[str] = None  # If None, deploy all staging rules

class DeployResponse(BaseModel):
    message: str
    deployed_rule_uuids: List[str]

@router.post("", response_model=DeployResponse)
async def deploy_rules(
    request: DeployRequest,
    tenant_id: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    query = select(Rule).where(
        Rule.tenant_id == tenant_id,
        Rule.status == "staging",
        Rule.is_active == True
    )
    if request.rule_uuid:
        query = query.where(Rule.rule_uuid == request.rule_uuid)
        
    result = await db.execute(query)
    staging_rules = result.scalars().all()
    
    if not staging_rules:
        return DeployResponse(message="No rules in staging to deploy", deployed_rule_uuids=[])
    
    deployed_uuids = []
    for r in staging_rules:
        # Mark current staging rule as production
        r.status = "production"
        deployed_uuids.append(r.rule_uuid)
        
        # Optionally, mark older production versions of this rule_uuid as archive or inactive,
        # but since we filter by version descending, the latest version in production is automatically resolved.
    
    await db.commit()
    return DeployResponse(
        message=f"Successfully deployed {len(deployed_uuids)} rule(s) to production",
        deployed_rule_uuids=list(set(deployed_uuids))
    )
