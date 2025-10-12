#!/usr/bin/env python3
"""Unit tests for execution.py (value retrieval and formula execution)"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from execution import retrieve_values, execute_formula, validate_formula


def test_retrieve_from_previous_results():
    """Test retrieving values from previous results"""
    print("Test: Retrieve values from previous results...")

    # Simulated context with name-based lookup
    context = {
        'results_by_name': {
            'net_sales_2001': {'value': 5363.0, 'scale': 'Millions', 'source': 'calculated', 'description': 'net sales in 2001'},
            'net_sales_2000': {'value': 7983.0, 'scale': 'Millions', 'source': 'calculated', 'description': 'net sales in 2000'},
            'change_in_net_sales': {'value': -2620.0, 'scale': 'Millions', 'source': 'calculated', 'description': 'change in net sales'}
        },
        'kg_graph': None
    }

    # Values spec from Phase 1 (using existing variable names)
    values_spec = {
        "change_in_net_sales": {
            "description": "the change in the total of net sales over the year",
            "semantic_type": "change_value",
            "source": "previous_result"
        },
        "net_sales_2000": {
            "description": "the total of net sales in 2000",
            "semantic_type": "total_value",
            "source": "previous_result"
        }
    }

    # Retrieve values
    value_objects = retrieve_values(values_spec, context)

    # Verify correct values retrieved
    assert 'change_in_net_sales' in value_objects
    assert 'net_sales_2000' in value_objects
    assert value_objects['change_in_net_sales']['value'] == -2620.0
    assert value_objects['net_sales_2000']['value'] == 7983.0

    print("✓ PASS")


def test_execute_simple_formula():
    """Test executing a simple formula"""
    print("\nTest: Execute simple formula...")

    value_objects = {
        'a': {'value': 10, 'scale': 'Units', 'source': 'test', 'description': 'value a'},
        'b': {'value': 5, 'scale': 'Units', 'source': 'test', 'description': 'value b'}
    }

    formula = "a + b"
    result = execute_formula(formula, value_objects)

    assert result['value'] == 15
    assert result['source'] == 'calculated'

    print("✓ PASS")


def test_execute_division_formula():
    """Test executing division formula"""
    print("\nTest: Execute division formula...")

    value_objects = {
        'numerator': {'value': 100, 'scale': 'Units', 'source': 'test', 'description': 'top'},
        'denominator': {'value': 4, 'scale': 'Units', 'source': 'test', 'description': 'bottom'}
    }

    formula = "numerator / denominator"
    result = execute_formula(formula, value_objects)

    assert result['value'] == 25.0

    print("✓ PASS")


def test_execute_percentage_formula():
    """Test executing percentage calculation"""
    print("\nTest: Execute percentage formula...")

    value_objects = {
        'change': {'value': -2620, 'scale': 'Millions', 'source': 'test', 'description': 'change'},
        'total': {'value': 7983, 'scale': 'Millions', 'source': 'test', 'description': 'total'}
    }

    formula = "change / total * 100"
    result = execute_formula(formula, value_objects)

    # -2620 / 7983 * 100 ≈ -32.82
    assert abs(result['value'] - (-32.82)) < 0.01

    print("✓ PASS")


def test_execute_with_abs():
    """Test executing formula with abs() function"""
    print("\nTest: Execute formula with abs()...")

    value_objects = {
        'x': {'value': -50, 'scale': 'Units', 'source': 'test', 'description': 'negative value'},
        'y': {'value': 10, 'scale': 'Units', 'source': 'test', 'description': 'positive value'}
    }

    formula = "abs(x) / y"
    result = execute_formula(formula, value_objects)

    assert result['value'] == 5.0

    print("✓ PASS")


def test_execute_with_round():
    """Test executing formula with round() function"""
    print("\nTest: Execute formula with round()...")

    value_objects = {
        'value': {'value': 3.14159, 'scale': 'Units', 'source': 'test', 'description': 'pi'}
    }

    formula = "round(value, 2)"
    result = execute_formula(formula, value_objects)

    assert result['value'] == 3.14

    print("✓ PASS")


def test_execute_complex_formula():
    """Test executing complex nested formula"""
    print("\nTest: Execute complex formula...")

    value_objects = {
        'rev_2008': {'value': 1000, 'scale': 'Millions', 'source': 'test', 'description': 'revenue 2008'},
        'rev_2007': {'value': 800, 'scale': 'Millions', 'source': 'test', 'description': 'revenue 2007'}
    }

    formula = "(rev_2008 - rev_2007) / rev_2007 * 100"
    result = execute_formula(formula, value_objects)

    # (1000 - 800) / 800 * 100 = 25.0
    assert result['value'] == 25.0

    print("✓ PASS")


def test_execute_rejects_invalid_variables():
    """Test that execution rejects formulas with undefined variables"""
    print("\nTest: Reject formula with undefined variables...")

    value_objects = {
        'a': {'value': 10, 'scale': 'Units', 'source': 'test', 'description': 'value a'}
    }

    formula = "a + b"  # b is not defined

    try:
        execute_formula(formula, value_objects)
        raise AssertionError("Should have rejected formula with undefined variable")
    except ValueError as e:
        assert "undefined variables" in str(e).lower()
        print("✓ PASS")


def test_sign_preservation():
    """Test that formulas preserve sign correctly"""
    print("\nTest: Sign preservation in calculations...")

    value_objects = {
        'negative_value': {'value': -100, 'scale': 'Units', 'source': 'test', 'description': 'negative'},
        'positive_value': {'value': 50, 'scale': 'Units', 'source': 'test', 'description': 'positive'}
    }

    # Test negative result
    formula = "negative_value / positive_value"
    result = execute_formula(formula, value_objects)
    assert result['value'] == -2.0

    # Test preserving negative in multiplication
    formula2 = "negative_value * 2"
    result2 = execute_formula(formula2, value_objects)
    assert result2['value'] == -200.0

    print("✓ PASS")


def test_retrieve_missing_variable():
    """Test error handling when variable not found"""
    print("\nTest: Error when variable missing...")

    context = {
        'results_by_name': {
            'available_var': {'value': 100, 'scale': 'Units', 'source': 'test', 'description': 'available'}
        },
        'kg_graph': None
    }

    values_spec = {
        "missing_value": {
            "source": "previous_result"
            # Variable name 'missing_value' not in context
        }
    }

    try:
        retrieve_values(values_spec, context)
        raise AssertionError("Should have raised error for missing variable")
    except ValueError as e:
        assert "not found in previous results" in str(e)
        print("✓ PASS")


if __name__ == "__main__":
    print("="*80)
    print("TESTING: execution.py (retrieval and formula execution)")
    print("="*80)

    tests = [
        test_retrieve_from_previous_results,
        test_execute_simple_formula,
        test_execute_division_formula,
        test_execute_percentage_formula,
        test_execute_with_abs,
        test_execute_with_round,
        test_execute_complex_formula,
        test_execute_rejects_invalid_variables,
        test_sign_preservation,
        test_retrieve_missing_variable,
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
