import os
import re
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="ControlPlane Tri-Guard Evaluation Service")

# Try to load Presidio, fallback to regex if not available or model load fails
try:
    from presidio_analyzer import AnalyzerEngine
    presidio_analyzer = AnalyzerEngine()
except Exception as e:
    print(f"Presidio load warning: {e}. Falling back to native regex scanning.")
    presidio_analyzer = None

# Regex patterns for common PII
PII_PATTERNS = {
    "EMAIL": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    "PHONE_NUMBER": re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "CREDIT_CARD": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")
}

class EvaluateRequest(BaseModel):
    text: str
    model: str = "unknown"

class PerformanceGuardResponse(BaseModel):
    score: float

class CostGuardResponse(BaseModel):
    tokens: int
    density: float

class ResponsibilityGuardResponse(BaseModel):
    has_pii: bool
    redacted_text: str
    matched_entities: List[str]

class EvaluateResponse(BaseModel):
    performance: PerformanceGuardResponse
    cost: CostGuardResponse
    responsibility: ResponsibilityGuardResponse

@app.get("/health")
def health():
    return {"status": "ok", "service": "tri-guard"}

def evaluate_performance(text: str) -> float:
    # Heuristics: search for hedging/apologies or quality indicators
    text_lower = text.lower()
    score = 85.0  # Base line score
    
    hedges = ["apologize", "sorry", "cannot fulfill", "unable to", "error", "failed"]
    for hedge in hedges:
        if hedge in text_lower:
            score -= 15.0
            
    # Keep score between 0 and 100
    return max(0.0, min(100.0, score))

def evaluate_cost(text: str) -> Dict[str, Any]:
    # Approximate tokens using standard ~4 chars per token rule
    word_count = len(text.split())
    char_count = len(text)
    tokens = max(1, int(char_count / 4))
    
    # Semantic density: ratio of unique words to total words
    if word_count > 0:
        unique_words = len(set(text.lower().split()))
        density = round(unique_words / word_count, 3)
    else:
        density = 0.0
        
    return {
        "tokens": tokens,
        "density": density
    }

def evaluate_responsibility(text: str) -> Dict[str, Any]:
    has_pii = False
    redacted_text = text
    matched_entities = []

    # If Presidio analyzer is available, use it
    if presidio_analyzer:
        try:
            results = presidio_analyzer.analyze(text=text, language="en")
            if results:
                has_pii = True
                # Redact matched text segments
                # Sort from end to beginning to keep offsets correct
                sorted_results = sorted(results, key=lambda x: x.start, reverse=True)
                for res in sorted_results:
                    entity_type = res.entity_type
                    if entity_type not in matched_entities:
                        matched_entities.append(entity_type)
                    redacted_text = redacted_text[:res.start] + f"[REDACTED_{entity_type}]" + redacted_text[res.end:]
                return {
                    "has_pii": has_pii,
                    "redacted_text": redacted_text,
                    "matched_entities": matched_entities
                }
        except Exception as e:
            # Fallback to regex on error
            pass

    # Regex fallback
    for entity_name, pattern in PII_PATTERNS.items():
        matches = list(pattern.finditer(redacted_text))
        if matches:
            has_pii = True
            matched_entities.append(entity_name)
            # Replace occurrences from right to left
            for match in reversed(matches):
                start, end = match.span()
                redacted_text = redacted_text[:start] + f"[REDACTED_{entity_name}]" + redacted_text[end:]

    return {
        "has_pii": has_pii,
        "redacted_text": redacted_text,
        "matched_entities": matched_entities
    }

@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(payload: EvaluateRequest):
    perf_score = evaluate_performance(payload.text)
    cost_info = evaluate_cost(payload.text)
    resp_info = evaluate_responsibility(payload.text)
    
    return {
        "performance": {"score": perf_score},
        "cost": cost_info,
        "responsibility": resp_info
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
