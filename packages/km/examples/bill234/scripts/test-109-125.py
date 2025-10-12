#!/usr/bin/env python3
"""Test all examples 109-125 and summarize results"""
import subprocess
import sys

# Example 113 has no test cases
examples = [109, 110, 111, 112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125]
results = {}

for ex_num in examples:
    print(f"\n{'='*80}")
    print(f"Testing Example {ex_num}")
    print('='*80)

    try:
        result = subprocess.run(
            ['uv', 'run', 'scripts/test_example.py', str(ex_num)],
            capture_output=True,
            text=True,
            timeout=180
        )

        # Extract results from output
        output = result.stdout + result.stderr

        # Look for "Results: X/Y passed"
        for line in output.split('\n'):
            if 'Results:' in line and 'passed' in line:
                # Parse "Example 122 Results: 2/3 passed (66.7%)"
                parts = line.split(':')[1].strip()  # "2/3 passed (66.7%)"
                fraction = parts.split(' ')[0]  # "2/3"
                correct, total = map(int, fraction.split('/'))

                status = '✓' if correct == total else '✗'
                results[ex_num] = {'correct': correct, 'total': total, 'status': status}
                print(f"  {status} {correct}/{total} passed")
                break
    except subprocess.TimeoutExpired:
        results[ex_num] = {'correct': 0, 'total': 0, 'status': 'TIMEOUT'}
        print(f"  TIMEOUT")
    except Exception as e:
        results[ex_num] = {'correct': 0, 'total': 0, 'status': 'ERROR'}
        print(f"  ERROR: {e}")

# Summary
print(f"\n{'='*80}")
print("FINAL SUMMARY")
print('='*80)

total_correct = 0
total_questions = 0

for ex_num in examples:
    if ex_num in results:
        r = results[ex_num]
        total_correct += r['correct']
        total_questions += r['total']
        print(f"Example {ex_num}: {r['correct']}/{r['total']} {r['status']}")

accuracy = (total_correct/total_questions*100) if total_questions > 0 else 0
print(f"\nOverall: {total_correct}/{total_questions} ({accuracy:.1f}%)")

if total_correct == total_questions:
    print("\n✓✓✓ 100% ACCURACY ACHIEVED! ✓✓✓")
    sys.exit(0)
else:
    failures = total_questions - total_correct
    print(f"\n✗ {failures} failure(s)")
    print(f"Success rate: {accuracy:.1f}%")
    sys.exit(1)
