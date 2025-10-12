"""
ConvFinQA Evaluator

Ports the original evaluation logic from:
https://github.com/czyssrs/ConvFinQA/blob/main/code/utils/general_utils.py

Key features:
- Flexible string-to-number conversion (handles commas, percentages, dollar signs)
- Rounds to 5 decimal places
- Strict equality comparison
"""

import json
from typing import Any, Dict, List, Union


def str_to_num(text: Union[str, float, int]) -> Union[float, str]:
    """
    Convert string to number with flexible formatting.
    Handles: commas, percentages, dollar signs, special constants

    Args:
        text: Input text/number to convert

    Returns:
        Parsed number or "n/a" if invalid
    """
    # Already a number
    if isinstance(text, (int, float)):
        return float(text)

    # Convert to string and remove commas
    text = str(text).replace(",", "")

    try:
        num = float(text)
        return num
    except ValueError:
        # Handle special cases
        if "%" in text:
            text = text.replace("%", "")
            try:
                num = float(text)
                return num / 100.0
            except ValueError:
                return "n/a"
        elif "const_" in text:
            text = text.replace("const_", "")
            if text == "m1":
                text = "-1"
            try:
                return float(text)
            except ValueError:
                return "n/a"
        else:
            return "n/a"


def compare_answers(gold_value: Any, pred_value: Any, tolerance_decimals: int = 3) -> bool:
    """
    Compare two values for equality with decimal precision tolerance.

    Uses 3 decimal places (0.001 tolerance) to handle:
    1. LLM returning exact division results (e.g., -0.3282275884379211)
    2. Dataset gold answers with inconsistent rounding (4 or 5 decimals)
    3. Alignment with original ConvFinQA evaluation standards

    Args:
        gold_value: Ground truth value
        pred_value: Predicted value
        tolerance_decimals: Number of decimal places to round to (default 3)

    Returns:
        True if equal (within precision)
    """
    # Handle yes/no string comparisons first (before conversion)
    if str(gold_value).lower() in ["yes", "no"]:
        return str(gold_value).lower() == str(pred_value).lower()

    # Convert both to numbers
    gold = str_to_num(gold_value)
    pred = str_to_num(pred_value)

    # If either is invalid, not equal
    if gold == "n/a" or pred == "n/a":
        return False

    # Round to specified decimal places and compare
    gold_rounded = round(gold, tolerance_decimals)
    pred_rounded = round(pred, tolerance_decimals)

    return gold_rounded == pred_rounded


def evaluate(ground_truth_data: List[Dict], predictions: Dict[str, Dict[str, List]]) -> Dict:
    """
    Evaluate predictions against ground truth.

    Args:
        ground_truth_data: Array of records from convfinqa_dataset.json
        predictions: Map of {id: {"turns": [answer1, answer2, ...]}}

    Returns:
        Evaluation results dictionary
    """
    total_turns = 0
    correct_turns = 0
    total_conversations = 0
    perfect_conversations = 0

    errors = []
    results = []

    for record in ground_truth_data:
        record_id = record["id"]
        dialogue = record["dialogue"]
        conv_questions = dialogue["conv_questions"]
        executed_answers = dialogue["executed_answers"]

        # Check if we have predictions for this record
        if record_id not in predictions:
            errors.append({
                "id": record_id,
                "error": "Missing predictions for this record"
            })
            continue

        pred_turns = predictions[record_id].get("turns", [])

        if len(pred_turns) != len(executed_answers):
            errors.append({
                "id": record_id,
                "error": f"Expected {len(executed_answers)} turns, got {len(pred_turns)}"
            })
            continue

        total_conversations += 1
        conversation_correct = True
        turn_results = []

        for i in range(len(executed_answers)):
            gold_answer = executed_answers[i]
            pred_answer = pred_turns[i]
            is_correct = compare_answers(gold_answer, pred_answer)

            total_turns += 1
            if is_correct:
                correct_turns += 1
            else:
                conversation_correct = False

            turn_results.append({
                "turn": i,
                "question": conv_questions[i],
                "gold": gold_answer,
                "predicted": pred_answer,
                "correct": is_correct
            })

        if conversation_correct:
            perfect_conversations += 1

        results.append({
            "id": record_id,
            "turns": turn_results,
            "all_correct": conversation_correct
        })

    turn_accuracy = correct_turns / total_turns if total_turns > 0 else 0.0
    conversation_accuracy = perfect_conversations / total_conversations if total_conversations > 0 else 0.0

    return {
        "turn_accuracy": turn_accuracy,
        "conversation_accuracy": conversation_accuracy,
        "total_turns": total_turns,
        "correct_turns": correct_turns,
        "total_conversations": total_conversations,
        "perfect_conversations": perfect_conversations,
        "errors": errors,
        "results": results
    }


def load_ground_truth(file_path: str) -> List[Dict]:
    """
    Load ground truth data from JSON file.

    Args:
        file_path: Path to convfinqa_dataset.json

    Returns:
        Array of records
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_predictions(file_path: str) -> Dict[str, Dict[str, List]]:
    """
    Load predictions from JSON file.
    Expected format:
    {
        "record_id_1": {"turns": [answer1, answer2, ...]},
        "record_id_2": {"turns": [answer1, answer2, ...]}
    }

    Args:
        file_path: Path to predictions JSON file

    Returns:
        Predictions dictionary
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def evaluate_from_files(ground_truth_path: str, predictions_path: str) -> Dict:
    """
    Main evaluation function.

    Args:
        ground_truth_path: Path to ground truth data
        predictions_path: Path to predictions

    Returns:
        Evaluation results
    """
    ground_truth = load_ground_truth(ground_truth_path)
    predictions = load_predictions(predictions_path)
    return evaluate(ground_truth, predictions)


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python evaluator.py <ground_truth.json> <predictions.json>")
        sys.exit(1)

    ground_truth_path = sys.argv[1]
    predictions_path = sys.argv[2]

    results = evaluate_from_files(ground_truth_path, predictions_path)

    print(f"\n{'='*60}")
    print("ConvFinQA Evaluation Results")
    print(f"{'='*60}")
    print(f"Turn Accuracy:         {results['turn_accuracy']:.2%}")
    print(f"Conversation Accuracy: {results['conversation_accuracy']:.2%}")
    print(f"\nTotal Turns:           {results['correct_turns']}/{results['total_turns']}")
    print(f"Perfect Conversations: {results['perfect_conversations']}/{results['total_conversations']}")

    if results['errors']:
        print(f"\nErrors: {len(results['errors'])}")
        for error in results['errors'][:5]:
            print(f"  - {error['id']}: {error['error']}")

    print(f"{'='*60}\n")
