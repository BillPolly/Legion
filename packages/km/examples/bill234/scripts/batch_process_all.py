#!/usr/bin/env python3
"""
Batch process all 130 examples from the ConvFinQA dataset.
Builds KGs, creates test cases, runs tests, and generates report.
"""

import json
import subprocess
import sys
from pathlib import Path

def run_command(cmd, description, timeout=300):
    """Run a command and return success status."""
    print(f"  {description}...", end=" ", flush=True)
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        if result.returncode == 0:
            print("✓")
            return True
        else:
            print(f"✗ (exit code {result.returncode})")
            if result.stderr:
                print(f"    Error: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"✗ (timeout after {timeout}s)")
        return False
    except Exception as e:
        print(f"✗ ({str(e)[:100]})")
        return False

def process_example(example_num):
    """Process a single example: build KG, create test, run test."""
    print(f"\n{'='*60}")
    print(f"Processing Example {example_num}")
    print('='*60)

    # Step 1: Build KG
    if not run_command(
        f"uv run python scripts/build-kg-for-example.py {example_num}",
        "Building knowledge graph",
        timeout=180
    ):
        return {"status": "kg_build_failed", "example_id": example_num}

    # Step 2: Create test cases
    if not run_command(
        f"uv run python scripts/create-test-case.py {example_num}",
        "Creating test cases"
    ):
        return {"status": "test_case_failed", "example_id": example_num}

    # Step 3: Copy KG to knowledge-graphs directory
    if not run_command(
        f"cp data/preprocessed/{example_num}_kg.ttl data/knowledge-graphs/{example_num}_kg.ttl",
        "Copying KG file"
    ):
        return {"status": "copy_failed", "example_id": example_num}

    # Step 4: Add ontology to test cases
    if not run_command(
        f"uv run python scripts/add-ontology-to-test-cases.py {example_num}",
        "Adding ontology"
    ):
        return {"status": "ontology_failed", "example_id": example_num}

    # Step 5: Run tests
    if not run_command(
        f"uv run python scripts/test_example.py {example_num}",
        "Running tests",
        timeout=180
    ):
        return {"status": "test_run_failed", "example_id": example_num}

    # Step 6: Read results
    try:
        result_file = Path(f"data/test-results/current/by-example/{example_num}.json")
        if result_file.exists():
            with open(result_file) as f:
                result_data = json.load(f)

            return {
                "status": "completed",
                "example_id": example_num,
                "accuracy": result_data.get("accuracy", 0.0),
                "passed": result_data.get("passed", 0),
                "failed": result_data.get("failed", 0),
                "total_turns": result_data.get("total_turns", 0)
            }
        else:
            return {"status": "no_results", "example_id": example_num}
    except Exception as e:
        return {"status": "read_error", "example_id": example_num, "error": str(e)}

def main():
    print("="*60)
    print("BATCH PROCESSING: Examples 0-130")
    print("="*60)

    results = []

    # Process examples 0-130
    for i in range(131):
        result = process_example(i)
        results.append(result)

        # Print progress every 10 examples
        if (i + 1) % 10 == 0:
            completed = sum(1 for r in results if r.get("status") == "completed")
            perfect = sum(1 for r in results if r.get("status") == "completed" and r.get("accuracy") == 1.0)
            print(f"\n{'='*60}")
            print(f"Progress: {i+1}/131 examples processed")
            print(f"  Completed: {completed}")
            print(f"  Perfect (100%): {perfect}")
            print(f"  Failed to process: {len(results) - completed}")
            print('='*60)

    # Generate final report
    print("\n" + "="*60)
    print("FINAL REPORT")
    print("="*60)

    completed_results = [r for r in results if r.get("status") == "completed"]
    perfect_examples = [r for r in completed_results if r.get("accuracy") == 1.0]
    partial_examples = [r for r in completed_results if 0 < r.get("accuracy", 0) < 1.0]
    failed_examples = [r for r in completed_results if r.get("accuracy") == 0]
    processing_errors = [r for r in results if r.get("status") != "completed"]

    total_turns = sum(r.get("total_turns", 0) for r in completed_results)
    passed_turns = sum(r.get("passed", 0) for r in completed_results)
    failed_turns = sum(r.get("failed", 0) for r in completed_results)

    print(f"\nExamples Processed: {len(results)}/131")
    print(f"  Successfully completed: {len(completed_results)}")
    print(f"  Processing errors: {len(processing_errors)}")

    print(f"\nAccuracy by Example:")
    print(f"  Perfect (100%): {len(perfect_examples)} examples")
    print(f"  Partial: {len(partial_examples)} examples")
    print(f"  Failed (0%): {len(failed_examples)} examples")

    print(f"\nAccuracy by Turn:")
    print(f"  Total turns: {total_turns}")
    print(f"  Passed: {passed_turns}")
    print(f"  Failed: {failed_turns}")
    if total_turns > 0:
        print(f"  Overall accuracy: {passed_turns/total_turns*100:.1f}%")

    # Save detailed results
    output_file = Path("data/test-results/batch-processing-report.json")
    with open(output_file, "w") as f:
        json.dump({
            "total_examples": len(results),
            "completed": len(completed_results),
            "perfect": len(perfect_examples),
            "partial": len(partial_examples),
            "failed": len(failed_examples),
            "processing_errors": len(processing_errors),
            "total_turns": total_turns,
            "passed_turns": passed_turns,
            "failed_turns": failed_turns,
            "overall_accuracy": passed_turns/total_turns if total_turns > 0 else 0,
            "results": results,
            "perfect_examples": [r["example_id"] for r in perfect_examples],
            "failed_examples": [r["example_id"] for r in failed_examples],
            "error_examples": [r["example_id"] for r in processing_errors]
        }, f, indent=2)

    print(f"\nDetailed results saved to: {output_file}")

    print("\n" + "="*60)
    print("BATCH PROCESSING COMPLETE")
    print("="*60)

if __name__ == "__main__":
    main()
