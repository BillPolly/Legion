#!/usr/bin/env python3
"""
Rebuild multiple KGs in batch with the updated extraction logic
"""
import sys
import subprocess
from pathlib import Path

def rebuild_kgs(start_id, end_id):
    """Rebuild KGs for a range of example IDs"""
    failed = []

    for example_id in range(start_id, end_id + 1):
        print(f"\n{'='*80}")
        print(f"Rebuilding KG for Example {example_id}")
        print(f"{'='*80}")

        try:
            result = subprocess.run(
                ['uv', 'run', 'python', 'scripts/build-kg-for-example.py', str(example_id), '--force'],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                print(f"✓ Example {example_id} KG rebuilt successfully")
            else:
                print(f"✗ Example {example_id} FAILED:")
                print(result.stderr)
                failed.append(example_id)

        except subprocess.TimeoutExpired:
            print(f"✗ Example {example_id} TIMEOUT")
            failed.append(example_id)
        except Exception as e:
            print(f"✗ Example {example_id} ERROR: {e}")
            failed.append(example_id)

    print(f"\n{'='*80}")
    print(f"REBUILD SUMMARY")
    print(f"{'='*80}")
    print(f"Total: {end_id - start_id + 1} examples")
    print(f"Succeeded: {(end_id - start_id + 1) - len(failed)}")
    print(f"Failed: {len(failed)}")

    if failed:
        print(f"\nFailed examples: {failed}")

    return failed

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python rebuild-kgs-batch.py <start_id> <end_id>")
        sys.exit(1)

    start = int(sys.argv[1])
    end = int(sys.argv[2])

    failed = rebuild_kgs(start, end)
    sys.exit(len(failed))
