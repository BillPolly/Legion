"""
Debug Example 115 - Sign handling issue
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

# Load KG
data_dir = Path(__file__).parent.parent / "data" / "preprocessed"
kg_file = data_dir / "115_kg.json"
graph_file = data_dir / "115_kg.ttl"

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

question = "what is the sum of net interest margin in 2007 and 2008?"

print("=" * 80)
print("DEBUG EXAMPLE 115 - Sign Handling")
print("=" * 80)
print(f"\nQuestion: {question}")

# Stage 1: Semantic Understanding
semantic_stage = SemanticUnderstandingStage()
semantic_output = semantic_stage.analyze_question(
    question=question,
    schema=schema,
    conversation_history=[]
)

print("\n" + "=" * 80)
print("SEMANTIC OUTPUT:")
print("=" * 80)
print(json.dumps(semantic_output, indent=2))

# Check if sign_handling is set
calculation_spec = semantic_output.get('calculation', {})
sign_handling = calculation_spec.get('sign_handling', 'natural')
print(f"\n⚠️  Sign handling: {sign_handling}")
if sign_handling == 'natural':
    print("   ❌ Problem: Should be 'magnitude' or 'always_positive' for this sum!")
    print("   The values are negative percentages that should be summed as positive")
