#!/usr/bin/env python3
"""Test LLM-based value extraction vs SPARQL"""
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from phase2_llm_extraction import run_phase2_llm_extraction
from phase2_query import run_phase2_query
from execution import retrieve_values, load_graph

# Example 18, Turn 1 test case
test_case = {
    'example_id': '18',
    'turn': 1,
    'question': 'what is the compensation expense the company recorded in 2015?',
    'gold_answer': 43.0
}

# Mock Phase 1 output
values_spec = {
    'comp_expense_2015': {
        'description': 'The compensation expense recorded by the company for the fiscal year 2015',
        'semantic_type': 'monetary_value',
        'source': 'knowledge_graph'
    }
}

print("="*80)
print("TESTING: Example 18, Turn 1")
print(f"Question: {test_case['question']}")
print(f"Gold answer: {test_case['gold_answer']}")
print("="*80)

# Test 1: SPARQL approach (current)
print("\n### Method 1: SPARQL Query Generation (Current) ###\n")
try:
    queries = run_phase2_query(values_spec, None, test_case, verbose=True)

    # Execute SPARQL queries
    kg_graph = load_graph(test_case['example_id'])
    context = {'results_by_name': {}, 'kg_graph': kg_graph}

    # Add SPARQL to values_spec
    for name, query_info in queries.items():
        values_spec[name]['sparql'] = query_info['sparql']

    value_objects_sparql = retrieve_values(values_spec, context)

    print(f"\nResult: {value_objects_sparql['comp_expense_2015']}")
    sparql_value = value_objects_sparql['comp_expense_2015']['value']
    print(f"Value: {sparql_value}")
    print(f"Match: {abs(sparql_value - 43.0) < 0.1}")
except Exception as e:
    print(f"ERROR: {e}")
    sparql_value = None

# Test 2: LLM extraction (new)
print("\n" + "="*80)
print("\n### Method 2: Direct LLM Extraction (New) ###\n")

# Reset values_spec (remove SPARQL)
values_spec = {
    'comp_expense_2015': {
        'description': 'The compensation expense recorded by the company for the fiscal year 2015',
        'semantic_type': 'monetary_value',
        'source': 'knowledge_graph'
    }
}

try:
    value_objects_llm = run_phase2_llm_extraction(values_spec, None, test_case, verbose=True)

    print(f"\nResult: {value_objects_llm['comp_expense_2015']}")
    llm_value = value_objects_llm['comp_expense_2015']['value']
    print(f"Value: {llm_value}")
    print(f"Match: {abs(llm_value - 43.0) < 0.1}")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    llm_value = None

# Comparison
print("\n" + "="*80)
print("\n### COMPARISON ###\n")
print(f"Gold answer: {test_case['gold_answer']}")
if sparql_value is not None:
    print(f"SPARQL method: {sparql_value} ({'✓ CORRECT' if abs(sparql_value - 43.0) < 0.1 else '✗ WRONG'})")
else:
    print(f"SPARQL method: FAILED")

if llm_value is not None:
    print(f"LLM extraction: {llm_value} ({'✓ CORRECT' if abs(llm_value - 43.0) < 0.1 else '✗ WRONG'})")
else:
    print(f"LLM extraction: FAILED")
