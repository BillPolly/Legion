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
from query_stage_llm import QueryStageLLM
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

    graph_file = data_dir / f"{example_id}_kg.ttl"

    if not graph_file.exists():
        print(f"[ERROR] Graph file not found: {graph_file}")
        return {
            'example_id': example_id,
            'error': 'Graph file not found',
            'results': []
        }

    # Build schema from TTL (ontology) not JSON
    # Query the RDF graph directly to get full ontology structure
    from rdflib import Graph as RDFGraph, Namespace

    rdf_graph = RDFGraph()
    rdf_graph.parse(graph_file, format='turtle')
    kg_ns = Namespace("http://example.org/convfinqa/")

    # Extract metrics with their actual properties from ontology
    extracted_metrics_with_props = []
    financial_metrics = {'row_labels': set(), 'column_labels': set()}

    for subj in rdf_graph.subjects(predicate=kg_ns.label):
        entity_type = rdf_graph.value(subj, predicate=kg_ns['type']) or list(rdf_graph.objects(subj, predicate=None))[0]
        if 'FinancialMetric' in str(entity_type):
            label = str(rdf_graph.value(subj, predicate=kg_ns.label))
            table_row = rdf_graph.value(subj, predicate=kg_ns.tableRow)
            table_col = rdf_graph.value(subj, predicate=kg_ns.tableColumn)
            has_year = rdf_graph.value(subj, predicate=kg_ns.forTimePeriod) is not None

            if table_row and table_col:
                financial_metrics['row_labels'].add(str(table_row))
                financial_metrics['column_labels'].add(str(table_col))
            elif not table_row and not table_col:
                extracted_metrics_with_props.append({
                    'label': label,
                    'hasYear': has_year
                })

    schema = {
        "entity_types": ["Company", "FinancialMetric", "Category", "Year"],
        "attribute_types": ["numericValue", "hasScale", "tableRow", "tableColumn"],
        "relationship_types": ["hasMetric", "hasValue", "forTimePeriod", "inCategory"],
        "sample_entities": {
            "extracted_metrics": [m['label'] + (' [has year]' if m['hasYear'] else ' [no year]') for m in extracted_metrics_with_props],
            "financial_metrics": {
                "row_labels": sorted(financial_metrics['row_labels']),
                "column_labels": sorted(financial_metrics['column_labels'])
            }
        }
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
                conversation_history=conversation_history,
                example_id=example_id,
                turn=turn_num
            )

            # Stage 2: Query
            query_output = stages['query'].generate_and_execute(
                question=question,
                semantic_output=semantic_output,
                schema=schema,
                graph_file=graph_file,
                conversation_history=conversation_history,
                debug=False,
                example_id=example_id,
                turn=turn_num
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

            # Update conversation history with VALUE OBJECT (not just rounded number!)
            result_value_object = calc_output.get('result_value_object')
            conversation_history.append({
                'question': question,
                'answer': our_answer,  # Rounded answer for display
                'value_object': result_value_object  # Full value object with precision
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
    """Run ontology-based solver on NEW examples (not 109, 110 which are already 5/5)"""

    # Just list example numbers - we'll get full IDs from KG files
    example_numbers = [111, 112, 114, 115, 116, 117]

    print("=" * 80)
    print("ONTOLOGY-BASED GRAPH SOLVER - BATCH EVALUATION")
    print("=" * 80)

    data_dir = Path(__file__).parent.parent / "data" / "preprocessed"

    # Load dataset
    print("\nLoading dataset...")
    dataset = load_dataset()

    # Initialize stages (reuse across examples)
    print("Initializing solver stages...")
    stages = {
        'semantic': SemanticUnderstandingStage(),
        'query': QueryStageLLM(),
        'calc': CalculationStage()
    }

    all_results = []

    for example_num in example_numbers:
        # Load KG to get full example_id
        kg_file = data_dir / f"{example_num}_kg.json"

        if not kg_file.exists():
            print(f"\n[ERROR] KG file not found for example {example_num}")
            continue

        with open(kg_file, 'r') as f:
            kg_data = json.load(f)

        # Get full example_id from preprocessed data (fallback to KG metadata)
        preprocessed_file = data_dir / f"{example_num}.json"
        with open(preprocessed_file, 'r') as f:
            preprocessed_data = json.load(f)

        full_id = preprocessed_data.get('example_id', '')

        print(f"\n{'=' * 80}")
        print(f"Example {example_num} ({full_id})")
        print(f"{'=' * 80}")

        # Find example in dataset using full ID
        example_data = find_example(dataset, full_id)

        if not example_data:
            print(f"[ERROR] Example {full_id} not found in dataset")
            continue

        # Run solver
        result = run_solver(str(example_num), example_data, stages, data_dir)
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
