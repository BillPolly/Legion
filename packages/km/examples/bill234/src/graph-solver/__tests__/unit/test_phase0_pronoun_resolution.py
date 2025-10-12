#!/usr/bin/env python3
"""Unit tests for Phase 0: Pronoun Resolution with REAL LLM"""
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from phase0_pronoun_resolution import run_phase0_pronoun_resolution
from validators import validate_pronoun_resolution, ValidationError
from retry_framework import run_phase_with_retry


def test_simple_it_reference():
    """Test resolving 'it' to previous metric type for different entity"""
    question = "what was it for purchased technology?"
    previous_results = {
        'trademark_useful_life': {
            'turn': 2,
            'question': 'what was the useful life for trademarks?',
            'answer': 9.0,
            'description': 'Useful life of trademarks in years'
        }
    }
    metadata = {'example_id': 'test', 'turn': 3}

    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    # Check structure
    assert 'resolved_question' in result
    assert 'resolutions' in result
    assert 'confidence' in result

    # Check pronouns resolved
    resolved = result['resolved_question'].lower()
    assert 'it' not in resolved or 'trademark' in resolved or 'useful life' in resolved

    # Check confidence is reasonable
    assert result['confidence'] > 0.5

    print(f"\n✅ Test passed:")
    print(f"   Original: {question}")
    print(f"   Resolved: {result['resolved_question']}")


def test_this_that_reference():
    """Test resolving 'this' and 'that' references"""
    question = "what is the percentage of this change relative to that total?"
    previous_results = {
        'change_in_revenue': {
            'turn': 3,
            'question': 'what was the change in revenue?',
            'answer': -2620,
            'description': 'Change in revenue from 2000 to 2001'
        },
        'total_revenue_2000': {
            'turn': 2,
            'question': 'what was the total revenue in 2000?',
            'answer': 7983,
            'description': 'Total revenue in year 2000'
        }
    }
    metadata = {'example_id': 'test', 'turn': 4}

    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    resolved = result['resolved_question'].lower()

    # Check pronouns resolved
    assert 'this' not in resolved or 'change' in resolved
    assert 'that' not in resolved or 'total' in resolved or '2000' in resolved

    print(f"\n✅ Test passed:")
    print(f"   Original: {question}")
    print(f"   Resolved: {result['resolved_question']}")


def test_temporal_pronoun():
    """Test resolving temporal pronouns like 'this year'"""
    question = "what was the revenue in this year?"
    previous_results = {
        'revenue_2007': {
            'turn': 2,
            'question': 'what was the revenue in 2007?',
            'answer': 5000,
            'description': 'Revenue in 2007'
        }
    }
    metadata = {'example_id': 'test', 'turn': 3}

    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    resolved = result['resolved_question'].lower()

    # Check temporal reference resolved to actual year
    assert 'this year' not in resolved
    assert any(year in resolved for year in ['2007', '2008'])  # Should reference specific year

    print(f"\n✅ Test passed:")
    print(f"   Original: {question}")
    print(f"   Resolved: {result['resolved_question']}")


def test_no_pronouns():
    """Test question with no pronouns passes through"""
    question = "what was the revenue in 2005?"
    previous_results = {}
    metadata = {'example_id': 'test', 'turn': 1}

    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    # Should pass through largely unchanged
    assert 'resolved_question' in result
    assert '2005' in result['resolved_question']
    assert 'revenue' in result['resolved_question'].lower()

    print(f"\n✅ Test passed:")
    print(f"   Original: {question}")
    print(f"   Resolved: {result['resolved_question']}")


def test_validation_catches_unresolved_pronoun():
    """Test that validation catches unresolved pronouns"""
    # Simulate a bad LLM response that didn't resolve pronoun
    bad_result = {
        'resolved_question': 'what was it for purchased technology?',  # 'it' not resolved!
        'resolutions': {},
        'confidence': 0.9
    }

    errors = validate_pronoun_resolution(bad_result['resolved_question'], "what was it for purchased technology?")

    assert len(errors) > 0
    assert any('it' in err.lower() for err in errors)

    print(f"\n✅ Validation test passed:")
    print(f"   Detected unresolved pronoun: {errors}")


def test_with_retry_framework():
    """Test Phase 0 with retry framework for error recovery"""
    question = "what was it in 2009?"
    previous_results = {
        'ups_performance_2004': {
            'turn': 1,
            'question': 'what was UPS performance in 2004?',
            'answer': 100,
            'description': 'UPS performance value in 2004'
        }
    }
    metadata = {'example_id': 'test', 'turn': 2}

    # Create phase function wrapper
    def phase_func(error_context=None):
        return run_phase0_pronoun_resolution(
            question,
            previous_results,
            verbose=True,
            error_context=error_context,
            metadata=metadata
        )

    # Create validator function wrapper
    def validator_func(result):
        return validate_pronoun_resolution(result['resolved_question'], question)

    # Run with retry framework
    result = run_phase_with_retry(
        phase_func,
        validator_func,
        max_retries=2,
        log_func=print,
        phase_name="Phase 0: Pronoun Resolution"
    )

    assert 'resolved_question' in result
    assert 'it' not in result['resolved_question'].lower()

    print(f"\n✅ Retry framework test passed:")
    print(f"   Original: {question}")
    print(f"   Resolved: {result['resolved_question']}")


def test_multiple_pronouns():
    """Test question with multiple pronouns"""
    question = "what percentage does this represent relative to that?"
    previous_results = {
        'change_value': {
            'turn': 3,
            'question': 'what was the change?',
            'answer': 500,
            'description': 'Change in metric'
        },
        'base_value': {
            'turn': 2,
            'question': 'what was the base value?',
            'answer': 1000,
            'description': 'Base value for comparison'
        }
    }
    metadata = {'example_id': 'test', 'turn': 4}

    result = run_phase0_pronoun_resolution(question, previous_results, verbose=True, metadata=metadata)

    resolved = result['resolved_question'].lower()

    # Check both pronouns resolved
    assert 'this' not in resolved or 'change' in resolved
    assert 'that' not in resolved or 'base' in resolved

    print(f"\n✅ Test passed:")
    print(f"   Original: {question}")
    print(f"   Resolved: {result['resolved_question']}")


if __name__ == "__main__":
    print("="*80)
    print("PHASE 0 UNIT TESTS (with REAL LLM)")
    print("="*80)

    try:
        print("\n[Test 1] Simple 'it' reference...")
        test_simple_it_reference()

        print("\n[Test 2] 'this' and 'that' references...")
        test_this_that_reference()

        print("\n[Test 3] Temporal pronoun...")
        test_temporal_pronoun()

        print("\n[Test 4] No pronouns...")
        test_no_pronouns()

        print("\n[Test 5] Validation catches unresolved...")
        test_validation_catches_unresolved_pronoun()

        print("\n[Test 6] With retry framework...")
        test_with_retry_framework()

        print("\n[Test 7] Multiple pronouns...")
        test_multiple_pronouns()

        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED!")
        print("="*80)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
