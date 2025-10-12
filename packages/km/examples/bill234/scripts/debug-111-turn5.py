#!/usr/bin/env python3
"""
Debug Example 111 Turn 5 - Previous answer references issue
"""

import json
import sys
from pathlib import Path

src_dir = Path(__file__).parent.parent / "src" / "graph-solver"
sys.path.insert(0, str(src_dir))

from semantic_stage import SemanticUnderstandingStage
from query_stage_llm import QueryStageLLM
from calculation_stage import CalculationStage

# We don't need to load the dataset for this debug
print("Debugging Example 111 Turn 5")
print()

# Simulate conversation history up to Turn 4
conversation_history = [
    {'question': 'what were the sublease revenues in 2008?', 'answer': 7.1},
    {'question': 'and what were they in 2007?', 'answer': 7.7},
    {'question': 'what was, then, the change over the year?', 'answer': -0.6},
    {'question': 'what were the sublease revenues in 2007?', 'answer': 7.7},
]

print("Conversation history (at Turn 5):")
for idx, turn in enumerate(conversation_history):
    print(f"  Index {idx}: Q: {turn['question']}")
    print(f"           A: {turn['answer']}")
print()

# Turn 5 question
question = "and how much does that change represent in relation to these 2007 sublease revenues?"
print(f"Turn 5 Question: {question}")
print()

# Run semantic stage
print("=" * 80)
print("STAGE 1: SEMANTIC UNDERSTANDING")
print("=" * 80)

semantic_stage = SemanticUnderstandingStage()
schema = {
    'entity_types': ['Company', 'FinancialMetric', 'Category', 'Year'],
    'attribute_types': ['numericValue', 'hasScale', 'tableRow', 'tableColumn'],
    'relationship_types': ['hasMetric', 'hasValue', 'forTimePeriod', 'inCategory']
}

semantic_output = semantic_stage.analyze_question(
    question=question,
    schema=schema,
    conversation_history=conversation_history
)

print(json.dumps(semantic_output, indent=2))
print()

# Extract previous_answer_references
previous_refs = semantic_output.get('query_specification', {}).get('previous_answer_references', [])
print("Previous answer references:")
for ref in previous_refs:
    turn_idx = ref['turn_index']
    desc = ref.get('description', '')
    print(f"  turn_index: {turn_idx}, description: {desc}")

    if turn_idx < len(conversation_history):
        value = conversation_history[turn_idx]['answer']
        print(f"    → conversation_history[{turn_idx}] = {value}")
    else:
        print(f"    → ERROR: turn_index {turn_idx} >= len(conversation_history) = {len(conversation_history)}")
print()

# Run query stage with debug
print("=" * 80)
print("STAGE 2: QUERY GENERATION")
print("=" * 80)

query_stage = QueryStageLLM()
graph_file = Path(__file__).parent.parent / "data" / "preprocessed" / "111_kg.ttl"

query_output = query_stage.generate_and_execute(
    question=question,
    semantic_output=semantic_output,
    schema=schema,
    graph_file=str(graph_file),
    conversation_history=conversation_history,
    debug=True
)

print()
print("Raw results:")
for idx, result in enumerate(query_output['raw_results']):
    print(f"  [{idx}] numericValue: {result.get('numericValue')}, valueType: {result.get('valueType')}, constraint_index: {result.get('constraint_index')}")
print()

# Run calculation stage
print("=" * 80)
print("STAGE 3: CALCULATION")
print("=" * 80)

calc_stage = CalculationStage()
calc_output = calc_stage.calculate(
    semantic_output=semantic_output,
    query_results=query_output['raw_results'],
    conversation_history=conversation_history
)

print(f"Calculation type: {calc_output['calculation_type']}")
print(f"Values used: {calc_output['values_used']}")
print(f"Answer: {calc_output['answer']}")
print(f"Gold answer: -0.07792")
print(f"Match: {calc_output['answer'] == -0.07792}")
