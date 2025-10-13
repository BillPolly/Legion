#!/usr/bin/env python3
"""Add or update failure analysis for a test example"""
import sys
import json
from datetime import datetime
from pymongo import MongoClient


def add_failure_analysis(example_id, analysis_dict):
    """Add or update failure analysis for an example

    Args:
        example_id: Example identifier (string)
        analysis_dict: Failure analysis dictionary with keys:
            - root_cause (required): Description of the root cause
            - issue_type (required): Type of issue (e.g., 'linguistic_pattern_matching')
            - affected_turns (required): List of turn numbers affected
            - primary_turn (optional): The turn where the issue originates
            - expected_behavior (optional): What should happen
            - actual_behavior (optional): What actually happens
            - kg_evidence (optional): Evidence from knowledge graph
            - cascading_effect (optional): Description of how failure cascades
            - status (optional): 'identified', 'in_progress', 'fixed' (default: 'identified')

    Returns:
        Updated document or None if example not found
    """
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']
    collection = db['test_results']

    # Check if example exists
    result = collection.find_one({'example_id': str(example_id)})
    if not result:
        print(f"Error: No test results found for example {example_id}")
        print("Run test_example.py first to create test results.")
        return None

    # Set default status if not provided
    if 'status' not in analysis_dict:
        analysis_dict['status'] = 'identified'

    # Add timestamp
    analysis_dict['timestamp'] = datetime.utcnow()

    # Update the document
    collection.update_one(
        {'example_id': str(example_id)},
        {'$set': {'failure_analysis': analysis_dict}}
    )

    print(f"✓ Added failure analysis to example {example_id}")
    return analysis_dict


def interactive_mode():
    """Interactive mode to build failure analysis"""
    print("="*80)
    print("Failure Analysis - Interactive Mode")
    print("="*80)

    example_id = input("\nExample ID: ").strip()

    # Verify example exists
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']
    result = db.test_results.find_one({'example_id': str(example_id)})

    if not result:
        print(f"\nError: No test results found for example {example_id}")
        print("Run test_example.py first.")
        return

    # Show current test results
    print(f"\n{'='*80}")
    print(f"Example {example_id} - Current Results")
    print(f"{'='*80}")
    print(f"Accuracy: {result['passed']}/{result['total_turns']} ({result['accuracy']*100:.1f}%)\n")

    for turn in result['turns']:
        status = "✅ PASS" if turn['success'] else "❌ FAIL"
        print(f"Turn {turn['turn']}: {status}")
        print(f"  Q: {turn['question']}")
        print(f"  Our: {turn['our_answer']}, Gold: {turn['gold_answer']}")
        print()

    # Collect failure analysis
    print(f"{'='*80}")
    print("Enter Failure Analysis")
    print(f"{'='*80}\n")

    analysis = {}

    analysis['root_cause'] = input("Root cause (required): ").strip()
    if not analysis['root_cause']:
        print("Error: Root cause is required")
        return

    analysis['issue_type'] = input("Issue type (required, e.g., 'linguistic_pattern_matching'): ").strip()
    if not analysis['issue_type']:
        print("Error: Issue type is required")
        return

    # Affected turns
    affected_input = input("Affected turns (comma-separated, required): ").strip()
    if not affected_input:
        print("Error: Affected turns is required")
        return
    try:
        analysis['affected_turns'] = [int(t.strip()) for t in affected_input.split(',')]
    except ValueError:
        print("Error: Affected turns must be comma-separated integers")
        return

    # Optional fields
    primary_turn = input("Primary turn (optional, press Enter to skip): ").strip()
    if primary_turn:
        analysis['primary_turn'] = int(primary_turn)

    expected = input("Expected behavior (optional): ").strip()
    if expected:
        analysis['expected_behavior'] = expected

    actual = input("Actual behavior (optional): ").strip()
    if actual:
        analysis['actual_behavior'] = actual

    cascading = input("Cascading effect (optional): ").strip()
    if cascading:
        analysis['cascading_effect'] = cascading

    status = input("Status (identified/in_progress/fixed) [identified]: ").strip() or 'identified'
    analysis['status'] = status

    # Confirm
    print(f"\n{'='*80}")
    print("Confirm Failure Analysis")
    print(f"{'='*80}")
    print(json.dumps(analysis, indent=2))
    confirm = input("\nSave this analysis? (y/n): ").strip().lower()

    if confirm == 'y':
        add_failure_analysis(example_id, analysis)
        print(f"\n✓ Saved! View with: uv run python scripts/query-test-results.py {example_id}")
    else:
        print("Cancelled")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python add-failure-analysis.py <example_id>  # Interactive mode")
        print("  python add-failure-analysis.py <example_id> <json_file>  # From JSON file")
        print()
        print("Examples:")
        print("  python add-failure-analysis.py 8  # Interactive")
        print("  python add-failure-analysis.py 8 analysis.json  # From file")
        print()
        print("JSON file format:")
        print(json.dumps({
            "root_cause": "Phase 1 misinterprets 'between 1-3 years' as range calculation",
            "issue_type": "linguistic_pattern_matching",
            "affected_turns": [2, 3, 4],
            "primary_turn": 2,
            "expected_behavior": "Should map to table column '1-3 years' directly",
            "actual_behavior": "Creates subtraction formula",
            "status": "identified"
        }, indent=2))
        sys.exit(1)

    example_id = sys.argv[1]

    if len(sys.argv) == 2:
        # Interactive mode
        interactive_mode()
    else:
        # Load from JSON file
        json_file = sys.argv[2]
        try:
            with open(json_file) as f:
                analysis = json.load(f)

            # Validate required fields
            required = ['root_cause', 'issue_type', 'affected_turns']
            for field in required:
                if field not in analysis:
                    print(f"Error: Missing required field '{field}'")
                    sys.exit(1)

            add_failure_analysis(example_id, analysis)
            print(f"✓ View with: uv run python scripts/query-test-results.py {example_id}")
        except FileNotFoundError:
            print(f"Error: File not found: {json_file}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON: {e}")
            sys.exit(1)
