#!/usr/bin/env python3
"""Test all examples 109-117 and summarize results"""
import subprocess
import sys

examples = [109, 110, 111, 112, 114, 115, 116, 117]
results = {}

for ex_num in examples:
    print(f"\n{'='*80}")
    print(f"Testing Example {ex_num}")
    print('='*80)

    try:
        result = subprocess.run(
            ['uv', 'run', 'scripts/test-one.py', str(ex_num)],
            capture_output=True,
            text=True,
            timeout=60
        )

        # Extract correctness from output
        output = result.stdout + result.stderr

        if '100% CORRECT!' in output:
            # Parse turn count
            for line in output.split('\n'):
                if '/5 correct' in line or '/6 correct' in line or '/2 correct' in line or '/3 correct' in line or '/4 correct' in line:
                    parts = line.split(':')[1].strip().split('/')
                    correct = int(parts[0])
                    total = int(parts[1].split()[0])
                    results[ex_num] = {'correct': correct, 'total': total, 'status': '✓'}
                    print(f"  ✓ {correct}/{total} correct")
                    break
        else:
            # Parse failure
            for line in output.split('\n'):
                if '/5 correct' in line or '/6 correct' in line or '/2 correct' in line or '/3 correct' in line or '/4 correct' in line:
                    parts = line.split(':')[1].strip().split('/')
                    correct = int(parts[0])
                    total = int(parts[1].split()[0])
                    results[ex_num] = {'correct': correct, 'total': total, 'status': '✗'}
                    print(f"  ✗ {correct}/{total} correct")
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

print(f"\nOverall: {total_correct}/{total_questions} ({total_correct/total_questions*100:.1f}%)")

if total_correct == total_questions:
    print("\n✓✓✓ 100% ACCURACY ACHIEVED! ✓✓✓")
    sys.exit(0)
else:
    print(f"\n✗ {total_questions - total_correct} failures")
    sys.exit(1)
