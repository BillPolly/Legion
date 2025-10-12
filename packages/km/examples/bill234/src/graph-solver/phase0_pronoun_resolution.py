#!/usr/bin/env python3
"""Phase 0: Pronoun Resolution - Focused on resolving pronouns and temporal references"""
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


def run_phase0_pronoun_resolution(question, previous_results, verbose=False, error_context=None, metadata=None):
    """
    Phase 0: Resolve pronouns and temporal references

    Args:
        question: The question string to resolve
        previous_results: Dict of {variable_name: {question, answer, description, turn, scale}} from previous turns
        verbose: Print debug info
        error_context: Dict with 'errors' and 'previous_result' from failed validation (for retry)
        metadata: Dict with example_id, turn, etc for logging

    Returns:
        {
            'resolved_question': 'question with all pronouns replaced',
            'resolutions': {
                'pronoun': 'what it was replaced with'
            },
            'confidence': float (0-1)
        }
    """
    # Load prompt template
    template_dir = Path(__file__).parent / 'prompts'
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template('pronoun_resolution.j2')

    # Render prompt
    prompt = template.render(
        question=question,
        previous_results=previous_results,
        error_context=error_context
    )

    # Call LLM with logging metadata
    llm_metadata = metadata.copy() if metadata else {}
    llm_metadata['phase'] = 'phase0_pronoun_resolution'
    if error_context:
        llm_metadata['retry_attempt'] = error_context.get('attempt', 0)

    if verbose:
        print(f"\n--- PHASE 0: Pronoun Resolution ---")
        print(f"Prompt length: {len(prompt)} chars")
        if error_context:
            print(f"Retry attempt: {error_context.get('attempt', 0)}")
            print(f"Previous errors: {error_context.get('errors', [])}")

    response = call_llm(prompt, llm_metadata)

    # Parse JSON response
    try:
        output = parse_json_response(response)
    except json.JSONDecodeError as e:
        if verbose:
            print(f"Error parsing Phase 0 response: {e}")
            print(f"Response: {response[:500]}")
        raise

    if verbose:
        print(f"Resolved question: {output['resolved_question']}")
        print(f"Resolutions: {output.get('resolutions', {})}")
        print(f"Confidence: {output.get('confidence', 'N/A')}")

    return output


if __name__ == "__main__":
    # Test with a simple pronoun case
    question = "what was it for purchased technology?"
    previous_results = {
        'trademark_useful_life': {
            'turn': 2,
            'question': 'what was the useful life for trademarks?',
            'answer': 9.0,
            'description': 'Useful life of trademarks in years'
        }
    }

    metadata = {
        'example_id': 'test',
        'turn': 3
    }

    output = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)
    print("\n" + "="*80)
    print("PHASE 0 OUTPUT:")
    print(json.dumps(output, indent=2))
