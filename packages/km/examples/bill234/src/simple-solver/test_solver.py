"""
Test the ConvFinQA Solver with sample data
"""

import sys
import json
from pathlib import Path
from solver import ConvFinQASolver
from answer_parser import parse_answer

# Add parent directory to path to access evaluator
sys.path.insert(0, str(Path(__file__).parent.parent))
from evaluator import compare_answers


def test_answer_parser():
    """Test the answer parser with various formats"""
    print("Testing answer parser...")

    test_cases = [
        ("4", 4.0),
        ("0.14136", 0.14136),
        ("The answer is 0.14136", 0.14136),
        ("25587.0", 25587.0),
        ("yes", "yes"),
        ("no", "no"),
        ("20%", 0.20),
        ("-100", -100.0),
        ("1,234.56", 1234.56),
    ]

    for text, expected in test_cases:
        try:
            result = parse_answer(text)
            if result == expected:
                print(f"✓ '{text}' → {result}")
            else:
                print(f"✗ '{text}' → {result} (expected {expected})")
        except Exception as e:
            print(f"✗ '{text}' → ERROR: {e}")

    print()


def test_solver_with_sample():
    """Test solver with a sample from the actual dataset"""
    print("Testing solver with 3 samples from the dataset...")

    # Load samples from the dataset
    data_path = Path(__file__).parent.parent.parent / "data" / "convfinqa_dataset.json"

    with open(data_path, 'r') as f:
        full_data = json.load(f)

    # Extract train data and limit to first 3
    dataset = full_data["train"][:3]

    print(f"Testing with {len(dataset)} conversations")
    print()

    # Initialize solver
    solver = ConvFinQASolver()

    # Process each sample
    total_correct = 0
    total_turns = 0

    for sample_idx, sample in enumerate(dataset, 1):
        print(f"{'='*80}")
        print(f"Sample {sample_idx}: {sample['id']}")
        print(f"Turns: {len(sample['dialogue']['conv_questions'])}")
        print(f"{'='*80}")

        try:
            result = solver.solve_conversation(sample)
            predicted_answers = result["turns"]
            gold_answers = sample["dialogue"]["executed_answers"]

            correct_count = 0
            for i, (question, pred, gold) in enumerate(
                zip(sample["dialogue"]["conv_questions"], predicted_answers, gold_answers)
            ):
                is_correct = compare_answers(gold, pred)
                status = "✓" if is_correct else "✗"

                if is_correct:
                    correct_count += 1

                print(f"Turn {i + 1} {status}")
                print(f"  Q: {question}")
                print(f"  Predicted: {pred}")
                print(f"  Gold:      {gold}")

            accuracy = correct_count / len(gold_answers)
            print(f"\nSample Accuracy: {correct_count}/{len(gold_answers)} = {accuracy:.1%}")

            total_correct += correct_count
            total_turns += len(gold_answers)

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

        print()

    # Overall accuracy
    if total_turns > 0:
        overall_accuracy = total_correct / total_turns
        print(f"{'='*80}")
        print(f"OVERALL: {total_correct}/{total_turns} = {overall_accuracy:.1%}")
        print(f"{'='*80}")


def test_solver_with_simple_case():
    """Test solver with a very simple custom case"""
    print("Testing solver with simple custom case...")

    solver = ConvFinQASolver()

    # Create a simple test case
    test_record = {
        "id": "test_simple",
        "doc": {
            "pre_text": "",
            "post_text": "",
            "table": {
                "2023": {"revenue": 1200000, "cost": 800000},
                "2022": {"revenue": 1000000, "cost": 700000}
            }
        },
        "dialogue": {
            "conv_questions": [
                "What was the revenue in 2023?",
                "What was it in 2022?",
                "What was the change?",
            ],
            "executed_answers": [
                1200000.0,
                1000000.0,
                200000.0
            ]
        }
    }

    result = solver.solve_conversation(test_record)
    predicted = result["turns"]
    gold = test_record["dialogue"]["executed_answers"]

    print("Results:")
    correct = 0
    for i, (q, p, g) in enumerate(zip(
        test_record["dialogue"]["conv_questions"], predicted, gold
    )):
        is_correct = compare_answers(g, p)
        status = "✓" if is_correct else "✗"
        if is_correct:
            correct += 1

        print(f"{status} Q: {q}")
        print(f"  Predicted: {p}, Gold: {g}")

    print(f"\nAccuracy: {correct}/{len(gold)} = {correct/len(gold):.1%}")
    print()


if __name__ == "__main__":
    print("="*80)
    print("ConvFinQA Solver Test Suite")
    print("="*80)
    print()

    # Test answer parser
    test_answer_parser()

    # Test with simple case first
    test_solver_with_simple_case()

    # Test with actual dataset sample
    test_solver_with_sample()

    print("="*80)
    print("Testing complete!")
    print("="*80)
