import re
from typing import List, Dict, Any

try:
    from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
    from presidio_anonymizer import AnonymizerEngine
except ImportError:
    AnalyzerEngine = None
    PatternRecognizer = None
    Pattern = None
    AnonymizerEngine = None

class ResponsibilityGuard:
    def __init__(self):
        self.analyzer = None
        self.anonymizer = None
        self.initialized = False
        self._setup_presidio()
        
        # Regex patterns for fallback
        self.fallback_patterns = {
            "EMAIL": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
            "PHONE_NUMBER": re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
            "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
            "CREDIT_CARD": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
            "IBAN": re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),
            "HEALTH_ID": re.compile(r"\bH-[A-Z0-9]{10}\b"),
            "PROJECT_CODE": re.compile(r"\bPROJECT-[A-Z0-9]{3,8}\b")
        }

        # Demographic bias terms/patterns to monitor
        self.bias_terms = {
            "gender_bias": re.compile(r"\b(men are better|women are not|she should cook|he should lead|housewife|man's job)\b", re.I),
            "age_bias": re.compile(r"\b(too old|millennial laziness|boomer|geriatric|tech-challenged senior)\b", re.I),
            "racial_ethnic_bias": re.compile(r"\b(stereotypical behavior|those people|ghetto|illegal immigrant|lazy foreigners)\b", re.I)
        }

        # Regulatory mappings mapping violation/entity to regulations
        self.regulatory_mapping = {
            "EMAIL": ["GDPR Article 4 (PII)", "CCPA (Personal Information)"],
            "PHONE_NUMBER": ["GDPR Article 4 (PII)", "CCPA (Personal Information)"],
            "SSN": ["GDPR Article 4 (PII)", "HIPAA Privacy Rule (Safe Harbor)", "CCPA"],
            "CREDIT_CARD": ["PCI-DSS Requirement 3 (Cardholder Data)", "GDPR Article 32"],
            "IBAN": ["GDPR Article 4 (Financial PII)"],
            "HEALTH_ID": ["HIPAA Privacy Rule (PHI)", "GDPR Article 9 (Special Category Data)"],
            "PROJECT_CODE": ["Corporate Data Governance Policy (Confidential IP)"],
            "GENDER_BIAS": ["EU AI Act Article 10 (Bias Mitigation)", "Equal Opportunity Standards"],
            "AGE_BIAS": ["EU AI Act Article 10 (Bias Mitigation)"],
            "RACIAL_ETHNIC_BIAS": ["EU AI Act Article 10 (Bias Mitigation)"]
        }

    def _setup_presidio(self):
        if not AnalyzerEngine:
            return
            
        try:
            self.analyzer = AnalyzerEngine()
            self.anonymizer = AnonymizerEngine()
            
            # Create custom recognizers
            # 1. IBAN Recognizer
            iban_pattern = Pattern(
                name="iban_pattern",
                regex=r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b",
                score=0.85
            )
            iban_recognizer = PatternRecognizer(
                supported_entity="IBAN",
                patterns=[iban_pattern]
            )
            
            # 2. Health ID Recognizer
            health_pattern = Pattern(
                name="health_pattern",
                regex=r"\bH-[A-Z0-9]{10}\b",
                score=0.85
            )
            health_recognizer = PatternRecognizer(
                supported_entity="HEALTH_ID",
                patterns=[health_pattern]
            )

            # 3. Project Code Recognizer
            project_pattern = Pattern(
                name="project_pattern",
                regex=r"\bPROJECT-[A-Z0-9]{3,8}\b",
                score=0.9
            )
            project_recognizer = PatternRecognizer(
                supported_entity="PROJECT_CODE",
                patterns=[project_pattern]
            )

            # Register them
            self.analyzer.registry.add_recognizer(iban_recognizer)
            self.analyzer.registry.add_recognizer(health_recognizer)
            self.analyzer.registry.add_recognizer(project_recognizer)
            
            self.initialized = True
            print("Presidio Analyzer with custom recognizers initialized successfully.")
        except Exception as e:
            print(f"Error setting up Presidio Analyzer: {e}. Using native regex patterns instead.")

    def evaluate_pii(self, text: str) -> Dict[str, Any]:
        """Analyzes text for PII using Presidio or regex fallback, and returns redacted text & matches."""
        matched_entities = []
        redacted_text = text
        
        if self.initialized and self.analyzer and self.anonymizer:
            try:
                # Use Presidio
                results = self.analyzer.analyze(text=text, language="en")
                if results:
                    # Get matched entities
                    for res in results:
                        if res.entity_type not in matched_entities:
                            matched_entities.append(res.entity_type)
                            
                    # Anonymize/Redact
                    anonymize_result = self.anonymizer.anonymize(
                        text=text,
                        analyzer_results=results
                    )
                    redacted_text = anonymize_result.text
                return {
                    "has_pii": len(matched_entities) > 0,
                    "redacted_text": redacted_text,
                    "matched_entities": matched_entities
                }
            except Exception as e:
                print(f"Presidio evaluation error: {e}. Falling back to regex.")
                
        # Regex Fallback
        for entity_name, pattern in self.fallback_patterns.items():
            matches = list(pattern.finditer(redacted_text))
            if matches:
                matched_entities.append(entity_name)
                for match in reversed(matches):
                    start, end = match.span()
                    redacted_text = redacted_text[:start] + f"<REDACTED_{entity_name}>" + redacted_text[end:]
                    
        return {
            "has_pii": len(matched_entities) > 0,
            "redacted_text": redacted_text,
            "matched_entities": matched_entities
        }

    def evaluate_bias(self, text: str) -> Dict[str, Any]:
        """Checks for demographic bias markers and returns bias score & detected types."""
        detected_biases = []
        bias_score = 100.0  # Start clean (100 means no bias)
        
        for bias_type, pattern in self.bias_terms.items():
            if pattern.search(text):
                detected_biases.append(bias_type.upper())
                bias_score -= 30.0
                
        return {
            "bias_score": max(0.0, bias_score),
            "detected_biases": detected_biases
        }

    def tag_regulations(self, entities: List[str], biases: List[str]) -> List[str]:
        """Maps detected violations or PII entities to regulatory compliance tags."""
        tags = set()
        for item in entities:
            if item in self.regulatory_mapping:
                tags.update(self.regulatory_mapping[item])
                
        for item in biases:
            if item in self.regulatory_mapping:
                tags.update(self.regulatory_mapping[item])
                
        return sorted(list(tags))

    def evaluate(self, text: str) -> Dict[str, Any]:
        """Runs the complete Responsibility Guard evaluation pipeline."""
        pii_result = self.evaluate_pii(text)
        bias_result = self.evaluate_bias(text)
        
        # Merge list of issues
        regulatory_tags = self.tag_regulations(
            pii_result["matched_entities"],
            bias_result["detected_biases"]
        )
        
        # Calculate combined responsibility compliance score
        # Base 100, deduction for PII and bias issues
        score = 100.0
        if pii_result["has_pii"]:
            # Deduct based on number of entities found
            score -= min(40.0, len(pii_result["matched_entities"]) * 15.0)
            
        score = min(score, bias_result["bias_score"])
        
        return {
            "has_pii": pii_result["has_pii"],
            "redacted_text": pii_result["redacted_text"],
            "matched_entities": pii_result["matched_entities"],
            "detected_biases": bias_result["detected_biases"],
            "regulatory_tags": regulatory_tags,
            "score": max(0.0, score)
        }
