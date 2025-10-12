#!/usr/bin/env python3
"""Phase 1: Value Planning - Value identification (pronouns resolved in Phase 0)"""
import sys
from pathlib import Path
import json
from jinja2 import Environment, FileSystemLoader

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from common.llm_client import call_llm
from phase0_pronoun_resolution import run_phase0_pronoun_resolution
from validators import validate_pronoun_resolution
from retry_framework import run_phase_with_retry


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

    # Handle explanatory text before JSON by finding the first '{'
    json_start = response.find('{')
    if json_start > 0:
        response = response[json_start:]

    # Now try to parse - use strict=False to allow control characters
    try:
        return json.loads(response, strict=False)
    except json.JSONDecodeError as e:
        # Try to extract just the JSON object by counting braces
        brace_count = 0
        for i, char in enumerate(response):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    # Found complete JSON object
                    try:
                        return json.loads(response[:i+1], strict=False)
                    except:
                        pass
        # If we get here, couldn't find balanced JSON
        raise


def run_phase1(test_case, previous_results, calculation_rules, verbose=False, kg_graph=None):
    """
    Phase 1: Identify values, classify semantic types (pronouns resolved in Phase 0)

    Args:
        test_case: Dict with example_id, turn, question, gold_answer
        previous_results: Dict of {variable_name: {question, answer, scale}} from previous turns
        calculation_rules: Formatted string from ontology_loader
        verbose: Print debug info
        kg_graph: Optional rdflib.Graph for extracting table metadata

    Returns:
        {
            'resolved_question': 'expanded question with no pronouns',
            'values': {
                'value_name': {
                    'description': '...',
                    'semantic_type': 'change_value',
                    'source': 'previous_result'  // uses variable name to lookup
                },
                'another_value_name': {
                    'description': '...',
                    'semantic_type': 'monetary_value',
                    'source': 'knowledge_graph'  // new value from KG
                }
            }
        }
    """
    # PHASE 0: Pronoun Resolution with validation + retry
    metadata = {
        'example_id': test_case['example_id'],
        'turn': test_case['turn']
    }

    def phase0_func(error_context=None):
        return run_phase0_pronoun_resolution(
            test_case['question'],
            previous_results,
            verbose=verbose,
            error_context=error_context,
            metadata=metadata
        )

    def phase0_validator(result):
        return validate_pronoun_resolution(result['resolved_question'], test_case['question'])

    if verbose:
        print(f"\n=== Running Phase 0: Pronoun Resolution ===")

    phase0_output = run_phase_with_retry(
        phase0_func,
        phase0_validator,
        max_retries=2,
        log_func=print if verbose else None,
        phase_name="Phase 0: Pronoun Resolution"
    )

    resolved_question = phase0_output['resolved_question']

    if verbose:
        print(f"✓ Phase 0 complete: {resolved_question}")

    # PHASE 1: Value Planning (using resolved question)
    # Extract table metadata and metric comments from KG if available
    table_metadata = None
    metric_comments = {}
    if kg_graph:
        from execution import extract_sample_entities
        from phase2_llm_extraction import extract_table_data_for_prompt

        sample_entities = extract_sample_entities(kg_graph)
        table_metadata = {
            'row_labels': sample_entities['financial_metrics']['row_labels'],
            'column_labels': sample_entities['financial_metrics']['column_labels']
        }

        # Extract metric comments (rdfs:comment annotations)
        table_data_full = extract_table_data_for_prompt(kg_graph)
        metric_comments = table_data_full['metric_comments']

        if verbose:
            print(f"  Extracted table metadata: {len(table_metadata['row_labels'])} rows, {len(table_metadata['column_labels'])} columns")
            if metric_comments:
                print(f"  Extracted {len(metric_comments)} metric footnotes")

    # Load prompt template
    template_dir = Path(__file__).parent / 'prompts'
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template('value_planning.j2')

    # Render prompt with RESOLVED question
    prompt = template.render(
        question=resolved_question,  # Use resolved question from Phase 0
        previous_results=previous_results,
        calculation_rules=calculation_rules,
        table_metadata=table_metadata,
        metric_comments=metric_comments
    )

    # Call LLM with logging metadata
    metadata = {
        'example_id': test_case['example_id'],
        'turn': test_case['turn'],
        'question': test_case['question'],
        'phase': 'phase1_value_planning'
    }

    if verbose:
        print(f"\n--- PHASE 1: Value Planning ---")
        print(f"Prompt length: {len(prompt)} chars")

    response = call_llm(prompt, metadata)

    # Parse JSON response
    try:
        output = parse_json_response(response)
    except json.JSONDecodeError as e:
        if verbose:
            print(f"Error parsing Phase 1 response: {e}")
            print(f"Response: {response[:500]}")
        raise

    if verbose:
        print(f"Resolved question: {output['resolved_question']}")
        print(f"Values identified: {list(output['values'].keys())}")

    return output


if __name__ == "__main__":
    # Test on Example 2, Turn 4
    from ontology_loader import load_semantic_guidance

    calculation_rules = load_semantic_guidance()

    test_case = {
        'example_id': '2',
        'turn': 4,
        'question': 'and how much does this change represent in relation to that total in 2000, in percentage?',
        'gold_answer': -32
    }

    previous_results = {
        'net_sales_2001': {'question': 'what was the total of net sales in 2001?', 'answer': 5363},
        'net_sales_2000': {'question': 'and what was that in 2000?', 'answer': 7983},
        'change_in_net_sales': {'question': 'what was, then, the change in the total of net sales over the year?', 'answer': -2620}
    }

    output = run_phase1(test_case, previous_results, calculation_rules, verbose=True)
    print("\n" + "="*80)
    print("PHASE 1 OUTPUT:")
    print(json.dumps(output, indent=2))
