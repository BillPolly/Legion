#!/usr/bin/env python3
"""Phase 2A: Query Generation - Generate SPARQL for knowledge graph values"""
import sys
from pathlib import Path
import json
from jinja2 import Environment, FileSystemLoader

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from common.llm_client import call_llm
from execution import load_graph, extract_sample_entities


def parse_json_response(response):
    """Parse JSON response, handling markdown code fences"""
    response = response.strip()
    if response.startswith('```json'):
        response = response[7:]
    elif response.startswith('```'):
        response = response[3:]
    if response.endswith('```'):
        response = response[:-3]
    response = response.strip()
    return json.loads(response)


def run_phase2_query(values_spec, kg_schema, test_case, verbose=False):
    """
    Generate SPARQL queries for knowledge_graph values

    Args:
        values_spec: From Phase 1 - dict of value specs
        kg_schema: Knowledge graph schema (ontology snippet)
        test_case: Dict with example_id, turn, question for logging
        verbose: Print debug info

    Returns:
        {name: {'sparql': '...', 'description': '...'}} for each KG value
    """
    # Filter to only knowledge_graph values
    kg_values = {k: v for k, v in values_spec.items() if v.get('source') == 'knowledge_graph'}

    if not kg_values:
        if verbose:
            print("\n--- PHASE 2A: Query Generation ---")
            print("No knowledge graph values needed, skipping")
        return {}

    if verbose:
        print(f"\n--- PHASE 2A: Query Generation ---")
        print(f"Generating SPARQL for {len(kg_values)} values")

    # Load graph and extract sample entities
    try:
        kg_graph = load_graph(test_case['example_id'])
        sample_entities = extract_sample_entities(kg_graph)
        if verbose:
            print(f"  Extracted entities from graph:")
            print(f"    - {len(sample_entities['extracted_metrics'])} extracted metrics")
            print(f"    - {len(sample_entities['financial_metrics']['row_labels'])} row labels")
            print(f"    - {len(sample_entities['financial_metrics']['column_labels'])} column labels")
    except FileNotFoundError:
        if verbose:
            print("  Warning: No knowledge graph found, proceeding without sample entities")
        sample_entities = None

    # Load prompt template
    template_dir = Path(__file__).parent / 'prompts'
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template('query_generation.j2')

    # Render prompt
    prompt = template.render(
        values=kg_values,
        sample_entities=sample_entities
    )

    if verbose:
        print("Calling LLM to generate SPARQL queries...")

    # Call LLM
    response = call_llm(
        prompt,
        metadata={
            'example_id': test_case.get('example_id'),
            'turn': test_case.get('turn'),
            'phase': 'phase2a_query_generation',
            'question': test_case.get('question')
        }
    )

    # Parse response
    try:
        result = parse_json_response(response)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}\nResponse: {response}")

    if 'values' not in result:
        raise ValueError(f"LLM response missing 'values' key: {result}")

    queries = result['values']

    if verbose:
        print(f"Generated {len(queries)} SPARQL queries")
        for name, query_info in queries.items():
            print(f"\n{name}:")
            print(f"  {query_info.get('description', 'No description')}")
            print(f"  SPARQL: {query_info.get('sparql', 'No SPARQL')[:100]}...")

    return queries


if __name__ == "__main__":
    print("Phase 2A: SPARQL query generation")
    print("Not needed for Example 2 (all values from previous results)")
    print("Will implement when testing examples that need KG queries")
