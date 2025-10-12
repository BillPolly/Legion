#!/usr/bin/env python3
"""Unit tests for formula validation"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from execution import validate_formula


def test_valid_arithmetic():
    """Test valid arithmetic formulas"""
    print("Test: Valid arithmetic formulas...")

    variables = ['a', 'b', 'c']

    test_cases = [
        "a + b",
        "a - b",
        "a * b",
        "a / b",
        "(a + b) * c",
        "a / b * 100",
        "(a - b) / c",
        "a + b - c",
    ]

    for formula in test_cases:
        try:
            validate_formula(formula, variables)
        except Exception as e:
            raise AssertionError(f"Valid formula rejected: '{formula}'. Error: {e}")

    print(f"✓ PASS - Validated {len(test_cases)} arithmetic formulas")


def test_valid_with_functions():
    """Test valid formulas with functions"""
    print("\nTest: Valid formulas with functions...")

    variables = ['x', 'y', 'z']

    test_cases = [
        "abs(x)",
        "abs(x - y)",
        "min(x, y)",
        "max(x, y)",
        "round(x, 2)",
        "round(x / y * 100, 2)",
        "abs(x) / y",
        "min(x, y) + max(y, z)",
    ]

    for formula in test_cases:
        try:
            validate_formula(formula, variables)
        except Exception as e:
            raise AssertionError(f"Valid formula rejected: '{formula}'. Error: {e}")

    print(f"✓ PASS - Validated {len(test_cases)} function formulas")


def test_valid_with_constants():
    """Test valid formulas with numeric constants"""
    print("\nTest: Valid formulas with constants...")

    variables = ['value', 'total']

    test_cases = [
        "value * 100",
        "value / total * 100",
        "(value - 0.5) * 2",
        "value + 1000",
        "abs(value) * 1.5",
    ]

    for formula in test_cases:
        try:
            validate_formula(formula, variables)
        except Exception as e:
            raise AssertionError(f"Valid formula rejected: '{formula}'. Error: {e}")

    print(f"✓ PASS - Validated {len(test_cases)} formulas with constants")


def test_invalid_undefined_variables():
    """Test rejection of undefined variables"""
    print("\nTest: Reject undefined variables...")

    variables = ['a', 'b']

    test_cases = [
        "a + c",  # c not defined
        "x + y",  # x, y not defined
        "a / undefined_var",
        "foo * bar",
    ]

    for formula in test_cases:
        try:
            validate_formula(formula, variables)
            raise AssertionError(f"Should have rejected formula: '{formula}'")
        except ValueError as e:
            # Expected - formula uses undefined variables
            assert "undefined variables" in str(e).lower()
        except Exception as e:
            raise AssertionError(f"Wrong exception type for '{formula}': {e}")

    print(f"✓ PASS - Correctly rejected {len(test_cases)} invalid formulas")


def test_invalid_syntax():
    """Test rejection of invalid Python syntax"""
    print("\nTest: Reject invalid syntax...")

    variables = ['a', 'b']

    test_cases = [
        "a +",  # Incomplete
        "a * * b",  # Double operator
        "(a + b",  # Unmatched paren
        "a + b)",  # Unmatched paren
        "",  # Empty
    ]

    for formula in test_cases:
        try:
            validate_formula(formula, variables)
            raise AssertionError(f"Should have rejected formula: '{formula}'")
        except SyntaxError:
            # Expected - invalid syntax
            pass
        except Exception as e:
            raise AssertionError(f"Wrong exception type for '{formula}': {e}")

    print(f"✓ PASS - Correctly rejected {len(test_cases)} syntax errors")


def test_complex_formulas():
    """Test complex real-world formulas"""
    print("\nTest: Complex real-world formulas...")

    variables = ['change_in_sales', 'total_sales_2000', 'revenue_2008', 'revenue_2007']

    test_cases = [
        "change_in_sales / total_sales_2000 * 100",
        "(revenue_2008 - revenue_2007) / revenue_2007 * 100",
        "abs(change_in_sales) / total_sales_2000",
        "round((change_in_sales / total_sales_2000) * 100, 2)",
    ]

    for formula in test_cases:
        try:
            validate_formula(formula, variables)
        except Exception as e:
            raise AssertionError(f"Valid formula rejected: '{formula}'. Error: {e}")

    print(f"✓ PASS - Validated {len(test_cases)} complex formulas")


def test_edge_cases():
    """Test edge cases"""
    print("\nTest: Edge cases...")

    # Single variable
    assert validate_formula("x", ['x'])

    # Just a constant
    assert validate_formula("100", [])

    # Complex nesting
    assert validate_formula("((a + b) * (c - d)) / (e + f)", ['a', 'b', 'c', 'd', 'e', 'f'])

    print("✓ PASS - Edge cases handled correctly")


if __name__ == "__main__":
    print("="*80)
    print("TESTING: formula validation")
    print("="*80)

    tests = [
        test_valid_arithmetic,
        test_valid_with_functions,
        test_valid_with_constants,
        test_invalid_undefined_variables,
        test_invalid_syntax,
        test_complex_formulas,
        test_edge_cases,
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
