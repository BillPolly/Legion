#!/usr/bin/env python3
"""
Test multiple examples in batch and collect results
"""
import sys
import subprocess
from pathlib import Path

def test_examples(start_id, end_id):
    """Test examples for a range of IDs"""
    results = []

    for example_id in range(start_id, end_id + 1):
        print(f"\n{'='*80}")
        print(f"Testing Example {example_id}")
        print(f"{'='*80}")

        try:
            result = subprocess.run(
                ['uv', 'run', 'python', 'src/graph-solver/__tests__/test_example.py', str(example_id)],
                capture_output=True,
                text=True,
                timeout=180
            )

            # Extract pass/fail from output
            output = result.stdout
            if 'COMPLETE:' in output:
                # Parse "X/Y passed (Z%)"
                complete_line = [line for line in output.split('\n') if 'COMPLETE:' in line][0]
                results.append({
                    'example_id': example_id,
                    'output': complete_line,
                    'success': result.returncode == 0
                })
                print(complete_line)
            else:
                results.append({
                    'example_id': example_id,
                    'output': 'ERROR',
                    'success': False
                })
                print(f"ERROR: Could not parse output")
                print(result.stderr)

        except subprocess.TimeoutExpired:
            print(f"TIMEOUT")
            results.append({
                'example_id': example_id,
                'output': 'TIMEOUT',
                'success': False
            })
        except Exception as e:
            print(f"ERROR: {e}")
            results.append({
                'example_id': example_id,
                'output': f'EXCEPTION: {e}',
                'success': False
            })

    # Print summary
    print(f"\n{'='*80}")
    print(f"BATCH TEST SUMMARY ({start_id}-{end_id})")
    print(f"{'='*80}\n")

    for r in results:
        status = "✓" if r['success'] else "✗"
        print(f"{status} Example {r['example_id']}: {r['output']}")

    return results

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python test-batch.py <start_id> <end_id>")
        sys.exit(1)

    start = int(sys.argv[1])
    end = int(sys.argv[2])

    results = test_examples(start, end)

    # Count successes
    successes = sum(1 for r in results if r['success'])
    print(f"\n{'='*80}")
    print(f"OVERALL: {successes}/{len(results)} examples passed")
    print(f"{'='*80}\n")
