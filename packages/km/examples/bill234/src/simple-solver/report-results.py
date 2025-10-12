"""
Report results from MongoDB logs for solver runs

Usage:
  python report-results.py 107        # Show all turns for example 107 (by index)
  python report-results.py "Single_AWK/2012/page_118.pdf-3"  # By full ID
  python report-results.py 107 0      # Show only turn 0 of example 107
  python report-results.py 107 0 --full  # Show full prompts
"""
import sys
import json
from pymongo import MongoClient
from pathlib import Path

def get_example_id_from_index(index: int) -> str:
    """Look up full example ID from dataset index"""
    dataset_path = Path(__file__).parent.parent.parent / "data" / "convfinqa_dataset.json"
    with open(dataset_path, 'r') as f:
        dataset = json.load(f)

    if index >= len(dataset['train']):
        return None

    return dataset['train'][index]['id']

def inspect_example(example_id: str, turn_idx: int = None, show_full: bool = False):
    """Inspect logs for a specific example"""
    original_input = example_id

    # If example_id is numeric, try to find it (it may be logged as just the number)
    if example_id.isdigit():
        index = int(example_id)
        full_id = get_example_id_from_index(index)
        if not full_id:
            print(f"❌ Index {index} out of range")
            return
        print(f"Example {index} → {full_id}")

    client = MongoClient('mongodb://localhost:27017')
    db = client['convfinqa']
    logs = db['evaluation_runs']

    # Try to find the log entry (first by numeric ID if applicable, then by full ID)
    log = None
    if original_input.isdigit():
        log = logs.find_one({'example_id': original_input})
        if log:
            print(f"Found using numeric ID: {original_input}\n")

    if not log and original_input.isdigit():
        full_id = get_example_id_from_index(int(original_input))
        if full_id:
            log = logs.find_one({'example_id': full_id})
            if log:
                print(f"Found using full ID: {full_id}\n")

    if not log:
        log = logs.find_one({'example_id': original_input})

    if not log:
        print(f"❌ No logs found for example {example_id}")
        return

    print("=" * 80)
    print(f"EXAMPLE: {log.get('example_id', 'N/A')}")
    print("=" * 80)

    turns = log.get('conversation_turns', [])

    if turn_idx is not None:
        # Show specific turn
        if turn_idx >= len(turns):
            print(f"❌ Turn {turn_idx} not found (only {len(turns)} turns)")
            return

        show_turn(turns[turn_idx], turn_idx, show_full)
    else:
        # Show all turns
        for i, turn in enumerate(turns):
            show_turn(turn, i, show_full)
            if i < len(turns) - 1:
                print("\n" + "-" * 80 + "\n")

    client.close()

def show_turn(turn, turn_idx, show_full=False):
    """Display a single turn"""
    print(f"\n🔍 TURN {turn.get('turn_number', turn_idx)}")
    print(f"\nQUESTION: {turn.get('question', 'N/A')}")
    print(f"GOLD: {turn.get('gold_answer', 'N/A')}")

    # Get predicted from evaluation
    evaluation = turn.get('evaluation', {})
    predicted = evaluation.get('predicted_answer', 'N/A')
    print(f"PREDICTED: {predicted}")

    correct = evaluation.get('correct', False)
    status = "✅ CORRECT" if correct else "❌ WRONG"
    print(f"\nSTATUS: {status}")

    if not correct and turn.get('gold_answer') and predicted != 'N/A':
        try:
            diff = float(predicted) - float(turn['gold_answer'])
            print(f"DIFFERENCE: {diff:+.4f}")
        except:
            pass

    # Stage 0 - Rewriting
    stage0 = turn.get('stage0_rewrite', {})
    if stage0.get('rewritten_question'):
        print(f"\n📝 STAGE 0 - REWRITTEN QUESTION:")
        print(f"  {stage0['rewritten_question']}")

    # Stage 1 - Analysis
    stage1 = turn.get('stage1_analysis', {})
    hints = stage1.get('hints', {})

    if hints:
        print(f"\n🔍 STAGE 1 - ANALYSIS:")
        print(f"  Question Type: {hints.get('question_type', 'N/A')}")

        if 'extracted_values' in hints:
            print(f"\n  📊 EXTRACTED VALUES:")
            for val in hints['extracted_values']:
                print(f"    - {val.get('description', 'N/A')}: {val.get('value', 'N/A')} {val.get('units', '')}")
                print(f"      Source: {val.get('source_location', 'N/A')}")

        if 'calculation_plan' in hints:
            plan = hints['calculation_plan']
            print(f"\n  🧮 CALCULATION PLAN:")
            print(f"    Reasoning: {plan.get('reasoning', 'N/A')}")
            if 'steps' in plan:
                print(f"    Steps:")
                for i, step in enumerate(plan['steps'], 1):
                    print(f"      {i}. {step}")
            print(f"    Expected: {plan.get('expected_result_description', 'N/A')}")

    # Stage 2 - Answer
    stage2 = turn.get('stage2_answer', {})
    if stage2.get('answer'):
        print(f"\n💡 STAGE 2 - ANSWER:")
        print(f"  {stage2['answer']}")

    # Show full prompts if requested
    if show_full:
        if stage1.get('prompt'):
            print(f"\n📄 FULL STAGE 1 PROMPT:")
            print(stage1['prompt'])
        if stage2.get('prompt'):
            print(f"\n📄 FULL STAGE 2 PROMPT:")
            print(stage2['prompt'])

def main():
    if len(sys.argv) < 2:
        print("Usage: python inspect_logs.py <example_id> [turn_idx] [--full]")
        print("\nExamples:")
        print("  python inspect_logs.py 107        # All turns")
        print("  python inspect_logs.py 107 0      # Turn 0 only")
        print("  python inspect_logs.py 107 0 --full  # Turn 0 with full prompts")
        sys.exit(1)

    example_id = sys.argv[1]
    turn_idx = None
    show_full = '--full' in sys.argv

    if len(sys.argv) >= 3 and sys.argv[2] != '--full':
        turn_idx = int(sys.argv[2])

    inspect_example(example_id, turn_idx, show_full)

if __name__ == '__main__':
    main()
