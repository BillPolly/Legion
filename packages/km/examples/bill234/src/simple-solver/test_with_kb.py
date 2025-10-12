"""Quick test with knowledge base"""
import json
import sys
from pathlib import Path
from solver import ConvFinQASolver
from evaluator import compare_answers

# Get project root
project_root = Path(__file__).parent.parent.parent

# Load preprocessed data (table + knowledge_base)
example_num = int(sys.argv[1]) if len(sys.argv) > 1 else 12
preprocessed_path = project_root / "data" / "preprocessed" / f"{example_num}.json"
with open(preprocessed_path, 'r') as f:
    preprocessed = json.load(f)

# Load ONLY questions and gold answers from original dataset (for eval)
dataset_path = project_root / "data" / "convfinqa_dataset.json"
with open(dataset_path, 'r') as f:
    dataset = json.load(f)
original = dataset['train'][example_num]

# Build example structure - EVERYTHING from preprocessed except questions
example = {
    "id": preprocessed["example_id"],                # From preprocessed
    "questions": original["dialogue"]["conv_questions"],  # Questions from original
    "doc": {
        "table": preprocessed["table"]               # From preprocessed
    },
    "knowledge_base": preprocessed["knowledge_base"]  # From preprocessed
}

# Keep gold answers SEPARATE - only for evaluation
gold_answers = original["dialogue"]["executed_answers"]

print(f"Testing Example {example_num}: {example['id']}")
print(f"Questions: {len(example['questions'])}")
print()

# Initialize solver (no MongoDB logging)
solver = ConvFinQASolver(enable_logging=False)

# Debug: Print first turn's knowledge base
print("KNOWLEDGE BASE - Extracted Values:")
for key, val in example["knowledge_base"]["extracted_values"].items():
    if "class_b" in key or "authorized" in key:
        print(f"  {key}: {val['value']} {val['units']} - {val['context']}")
print()

# Solve conversation
result = solver.solve_conversation(example, gold_answers)

# Print results
questions = example['questions']
predicted_answers = result['turns']

print("Results:")
print("="*80)
for i, (q, predicted, gold) in enumerate(zip(questions, predicted_answers, gold_answers)):
    correct = compare_answers(gold, predicted)
    status = "✓" if correct else "✗"
    print(f"\n{status} Turn {i+1}:")
    print(f"  Q: {q}")
    print(f"  Predicted: {predicted}")
    print(f"  Gold: {gold}")

# Summary
correct_count = sum(1 for pred, gold in zip(predicted_answers, gold_answers)
                   if compare_answers(gold, pred))
total = len(gold_answers)
accuracy = correct_count / total if total > 0 else 0

print(f"\n{'='*80}")
print(f"Accuracy: {correct_count}/{total} ({accuracy*100:.1f}%)")

solver.close()
