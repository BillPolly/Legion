"""
Run ConvFinQA Solver on full dataset and evaluate

This script:
1. Loads the ConvFinQA dataset
2. Runs the solver on each conversation
3. Generates predictions file
4. Evaluates using the existing evaluator
"""

import sys
import json
import argparse
from pathlib import Path
from tqdm import tqdm
from solver import ConvFinQASolver

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from evaluator import evaluate, compare_answers


def run_evaluation(
    data_path: str,
    output_path: str = None,
    start_idx: int = None,
    end_idx: int = None,
    verbose: bool = False
):
    """
    Run solver on dataset and evaluate.

    Args:
        data_path: Path to convfinqa_dataset.json
        output_path: Path to save predictions JSON (optional)
        start_idx: Starting index (0-based, inclusive)
        end_idx: Ending index (0-based, exclusive). If None, runs only start_idx
        verbose: Print detailed progress
    """
    # Load dataset
    print(f"Loading dataset from {data_path}...")
    with open(data_path, 'r') as f:
        full_data = json.load(f)

    # Extract train data
    full_dataset = full_data.get("train", [])
    print(f"Total dataset size: {len(full_dataset)}")

    # Select subset
    if start_idx is not None:
        if end_idx is None:
            # Run single example
            dataset = [full_dataset[start_idx]]
            print(f"Running example {start_idx}")
        else:
            # Run range
            dataset = full_dataset[start_idx:end_idx]
            print(f"Running examples {start_idx} to {end_idx-1} ({len(dataset)} conversations)")
    else:
        dataset = full_dataset
        print(f"Running all {len(dataset)} conversations")

    # Initialize solver
    print("Initializing solver...")
    solver = ConvFinQASolver()

    # Process each conversation
    predictions = {}
    errors = []

    # Track running accuracy
    running_correct = 0
    running_total = 0

    print("\nProcessing conversations...")
    print("=" * 80)

    for idx, record in enumerate(dataset, 1):
        record_id = record["id"]
        questions = record["dialogue"]["conv_questions"]
        gold_answers = record["dialogue"]["executed_answers"]

        print(f"\n[{idx}/{len(dataset)}] {record_id} ({len(questions)} turns)")

        try:
            result = solver.solve_conversation(record, gold_answers, example_id=record_id)
            predictions[record_id] = result
            predicted_answers = result["turns"]

            # Evaluate this conversation
            sample_correct = 0
            for i, (question, pred, gold) in enumerate(zip(questions, predicted_answers, gold_answers)):
                is_correct = compare_answers(gold, pred)
                status = "✓" if is_correct else "✗"

                if is_correct:
                    sample_correct += 1
                    running_correct += 1

                running_total += 1

                # Show turn result
                question_abbrev = question[:70] + "..." if len(question) > 70 else question
                if verbose:
                    print(f"  Turn {i+1} {status} {question_abbrev}")
                    print(f"    Predicted: {pred}, Gold: {gold}")
                else:
                    print(f"  Turn {i+1} {status} {question_abbrev}")

            # Show sample accuracy
            sample_acc = sample_correct / len(gold_answers)
            running_acc = running_correct / running_total
            print(f"  → Sample: {sample_correct}/{len(gold_answers)} ({sample_acc:.1%})")
            print(f"  → Running: {running_correct}/{running_total} ({running_acc:.1%})")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            errors.append({
                "id": record_id,
                "error": str(e)
            })
            # Create empty prediction to maintain structure
            num_turns = len(questions)
            predictions[record_id] = {
                "turns": [float('nan')] * num_turns
            }
            running_total += num_turns

    # Save predictions if output path provided
    if output_path:
        print(f"\nSaving predictions to {output_path}...")
        with open(output_path, 'w') as f:
            json.dump(predictions, f, indent=2)

    # Evaluate
    print("\n" + "="*80)
    print("EVALUATION RESULTS")
    print("="*80)

    results = evaluate(dataset, predictions)

    print(f"Turn Accuracy:         {results['turn_accuracy']:.2%}")
    print(f"Conversation Accuracy: {results['conversation_accuracy']:.2%}")
    print(f"\nTotal Turns:           {results['correct_turns']}/{results['total_turns']}")
    print(f"Perfect Conversations: {results['perfect_conversations']}/{results['total_conversations']}")

    if results['errors']:
        print(f"\nEvaluation Errors: {len(results['errors'])}")
        for error in results['errors'][:5]:
            print(f"  - {error['id']}: {error['error']}")

    if errors:
        print(f"\nSolver Errors: {len(errors)}")
        for error in errors[:5]:
            print(f"  - {error['id']}: {error['error']}")

    print("="*80)

    # Save detailed results
    if output_path:
        results_path = Path(output_path).parent / "evaluation_results.json"
        print(f"\nSaving detailed results to {results_path}...")
        with open(results_path, 'w') as f:
            json.dump({
                "summary": {
                    "turn_accuracy": results['turn_accuracy'],
                    "conversation_accuracy": results['conversation_accuracy'],
                    "correct_turns": results['correct_turns'],
                    "total_turns": results['total_turns'],
                    "perfect_conversations": results['perfect_conversations'],
                    "total_conversations": results['total_conversations'],
                },
                "errors": results['errors'],
                "solver_errors": errors,
                "per_conversation": results['results']
            }, f, indent=2)

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Run ConvFinQA solver and evaluate results"
    )
    parser.add_argument(
        "--data",
        type=str,
        default="../../data/convfinqa_dataset.json",
        help="Path to ConvFinQA dataset JSON file"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="predictions.json",
        help="Path to save predictions JSON"
    )
    parser.add_argument(
        "--start",
        type=int,
        default=None,
        help="Starting index (0-based). If only start is given, runs single example."
    )
    parser.add_argument(
        "--end",
        type=int,
        default=None,
        help="Ending index (0-based, exclusive). Use with --start for ranges."
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed progress"
    )

    args = parser.parse_args()

    # Resolve paths relative to this script
    script_dir = Path(__file__).parent
    data_path = script_dir / args.data
    output_path = script_dir / args.output

    run_evaluation(
        data_path=str(data_path),
        output_path=str(output_path),
        start_idx=args.start,
        end_idx=args.end,
        verbose=args.verbose
    )


if __name__ == "__main__":
    main()
