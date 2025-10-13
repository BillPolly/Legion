#!/usr/bin/env python3
"""Unit tests for phase1.py"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from phase1 import run_phase1
from ontology_loader import load_semantic_guidance


def test_turn1_no_pronouns():
    """Test Phase 1 with no pronouns (Turn 1)"""
    print("Test: Turn 1 - No pronouns...")

    calculation_rules = load_semantic_guidance()

    test_case = {
        'example_id': '2',
        'turn': 1,
        'question': 'what was the total of net sales in 2001?',
        'gold_answer': 5363
    }

    output = run_phase1(test_case, [], calculation_rules, verbose=False)

    # Check structure
    assert 'resolved_question' in output
    assert 'values' in output
    assert isinstance(output['values'], dict)

    # Check resolved question
    assert '2001' in output['resolved_question']

    # Check values
    assert len(output['values']) > 0
    for name, spec in output['values'].items():
        assert 'description' in spec
        assert 'semantic_type' in spec
        assert 'source' in spec

    print(f"✓ PASS - Found {len(output['values'])} values")
    return output


def test_turn2_has_pronoun():
    """Test Phase 1 with pronoun (Turn 2)"""
    print("\nTest: Turn 2 - Has 'that' pronoun...")

    calculation_rules = load_semantic_guidance()

    test_case = {
        'example_id': '2',
        'turn': 2,
        'question': 'and what was that in 2000?',
        'gold_answer': 7983
    }

    previous_results = {
        'net_sales_2001': {'question': 'what was the total of net sales in 2001?', 'answer': 5363}
    }

    output = run_phase1(test_case, previous_results, calculation_rules, verbose=False)

    # Check pronoun was resolved
    assert 'that' not in output['resolved_question'].lower() or 'net sales' in output['resolved_question'].lower()

    # Check structure
    assert 'values' in output
    assert len(output['values']) > 0

    print(f"✓ PASS - Resolved: {output['resolved_question'][:80]}...")
    return output


def test_turn4_multiple_pronouns():
    """Test Phase 1 with multiple pronouns (Turn 4)"""
    print("\nTest: Turn 4 - Multiple pronouns ('this', 'that')...")

    calculation_rules = load_semantic_guidance()

    test_case = {
        'example_id': '2',
        'turn': 4,
        'question': 'and how much does this change represent in relation to that total in 2000, in percentage?',
        'gold_answer': -32
    }

    previous_results = {
        'net_sales_2001': {'question': 'what was the total of net sales in 2001?', 'answer': 5363},
        'net_sales_2000': {'question': 'and what was that in 2000?', 'answer': 7983},
        'change_in_net_sales': {'question': 'what was, then, the change in the total of net sales over the year?', 'answer': -2620}
    }

    output = run_phase1(test_case, previous_results, calculation_rules, verbose=False)

    # Check pronouns were resolved
    resolved = output['resolved_question'].lower()
    assert 'this' not in resolved or 'change' in resolved
    assert 'that' not in resolved or 'total' in resolved or '2000' in resolved

    # Check values
    assert len(output['values']) == 2, f"Expected 2 values, got {len(output['values'])}"

    # Check that values reference previous results
    for name, spec in output['values'].items():
        assert spec['source'] == 'previous_result', f"Expected previous_result, got {spec['source']}"
        # Variable name should match one from previous_results
        assert name in previous_results, f"Variable '{name}' not in previous_results"

    # Check semantic types
    has_change_value = any(v['semantic_type'] == 'change_value' for v in output['values'].values())
    assert has_change_value, "Expected at least one change_value"

    print(f"✓ PASS - Resolved: {output['resolved_question'][:80]}...")
    print(f"  Values: {list(output['values'].keys())}")
    return output


def test_output_structure():
    """Test that all outputs have required structure"""
    print("\nTest: Output structure consistency...")

    calculation_rules = load_semantic_guidance()

    test_case = {
        'example_id': '2',
        'turn': 1,
        'question': 'what was the total of net sales in 2001?',
        'gold_answer': 5363
    }

    output = run_phase1(test_case, [], calculation_rules, verbose=False)

    # Top-level keys
    assert 'resolved_question' in output
    assert 'values' in output

    # Values structure
    for name, spec in output['values'].items():
        # Required keys
        assert 'description' in spec, f"Missing description for {name}"
        assert 'semantic_type' in spec, f"Missing semantic_type for {name}"
        assert 'source' in spec, f"Missing source for {name}"

        # Valid source
        assert spec['source'] in ['previous_result', 'knowledge_graph'], f"Invalid source: {spec['source']}"

        # No turn_reference field needed anymore (we use variable names directly)

    print("✓ PASS")


if __name__ == "__main__":
    print("="*80)
    print("TESTING: phase1.py (Value Planning)")
    print("="*80)

    tests = [
        test_turn1_no_pronouns,
        test_turn2_has_pronoun,
        test_turn4_multiple_pronouns,
        test_output_structure
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ FAIL: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "="*80)
    print(f"Results: {passed}/{len(tests)} tests passed")
    if failed == 0:
        print("✓ ALL TESTS PASSED")
    else:
        print(f"✗ {failed} tests failed")
    print("="*80)

    exit(0 if failed == 0 else 1)
