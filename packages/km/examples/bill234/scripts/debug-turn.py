#!/usr/bin/env python3
"""
Debug a specific turn of an example by showing all intermediate steps.

Usage:
    uv run python scripts/debug-turn.py <example_id> <turn>

Example:
    uv run python scripts/debug-turn.py 8 1
"""

import sys
import json
from pathlib import Path
from pymongo import MongoClient
from datetime import datetime, timedelta

def load_test_result(example_id, turn):
    """Load test result from JSON file."""
    result_path = Path(f'data/test-results/current/by-example/{example_id}.json')
    if not result_path.exists():
        return None

    with open(result_path) as f:
        result = json.load(f)

    # Find the specific turn (0-indexed in JSON)
    if turn < len(result['turns']):
        return result['turns'][turn]
    return None

def get_mongodb_logs(example_id, turn):
    """Get MongoDB logs for this example and turn."""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']

    # Get logs from last hour (in case of recent re-runs)
    recent = datetime.utcnow() - timedelta(hours=1)

    logs = list(db.llm_interactions.find({
        'metadata.example_id': str(example_id),
        'metadata.turn': turn,
        'timestamp': {'$gte': recent}
    }).sort('timestamp', -1))

    # Group by phase
    phase0_logs = [l for l in logs if l.get('metadata', {}).get('phase') == 'phase0_question_expansion']
    phase1_logs = [l for l in logs if l.get('stage') == 'semantic_query']
    phase2_logs = [l for l in logs if l.get('stage') == 'calculation']

    return {
        'phase0': phase0_logs[0] if phase0_logs else None,
        'phase1': phase1_logs[0] if phase1_logs else None,
        'phase2': phase2_logs[0] if phase2_logs else None
    }

def print_section(title, char='='):
    """Print a section header."""
    print(f"\n{char * 80}")
    print(f"{title}")
    print(f"{char * 80}\n")

def truncate(text, max_len=500):
    """Truncate text if too long."""
    if len(text) <= max_len:
        return text
    return text[:max_len] + f"\n... (truncated, {len(text)} total chars) ..."

def main():
    if len(sys.argv) != 3:
        print("Usage: uv run python scripts/debug-turn.py <example_id> <turn>")
        print("Example: uv run python scripts/debug-turn.py 8 1")
        sys.exit(1)

    example_id = sys.argv[1]
    turn = int(sys.argv[2])

    print_section(f"DEBUGGING Example {example_id}, Turn {turn}")

    # Load test result
    turn_result = load_test_result(example_id, turn)
    if not turn_result:
        print(f"❌ No test result found for Example {example_id}, Turn {turn}")
        return

    # Basic info
    print(f"Question: {turn_result['question']}")
    print(f"Gold Answer: {turn_result['gold_answer']}")
    print(f"Status: {'✅ PASS' if turn_result['success'] else '❌ FAIL'}")
    if turn_result.get('issues'):
        print(f"Issues: {', '.join(turn_result['issues'])}")

    # Get MongoDB logs
    logs = get_mongodb_logs(example_id, turn)

    # Phase 0: Question Expansion
    if logs['phase0']:
        print_section("PHASE 0: Question Expansion", '-')
        phase0 = logs['phase0']

        if turn_result.get('output', {}).get('expanded_question'):
            print(f"Original:  {turn_result['question']}")
            print(f"Expanded:  {turn_result['output']['expanded_question']}")
            print()

        print("Prompt (first 500 chars):")
        print(truncate(phase0.get('prompt', 'N/A')))
        print()

        print("Response:")
        print(phase0.get('response', 'N/A'))

    # Phase 1: Query Planning
    if logs['phase1']:
        print_section("PHASE 1: Query Planning", '-')
        phase1 = logs['phase1']

        print("Prompt (first 1000 chars):")
        print(truncate(phase1.get('prompt', 'N/A'), 1000))
        print()

        print("Response:")
        response_text = phase1.get('response', 'N/A')
        # Try to parse as JSON for pretty printing
        try:
            # Extract JSON from markdown code block if present
            if '```json' in response_text:
                json_start = response_text.index('```json') + 7
                json_end = response_text.index('```', json_start)
                json_text = response_text[json_start:json_end].strip()
            else:
                json_text = response_text

            response_obj = json.loads(json_text)
            print(json.dumps(response_obj, indent=2))
        except:
            print(response_text)
        print()

        # Show retrieved values
        if turn_result.get('execution', {}).get('retrieved_values'):
            print("Retrieved Values:")
            for name, val in turn_result['execution']['retrieved_values'].items():
                print(f"  {name}: {val['value']} ({val.get('scale', 'N/A')})")
                print(f"    Source: {val.get('source', 'N/A')}")

    # Phase 2: Calculation
    if logs['phase2']:
        print_section("PHASE 2: Calculation", '-')
        phase2 = logs['phase2']

        print("Prompt (first 1000 chars):")
        print(truncate(phase2.get('prompt', 'N/A'), 1000))
        print()

        print("Response:")
        response_text = phase2.get('response', 'N/A')
        try:
            if '```json' in response_text:
                json_start = response_text.index('```json') + 7
                json_end = response_text.index('```', json_start)
                json_text = response_text[json_start:json_end].strip()
            else:
                json_text = response_text

            response_obj = json.loads(json_text)
            print(json.dumps(response_obj, indent=2))
        except:
            print(response_text)

    # Execution result
    if turn_result.get('execution'):
        print_section("EXECUTION RESULT", '-')
        exec_result = turn_result['execution']

        if exec_result.get('success') is False:
            print(f"❌ Execution Failed")
            if exec_result.get('error'):
                print(f"Error: {exec_result['error']}")

        print(f"Formula: {turn_result.get('output', {}).get('phase2', {}).get('formula', 'N/A')}")
        print(f"Our Answer: {exec_result.get('our_answer', 'N/A')} (full: {exec_result.get('our_answer_full', 'N/A')})")
        print(f"Gold Answer: {exec_result.get('gold_answer', 'N/A')}")

        if exec_result.get('our_answer') and exec_result.get('gold_answer'):
            diff = abs(exec_result['our_answer'] - exec_result['gold_answer'])
            print(f"Difference: {diff}")

    # Summary
    print_section("SUMMARY", '=')
    if turn_result['success']:
        print("✅ This turn PASSED")
    else:
        print("❌ This turn FAILED")
        print("\nLikely issues:")

        # Analyze common failure patterns
        if turn_result.get('execution'):
            exec_result = turn_result['execution']

            # Wrong answer
            if exec_result.get('our_answer') and exec_result.get('gold_answer'):
                our = exec_result['our_answer']
                gold = exec_result['gold_answer']

                if abs(our - gold) < 0.01:
                    print("  - Tolerance issue (very close answer)")
                elif our > gold * 10 or our < gold / 10:
                    print("  - Scale mismatch (order of magnitude difference)")
                elif abs(our + gold) < 0.01:
                    print("  - Sign error (negative vs positive)")
                else:
                    print("  - Wrong values retrieved or wrong formula")

            # SPARQL errors
            if 'Expected {SelectQuery' in str(turn_result.get('issues', [])):
                print("  - Invalid SPARQL (arithmetic in sparql field?)")

            # Execution errors
            if exec_result.get('error'):
                if 'NoneType' in exec_result['error']:
                    print("  - Missing value (variable is None)")
                elif 'SyntaxError' in exec_result['error']:
                    print("  - Invalid Python formula")

if __name__ == '__main__':
    main()
