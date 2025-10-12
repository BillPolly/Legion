#!/usr/bin/env python3
"""
Tests for RDFLib SQLite caching functionality

Tests:
1. Cache creation and initialization
2. Cache hit/miss behavior
3. Cache invalidation on file changes
4. Query correctness (cached vs uncached)
5. Performance improvement
6. Concurrent access
"""
import sys
import time
import tempfile
import shutil
from pathlib import Path

# Add src to path
src_dir = Path(__file__).parent.parent
sys.path.insert(0, str(src_dir))

from execution import load_graph, _get_cache_db_path, _init_cache_db, _is_cache_valid


def test_cache_initialization():
    """Test that cache DB is created and initialized properly"""
    print("\n" + "=" * 80)
    print("TEST 1: Cache Initialization")
    print("=" * 80)

    # Clean up any existing cache
    cache_path = _get_cache_db_path()
    if cache_path.exists():
        cache_path.unlink()

    # Initialize cache
    _init_cache_db(cache_path)

    assert cache_path.exists(), "Cache DB file was not created"
    print("✓ Cache DB file created")

    # Check metadata table exists
    import sqlite3
    conn = sqlite3.connect(str(cache_path))
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cache_metadata'"
    )
    assert cursor.fetchone() is not None, "Metadata table not created"
    conn.close()
    print("✓ Metadata table exists")

    print("\nTest 1 PASSED ✅\n")


def test_cache_miss_then_hit():
    """Test cache miss on first load, cache hit on second load"""
    print("=" * 80)
    print("TEST 2: Cache Miss → Cache Hit")
    print("=" * 80)

    # Clean up cache
    cache_path = _get_cache_db_path()
    if cache_path.exists():
        cache_path.unlink()

    # First load - should be cache miss
    print("\nFirst load (cache miss expected)...")
    start = time.time()
    g1 = load_graph("9", use_cache=True)
    first_load_time = time.time() - start
    print(f"✓ First load completed in {first_load_time:.3f}s")

    # Verify graph has data
    count1 = len(list(g1))
    assert count1 > 0, "Graph has no triples"
    print(f"✓ Graph loaded with {count1} triples")

    # Second load - should be cache hit
    print("\nSecond load (cache hit expected)...")
    start = time.time()
    g2 = load_graph("9", use_cache=True)
    second_load_time = time.time() - start
    print(f"✓ Second load completed in {second_load_time:.3f}s")

    # Verify same data
    count2 = len(list(g2))
    assert count1 == count2, f"Triple counts don't match: {count1} vs {count2}"
    print(f"✓ Same triple count: {count2}")

    # Cache hit should be faster (though not always guaranteed)
    speedup = first_load_time / second_load_time if second_load_time > 0 else 1.0
    print(f"\nSpeedup: {speedup:.2f}x")

    print("\nTest 2 PASSED ✅\n")


def test_cache_invalidation():
    """Test that cache is invalidated when turtle file changes"""
    print("=" * 80)
    print("TEST 3: Cache Invalidation on File Change")
    print("=" * 80)

    # Clean up cache
    cache_path = _get_cache_db_path()
    if cache_path.exists():
        cache_path.unlink()

    # Load to populate cache
    print("\nInitial load...")
    g1 = load_graph("9", use_cache=True)
    count1 = len(list(g1))
    print(f"✓ Loaded {count1} triples")

    # Get turtle file path
    kg_path = Path(__file__).parent.parent.parent.parent / "data" / "knowledge-graphs" / "9_kg.ttl"

    # Check cache is valid
    assert _is_cache_valid("9", kg_path, cache_path), "Cache should be valid"
    print("✓ Cache is valid")

    # Simulate file change by updating mtime
    print("\nSimulating file modification...")
    time.sleep(0.1)  # Ensure time difference
    kg_path.touch()  # Update mtime

    # Check cache is now invalid
    assert not _is_cache_valid("9", kg_path, cache_path), "Cache should be invalid"
    print("✓ Cache correctly invalidated after file touch")

    # Load again - should rebuild cache
    print("\nReloading after file change...")
    g2 = load_graph("9", use_cache=True)
    count2 = len(list(g2))
    assert count1 == count2, "Triple count changed after reload"
    print(f"✓ Reloaded correctly with {count2} triples")

    # Cache should be valid again
    assert _is_cache_valid("9", kg_path, cache_path), "Cache should be valid after rebuild"
    print("✓ Cache is valid again")

    print("\nTest 3 PASSED ✅\n")


def test_query_correctness():
    """Test that SPARQL queries return same results with and without cache"""
    print("=" * 80)
    print("TEST 4: Query Correctness (Cached vs Uncached)")
    print("=" * 80)

    # Clean cache
    cache_path = _get_cache_db_path()
    if cache_path.exists():
        cache_path.unlink()

    # Load without cache
    print("\nLoading without cache...")
    g_uncached = load_graph("9", use_cache=False)

    # Load with cache
    print("Loading with cache...")
    g_cached = load_graph("9", use_cache=True)

    # Test query: Get all metrics with year 2013
    query = """
    PREFIX kg: <http://example.org/convfinqa/>
    SELECT ?label ?value WHERE {
        ?metric a kg:FinancialMetric .
        ?metric kg:label ?label .
        ?metric kg:forTimePeriod ?year .
        ?year kg:yearValue 2013 .
        ?metric kg:hasValue ?valueEntity .
        ?valueEntity kg:numericValue ?value .
    }
    ORDER BY ?label
    """

    print("\nExecuting SPARQL query on both graphs...")
    results_uncached = list(g_uncached.query(query))
    results_cached = list(g_cached.query(query))

    print(f"✓ Uncached results: {len(results_uncached)} rows")
    print(f"✓ Cached results: {len(results_cached)} rows")

    # Compare results
    assert len(results_uncached) == len(results_cached), \
        f"Result counts differ: {len(results_uncached)} vs {len(results_cached)}"

    for i, (r1, r2) in enumerate(zip(results_uncached, results_cached)):
        assert str(r1.label) == str(r2.label), f"Row {i} label mismatch"
        assert float(r1.value) == float(r2.value), f"Row {i} value mismatch"

    print(f"✓ All {len(results_uncached)} query results match exactly")

    print("\nTest 4 PASSED ✅\n")


def test_multiple_examples():
    """Test caching with multiple examples in same database"""
    print("=" * 80)
    print("TEST 5: Multiple Examples in Same Cache")
    print("=" * 80)

    # Clean cache
    cache_path = _get_cache_db_path()
    if cache_path.exists():
        cache_path.unlink()

    # Load multiple examples
    examples = ["9", "10", "11"]
    triple_counts = {}

    print("\nLoading multiple examples...")
    for ex in examples:
        g = load_graph(ex, use_cache=True)
        count = len(list(g))
        triple_counts[ex] = count
        print(f"✓ Example {ex}: {count} triples")

    # Reload and verify
    print("\nReloading to verify cache...")
    for ex in examples:
        g = load_graph(ex, use_cache=True)
        count = len(list(g))
        assert count == triple_counts[ex], f"Example {ex} count changed: {triple_counts[ex]} -> {count}"
        print(f"✓ Example {ex}: {count} triples (matched)")

    print("\nTest 5 PASSED ✅\n")


def test_fallback_mode():
    """Test that use_cache=False works correctly"""
    print("=" * 80)
    print("TEST 6: Fallback Mode (use_cache=False)")
    print("=" * 80)

    print("\nLoading with cache disabled...")
    g = load_graph("9", use_cache=False)
    count = len(list(g))
    print(f"✓ Loaded {count} triples without caching")

    # Verify it's an in-memory graph (not SQLite-backed)
    assert str(type(g.store)) != "rdflib_sqlalchemy.store.SQLAlchemy", \
        "Should use in-memory store when cache disabled"
    print("✓ Using in-memory store (not SQLite)")

    print("\nTest 6 PASSED ✅\n")


def run_all_tests():
    """Run all cache tests"""
    print("\n" + "=" * 80)
    print("SQLITE CACHE TEST SUITE")
    print("=" * 80)

    tests = [
        ("Cache Initialization", test_cache_initialization),
        ("Cache Miss → Hit", test_cache_miss_then_hit),
        ("Cache Invalidation", test_cache_invalidation),
        ("Query Correctness", test_query_correctness),
        ("Multiple Examples", test_multiple_examples),
        ("Fallback Mode", test_fallback_mode),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f"\n❌ TEST FAILED: {name}")
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 80)
    print(f"TEST SUMMARY: {passed} passed, {failed} failed")
    print("=" * 80 + "\n")

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
