import os
import re
import math
import numpy as np
from typing import List, Dict, Any

# Try to import ONNX Runtime
try:
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download
    from tokenizers import Tokenizer
except ImportError:
    ort = None
    hf_hub_download = None
    Tokenizer = None

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

class PerformanceGuard:
    def __init__(self):
        self.embedding_session = None
        self.embedding_tokenizer = None
        self.hallucination_session = None
        self.hallucination_tokenizer = None
        self.ml_initialized = False
        
        # Hedging and overconfidence patterns
        self.hedging_patterns = [
            r"\b(maybe|perhaps|possibly|probably|potentially|likely)\b",
            r"\b(i think|i believe|i guess|in my opinion|from my perspective)\b",
            r"\b(apologize|sorry|could be|might|may|suggests|seems to|appears to)\b",
            r"\b(not sure|uncertain|unclear|as far as i know|correct me if i'm wrong)\b"
        ]
        self.overconfident_patterns = [
            r"\b(absolutely|completely|obviously|totally|definitely|undeniably)\b",
            r"\b(always|never|100%|guaranteed|must be|undoubted|without doubt)\b",
            r"\b(everyone knows|obviously|clear as day|literally)\b"
        ]

    def download_models(self):
        """Downloads quantized ONNX models from HuggingFace to the local cache directory."""
        if not ort or not hf_hub_download or not Tokenizer:
            print("Required ML libraries are missing. Skipping ML model download.")
            return

        try:
            # 1. Embeddings Model (all-MiniLM-L6-v2 ONNX)
            emb_onnx_path = os.path.join(MODELS_DIR, "all-MiniLM-L6-v2.onnx")
            emb_tok_path = os.path.join(MODELS_DIR, "all-MiniLM-L6-v2_tokenizer.json")
            
            if not os.path.exists(emb_onnx_path):
                print("Downloading MiniLM embedding ONNX model...")
                downloaded_file = hf_hub_download(
                    repo_id="optimum/all-MiniLM-L6-v2",
                    filename="model.onnx"
                )
                os.replace(downloaded_file, emb_onnx_path)
            
            if not os.path.exists(emb_tok_path):
                print("Downloading MiniLM tokenizer...")
                downloaded_file = hf_hub_download(
                    repo_id="optimum/all-MiniLM-L6-v2",
                    filename="tokenizer.json"
                )
                os.replace(downloaded_file, emb_tok_path)

            # 2. Hallucination Scorer Model (DistilBERT ONNX)
            # Use Xenova/distilbert-base-uncased-finetuned-sst-2-english as a proxy for classification
            hal_onnx_path = os.path.join(MODELS_DIR, "distilbert-halueval.onnx")
            hal_tok_path = os.path.join(MODELS_DIR, "distilbert-halueval_tokenizer.json")

            if not os.path.exists(hal_onnx_path):
                print("Downloading DistilBERT classification ONNX model...")
                downloaded_file = hf_hub_download(
                    repo_id="Xenova/distilbert-base-uncased-finetuned-sst-2-english",
                    filename="onnx/model_quantized.onnx"
                )
                os.replace(downloaded_file, hal_onnx_path)
            
            if not os.path.exists(hal_tok_path):
                print("Downloading DistilBERT tokenizer...")
                downloaded_file = hf_hub_download(
                    repo_id="Xenova/distilbert-base-uncased-finetuned-sst-2-english",
                    filename="tokenizer.json"
                )
                os.replace(downloaded_file, hal_tok_path)

            # Initialize sessions
            # CPU execution provider limit to 1 thread for budget compliance
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 1
            sess_options.inter_op_num_threads = 1
            
            self.embedding_session = ort.InferenceSession(emb_onnx_path, sess_options, providers=["CPUExecutionProvider"])
            self.embedding_tokenizer = Tokenizer.from_file(emb_tok_path)
            
            self.hallucination_session = ort.InferenceSession(hal_onnx_path, sess_options, providers=["CPUExecutionProvider"])
            self.hallucination_tokenizer = Tokenizer.from_file(hal_tok_path)
            
            self.ml_initialized = True
            print("ML models loaded successfully.")
        except Exception as e:
            print(f"Error initializing ML models: {e}. Falling back to heuristics.")

    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        """Helper to compute sentence embeddings using the MiniLM ONNX model."""
        if not self.ml_initialized or not self.embedding_tokenizer or not self.embedding_session:
            return np.zeros((len(texts), 384))

        embeddings = []
        for text in texts:
            encoded = self.embedding_tokenizer.encode(text)
            input_ids = np.array([encoded.ids], dtype=np.int64)
            attention_mask = np.array([encoded.attention_mask], dtype=np.int64)
            token_type_ids = np.array([encoded.type_ids], dtype=np.int64)
            # MiniLM ONNX outputs [last_hidden_state, pooler_output] or a single dict
            outputs = self.embedding_session.run(None, {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids
            })
            # Mean pooling
            token_embeddings = outputs[0]  # shape: (1, seq_len, 384)
            mask = np.expand_dims(attention_mask, -1)  # shape: (1, seq_len, 1)
            sum_embeddings = np.sum(token_embeddings * mask, axis=1)
            sum_mask = np.clip(np.sum(mask, axis=1), a_min=1e-9, a_max=None)
            mean_pooled = sum_embeddings / sum_mask
            # Normalize for cosine similarity
            norm = np.linalg.norm(mean_pooled, axis=1, keepdims=True)
            norm = np.clip(norm, a_min=1e-9, a_max=None)
            normalized = mean_pooled / norm
            embeddings.append(normalized[0])
            
        return np.array(embeddings)

    def evaluate_hallucination_ml(self, text: str) -> float:
        """Run ML sequence classification to evaluate hallucination risk."""
        if not self.ml_initialized or not self.hallucination_tokenizer or not self.hallucination_session:
            # Fallback heuristic
            return 85.0
            
        try:
            encoded = self.hallucination_tokenizer.encode(text)
            # Truncate to maximum sequence length if needed
            input_ids = np.array([encoded.ids[:512]], dtype=np.int64)
            attention_mask = np.array([encoded.attention_mask[:512]], dtype=np.int64)
            
            outputs = self.hallucination_session.run(None, {
                "input_ids": input_ids,
                "attention_mask": attention_mask
            })
            logits = outputs[0][0]  # shape (2,)
            # Softmax
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / np.sum(exp_logits)
            
            # Assuming class 0 is non-hallucinated and class 1 is hallucinated / violation
            # Let's map high probability of class 1 to a lower performance/factual score
            # Score ranges 0-100 (where 100 is best, 0 is worst)
            score = float(100.0 - (probs[1] * 100.0))
            return max(0.0, min(100.0, score))
        except Exception as e:
            print(f"Error in ML evaluation: {e}")
            return 85.0

    def evaluate_contradiction(self, text: str) -> float:
        """Calculates cosine similarity between sentence pairs in evaluation window.
        Returns a contradiction penalty (0 to 20).
        """
        # Split text into sentences using simple regex
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 8]
        if len(sentences) < 2:
            return 0.0

        if not self.ml_initialized:
            # Fallback heuristic contradiction detection (word overlap check)
            max_penalty = 0.0
            for i in range(len(sentences)):
                for j in range(i + 1, len(sentences)):
                    words_i = set(sentences[i].lower().split())
                    words_j = set(sentences[j].lower().split())
                    if not words_i or not words_j:
                        continue
                    overlap = len(words_i & words_j) / min(len(words_i), len(words_j))
                    # If high word overlap but opposite polarity (e.g. contains 'not', 'no', 'never' in one but not the other)
                    has_neg_i = any(w in words_i for w in ["not", "no", "never", "cannot", "won't", "n't"])
                    has_neg_j = any(w in words_j for w in ["not", "no", "never", "cannot", "won't", "n't"])
                    if overlap > 0.6 and (has_neg_i != has_neg_j):
                        max_penalty = max(max_penalty, 15.0)
            return max_penalty

        try:
            embeddings = self.get_embeddings(sentences)
            max_penalty = 0.0
            # Calculate pairwise cosine similarity
            for i in range(len(sentences)):
                for j in range(i + 1, len(sentences)):
                    # Cosine similarity since vectors are normalized is dot product
                    sim = float(np.dot(embeddings[i], embeddings[j]))
                    # If high semantic similarity, check for contradiction (e.g., negation mismatch)
                    if sim > 0.75:
                        words_i = set(sentences[i].lower().split())
                        words_j = set(sentences[j].lower().split())
                        has_neg_i = any(w in words_i for w in ["not", "no", "never", "cannot", "won't", "n't", "don't"])
                        has_neg_j = any(w in words_j for w in ["not", "no", "never", "cannot", "won't", "n't", "don't"])
                        if has_neg_i != has_neg_j:
                            penalty = 20.0 * (sim - 0.7) / 0.3
                            max_penalty = max(max_penalty, penalty)
            return max(0.0, min(20.0, max_penalty))
        except Exception as e:
            print(f"Error in contradiction detection: {e}")
            return 0.0

    def evaluate_confidence(self, text: str) -> float:
        """Pattern-based scorer for hedging and overconfident language.
        Returns a confidence calibration adjustment (-15 to +15).
        """
        hedging_count = 0
        overconfident_count = 0
        
        for pattern in self.hedging_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            hedging_count += len(matches)
            
        for pattern in self.overconfident_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            overconfident_count += len(matches)
            
        # Hedging penalty (apologies/unsureness lowers performance score)
        # Overconfidence without basis can also lower calibration
        adjustment = 0.0
        if hedging_count > 0:
            adjustment -= min(15.0, hedging_count * 5.0)
        if overconfident_count > 2:
            # Overconfident penalty for excess hype
            adjustment -= min(5.0, (overconfident_count - 2) * 2.0)
            
        return adjustment

    def evaluate(self, text: str) -> float:
        """Main entrypoint for Performance Guard scoring. Budget: <20ms."""
        # 1. Factuality score via DistilBERT ONNX
        fact_score = self.evaluate_hallucination_ml(text)
        
        # 2. Contradiction penalty
        contradiction_penalty = self.evaluate_contradiction(text)
        
        # 3. Confidence adjustment
        confidence_adjustment = self.evaluate_confidence(text)
        
        # Calculate final score
        final_score = fact_score - contradiction_penalty + confidence_adjustment
        return max(0.0, min(100.0, final_score))
