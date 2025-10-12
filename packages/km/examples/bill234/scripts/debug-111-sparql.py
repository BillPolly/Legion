"""
Debug Example 111 SPARQL queries
"""
import json
import sys
from pathlib import Path

# Add src to path
src_dir = Path(__file__).parent.parent / "src" / "graph-solver"
sys.path.insert(0, str(src_dir))

from semantic_stage import SemanticUnderstandingStage
from query_stage_llm import QueryStageLLM

# Load KG
data_dir = Path(__file__).parent.parent / "data" / "preprocessed"
kg_file = data_dir / "111_kg.json"
graph_file = data_dir / "111_kg.ttl"

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

print("=" * 80)
print("EXTRACTED METRICS (from knowledge base):")
print("=" * 80)
for m in extracted_metrics[:10]:
    print(f"  - {m}")

questions = [
    "what were the sublease revenues in 2008?",
    "and what were they in 2007?",
]

semantic_stage = SemanticUnderstandingStage()
query_stage = QueryStageLLM()

conversation_history = []

for i, question in enumerate(questions):
    print(f"\n{'=' * 80}")
    print(f"TURN {i+1}: {question}")
    print("=" * 80)

    # Stage 1: Semantic Understanding
    semantic_output = semantic_stage.analyze_question(
        question=question,
        schema=schema,
        conversation_history=conversation_history
    )

    print("\nSEMENTIC OUTPUT:")
    print(json.dumps(semantic_output, indent=2))

    # Stage 2: Query
    query_output = query_stage.generate_and_execute(
        question=question,
        semantic_output=semantic_output,
        schema=schema,
        graph_file=graph_file,
        conversation_history=conversation_history,
        debug=True  # Enable debug output
    )

    print(f"\nQUERY RESULTS: {len(query_output['raw_results'])} results")
    for r in query_output['raw_results']:
        print(f"  Value: {r.get('numericValue')}, Type: {r.get('valueType')}")

    # Update history
    answer = query_output['raw_results'][0].get('numericValue') if query_output['raw_results'] else None
    conversation_history.append({
        'question': question,
        'answer': answer
    })
