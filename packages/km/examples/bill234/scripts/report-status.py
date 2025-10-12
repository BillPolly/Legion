#!/usr/bin/env python3
"""
Report test status for examples.

Usage:
    python scripts/report-status.py              # Report all examples
    python scripts/report-status.py 0 1 2 3      # Report specific examples
    python scripts/report-status.py 0-9          # Report range
"""

import json
import sys
from pathlib import Path

def parse_range(arg):
    """Parse range like '0-9' into list of numbers."""
    if '-' in arg:
        start, end = arg.split('-')
        return list(range(int(start), int(end) + 1))
    return [int(arg)]

def get_example_ids(args):
    """Get list of example IDs from command line args."""
    if not args:
        # Get all available examples
        results_dir = Path('data/test-results/current/by-example')
        if results_dir.exists():
            return sorted([int(f.stem) for f in results_dir.glob('*.json')])
        return []

    # Parse args
    example_ids = []
    for arg in args:
        example_ids.extend(parse_range(arg))
    return sorted(example_ids)

def load_result(example_id):
    """Load test result for an example."""
    result_path = Path(f'data/test-results/current/by-example/{example_id}.json')
    if not result_path.exists():
        return None

    with open(result_path) as f:
        return json.load(f)

def main():
    example_ids = get_example_ids(sys.argv[1:])

    if not example_ids:
        print("No test results found.")
        return

    print(f"\n{'Example':<10} {'Status':<10} {'Turns':<15} {'Accuracy':<10}")
    print("=" * 50)

    total_passed = 0
    total_turns = 0

    for example_id in example_ids:
        result = load_result(example_id)
        if result is None:
            print(f"{example_id:<10} {'N/A':<10} {'No data':<15} {'-':<10}")
            continue

        passed = result.get('passed', result.get('passed_turns', 0))
        total = result.get('total_turns', 0)
        accuracy = result.get('accuracy', 0)

        # Handle accuracy as decimal (1.0) or percentage (100)
        if accuracy <= 1.0:
            accuracy = accuracy * 100

        status = '✅ PASS' if accuracy == 100 else '❌ FAIL'
        turns_str = f"{passed}/{total}"
        accuracy_str = f"{accuracy:.1f}%"

        print(f"{example_id:<10} {status:<10} {turns_str:<15} {accuracy_str:<10}")

        total_passed += passed
        total_turns += total

    print("=" * 50)
    overall_accuracy = (total_passed / total_turns * 100) if total_turns > 0 else 0
    print(f"{'OVERALL':<10} {'':<10} {total_passed}/{total_turns:<10} {overall_accuracy:.1f}%")
    print()

if __name__ == '__main__':
    main()
