#!/usr/bin/env python3
"""
Analyze test results from MongoDB for a range of examples
"""
import sys
from pathlib import Path
from pymongo import MongoClient
from collections import defaultdict

def analyze_results(start_id, end_id):
    """Analyze test results from MongoDB"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']
    collection = db['test_results']

    print(f"\n{'='*80}")
    print(f"TEST RESULTS ANALYSIS (Examples {start_id}-{end_id})")
    print(f"{'='*80}\n")

    total_examples = 0
    total_turns = 0
    passed_turns = 0
    failed_examples = []
    failure_types = defaultdict(list)

    for example_id in range(start_id, end_id + 1):
        # Get latest result for this example
        result = collection.find_one(
            {'example_id': str(example_id)},
            sort=[('timestamp', -1)]
        )

        if not result:
            print(f"✗ Example {example_id}: NO RESULTS FOUND")
            failed_examples.append(example_id)
            continue

        total_examples += 1
        turns = result.get('turns', [])
        total_turns += len(turns)

        example_passed = sum(1 for t in turns if t.get('passed', False))
        passed_turns += example_passed

        status = "✓" if example_passed == len(turns) else "✗"
        accuracy = f"{example_passed}/{len(turns)}" if turns else "0/0"
        percentage = f"({100 * example_passed / len(turns):.1f}%)" if turns else "(0%)"

        print(f"{status} Example {example_id}: {accuracy} {percentage}")

        if example_passed < len(turns):
            failed_examples.append(example_id)

            # Analyze failure types for this example
            for i, turn in enumerate(turns, 1):
                if not turn.get('passed', False):
                    our_answer = turn.get('our_answer', 'None')
                    gold_answer = turn.get('gold_answer', 'None')

                    if our_answer == 'None' or our_answer is None:
                        failure_type = "NONE_ANSWER"
                    elif str(our_answer) != str(gold_answer):
                        failure_type = "WRONG_VALUE"
                    else:
                        failure_type = "OTHER"

                    failure_types[failure_type].append({
                        'example_id': example_id,
                        'turn': i,
                        'question': turn.get('question', ''),
                        'our_answer': our_answer,
                        'gold_answer': gold_answer
                    })

    # Print summary
    print(f"\n{'='*80}")
    print(f"OVERALL SUMMARY")
    print(f"{'='*80}")
    print(f"Examples tested: {total_examples}/{end_id - start_id + 1}")
    print(f"Total turns: {total_turns}")
    print(f"Passed turns: {passed_turns}/{total_turns} ({100 * passed_turns / total_turns if total_turns else 0:.1f}%)")
    print(f"Failed examples: {len(failed_examples)}")

    if failed_examples:
        print(f"\nFailed example IDs: {', '.join(map(str, failed_examples))}")

    # Print failure type breakdown
    print(f"\n{'='*80}")
    print(f"FAILURE TYPE BREAKDOWN")
    print(f"{'='*80}")

    for failure_type, failures in sorted(failure_types.items()):
        print(f"\n{failure_type}: {len(failures)} failures")
        if len(failures) <= 10:
            for f in failures:
                print(f"  Example {f['example_id']}, Turn {f['turn']}: {f['question'][:60]}...")
        else:
            # Show first 5
            for f in failures[:5]:
                print(f"  Example {f['example_id']}, Turn {f['turn']}: {f['question'][:60]}...")
            print(f"  ... and {len(failures) - 5} more")

    return {
        'total_examples': total_examples,
        'total_turns': total_turns,
        'passed_turns': passed_turns,
        'failed_examples': failed_examples,
        'failure_types': dict(failure_types)
    }

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python analyze-test-results.py <start_id> <end_id>")
        sys.exit(1)

    start = int(sys.argv[1])
    end = int(sys.argv[2])

    results = analyze_results(start, end)
