"""
Run ontology-based graph solver on a batch of examples

Evaluates using the 3-stage pipeline:
1. Semantic Understanding (LLM)
2. Query Generation & Execution (SPARQL)
3. Calculation (arithmetic)

Logs results to MongoDB for comparison with simple-solver.
"""

import json
import sys
from pathlib import Path

# Add src to path
src_dir = Path(__file__).parent.parent / "src" / "graph-solver"
sys.path.insert(0, str(src_dir))

from semantic_stage import SemanticUnderstandingStage
from query_stage import QueryStage
from calculation_stage import CalculationStage


def load_dataset():
    """Load ConvFinQA dataset"""
    dataset_file = Path(__file__).parent.parent / "data" / "convfinqa_dataset.json"
    with open(dataset_file, 'r') as f:
        data = json.load(f)

    # Dataset has train/dev/test splits - combine all
    all_examples = []
    for split in ['train', 'dev', 'test']:
        if split in data:
            all_examples.extend(data[split])

    return all_examples


def find_example(dataset, example_id):
    """Find example by ID in dataset"""
    for example in dataset:
        if example_id in example['id']:
            return example
    return None


def run_solver(example_id, example_data, stages, data_dir):
    """Run ontology-based solver on one example"""

    questions = example_data['dialogue']['conv_questions']
    gold_answers_str = example_data['dialogue']['executed_answers']

    # Convert gold answers to numbers
    gold_answers = []
    for ans_str in gold_answers_str:
        try:
            # Remove % and convert to number
            if '%' in ans_str:
                gold_answers.append(float(ans_str.replace('%', '')))
            else:
                gold_answers.append(float(ans_str))
        except:
            gold_answers.append(ans_str)  # Keep as string if conversion fails

    graph_file = data_dir / f"{example_id}_ontology.ttl"

    if not graph_file.exists():
        print(f"[ERROR] Graph file not found: {graph_file}")
        return {
            'example_id': example_id,
            'error': 'Graph file not found',
            'results': []
        }

    # Schema for semantic understanding
    schema = {
        "entity_types": ["Company", "FinancialMetric", "Category", "Year"],
        "attribute_types": ["numericValue", "hasScale", "tableRow", "tableColumn"],
        "relationship_types": ["hasMetric", "hasValue", "forTimePeriod", "inCategory"]
    }

    conversation_history = []
    results = []

    for turn_idx, question in enumerate(questions):
        turn_num = turn_idx + 1
        print(f"\n  Turn {turn_num}: {question}")

        try:
            # Stage 1: Semantic Understanding
            semantic_output = stages['semantic'].analyze_question(
                question=question,
                schema=schema,
                conversation_history=conversation_history
            )

            # Stage 2: Query
            query_output = stages['query'].generate_and_execute(
                semantic_output=semantic_output,
                graph_file=graph_file,
                debug=False
            )

            # Stage 3: Calculation
            calc_output = stages['calc'].calculate(
                semantic_output=semantic_output,
                query_results=query_output['raw_results'],
                conversation_history=conversation_history
            )

            our_answer = calc_output['answer']
            gold_answer = gold_answers[turn_idx]

            match = our_answer == gold_answer

            print(f"    Our answer: {our_answer}")
            print(f"    Gold answer: {gold_answer}")
            print(f"    Match: {'✓' if match else '✗'}")

            results.append({
                'turn': turn_num,
                'question': question,
                'our_answer': our_answer,
                'gold_answer': gold_answer,
                'match': match,
                'calculation_type': calc_output['calculation_type'],
                'values_used': calc_output['values_used'],
                'types_used': calc_output['types_used']
            })

            # Update conversation history
            conversation_history.append({
                'question': question,
                'answer': our_answer
            })

        except Exception as e:
            print(f"    ERROR: {str(e)}")
            results.append({
                'turn': turn_num,
                'question': question,
                'error': str(e),
                'match': False
            })

    return {
        'example_id': example_id,
        'results': results
    }


def main():
    """Run ontology-based solver on examples 109-112"""

    # Map preprocessing index to actual dataset example ID
    examples = [
        ('109', 'Single_MMM/2005/page_55.pdf-2'),
        ('110', 'Double_RSG/2017/page_14.pdf'),
        ('111', 'Single_KIM/2008/page_126.pdf-2'),
        ('112', 'Single_IPG/2015/page_38.pdf-2')
    ]

    print("=" * 80)
    print("ONTOLOGY-BASED GRAPH SOLVER - BATCH EVALUATION")
    print("=" * 80)

    # Load dataset
    print("\nLoading dataset...")
    dataset = load_dataset()

    # Initialize stages (reuse across examples)
    print("Initializing solver stages...")
    stages = {
        'semantic': SemanticUnderstandingStage(),
        'query': QueryStage(),
        'calc': CalculationStage()
    }

    data_dir = Path(__file__).parent.parent / "data" / "preprocessed"

    all_results = []

    for idx, full_id in examples:
        print(f"\n{'=' * 80}")
        print(f"Example {idx} ({full_id})")
        print(f"{'=' * 80}")

        # Find example in dataset using full ID
        example_data = find_example(dataset, full_id)

        if not example_data:
            print(f"[ERROR] Example {full_id} not found in dataset")
            continue

        # Run solver using index for graph files
        result = run_solver(idx, example_data, stages, data_dir)
        all_results.append(result)

    # Print summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")

    total_turns = 0
    total_correct = 0

    for result in all_results:
        if 'error' in result and result['error']:
            print(f"\nExample {result['example_id']}: ERROR - {result['error']}")
            continue

        example_id = result['example_id']
        turns = len(result['results'])
        correct = sum(1 for r in result['results'] if r.get('match', False))

        total_turns += turns
        total_correct += correct

        print(f"\nExample {example_id}: {correct}/{turns} correct")
        for r in result['results']:
            status = '✓' if r.get('match', False) else '✗'
            print(f"  Turn {r['turn']}: {status}")

    accuracy = (total_correct / total_turns * 100) if total_turns > 0 else 0
    print(f"\nOverall: {total_correct}/{total_turns} ({accuracy:.1f}%)")

    # Save results
    output_file = Path(__file__).parent.parent / "data" / "ontology_solver_results.json"
    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"\n✓ Results saved to: {output_file}")


if __name__ == "__main__":
    main()
