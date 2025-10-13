"""
Test specific examples with logging enabled
"""
import json
import sys
from pathlib import Path
from solver import ConvFinQASolver

def test_example_with_logging(example_num: int):
    """Run a single example with logging enabled"""
    project_root = Path(__file__).parent.parent.parent

    # Load preprocessed
    preprocessed_path = project_root / "data" / "preprocessed" / f"{example_num}.json"
    with open(preprocessed_path, 'r') as f:
        preprocessed = json.load(f)

    # Load original for questions and gold answers
    dataset_path = project_root / "data" / "convfinqa_dataset.json"
    with open(dataset_path, 'r') as f:
        dataset = json.load(f)
    original = dataset['train'][example_num]

    # Build example
    example = {
        'id': preprocessed['example_id'],
        'questions': original['dialogue']['conv_questions'],
        'doc': {'table': preprocessed['table']},
        'knowledge_base': preprocessed['knowledge_base']
    }
    gold_answers = original['dialogue']['executed_answers']

    # Initialize solver (always logs)
    solver = ConvFinQASolver()

    print(f"Solving example {example_num}: {example['id']}")
    print(f"Questions: {len(example['questions'])}")
    print()

    # Solve
    result = solver.solve_conversation(example, gold_answers, example_id=str(example_num))

    print(f"\n✅ Logged to MongoDB: example ID = '{example_num}'")
    print(f"Predicted answers: {result['turns']}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_with_logging.py <example_num>")
        sys.exit(1)

    example_num = int(sys.argv[1])
    test_example_with_logging(example_num)
