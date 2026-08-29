import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager

from src.db import Base, engine
from src.routes.rules import router as rules_router
from src.routes.deploy import router as deploy_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title="ControlPlane Policy Service",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(rules_router, prefix="/rules", tags=["Rules"])
app.include_router(deploy_router, prefix="/deploy", tags=["Deploy"])

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
