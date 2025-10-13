#!/usr/bin/env python3
"""Unit tests for ontology_loader.py"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ontology_loader import load_semantic_guidance


def test_loads_without_error():
    """Test that ontology loads without errors"""
    print("Test: Load ontology without errors...")
    guidance = load_semantic_guidance()
    assert guidance is not None
    assert isinstance(guidance, str)
    assert len(guidance) > 0
    print("✓ PASS")


def test_contains_linguistic_patterns():
    """Test that guidance contains linguistic patterns"""
    print("\nTest: Contains linguistic patterns...")
    guidance = load_semantic_guidance()
    assert "LINGUISTIC PATTERNS" in guidance
    assert "in relation to" in guidance
    assert "percentage" in guidance or "in percentage" in guidance
    assert "change" in guidance
    print("✓ PASS")


def test_contains_semantic_operations():
    """Test that guidance contains semantic operations"""
    print("\nTest: Contains semantic operations...")
    guidance = load_semantic_guidance()
    assert "SEMANTIC OPERATIONS" in guidance
    # Should have operation descriptions
    assert "Ratio" in guidance or "ratio" in guidance
    print("✓ PASS")


def test_format_is_readable():
    """Test that format is readable for LLM"""
    print("\nTest: Format is readable...")
    guidance = load_semantic_guidance()

    # Should have clear section headers
    assert "=" in guidance  # Section dividers
    assert "-" in guidance  # Sub-sections

    # Should not be raw Turtle syntax
    assert "@prefix" not in guidance
    assert "rdf:type" not in guidance

    print("✓ PASS")


def test_guidance_length():
    """Test that guidance is reasonably sized"""
    print("\nTest: Guidance is reasonably sized...")
    guidance = load_semantic_guidance()

    # Should be substantial but not too long
    assert len(guidance) > 1000, f"Too short: {len(guidance)} chars"
    assert len(guidance) < 50000, f"Too long: {len(guidance)} chars"

    print(f"✓ PASS - Guidance is {len(guidance)} characters")


def test_specific_patterns():
    """Test for specific important patterns"""
    print("\nTest: Contains specific important patterns...")
    guidance = load_semantic_guidance()

    # Key patterns we know exist
    patterns_to_check = [
        "in relation to",
        "what was the change",
        "percentage"
    ]

    for pattern in patterns_to_check:
        assert pattern.lower() in guidance.lower(), f"Missing pattern: {pattern}"
        print(f"  ✓ Found: {pattern}")

    print("✓ PASS")


if __name__ == "__main__":
    print("="*80)
    print("TESTING: ontology_loader.py")
    print("="*80)

    tests = [
        test_loads_without_error,
        test_contains_linguistic_patterns,
        test_contains_semantic_operations,
        test_format_is_readable,
        test_guidance_length,
        test_specific_patterns
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
            failed += 1

    print("\n" + "="*80)
    print(f"Results: {passed}/{len(tests)} tests passed")
    if failed == 0:
        print("✓ ALL TESTS PASSED")
    else:
        print(f"✗ {failed} tests failed")
    print("="*80)

    exit(0 if failed == 0 else 1)
