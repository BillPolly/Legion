"""
Interactive evaluation script - test examples one by one with discussion
"""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv
from solver import ConvFinQASolver
from evaluator import compare_answers

# Load environment
project_root = Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=project_root / ".env")

def ensure_preprocessed(example_num):
    """Ensure example is preprocessed, preprocess if needed"""
    preprocessed_path = project_root / "data" / "preprocessed" / f"{example_num}.json"

    if preprocessed_path.exists():
        return True

    print(f"⚠️  Example {example_num} not preprocessed. Preprocessing now...")

    import subprocess
    result = subprocess.run(
        ["uv", "run", "python", "src/preprocessor/run_preprocessing.py",
         "--example-num", str(example_num), "--no-logging"],
        cwd=project_root,
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print(f"✅ Example {example_num} preprocessed successfully")
        return True
    else:
        print(f"❌ Failed to preprocess example {example_num}")
        print(result.stderr)
        return False

def test_example(example_num, solver):
    """Test a single example and show results"""
    # Ensure preprocessed
    if not ensure_preprocessed(example_num):
        return None

    # Load preprocessed KB
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

    print("=" * 80)
    print(f"Example {example_num}: {example['id']}")
    print("=" * 80)

    # Show knowledge base info
    kb = example["knowledge_base"]
    if kb.get("table_metadata", {}).get("baseline_year"):
        print(f"📊 Baseline Year: {kb['table_metadata']['baseline_year']}")
    if kb.get("entities"):
        entities = [e["name"] for e in kb["entities"][:5]]
        print(f"🏢 Entities: {', '.join(entities)}")
    if kb.get("extracted_values"):
        print(f"📝 Extracted Values: {len(kb['extracted_values'])} values from text")
    print()

    # Solve
    result = solver.solve_conversation(example, gold_answers)

    # Show results
    questions = example['questions']
    predicted_answers = result['turns']

    correct_count = 0

    for i, (q, predicted, gold) in enumerate(zip(questions, predicted_answers, gold_answers)):
        correct = compare_answers(gold, predicted)
        if correct:
            correct_count += 1

        status = "✓" if correct else "✗"

        print(f"{status} Turn {i+1}:")
        print(f"  Q: {q}")
        print(f"  Predicted: {predicted}")
        print(f"  Gold: {gold}")

        if not correct:
            # Show the difference
            try:
                pred_num = float(predicted)
                gold_num = float(gold)
                diff = pred_num - gold_num
                print(f"  Difference: {diff:+.4f}")
            except:
                pass
        print()

    # Summary
    total = len(gold_answers)
    accuracy = correct_count / total if total > 0 else 0

    print("=" * 80)
    print(f"Accuracy: {correct_count}/{total} ({accuracy*100:.1f}%)")
    print("=" * 80)

    return {
        "example_num": example_num,
        "example_id": example['id'],
        "correct": correct_count,
        "total": total,
        "accuracy": accuracy
    }

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Interactive evaluation with discussion")
    parser.add_argument("--start", type=int, default=0, help="Start example index")
    parser.add_argument("--end", type=int, default=10, help="End example index (exclusive)")
    parser.add_argument("--auto", action="store_true", help="Auto-continue without prompts")

    args = parser.parse_args()

    print("=" * 80)
    print("INTERACTIVE EVALUATION - ConvFinQA with Stage 0 Rewriting")
    print("=" * 80)
    print(f"Testing examples {args.start} to {args.end - 1}")
    print()

    # Initialize solver (always logs to MongoDB)
    solver = ConvFinQASolver()

    results = []

    for example_num in range(args.start, args.end):
        result = test_example(example_num, solver)

        if result:
            results.append(result)

        # Prompt for continuation unless auto mode
        if not args.auto and example_num < args.end - 1:
            print()
            response = input("Press Enter to continue to next example (or 'q' to quit): ")
            if response.lower() == 'q':
                break
            print()

    # Final summary
    if results:
        print("\n" + "=" * 80)
        print("FINAL SUMMARY")
        print("=" * 80)

        total_correct = sum(r["correct"] for r in results)
        total_questions = sum(r["total"] for r in results)
        overall_accuracy = total_correct / total_questions if total_questions > 0 else 0

        print(f"\nTested {len(results)} examples")
        print(f"Overall Accuracy: {total_correct}/{total_questions} ({overall_accuracy*100:.1f}%)")
        print()

        # Show per-example breakdown
        print("Per-Example Results:")
        for r in results:
            print(f"  Example {r['example_num']}: {r['correct']}/{r['total']} ({r['accuracy']*100:.0f}%) - {r['example_id']}")

    solver.close()

if __name__ == "__main__":
    main()
