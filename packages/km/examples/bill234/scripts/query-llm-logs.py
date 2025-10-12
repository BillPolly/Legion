#!/usr/bin/env python3
"""Query LLM interaction logs from MongoDB"""
import sys
import json
from pymongo import MongoClient


def show_phase(example_id, turn, phase):
    """Show prompt and response for a specific phase"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']

    result = db.llm_interactions.find_one({
        'metadata.example_id': str(example_id),
        'metadata.turn': int(turn),
        'metadata.phase': phase
    }, sort=[('timestamp', -1)])

    if not result:
        print(f"No data found for example {example_id}, turn {turn}, phase {phase}")
        return

    print(f"\n{'='*80}")
    print(f"Example {example_id}, Turn {turn}, Phase: {phase}")
    print(f"{'='*80}\n")

    print("PROMPT:")
    print(result['prompt'][:2000])
    if len(result['prompt']) > 2000:
        print(f"\n... (truncated, {len(result['prompt'])} total chars)")

    print(f"\n{'='*80}\n")
    print("RESPONSE:")
    print(result['response'])
    print()


def list_phases(example_id, turn):
    """List all phases for a turn"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']

    results = list(db.llm_interactions.find({
        'metadata.example_id': str(example_id),
        'metadata.turn': int(turn)
    }).sort('timestamp', 1))

    if not results:
        print(f"No data found for example {example_id}, turn {turn}")
        return

    print(f"\n{'='*80}")
    print(f"Example {example_id}, Turn {turn} - Available Phases")
    print(f"{'='*80}\n")

    for i, result in enumerate(results, 1):
        phase = result['metadata'].get('phase', 'unknown')
        timestamp = result.get('timestamp', 'unknown')
        print(f"{i}. {phase} - {timestamp}")

    print()


def show_turn_flow(example_id, turn):
    """Show the flow of all phases for a turn"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']

    results = list(db.llm_interactions.find({
        'metadata.example_id': str(example_id),
        'metadata.turn': int(turn)
    }).sort('timestamp', 1))

    if not results:
        print(f"No data found for example {example_id}, turn {turn}")
        return

    print(f"\n{'='*80}")
    print(f"Example {example_id}, Turn {turn} - Full Flow")
    print(f"{'='*80}\n")

    for result in results:
        phase = result['metadata'].get('phase', 'unknown')
        print(f"{'='*80}")
        print(f"PHASE: {phase}")
        print(f"{'='*80}\n")
        print("Response:")
        print(result['response'][:1000])
        if len(result['response']) > 1000:
            print("... (truncated)")
        print("\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python query-llm-logs.py <example_id> <turn> [phase]")
        print()
        print("Phase names:")
        print("  phase1_value_planning")
        print("  phase2a_query_generation")
        print("  phase2b_formula_planning")
        print()
        print("Examples:")
        print("  python query-llm-logs.py 8 1                              # List phases for turn 1")
        print("  python query-llm-logs.py 8 1 phase1_value_planning        # Show Phase 1")
        print("  python query-llm-logs.py 8 1 phase2a_query_generation     # Show Phase 2A")
        print("  python query-llm-logs.py 8 1 flow                         # Show all phases")
        sys.exit(1)

    example_id = sys.argv[1]
    turn = sys.argv[2]

    if len(sys.argv) > 3:
        phase_arg = sys.argv[3]
        if phase_arg == "flow":
            show_turn_flow(example_id, turn)
        else:
            show_phase(example_id, turn, phase_arg)
    else:
        list_phases(example_id, turn)
