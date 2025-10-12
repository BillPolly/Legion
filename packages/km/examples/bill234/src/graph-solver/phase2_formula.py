#!/usr/bin/env python3
"""Phase 2B: Formula Planning - Build formula by analyzing question + ontology"""
import sys
from pathlib import Path
import json
from jinja2 import Environment, FileSystemLoader

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from common.llm_client import call_llm


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


def run_phase2_formula(resolved_question, values, calculation_rules, test_case, verbose=False):
    """
    Phase 2B: Build formula by analyzing question semantics + ontology

    Args:
        resolved_question: Expanded question from Phase 1
        values: Dict of value definitions from Phase 1
        calculation_rules: Formatted string from ontology_loader
        test_case: Dict with example_id, turn, question for logging
        verbose: Print debug info

    Returns:
        {
            'formula': 'change_in_net_sales / net_sales_2000 * 100',
            'reasoning': 'step-by-step explanation'
        }
    """
    # Load prompt template
    template_dir = Path(__file__).parent / 'prompts'
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template('formula_planning.j2')

    # Render prompt
    prompt = template.render(
        resolved_question=resolved_question,
        values=values,
        calculation_rules=calculation_rules
    )

    # Call LLM with logging metadata
    metadata = {
        'example_id': test_case['example_id'],
        'turn': test_case['turn'],
        'question': test_case['question'],
        'resolved_question': resolved_question,
        'phase': 'phase2b_formula',
        'values': values
    }

    if verbose:
        print(f"\n--- PHASE 2B: Formula Planning ---")
        print(f"Prompt length: {len(prompt)} chars")

    response = call_llm(prompt, metadata)

    # Parse JSON response
    try:
        output = parse_json_response(response)
    except json.JSONDecodeError as e:
        if verbose:
            print(f"Error parsing Phase 2B response: {e}")
            print(f"Response: {response[:500]}")
        raise

    if verbose:
        print(f"Formula: {output['formula']}")

    return output


if __name__ == "__main__":
    # Test on Example 2, Turn 4
    from ontology_loader import load_semantic_guidance

    calculation_rules = load_semantic_guidance()

    # Simulated Phase 1 output
    resolved_question = "and how much does the change in the total of net sales over the year represent in relation to the total of net sales in 2000, in percentage?"

    values = {
        "change_in_net_sales": {
            "description": "the change in the total of net sales over the year (from 2000 to 2001)",
            "semantic_type": "change_value",
            "source": "previous_result",
            "turn_reference": 3
        },
        "net_sales_2000": {
            "description": "the total of net sales in 2000",
            "semantic_type": "total_value",
            "source": "previous_result",
            "turn_reference": 2
        }
    }

    test_case = {
        'example_id': '2',
        'turn': 4,
        'question': 'and how much does this change represent in relation to that total in 2000, in percentage?'
    }

    output = run_phase2_formula(resolved_question, values, calculation_rules, test_case, verbose=True)
    print("\n" + "="*80)
    print("PHASE 2B OUTPUT:")
    print(json.dumps(output, indent=2))
