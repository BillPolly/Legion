#!/usr/bin/env python3
"""Debug Example 117 Turn 2 scale metadata issue"""
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "graph-solver" / "semantic-query"))

from test_prompt import test_single_case, load_test_cases

# Load test cases
test_cases = load_test_cases()

# Find Example 117 cases
example_117_cases = [tc for tc in test_cases if tc['example_id'] == '117']

print("Example 117 Test Cases:")
for tc in example_117_cases:
    print(f"  Turn {tc['turn']}: {tc['question']}")

# Simulate running Turn 1, then Turn 2
previous_results = []
previous_results_metadata = []

print("\n" + "="*80)
print("TURN 1")
print("="*80)

turn1 = example_117_cases[0]
success1, issues1, output1, exec1 = test_single_case(turn1, previous_results, previous_results_metadata, verbose=True)

if exec1:
    print(f"\nTurn 1 Result:")
    print(f"  our_answer_full: {exec1['our_answer_full']}")
    print(f"  output_scale: {exec1['output_scale']}")

    # Store result and metadata
    previous_results.append(exec1['our_answer_full'])
    metadata = {'scale': exec1.get('output_scale', 'Units')}
    previous_results_metadata.append(metadata)

    print(f"\nStored in previous_results_metadata[0]: {metadata}")

print("\n" + "="*80)
print("TURN 2")
print("="*80)

turn2 = example_117_cases[1]

print(f"\nBefore Turn 2:")
print(f"  previous_results: {previous_results}")
print(f"  previous_results_metadata: {previous_results_metadata}")

success2, issues2, output2, exec2 = test_single_case(turn2, previous_results, previous_results_metadata, verbose=True)

if exec2:
    print(f"\nTurn 2 Retrieved Values:")
    for name, info in exec2['retrieved_values'].items():
        print(f"  {name}:")
        print(f"    value: {info['value']}")
        print(f"    scale: {info['scale']}")
        print(f"    source: {info['source']}")
