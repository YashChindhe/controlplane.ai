import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager

from src.db import Base, engine
from src.routes.rules import router as rules_router
from src.routes.deploy import router as deploy_router
from src.routes.providers import router as providers_router

from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select
from src.models.rule import Rule
from src.models.tenant_provider import TenantProvider

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Seed basic rules if table is empty
    from src.db import async_session_maker
    from src.models.rule import Rule
    from sqlalchemy import select
    
    async with async_session_maker() as session:
        # Check if default rules exist
        result = await session.execute(select(Rule).where(Rule.tenant_id == "default"))
        existing = result.scalars().first()
        if not existing:
            default_rules = [
                Rule(tenant_id="default", name="Redact US Phone Numbers", guard="responsibility", field="PHONE_NUMBER", operator="contains", threshold="1", action="redact", version=1, status="production", is_active=True),
                Rule(tenant_id="default", name="Block Hallucination > 80%", guard="performance", field="hallucination_score", operator=">", threshold="80", action="block", version=1, status="staging", is_active=True),
                Rule(tenant_id="default", name="Flag High Cost Requests", guard="cost", field="projected_cost", operator=">", threshold="2.50", action="flag", version=1, status="production", is_active=True)
            ]
            session.add_all(default_rules)
        await session.commit()
            
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title="ControlPlane Policy Service",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rules_router, prefix="/rules", tags=["Rules"])
app.include_router(deploy_router, prefix="/deploy", tags=["Deploy"])
app.include_router(providers_router, prefix="/api", tags=["Providers"])

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    # Run as 'python src/main.py' from /app — module path must include 'src.'
    uvicorn.run("src.main:app", host="0.0.0.0", port=8001, reload=True)
