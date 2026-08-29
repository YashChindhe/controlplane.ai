from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from pydantic import BaseModel
import uuid

from src.db import get_db
from src.models.rule import Rule

router = APIRouter()

# Schemas
class RuleBase(BaseModel):
    name: str
    guard: str
    field: str
    operator: str
    threshold: str
    action: str

class RuleCreate(RuleBase):
    pass

class RuleResponse(RuleBase):
    id: int
    rule_uuid: str
    tenant_id: str
    version: int
    status: str
    is_active: bool

class TemplatePack(BaseModel):
    pack_name: str
    rules: List[RuleCreate]

# Prebuilt template libraries
TEMPLATE_PACKS = {
    "gdpr": TemplatePack(
        pack_name="GDPR PII Pack",
        rules=[
            RuleCreate(name="Email Redaction", guard="responsibility", field="EMAIL_ADDRESS", operator="contains", threshold="1", action="redact"),
            RuleCreate(name="Phone Number Redaction", guard="responsibility", field="PHONE_NUMBER", operator="contains", threshold="1", action="redact"),
            RuleCreate(name="US Social Security Number Blocking", guard="responsibility", field="US_SSN", operator="contains", threshold="1", action="block"),
            RuleCreate(name="IBAN Redaction", guard="responsibility", field="IBAN", operator="contains", threshold="1", action="redact"),
            RuleCreate(name="IP Address Redaction", guard="responsibility", field="IP_ADDRESS", operator="contains", threshold="1", action="redact")
        ]
    ),
    "hipaa": TemplatePack(
        pack_name="HIPAA Data Pack",
        rules=[
            RuleCreate(name="Health ID Redaction", guard="responsibility", field="HEALTH_ID", operator="contains", threshold="1", action="redact"),
            RuleCreate(name="Medical Record Number Blocking", guard="responsibility", field="MRN", operator="contains", threshold="1", action="block")
        ]
    ),
    "eu-ai-act": TemplatePack(
        pack_name="EU AI Act Annex III Pack",
        rules=[
            RuleCreate(name="High Hallucination Blocking", guard="performance", field="hallucination_score", operator=">", threshold="70", action="block"),
            RuleCreate(name="Demographic Bias Flagging", guard="responsibility", field="bias_score", operator=">", threshold="60", action="flag")
        ]
    )
}

@router.post("", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    rule_in: RuleCreate,
    tenant_id: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    rule = Rule(
        tenant_id=tenant_id,
        name=rule_in.name,
        guard=rule_in.guard,
        field=rule_in.field,
        operator=rule_in.operator,
        threshold=rule_in.threshold,
        action=rule_in.action,
        version=1,
        status="staging",
        is_active=True
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@router.get("", response_model=List[RuleResponse])
async def list_rules(
    tenant_id: str = Header(...),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    # Retrieve the latest version of all active rules for the tenant
    query = select(Rule).where(Rule.tenant_id == tenant_id, Rule.is_active == True)
    if status:
        query = query.where(Rule.status == status)
    
    result = await db.execute(query)
    rules = result.scalars().all()
    
    # Filter to get only the highest version for each rule_uuid
    latest_rules = {}
    for r in rules:
        if r.rule_uuid not in latest_rules or r.version > latest_rules[r.rule_uuid].version:
            latest_rules[r.rule_uuid] = r
            
    return list(latest_rules.values())

@router.get("/{rule_uuid}", response_model=RuleResponse)
async def get_rule(
    rule_uuid: str,
    tenant_id: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    query = select(Rule).where(
        Rule.rule_uuid == rule_uuid,
        Rule.tenant_id == tenant_id,
        Rule.is_active == True
    ).order_by(Rule.version.desc()).limit(1)
    
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@router.put("/{rule_uuid}", response_model=RuleResponse)
async def update_rule(
    rule_uuid: str,
    rule_in: RuleCreate,
    tenant_id: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    # Fetch latest rule version
    query = select(Rule).where(
        Rule.rule_uuid == rule_uuid,
        Rule.tenant_id == tenant_id,
        Rule.is_active == True
    ).order_by(Rule.version.desc()).limit(1)
    
    result = await db.execute(query)
    current_rule = result.scalar_one_or_none()
    if not current_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Save a new version
    new_rule = Rule(
        rule_uuid=current_rule.rule_uuid,
        tenant_id=tenant_id,
        name=rule_in.name,
        guard=rule_in.guard,
        field=rule_in.field,
        operator=rule_in.operator,
        threshold=rule_in.threshold,
        action=rule_in.action,
        version=current_rule.version + 1,
        status="staging",
        is_active=True
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    return new_rule

@router.delete("/{rule_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_uuid: str,
    tenant_id: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    # Mark all versions of this rule as inactive
    query = update(Rule).where(
        Rule.rule_uuid == rule_uuid,
        Rule.tenant_id == tenant_id
    ).values(is_active=False)
    
    await db.execute(query)
    await db.commit()
    return

# Templates
@router.get("/templates/packs")
async def list_template_packs():
    return {k: v.pack_name for k, v in TEMPLATE_PACKS.items()}

@router.post("/templates/import/{pack_key}", response_model=List[RuleResponse])
async def import_template_pack(
    pack_key: str,
    tenant_id: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    if pack_key not in TEMPLATE_PACKS:
        raise HTTPException(status_code=404, detail="Template pack not found")
    
    imported_rules = []
    pack = TEMPLATE_PACKS[pack_key]
    for rule_in in pack.rules:
        rule = Rule(
            tenant_id=tenant_id,
            name=rule_in.name,
            guard=rule_in.guard,
            field=rule_in.field,
            operator=rule_in.operator,
            threshold=rule_in.threshold,
            action=rule_in.action,
            version=1,
            status="staging",
            is_active=True
        )
        db.add(rule)
        imported_rules.append(rule)
        
    await db.commit()
    for rule in imported_rules:
        await db.refresh(rule)
    return imported_rules
