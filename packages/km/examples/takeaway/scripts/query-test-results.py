#!/usr/bin/env python3
"""Query test results from MongoDB"""
import sys
import json
from pymongo import MongoClient


def show_results(example_id):
    """Show test results for an example"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']

    result = db.test_results.find_one({'example_id': str(example_id)}, sort=[('timestamp', -1)])

    if not result:
        print(f"No results found for example {example_id}")
        return

    print(f"\n{'='*80}")
    print(f"Example {example_id} Results")
    print(f"{'='*80}")
    print(f"Timestamp: {result['timestamp']}")
    print(f"Accuracy: {result['passed']}/{result['total_turns']} ({result['accuracy']*100:.1f}%)")
    print()

    for turn in result['turns']:
        status = "✅ PASS" if turn['success'] else "❌ FAIL"
        print(f"Turn {turn['turn']}: {status}")
        print(f"  Question: {turn['question']}")
        print(f"  Our answer: {turn['our_answer']}")
        print(f"  Gold answer: {turn['gold_answer']}")
        print(f"  Formula: {turn['formula']}")
        if 'error' in turn:
            print(f"  Error: {turn['error']}")
        print()

    # Display failure analysis if present
    if 'failure_analysis' in result:
        analysis = result['failure_analysis']
        print(f"{'='*80}")
        print("FAILURE ANALYSIS")
        print(f"{'='*80}")
        print(f"Status: {analysis.get('status', 'N/A').upper()}")
        print(f"Timestamp: {analysis.get('timestamp', 'N/A')}")
        print()

        print(f"Issue Type: {analysis.get('issue_type', 'N/A')}")
        print(f"Affected Turns: {', '.join(map(str, analysis.get('affected_turns', [])))}")
        if 'primary_turn' in analysis:
            print(f"Primary Turn: {analysis['primary_turn']}")
        print()

        print("Root Cause:")
        print(f"  {analysis.get('root_cause', 'N/A')}")
        print()

        if 'expected_behavior' in analysis:
            print("Expected Behavior:")
            print(f"  {analysis['expected_behavior']}")
            print()

        if 'actual_behavior' in analysis:
            print("Actual Behavior:")
            print(f"  {analysis['actual_behavior']}")
            print()

        if 'kg_evidence' in analysis:
            print("KG Evidence:")
            for key, value in analysis['kg_evidence'].items():
                print(f"  {key}: {value}")
            print()

        if 'cascading_effect' in analysis:
            print("Cascading Effect:")
            print(f"  {analysis['cascading_effect']}")
            print()

        print(f"{'='*80}\n")


def show_all_results():
    """Show results for all examples"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']

    # Get all distinct example IDs
    example_ids = db.test_results.distinct('example_id')
    example_ids.sort(key=lambda x: int(x))

    print(f"\n{'='*80}")
    print(f"All Test Results ({len(example_ids)} examples)")
    print(f"{'='*80}\n")

    total_passed = 0
    total_turns = 0

    for example_id in example_ids:
        result = db.test_results.find_one({'example_id': example_id}, sort=[('timestamp', -1)])
        total_passed += result['passed']
        total_turns += result['total_turns']

        print(f"Example {example_id:>3}: {result['passed']}/{result['total_turns']} ({result['accuracy']*100:5.1f}%) - {result['timestamp']}")

    print(f"\n{'='*80}")
    print(f"Overall: {total_passed}/{total_turns} ({100*total_passed/total_turns:.1f}%)")
    print(f"{'='*80}\n")


def show_json(example_id):
    """Show raw JSON for an example"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']

    result = db.test_results.find_one({'example_id': str(example_id)}, sort=[('timestamp', -1)])

    if not result:
        print(f"No results found for example {example_id}")
        return

    # Convert ObjectId and datetime to strings recursively
    def convert_datetime(obj):
        """Recursively convert datetime objects to strings"""
        if isinstance(obj, dict):
            return {k: convert_datetime(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_datetime(item) for item in obj]
        elif hasattr(obj, 'isoformat'):  # datetime objects
            return str(obj)
        else:
            return obj

    result = convert_datetime(result)
    result['_id'] = str(result['_id'])

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python query-test-results.py <example_id|all> [--json]")
        print()
        print("Examples:")
        print("  python query-test-results.py 8           # Show results for example 8")
        print("  python query-test-results.py 8 --json    # Show raw JSON for example 8")
        print("  python query-test-results.py all         # Show all results summary")
        sys.exit(1)

    arg = sys.argv[1]
    json_mode = "--json" in sys.argv

    if arg == "all":
        show_all_results()
    elif json_mode:
        show_json(arg)
    else:
        show_results(arg)
