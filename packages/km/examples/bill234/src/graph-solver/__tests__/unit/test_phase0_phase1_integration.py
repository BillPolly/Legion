#!/usr/bin/env python3
"""Integration tests for Phase 0 + Phase 1 on real Example 30 questions"""
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from phase0_pronoun_resolution import run_phase0_pronoun_resolution
from phase1 import run_phase1
from ontology_loader import load_semantic_guidance


def test_example30_turn1_no_pronouns():
    """Turn 1 has no pronouns - should pass through unchanged"""
    question = "what is the square feet of the owned global supply chain distribution and administration offices?"
    previous_results = {}
    metadata = {'example_id': '30', 'turn': 1}

    # Run Phase 0
    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    print(f"\n=== Turn 1 (No Pronouns) ===")
    print(f"Original:  {question}")
    print(f"Resolved:  {result['resolved_question']}")
    print(f"Should be: {question}")

    # Should be unchanged since no pronouns
    assert result['resolved_question'] == question or result['resolved_question'].strip() == question.strip()
    print("✅ Turn 1: Question unchanged (no pronouns)")


def test_example30_turn3_those_values():
    """Turn 3: 'what is the sum of those values?' - references Turn 1 and Turn 2"""
    question = "what is the sum of those values?"

    previous_results = {
        'total_owned_sqft': {
            'turn': 1,
            'question': 'what is the square feet of the owned global supply chain distribution and administration offices?',
            'answer': 320000.0,  # NOTE: This was WRONG in the test (gold = 160000)
            'description': 'Total square feet of owned global supply chain distribution and administration offices'
        },
        'owned_sqft_commercial_rnd_mfg': {
            'turn': 2,
            'question': 'what is the square feet of the owned commercial research and development manufacturing facilities?',
            'answer': 80000,
            'description': 'Total square feet of owned commercial research and development manufacturing facilities'
        }
    }

    metadata = {'example_id': '30', 'turn': 3}

    # Run Phase 0
    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    print(f"\n=== Turn 3 ('those values') ===")
    print(f"Original:  {question}")
    print(f"Resolved:  {result['resolved_question']}")
    print(f"Resolutions: {result.get('resolutions', {})}")

    # Check that 'those values' was resolved
    resolved = result['resolved_question'].lower()
    assert 'those values' not in resolved, f"Failed to resolve 'those values': {result['resolved_question']}"

    # Should reference the two previous results
    print("✅ Turn 3: 'those values' resolved")


def test_example30_turn4_total_sum_including():
    """Turn 4: 'what is the total sum including...' - ambiguous reference"""
    question = "what is the total sum including square feet of commercial research and development manufacturing facilities in smithfield, rhode island?"

    previous_results = {
        'total_owned_sqft': {
            'turn': 1,
            'question': 'what is the square feet of the owned global supply chain distribution and administration offices?',
            'answer': 320000.0,
            'description': 'Total square feet of owned global supply chain distribution and administration offices'
        },
        'owned_sqft_commercial_rnd_mfg': {
            'turn': 2,
            'question': 'what is the square feet of the owned commercial research and development manufacturing facilities?',
            'answer': 80000,
            'description': 'Total square feet of owned commercial research and development manufacturing facilities'
        },
        'sum_owned_sqft': {
            'turn': 3,
            'question': 'what is the sum of those values?',
            'answer': 400000.0,
            'description': 'Sum of the total owned square feet'
        }
    }

    metadata = {'example_id': '30', 'turn': 4}

    # Run Phase 0
    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    print(f"\n=== Turn 4 ('total sum including') ===")
    print(f"Original:  {question}")
    print(f"Resolved:  {result['resolved_question']}")
    print(f"Resolutions: {result.get('resolutions', {})}")

    # This question has no clear pronouns, should mostly pass through
    # The word "including" suggests ADDING to something (sum_owned_sqft)
    print("✅ Turn 4: Processed")


def test_phase0_phase1_integration_turn3():
    """Full integration test: Phase 0 → Phase 1 for Turn 3"""
    calculation_rules = load_semantic_guidance()

    test_case = {
        'example_id': '30',
        'turn': 3,
        'question': 'what is the sum of those values?',
        'gold_answer': 240000.0
    }

    previous_results = {
        'total_owned_sqft': {
            'turn': 1,
            'question': 'what is the square feet of the owned global supply chain distribution and administration offices?',
            'answer': 160000.0,  # Using CORRECT gold answer
            'description': 'Total square feet of owned global supply chain distribution and administration offices'
        },
        'owned_sqft_commercial_rnd_mfg': {
            'turn': 2,
            'question': 'what is the square feet of the owned commercial research and development manufacturing facilities?',
            'answer': 80000,
            'description': 'Total square feet of owned commercial research and development manufacturing facilities'
        }
    }

    print(f"\n=== FULL INTEGRATION TEST: Phase 0 → Phase 1 ===")

    # Run integrated Phase 0 + Phase 1
    output = run_phase1(test_case, previous_results, calculation_rules, verbose=True)

    print(f"\n=== Phase 1 Output ===")
    print(f"Resolved question: {output['resolved_question']}")
    print(f"Values: {list(output['values'].keys())}")

    # Check that values reference previous results
    for var_name, value_info in output['values'].items():
        print(f"\n  {var_name}:")
        print(f"    Source: {value_info['source']}")
        print(f"    Description: {value_info['description']}")

        if value_info['source'] == 'previous_result':
            # Should be an EXACT match to a key in previous_results
            assert var_name in previous_results, f"Variable {var_name} marked as previous_result but not found in previous_results!"

    print("\n✅ Full integration test passed")


if __name__ == "__main__":
    print("="*80)
    print("PHASE 0 + PHASE 1 INTEGRATION TESTS")
    print("="*80)

    try:
        print("\n[Test 1] Turn 1: No pronouns...")
        test_example30_turn1_no_pronouns()

        print("\n[Test 2] Turn 3: 'those values'...")
        test_example30_turn3_those_values()

        print("\n[Test 3] Turn 4: 'total sum including'...")
        test_example30_turn4_total_sum_including()

        print("\n[Test 4] Full Phase 0→1 integration on Turn 3...")
        test_phase0_phase1_integration_turn3()

        print("\n" + "="*80)
        print("✅ ALL INTEGRATION TESTS PASSED!")
        print("="*80)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
