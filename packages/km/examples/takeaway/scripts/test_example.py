#!/usr/bin/env python3
"""Test a single example with detailed output"""
import json
import sys
from pathlib import Path

# Add src path
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "graph-solver" / "semantic-query"))

from test_prompt import load_test_cases, test_single_case

def test_example(example_id, verbose=True):
    """Test all turns of a single example"""
    # Load test cases
    all_cases = load_test_cases()

    # Filter to this example
    example_cases = [c for c in all_cases if c['example_id'] == str(example_id)]

    if not example_cases:
        print(f"❌ No test cases found for example {example_id}")
        return False

    print(f"\n{'='*80}")
    print(f"Testing Example {example_id} ({len(example_cases)} turns)")
    print(f"{'='*80}\n")

    results = []
    previous_results = []
    previous_results_metadata = []

    for i, case in enumerate(example_cases):
        turn = case['turn']
        print(f"[{i+1}/{len(example_cases)}] Turn {turn}: {case['question'][:80]}...")

        result = test_single_case(case, previous_results, previous_results_metadata, verbose=verbose)
        success, issues, output, execution = result

        # Store result
        result_data = {
            'turn': turn,
            'question': case['question'],
            'gold_answer': case['gold_answer'],
            'success': success,
            'issues': issues if issues else [],
            'output': output,
            'execution': execution
        }
        results.append(result_data)

        if success:
            print("  ✓ PASS")
            if execution:
                print(f"    Answer: {execution['our_answer']} (gold: {execution['gold_answer']})")
                previous_results.append(execution['our_answer_full'])

                # Import metadata generation functions
                import sys
                from pathlib import Path
                sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "graph-solver" / "semantic-query"))
                from test_prompt import generate_description, extract_entity, classify_metric_type

                # Extract phase outputs from output dict
                phase1_output = output.get('phase1', {}) if output else {}
                phase2_output = output.get('phase2', {}) if output else {}

                # Generate rich metadata
                previous_results_metadata.append({
                    'value': execution.get('our_answer_full', execution['our_answer']),
                    'scale': execution.get('output_scale', 'Units'),
                    'description': generate_description(case['question'], phase1_output, phase2_output),
                    'entity': extract_entity(phase1_output.get('values', {})),
                    'metric_type': classify_metric_type(case['question']),
                    'question': case['question'],
                    'phase1_variables': list(phase1_output.get('values', {}).keys()),
                    'phase2_formula': phase2_output.get('formula', '')
                })
        else:
            print(f"  ✗ FAIL: {', '.join(issues)}")
            if execution and 'our_answer' in execution:
                print(f"    Our answer: {execution.get('our_answer', 'N/A')}")
                print(f"    Gold answer: {execution.get('gold_answer', 'N/A')}")
                previous_results.append(execution.get('our_answer_full'))

                # Import metadata generation functions
                import sys
                from pathlib import Path
                sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "graph-solver" / "semantic-query"))
                from test_prompt import generate_description, extract_entity, classify_metric_type

                # Extract phase outputs from output dict
                phase1_output = output.get('phase1', {}) if output else {}
                phase2_output = output.get('phase2', {}) if output else {}

                # Generate rich metadata even for failures
                previous_results_metadata.append({
                    'value': execution.get('our_answer_full', execution['our_answer']),
                    'scale': execution.get('output_scale', 'Units'),
                    'description': generate_description(case['question'], phase1_output, phase2_output),
                    'entity': extract_entity(phase1_output.get('values', {})),
                    'metric_type': classify_metric_type(case['question']),
                    'question': case['question'],
                    'phase1_variables': list(phase1_output.get('values', {}).keys()),
                    'phase2_formula': phase2_output.get('formula', '')
                })
            else:
                previous_results.append(None)
                previous_results_metadata.append({'scale': 'Units'})
        print()

    # Summary
    passed = sum(1 for r in results if r['success'])
    failed = len(results) - passed

    print(f"{'='*80}")
    print(f"Example {example_id} Results: {passed}/{len(results)} passed ({passed/len(results)*100:.1f}%)")
    print(f"{'='*80}\n")

    # Save detailed results
    output_dir = Path(__file__).parent.parent / "data" / "test-results" / "current" / "by-example"
    output_file = output_dir / f"{example_id}.json"

    with open(output_file, 'w') as f:
        json.dump({
            'example_id': example_id,
            'total_turns': len(results),
            'passed': passed,
            'failed': failed,
            'accuracy': passed / len(results),
            'turns': results
        }, f, indent=2)

    print(f"Detailed results saved to: {output_file}\n")

    return passed == len(results)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test a single example")
    parser.add_argument("example_id", type=str, help="Example ID (e.g., 109, 115)")
    parser.add_argument("--quiet", "-q", action="store_true", help="Less verbose output")

    args = parser.parse_args()

    success = test_example(args.example_id, verbose=not args.quiet)
    sys.exit(0 if success else 1)
