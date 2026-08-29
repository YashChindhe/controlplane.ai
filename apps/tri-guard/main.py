import os
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from guards.performance import PerformanceGuard
from guards.cost import CostGuard
from guards.responsibility import ResponsibilityGuard

app = FastAPI(title="ControlPlane Tri-Guard Evaluation Service")

# Initialize Guard Engines
performance_guard = PerformanceGuard()
cost_guard = CostGuard()
responsibility_guard = ResponsibilityGuard()

class EvaluateRequest(BaseModel):
    text: str
    model: str = "unknown"

class PerformanceGuardResponse(BaseModel):
    score: float

class CostGuardResponse(BaseModel):
    tokens: int
    density: float
    cost: float
    fit_score: float

class ResponsibilityGuardResponse(BaseModel):
    has_pii: bool
    redacted_text: str
    matched_entities: List[str]
    detected_biases: List[str]
    regulatory_tags: List[str]
    score: float

class EvaluateResponse(BaseModel):
    performance: PerformanceGuardResponse
    cost: CostGuardResponse
    responsibility: ResponsibilityGuardResponse

@app.on_event("startup")
def startup_event():
    print("Startup: Initializing ML models...")
    performance_guard.download_models()

@app.get("/health")
def health():
    # Return health with status of ML models
    return {
        "status": "ok",
        "service": "tri-guard",
        "ml_initialized": performance_guard.ml_initialized
    }

@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(payload: EvaluateRequest):
    # 1. Performance Guard
    perf_score = performance_guard.evaluate(payload.text)
    
    # 2. Cost Guard
    cost_info = cost_guard.evaluate(payload.text, payload.model)
    
    # 3. Responsibility Guard
    resp_info = responsibility_guard.evaluate(payload.text)
    
    return {
        "performance": {
            "score": perf_score
        },
        "cost": {
            "tokens": cost_info["tokens"],
            "density": cost_info["density"],
            "cost": cost_info["cost"],
            "fit_score": cost_info["score"]
        },
        "responsibility": {
            "has_pii": resp_info["has_pii"],
            "redacted_text": resp_info["redacted_text"],
            "matched_entities": resp_info["matched_entities"],
            "detected_biases": resp_info["detected_biases"],
            "regulatory_tags": resp_info["regulatory_tags"],
            "score": resp_info["score"]
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
