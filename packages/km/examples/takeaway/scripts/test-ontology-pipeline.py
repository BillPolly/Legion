"""
Test script for ontology-based graph solver pipeline

Tests the full 3-stage pipeline on Example 110:
1. Semantic Understanding (LLM analyzes question)
2. Query Generation & Execution (SPARQL on ontology-based graph)
3. Calculation (arithmetic on retrieved values)
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


def test_example_110():
    """Test ontology-based pipeline on Example 110"""

    # Load preprocessed data
    data_dir = Path(__file__).parent.parent / "data" / "preprocessed"
    example_file = data_dir / "110.json"
    graph_file = data_dir / "110_ontology.ttl"

    with open(example_file, 'r') as f:
        preprocessed = json.load(f)

    # Example 110 questions and gold answers (hardcoded for testing)
    questions = [
        "what was the total number of residential vehicles in 2017?",
        "what is the residential divided by the large-container?"
    ]
    gold_answers = [7200, 1.76]  # Gold answer for turn 2 is rounded

    print("=" * 80)
    print("ONTOLOGY-BASED GRAPH SOLVER - Example 110")
    print("=" * 80)

    # Initialize stages
    semantic_stage = SemanticUnderstandingStage()
    query_stage = QueryStage()
    calc_stage = CalculationStage()

    conversation_history = []

    for i, question in enumerate(questions):
        print(f"\n{'-' * 80}")
        print(f"TURN {i+1}: {question}")
        print(f"Gold Answer: {gold_answers[i]}")
        print(f"{'-' * 80}")

        # Stage 1: Semantic Understanding
        print("\n[Stage 1] Semantic Understanding...")

        # For simplicity, we'll create a mock schema
        # In real implementation, this would come from the graph
        schema = {
            "entity_types": ["Company", "FinancialMetric", "Category", "Year"],
            "attribute_types": ["numericValue", "hasScale", "tableRow", "tableColumn"],
            "relationship_types": ["hasMetric", "hasValue", "forTimePeriod", "inCategory"]
        }

        semantic_output = semantic_stage.analyze_question(
            question=question,
            schema=schema,
            conversation_history=conversation_history
        )

        print(f"Calculation type: {semantic_output['calculation']['type']}")
        print(f"Query spec: {json.dumps(semantic_output['query_specification'], indent=2)}")

        # Stage 2: Query Generation & Execution
        print("\n[Stage 2] Query Generation & Execution...")
        query_output = query_stage.generate_and_execute(
            semantic_output=semantic_output,
            graph_file=graph_file,
            debug=True
        )

        print(f"\nSPARQL Query:\n{query_output['sparql_query']}")
        print(f"\nResults: {query_output['result_count']} rows")
        for j, result in enumerate(query_output['raw_results'], 1):
            print(f"  Result {j}: {result}")

        # Stage 3: Calculation
        print("\n[Stage 3] Calculation...")
        calc_output = calc_stage.calculate(
            semantic_output=semantic_output,
            query_results=query_output['raw_results'],
            conversation_history=conversation_history
        )

        our_answer = calc_output['answer']
        gold_answer = gold_answers[i]

        print(f"\nOur Answer: {our_answer}")
        print(f"Gold Answer: {gold_answer}")
        print(f"Match: {our_answer == gold_answer}")
        print(f"Values Used: {calc_output['values_used']}")
        print(f"Types Used: {calc_output['types_used']}")
        print(f"Scales Used: {calc_output['scales_used']}")

        # Update conversation history
        conversation_history.append({
            'question': question,
            'answer': our_answer
        })

    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    test_example_110()
