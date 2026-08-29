import pytest
from main import app, evaluate, EvaluateRequest, health
from guards.performance import PerformanceGuard
from guards.cost import CostGuard
from guards.responsibility import ResponsibilityGuard

def test_health():
    data = health()
    assert data["status"] == "ok"
    assert data["service"] == "tri-guard"

def test_performance_guard():
    guard = PerformanceGuard()
    
    # Test hedging penalty
    text_hedging = "I apologize, but I am not sure if we can recover the data. Perhaps we can try again."
    score = guard.evaluate(text_hedging)
    assert score < 85.0
    
    # Test overconfidence penalty
    text_overconfident = "This is absolutely the best solution, completely perfect, and 100% guaranteed to work."
    score = guard.evaluate(text_overconfident)
    assert score < 85.0

def test_cost_guard():
    guard = CostGuard()
    
    # Test token counting
    tokens_gpt = guard.count_tokens("Hello World", "gpt-4")
    assert tokens_gpt > 0
    
    # Test pricing calculation
    cost = guard.calculate_cost(1000, "gpt-4", is_output=True)
    assert cost == pytest.approx(0.06)  # 1000 * 0.00006
    
    # Test model-task fit
    fit_simple_gpt4 = guard.classify_model_task_fit("Hi", "gpt-4")
    assert fit_simple_gpt4["fit_score"] == 40.0
    assert fit_simple_gpt4["task_complexity"] == "simple"
    assert fit_simple_gpt4["model_tier"] == "high"

def test_responsibility_guard():
    guard = ResponsibilityGuard()
    
    # Test PII detection
    res = guard.evaluate("My email address is user@example.com.")
    assert res["has_pii"] is True
    assert "EMAIL" in res["matched_entities"]
    assert "[REDACTED_EMAIL]" in res["redacted_text"] or "<REDACTED_EMAIL>" in res["redacted_text"]
    
    # Test custom recognizers (IBAN, PROJECT_CODE)
    res_iban = guard.evaluate("IBAN: DE89370400440532013000")
    assert res_iban["has_pii"] is True
    assert "IBAN" in res_iban["matched_entities"]
    
    res_proj = guard.evaluate("The code is PROJECT-XYZ12")
    assert res_proj["has_pii"] is True
    assert "PROJECT_CODE" in res_proj["matched_entities"]
    
    # Test bias detection
    res_bias = guard.evaluate("boomer developers are too old and tech-challenged seniors")
    assert len(res_bias["detected_biases"]) > 0
    assert "AGE_BIAS" in res_bias["detected_biases"]
    
    # Test regulatory tagging
    assert "GDPR Article 4 (PII)" in res["regulatory_tags"]
    assert "EU AI Act Article 10 (Bias Mitigation)" in res_bias["regulatory_tags"]

def test_evaluate_endpoint():
    payload = EvaluateRequest(
        text="Hello, my email is test@domain.com. We must absolutely do this, 100% guaranteed.",
        model="gpt-4"
    )
    data = evaluate(payload)
    
    assert "performance" in data
    assert "cost" in data
    assert "responsibility" in data
    
    assert "score" in data["performance"]
    assert data["cost"]["tokens"] > 0
    assert data["responsibility"]["has_pii"] is True
