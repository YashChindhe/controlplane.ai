import os
import json
import math
from typing import Dict, Any

try:
    import tiktoken
except ImportError:
    tiktoken = None

PRICING_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "pricing.json")

class CostGuard:
    def __init__(self):
        self.pricing_table = self._load_pricing()
        
    def _load_pricing(self) -> Dict[str, Any]:
        if os.path.exists(PRICING_FILE):
            try:
                with open(PRICING_FILE, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading pricing table: {e}")
        # Default fallback pricing
        return {
            "gpt-4": {"input_cost_per_token": 0.00003, "output_cost_per_token": 0.00006},
            "gpt-4o": {"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000015},
            "gpt-3.5-turbo": {"input_cost_per_token": 0.0000015, "output_cost_per_token": 0.000002},
            "claude-3-opus-20240229": {"input_cost_per_token": 0.000015, "output_cost_per_token": 0.000075},
            "claude-3-5-sonnet-20240620": {"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015},
            "claude-3-haiku-20240307": {"input_cost_per_token": 0.00000025, "output_cost_per_token": 0.00000125},
            "unknown": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000002}
        }

    def count_tokens(self, text: str, model: str) -> int:
        """Accurately count tokens using tiktoken (or fallback) based on the model."""
        if not text:
            return 0
            
        if tiktoken:
            try:
                # Try getting the specific encoding
                if "gpt-4" in model or "gpt-3.5" in model or "o1" in model:
                    encoding = tiktoken.encoding_for_model(model)
                else:
                    encoding = tiktoken.get_encoding("cl100k_base")
                return len(encoding.encode(text))
            except Exception:
                # Fallback to cl100k_base
                try:
                    encoding = tiktoken.get_encoding("cl100k_base")
                    return len(encoding.encode(text))
                except Exception:
                    pass
        
        # General character-based approximation if tiktoken is not available
        return max(1, int(len(text) / 4))

    def calculate_cost(self, tokens: int, model: str, is_output: bool = True) -> float:
        """Look up the pricing table and return the calculated cost of the request."""
        # Find best matching model prefix in pricing table
        pricing = self.pricing_table.get("unknown")
        for key in self.pricing_table:
            if key in model:
                pricing = self.pricing_table[key]
                break
                
        cost_key = "output_cost_per_token" if is_output else "input_cost_per_token"
        cost_per_token = pricing.get(cost_key, 0.000002)
        return float(tokens * cost_per_token)

    def calculate_semantic_density(self, text: str, tokens: int) -> float:
        """Calculates information entropy / token count ratio to measure redundancy."""
        if not text or tokens <= 0:
            return 0.0
            
        words = text.lower().split()
        if not words:
            return 0.0
            
        # Calculate word frequency for Shannon Entropy
        freq = {}
        for word in words:
            freq[word] = freq.get(word, 0) + 1
            
        entropy = 0.0
        total_words = len(words)
        for count in freq.values():
            p = count / total_words
            entropy -= p * math.log2(p)
            
        # Return entropy normalized or a density metric
        # High density means rich information (low repetition)
        # Low density means high repetition/redundancy
        return round(entropy / max(1.0, math.log2(total_words + 1)), 3)

    def classify_model_task_fit(self, text: str, model: str) -> Dict[str, Any]:
        """Classify task complexity vs model capability and return fit rating (0 to 100)."""
        # Determine Task Complexity
        char_count = len(text)
        word_count = len(text.split())
        
        # Simple heuristics for complexity
        has_code = "```" in text or "def " in text or "function" in text or "import " in text
        has_complex_punctuation = "{" in text or "[" in text or "=>" in text
        
        if word_count < 15 and not has_code:
            task_complexity = "simple"
        elif has_code or word_count > 150 or has_complex_punctuation:
            task_complexity = "complex"
        else:
            task_complexity = "medium"
            
        # Determine Model Capability Tier
        model_lower = model.lower()
        if "gpt-4" in model_lower or "opus" in model_lower or "sonnet" in model_lower:
            model_tier = "high"
        elif "gpt-3.5" in model_lower or "haiku" in model_lower:
            model_tier = "medium"
        else:
            model_tier = "low"
            
        # Evaluate Fit
        fit_score = 100.0
        reason = "Optimal model selected for task complexity."
        
        if task_complexity == "simple" and model_tier == "high":
            # Overkill! Lower fit score
            fit_score = 40.0
            reason = "Inefficient model selection: High-capability model used for a simple task."
        elif task_complexity == "complex" and model_tier == "low":
            # Underpowered! Lower fit score
            fit_score = 60.0
            reason = "Suboptimal model selection: Low-capability model used for a complex task."
            
        return {
            "task_complexity": task_complexity,
            "model_tier": model_tier,
            "fit_score": fit_score,
            "reason": reason
        }

    def evaluate(self, text: str, model: str) -> Dict[str, Any]:
        """Runs Cost Guard evaluation pipeline."""
        tokens = self.count_tokens(text, model)
        cost = self.calculate_cost(tokens, model)
        density = self.calculate_semantic_density(text, tokens)
        fit_info = self.classify_model_task_fit(text, model)
        
        # Overall cost score is influenced by model task fit
        cost_efficiency_score = fit_info["fit_score"]
        
        return {
            "tokens": tokens,
            "cost": cost,
            "density": density,
            "fit": fit_info,
            "score": cost_efficiency_score
        }
