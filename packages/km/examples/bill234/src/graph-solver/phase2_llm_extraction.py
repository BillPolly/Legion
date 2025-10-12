#!/usr/bin/env python3
"""Phase 2A Alternative: Direct LLM value extraction (no SPARQL)"""
import sys
from pathlib import Path
import json
from jinja2 import Environment, FileSystemLoader

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from common.llm_client import call_llm
from execution import load_graph, extract_sample_entities


def parse_json_response(response):
    """Parse JSON response, handling markdown code fences and explanatory text"""
    response = response.strip()

    # Handle outer markdown code fences
    if response.startswith('```json'):
        response = response[7:]
    elif response.startswith('```'):
        response = response[3:]
    if response.endswith('```'):
        response = response[:-3]
    response = response.strip()

    # Strip out markdown code blocks (```json...```) that are examples, not the actual response
    import re
    # Remove code fences that are clearly examples/explanations
    response = re.sub(r'```json\s*\{[^`]+\}\s*```', '', response)
    response = response.strip()

    # Handle explanatory text before JSON by finding the first '{'
    json_start = response.find('{')
    if json_start > 0:
        response = response[json_start:]

    # Now try to parse - use strict=False to allow control characters
    try:
        return json.loads(response, strict=False)
    except json.JSONDecodeError as e:
        # Find ALL complete JSON objects and pick the largest
        json_objects = []
        brace_count = 0
        start_idx = None

        for i, char in enumerate(response):
            if char == '{':
                if brace_count == 0:
                    start_idx = i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and start_idx is not None:
                    # Found complete JSON object
                    try:
                        obj = json.loads(response[start_idx:i+1], strict=False)
                        json_objects.append((obj, i - start_idx + 1, response[start_idx:i+1]))
                    except:
                        pass
                    start_idx = None

        if json_objects:
            # Return the largest JSON object (by character count)
            return max(json_objects, key=lambda x: x[1])[0]

        # If we get here, couldn't find any valid JSON
        raise


def extract_table_data_for_prompt(graph):
    """
    Extract ALL table data from KG as row-oriented JSON

    ALSO extracts column/row header values (metrics with numeric values in headers)
    ALSO extracts rdfs:comment annotations (footnote explanations)

    Returns dict with:
    {
        "table_cells": list of row objects where each row has:
            {"metric": "row label", "column1": {"value": X, "scale": "Y"}, ...},
        "column_header_values": list of {"label": "$ 9889", "value": 9889.0, "scale": "Units"},
        "row_header_values": list of {"label": "...", "value": X, "scale": "Y"},
        "metric_comments": dict mapping row labels to their footnote explanations
    }

    This format is more natural for LLMs - they can read row by row like a human.
    """
    from rdflib.namespace import RDF, RDFS
    from rdflib import Namespace
    from collections import defaultdict

    KG = Namespace('http://example.org/convfinqa/')

    # First pass: collect all data grouped by row
    rows_data = defaultdict(dict)  # {row_label: {col_label: {value, scale} or text_value}}
    column_header_values = []  # Metrics with only column label (header values)
    row_header_values = []  # Metrics with only row label (header values)
    text_derived_metrics = []  # Metrics from text (no tableRow/tableColumn)
    metric_comments = {}  # {row_label: footnote_explanation} for semantic matching

    # Query for all metrics with tableRow and tableColumn
    for metric in graph.subjects(RDF.type, KG.FinancialMetric):
        row_label = None
        col_label = None
        value = None
        scale = None
        text_value = None
        comment = None

        # Get row label
        for row in graph.objects(metric, KG.tableRow):
            row_label = str(row)
            break

        # Get column label
        for col in graph.objects(metric, KG.tableColumn):
            col_label = str(col)
            break

        # Get comment if present (footnote explanation)
        for cmt in graph.objects(metric, RDFS.comment):
            comment = str(cmt)
            break

        # Try to get numeric value first
        for value_entity in graph.objects(metric, KG.hasValue):
            # Get numeric value
            for num_val in graph.objects(value_entity, KG.numericValue):
                value = float(num_val)

            # Get scale
            for scale_uri in graph.objects(value_entity, KG.hasScale):
                scale = str(scale_uri).split('/')[-1].split('#')[-1]

            break

        # If no numeric value, check for text value
        if value is None:
            for text_val in graph.objects(metric, KG.textValue):
                text_value = str(text_val)
                break

        # Skip if neither value type found
        if value is None and text_value is None:
            continue

        # Store comment for this row label (if present)
        if row_label and comment:
            # Store comment (only need one per row_label, even if multiple columns)
            if row_label not in metric_comments:
                metric_comments[row_label] = comment

        # Categorize metric based on what it has
        if row_label and col_label:
            # Regular table cell (numeric or text)
            if value is not None:
                rows_data[row_label][col_label] = {
                    "value": value,
                    "scale": scale or "Units"
                }
            else:
                # Text cell - store as simple string
                rows_data[row_label][col_label] = text_value
        elif col_label and not row_label and value is not None:
            # Column header value (e.g., "$ 9889" column header)
            column_header_values.append({
                "label": col_label,
                "value": value,
                "scale": scale or "Units"
            })
        elif row_label and not col_label and value is not None:
            # Row header value (less common)
            row_header_values.append({
                "label": row_label,
                "value": value,
                "scale": scale or "Units"
            })
        elif not row_label and not col_label and value is not None:
            # Text-derived metric (no table structure)
            # Get the metric label
            for label in graph.objects(metric, KG.label):
                metric_label = str(label)
                text_derived_metrics.append({
                    "label": metric_label,
                    "value": value,
                    "scale": scale or "Units"
                })
                break

    # Second pass: convert rows_data to list of row objects
    table_rows = []
    for row_label, columns in rows_data.items():
        row_obj = {"metric": row_label}
        row_obj.update(columns)
        table_rows.append(row_obj)

    return {
        "table_cells": table_rows,
        "column_header_values": column_header_values,
        "row_header_values": row_header_values,
        "text_derived_metrics": text_derived_metrics,
        "metric_comments": metric_comments
    }


def run_phase2_llm_extraction(values_spec, kg_schema, test_case, verbose=False):
    """
    Extract values directly from KG using LLM (alternative to SPARQL generation)

    Args:
        values_spec: From Phase 1 - dict of value specs
        kg_schema: Knowledge graph schema (ontology snippet)
        test_case: Dict with example_id, turn, question for logging
        verbose: Print debug info

    Returns:
        {name: {value, scale, source, description}} for each KG value
    """
    # Filter to only knowledge_graph values
    kg_values = {k: v for k, v in values_spec.items() if v.get('source') == 'knowledge_graph'}

    if not kg_values:
        if verbose:
            print("\n--- PHASE 2A (LLM Extraction): Value Extraction ---")
            print("No knowledge graph values needed, skipping")
        return {}

    if verbose:
        print(f"\n--- PHASE 2A (LLM Extraction): Value Extraction ---")
        print(f"Extracting {len(kg_values)} values directly from KG")

    # Load graph and extract entities + table data
    try:
        kg_graph = load_graph(test_case['example_id'])
        sample_entities = extract_sample_entities(kg_graph)

        # Extract full table data for LLM (including header values and comments!)
        table_data_full = extract_table_data_for_prompt(kg_graph)
        sample_entities['table_data'] = table_data_full['table_cells']
        sample_entities['column_header_values'] = table_data_full['column_header_values']
        sample_entities['row_header_values'] = table_data_full['row_header_values']
        sample_entities['text_derived_metrics'] = table_data_full['text_derived_metrics']
        sample_entities['metric_comments'] = table_data_full['metric_comments']

        if verbose:
            print(f"  Extracted from graph:")
            print(f"    - {len(sample_entities['extracted_metrics'])} extracted metrics")
            print(f"    - {len(sample_entities['financial_metrics']['row_labels'])} row labels")
            print(f"    - {len(sample_entities['financial_metrics']['column_labels'])} column labels")
            print(f"    - {len(table_data_full['table_cells'])} table cells")
            if table_data_full['column_header_values']:
                print(f"    - {len(table_data_full['column_header_values'])} column header values")
            if table_data_full['row_header_values']:
                print(f"    - {len(table_data_full['row_header_values'])} row header values")
            if table_data_full['text_derived_metrics']:
                print(f"    - {len(table_data_full['text_derived_metrics'])} text-derived metrics")
    except FileNotFoundError:
        if verbose:
            print("  Warning: No knowledge graph found")
        raise

    # Load prompt template
    template_dir = Path(__file__).parent / 'prompts'
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template('value_extraction.j2')

    # Render prompt
    prompt = template.render(
        values=kg_values,
        sample_entities=sample_entities,
        question=test_case.get('question')
    )

    if verbose:
        print("Calling LLM to extract values directly...")

    # Call LLM
    response = call_llm(
        prompt,
        metadata={
            'example_id': test_case.get('example_id'),
            'turn': test_case.get('turn'),
            'phase': 'phase2a_llm_extraction',
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

    extracted_values = result['values']

    # Convert to format expected by Phase 3 (execution.py:retrieve_values)
    # Phase 3 expects values_spec with 'sparql' key, but we'll directly return value objects
    value_objects = {}
    for name, extraction in extracted_values.items():
        if name not in kg_values:
            if verbose:
                print(f"  Warning: LLM returned unexpected value '{name}'")
            continue

        value_objects[name] = {
            'value': extraction['value'],
            'scale': extraction.get('scale', 'Units'),
            'source': 'knowledge graph (LLM extraction)',
            'description': kg_values[name]['description'],
            'source_row': extraction.get('source_row'),
            'source_column': extraction.get('source_column'),
            'reasoning': extraction.get('reasoning')
        }

    if verbose:
        print(f"Extracted {len(value_objects)} values")
        for name, obj in value_objects.items():
            print(f"\n{name}:")
            print(f"  Value: {obj['value']} ({obj['scale']})")
            print(f"  From: {obj.get('source_row', 'N/A')} × {obj.get('source_column', 'N/A')}")
            if obj.get('reasoning'):
                print(f"  Reasoning: {obj['reasoning']}")

    return value_objects


if __name__ == "__main__":
    # Test with Example 18 Turn 1
    from phase1 import run_phase1_planning

    test_case = {
        'example_id': '18',
        'turn': 1,
        'question': 'what is the compensation expense the company recorded in 2015?',
        'gold_answer': 43.0
    }

    # Run Phase 1
    print("=== PHASE 1: Value Planning ===")
    phase1_result = run_phase1_planning(
        question=test_case['question'],
        previous_results={},
        test_case=test_case,
        verbose=True
    )

    # Run Phase 2A (LLM Extraction)
    print("\n" + "="*80)
    value_objects = run_phase2_llm_extraction(
        values_spec=phase1_result['values'],
        kg_schema=None,
        test_case=test_case,
        verbose=True
    )

    print("\n" + "="*80)
    print("=== RESULT ===")
    print(f"Extracted value: {value_objects}")
    print(f"Expected: 43.0")
    if 'comp_expense_2015' in value_objects:
        print(f"Match: {abs(value_objects['comp_expense_2015']['value'] - 43.0) < 0.1}")
