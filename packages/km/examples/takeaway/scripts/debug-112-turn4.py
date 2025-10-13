"""Debug Example 112 Turn 4 - Why are we getting duplicate values?"""
import json
import sys
from pathlib import Path

# Add src/graph-solver to path (same as batch script)
src_dir = Path(__file__).parent.parent / "src" / "graph-solver"
sys.path.insert(0, str(src_dir))

from semantic_stage import SemanticUnderstandingStage
from query_stage_llm import QueryStageLLM
from calculation_stage import CalculationStage

# Load Example 112 KG
kg_file = Path(__file__).parent.parent / 'data' / 'preprocessed' / '112_kg.json'
with open(kg_file, 'r') as f:
    kg_data = json.load(f)

# Build schema
extracted_metrics = []
financial_metrics = {'row_labels': set(), 'column_labels': set()}

for entity in kg_data['entities']:
    if entity['type'] == 'FinancialMetric':
        if 'tableRow' in entity:
            financial_metrics['row_labels'].add(entity['tableRow'])
        if 'tableColumn' in entity:
            financial_metrics['column_labels'].add(entity['tableColumn'])
        if 'tableRow' not in entity and 'tableColumn' not in entity:
            extracted_metrics.append(entity['label'])

schema = {
    'entity_types': ['Company', 'FinancialMetric', 'Category', 'Year'],
    'attribute_types': ['numericValue', 'hasScale', 'tableRow', 'tableColumn'],
    'relationship_types': ['hasMetric', 'hasValue', 'forTimePeriod', 'inCategory'],
    'sample_entities': {
        'extracted_metrics': extracted_metrics,
        'financial_metrics': {
            'row_labels': sorted(financial_metrics['row_labels']),
            'column_labels': sorted(financial_metrics['column_labels'])
        }
    }
}

# Conversation history through Turn 3
conversation_history = [
    {'question': 'what was the long-term debt in 2015?', 'answer': 1610.3},
    {'question': 'and what was it in 2014?', 'answer': 1612.9},
    {'question': 'what was, then, the total long-term debt for those two years combined?', 'answer': 3223.2}
]

# Turn 4
question = 'and what was the total debt in that same period?'

print("=" * 80)
print("Example 112 Turn 4 - Duplicate Value Debug")
print("=" * 80)

# Stage 1: Semantic Understanding
semantic_stage = SemanticUnderstandingStage()
semantic_output = semantic_stage.analyze_question(question, schema, conversation_history)

print("\nSEMANTIC OUTPUT - Entity Constraints:")
constraints = semantic_output['query_specification']['entity_constraints']
print(f"Number of constraints: {len(constraints)}")
for i, constraint in enumerate(constraints):
    print(f"\nConstraint {i}:")
    print(json.dumps(constraint, indent=2))

# Stage 2: Query Generation
query_stage = QueryGenerationStage()
query_output = query_stage.generate_and_execute(
    question=question,
    semantic_output=semantic_output,
    schema=schema,
    graph_file='data/preprocessed/112_kg.ttl',
    conversation_history=conversation_history,
    debug=True
)

print(f"\n\n{'=' * 80}")
print(f"QUERY RESULTS: {len(query_output['raw_results'])} total results")
print("=" * 80)
for i, result in enumerate(query_output['raw_results']):
    print(f"\nResult {i}: Value={result.get('numericValue')} ({result.get('valueType')})")
    print(f"  Constraint index: {result.get('constraint_index')}")
    if 'tableRow' in result:
        print(f"  TableRow: {result.get('tableRow')}, TableColumn: {result.get('tableColumn')}")
    if 'label' in result:
        print(f"  Label: {result.get('label')}")

# Stage 3: Calculation
calc_stage = CalculationStage()
calc_output = calc_stage.calculate(semantic_output, query_output['raw_results'], conversation_history)

print(f"\n\n{'=' * 80}")
print("CALCULATION OUTPUT")
print("=" * 80)
print(f"Values used: {calc_output['values_used']}")
print(f"Sum: {sum(calc_output['values_used'])}")
print(f"Our answer: {calc_output['answer']}")
print(f"Expected answer: 3484.5")
print(f"Match: {calc_output['answer'] == 3484.5}")

print(f"\n\nPROBLEM: We have {len(calc_output['values_used'])} values instead of 2!")
print(f"Expected: [1722.2, 1762.3]")
print(f"Got: {calc_output['values_used']}")
