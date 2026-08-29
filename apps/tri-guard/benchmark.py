import time
import statistics
from guards.performance import PerformanceGuard
from guards.cost import CostGuard
from guards.responsibility import ResponsibilityGuard

# Initialize guards locally to measure engine latency (excluding HTTP/network overhead)
print("Initializing guards for benchmarking...")
perf_guard = PerformanceGuard()
# Download/load models
perf_guard.download_models()

cost_guard = CostGuard()
resp_guard = ResponsibilityGuard()

# Sample payloads representing real-world LLM outputs
payloads = [
    "Hello! How can I assist you with your project today?",
    "Sure, the project code is PROJECT-ABC1234. Let me know if you need anything else.",
    "My email address is john.doe@example.com and phone is +1-555-0199.",
    "The IBAN for the account is DE89370400440532013000. Please execute the payment.",
    "The system has encountered a critical error. I apologize for the inconvenience. I am not sure if we can recover the data, perhaps we can try again.",
    "This is absolutely the best solution and 100% guaranteed to work without any doubt.",
    "We should avoid hiring geriatric developers as they are too old and tech-challenged seniors.",
    "Here is the code snippet:\n```python\nimport os\ndef test():\n    return os.getenv('API_KEY')\n```",
    "Yes, I can confirm that the patient health ID is H-1234567890. Please update the records.",
    "The capital of France is Paris. Paris is a major European city and a global center for art, fashion, gastronomy and culture."
] * 10  # 100 payloads total

def run_benchmark():
    print(f"Starting benchmark of 100 evaluations...")
    latencies = []
    
    for idx, text in enumerate(payloads):
        start_time = time.perf_counter()
        
        # Run all three guards
        _ = perf_guard.evaluate(text)
        _ = cost_guard.evaluate(text, "gpt-4o")
        _ = resp_guard.evaluate(text)
        
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000
        latencies.append(duration_ms)
        
    p50 = statistics.median(latencies)
    p95 = statistics.quantiles(latencies, n=20)[18]  # 95th percentile
    p99 = statistics.quantiles(latencies, n=100)[98] # 99th percentile
    avg_latency = sum(latencies) / len(latencies)
    
    print("\n--- BENCHMARK RESULTS ---")
    print(f"Total Requests: {len(latencies)}")
    print(f"Average Latency: {avg_latency:.2f} ms")
    print(f"p50 (Median) Latency: {p50:.2f} ms")
    print(f"p95 Latency: {p95:.2f} ms")
    print(f"p99 Latency: {p99:.2f} ms")
    
    budget = 50.0
    if p99 <= budget:
        print(f"SUCCESS: p99 latency ({p99:.2f}ms) is within the budget of {budget}ms.")
    else:
        print(f"WARNING: p99 latency ({p99:.2f}ms) exceeds the budget of {budget}ms.")

if __name__ == "__main__":
    run_benchmark()
