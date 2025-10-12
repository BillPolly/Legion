#!/usr/bin/env python3
"""Analyze failure patterns across all test results"""
from pymongo import MongoClient
from collections import defaultdict, Counter
import re

client = MongoClient('mongodb://localhost:27017/')
db = client['legion_tools']

# Get all test results with turn details
results = list(db.test_results.find({}, {
    'example_id': 1,
    'turns': 1
}).sort('example_id', 1))

print("=" * 80)
print("FAILURE PATTERN ANALYSIS")
print("=" * 80)

# Categorize failures
error_patterns = defaultdict(list)
failure_reasons = Counter()

for result in results:
    ex_id = result['example_id']
    for turn_idx, turn in enumerate(result.get('turns', []), 1):
        if not turn.get('success', False):
            # Get error info
            error_msg = turn.get('error_message', '')
            our_answer = turn.get('our_answer')
            gold_answer = turn.get('gold_answer')

            # Categorize error
            if 'SPARQL query returned no results' in error_msg:
                reason = 'SPARQL_NO_RESULTS'
                # Extract what it was looking for
                if 'FILTER(CONTAINS' in error_msg:
                    match = re.search(r'FILTER\(CONTAINS\(LCASE\(\?(?:row|col|label)\), "([^"]+)"\)', error_msg)
                    if match:
                        search_term = match.group(1)
                        error_patterns[reason].append((ex_id, turn_idx, search_term))
                    else:
                        error_patterns[reason].append((ex_id, turn_idx, 'unknown'))
                else:
                    error_patterns[reason].append((ex_id, turn_idx, 'no_filter'))
            elif 'KeyError' in error_msg or 'not found in previous results' in error_msg:
                reason = 'VARIABLE_NOT_FOUND'
                error_patterns[reason].append((ex_id, turn_idx, error_msg[:100]))
            elif our_answer is None:
                reason = 'NONE_ANSWER'
                error_patterns[reason].append((ex_id, turn_idx, f'gold={gold_answer}'))
            elif our_answer != gold_answer and our_answer is not None:
                reason = 'WRONG_VALUE'
                error_patterns[reason].append((ex_id, turn_idx, f'ours={our_answer}, gold={gold_answer}'))
            else:
                reason = 'OTHER'
                error_patterns[reason].append((ex_id, turn_idx, error_msg[:100] if error_msg else 'no_error_msg'))

            failure_reasons[reason] += 1

print("\n📊 FAILURE BREAKDOWN:")
print("-" * 80)
total_failures = sum(failure_reasons.values())
for reason, count in failure_reasons.most_common():
    pct = 100 * count / total_failures
    print(f"{reason:25s}: {count:3d} failures ({pct:5.1f}%)")

print("\n" + "=" * 80)
print("TOP 3 FAILURE PATTERNS (with examples)")
print("=" * 80)

for i, (reason, count) in enumerate(failure_reasons.most_common(3), 1):
    print(f"\n{i}. {reason} ({count} failures, {100*count/total_failures:.1f}%)")
    print("-" * 80)

    examples = error_patterns[reason][:10]  # Show first 10

    if reason == 'SPARQL_NO_RESULTS':
        # Group by search term
        search_terms = Counter(term for _, _, term in examples)
        print("   Most common search terms that failed:")
        for term, term_count in search_terms.most_common(5):
            print(f"     - '{term}': {term_count} occurrences")
        print("\n   Examples:")
        for ex_id, turn, term in examples[:5]:
            print(f"     Example {ex_id}, Turn {turn}: searching for '{term}'")
    else:
        print("   Examples:")
        for ex_id, turn, detail in examples[:5]:
            print(f"     Example {ex_id}, Turn {turn}: {detail}")

    if len(examples) > 10:
        print(f"   ... and {len(error_patterns[reason]) - 10} more")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total failures analyzed: {total_failures}")
print(f"Top 3 patterns account for: {sum(count for _, count in failure_reasons.most_common(3))} failures")
print(f"  ({100 * sum(count for _, count in failure_reasons.most_common(3)) / total_failures:.1f}% of all failures)")
