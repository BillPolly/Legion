"""
Debug Example 110 step by step
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


def main():
    print("=" * 80)
    print("DEBUGGING EXAMPLE 110")
    print("=" * 80)

    # Load dataset
    dataset_file = Path(__file__).parent.parent / "data" / "convfinqa_dataset.json"
    with open(dataset_file, 'r') as f:
        dataset_data = json.load(f)

    # Find Example 110
    example_data = None
    for split in ['train', 'dev', 'test']:
        if split in dataset_data:
            for ex in dataset_data[split]:
                if 'Double_RSG/2017/page_14.pdf' in ex['id']:
                    example_data = ex
                    break
        if example_data:
            break

    if not example_data:
        print("ERROR: Could not find Example 110")
        return

    questions = example_data['dialogue']['conv_questions']
    gold_answers_str = example_data['dialogue']['executed_answers']

    print(f"\nFound example: {example_data['id']}")
    print(f"Questions: {len(questions)}")
    print(f"Gold answers: {gold_answers_str}")

    # Convert gold answers
    gold_answers = []
    for ans_str in gold_answers_str:
        try:
            if '%' in ans_str:
                gold_answers.append(float(ans_str.replace('%', '')))
            else:
                gold_answers.append(float(ans_str))
        except:
            gold_answers.append(ans_str)

    print(f"Converted gold answers: {gold_answers}")

    # Initialize stages
    semantic_stage = SemanticUnderstandingStage()
    query_stage = QueryStageLLM()
    calc_stage = CalculationStage()

    data_dir = Path(__file__).parent.parent / "data" / "preprocessed"
    graph_file = data_dir / "110_kg.ttl"

    # Load KG extraction to get available entities
    kg_file = data_dir / "110_kg.json"
    with open(kg_file, 'r') as f:
        kg_data = json.load(f)

    # Build schema with available entities
    extracted_metrics = []
    financial_metrics = {'row_labels': set(), 'column_labels': set()}

    for entity in kg_data['entities']:
        if entity['type'] == 'FinancialMetric':
            if 'tableRow' in entity:
                financial_metrics['row_labels'].add(entity['tableRow'])
            if 'tableColumn' in entity:
                financial_metrics['column_labels'].add(entity['tableColumn'])
            if 'tableRow' not in entity and 'tableColumn' not in entity:
                # Extracted metric from knowledge base
                extracted_metrics.append(entity['label'])

    schema = {
        "entity_types": ["Company", "FinancialMetric", "Category", "Year"],
        "attribute_types": ["numericValue", "hasScale", "tableRow", "tableColumn"],
        "relationship_types": ["hasMetric", "hasValue", "forTimePeriod", "inCategory"],
        "sample_entities": {
            "extracted_metrics": extracted_metrics,
            "financial_metrics": {
                "row_labels": sorted(financial_metrics['row_labels']),
                "column_labels": sorted(financial_metrics['column_labels'])
            }
        }
    }

    print(f"\nSchema with sample entities:")
    print(f"  Extracted metrics: {extracted_metrics}")
    print(f"  Table row labels: {sorted(financial_metrics['row_labels'])}")
    print(f"  Table column labels: {sorted(financial_metrics['column_labels'])}")

    conversation_history = []

    for turn_idx, question in enumerate(questions):
        turn_num = turn_idx + 1

        print(f"\n{'='*80}")
        print(f"TURN {turn_num}")
        print(f"{'='*80}")
        print(f"Question: {question}")
        print(f"Gold answer: {gold_answers[turn_idx]}")

        # Stage 1: Semantic Understanding
        print(f"\n[Stage 1] Semantic Understanding")
        semantic_output = semantic_stage.analyze_question(
            question=question,
            schema=schema,
            conversation_history=conversation_history
        )

        print(f"  Calculation type: {semantic_output['calculation']['type']}")
        print(f"  Entity constraints:")
        for i, constraint in enumerate(semantic_output['query_specification']['entity_constraints'], 1):
            print(f"    {i}. Type: {constraint['type']}")
            print(f"       Filters: {constraint.get('filters', {})}")

        # Stage 2: Query
        print(f"\n[Stage 2] Query Generation & Execution (LLM)")
        query_output = query_stage.generate_and_execute(
            question=question,
            semantic_output=semantic_output,
            schema=schema,
            graph_file=graph_file,
            conversation_history=conversation_history,
            debug=True
        )

        print(f"\n  Results: {query_output['result_count']} rows")
        for i, result in enumerate(query_output['raw_results'], 1):
            print(f"    Result {i}: {result}")

        # Stage 3: Calculation
        print(f"\n[Stage 3] Calculation")
        calc_output = calc_stage.calculate(
            semantic_output=semantic_output,
            query_results=query_output['raw_results'],
            conversation_history=conversation_history
        )

        our_answer = calc_output['answer']
        gold_answer = gold_answers[turn_idx]

        print(f"\n  Our answer: {our_answer}")
        print(f"  Gold answer: {gold_answer}")
        print(f"  Match: {our_answer == gold_answer}")
        print(f"  Values used: {calc_output['values_used']}")
        print(f"  Types used: {calc_output['types_used']}")

        if our_answer != gold_answer:
            print(f"\n  ❌ MISMATCH!")
            if our_answer is None:
                print(f"     Problem: No answer calculated")
                print(f"     Query results were: {query_output['raw_results']}")
            else:
                print(f"     Difference: {abs(float(our_answer) - float(gold_answer)) if our_answer else 'N/A'}")

        # Update conversation history
        conversation_history.append({
            'question': question,
            'answer': our_answer
        })


if __name__ == "__main__":
    main()
