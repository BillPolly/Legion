#!/usr/bin/env python3
"""Test runner - wire all phases together and test on examples"""
import sys
import json
from pathlib import Path
from pymongo import MongoClient

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ontology_loader import load_semantic_guidance, load_targeted_guidance
from phase1 import run_phase1
from phase2_llm_extraction import run_phase2_llm_extraction
from phase2_formula import run_phase2_formula
from execution import retrieve_values, execute_formula, load_graph


def clear_example_logs(example_id):
    """Clear MongoDB logs for a specific example"""
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']
    collection = db['llm_interactions']

    result = collection.delete_many({'metadata.example_id': str(example_id)})
    return result.deleted_count


def save_test_results(example_id, results_dict, failure_analysis=None):
    """Save test results to MongoDB with optional failure analysis

    Args:
        example_id: Example identifier
        results_dict: Test results dictionary
        failure_analysis: Optional dict with failure analysis:
            {
                'root_cause': str,
                'issue_type': str,
                'affected_turns': list[int],
                'primary_turn': int,
                'expected_behavior': str,
                'actual_behavior': str,
                'kg_evidence': dict,
                'cascading_effect': str,
                'status': str  # 'identified', 'in_progress', 'fixed'
            }
    """
    client = MongoClient('mongodb://localhost:27017/')
    db = client['legion_tools']
    collection = db['test_results']

    # Delete old results for this example
    collection.delete_many({'example_id': str(example_id)})

    # Add timestamp
    from datetime import datetime
    results_dict['timestamp'] = datetime.utcnow()

    # Add failure analysis if provided
    if failure_analysis:
        failure_analysis['timestamp'] = datetime.utcnow()
        results_dict['failure_analysis'] = failure_analysis

    # Insert new results
    collection.insert_one(results_dict)
    return results_dict


def load_dataset():
    """Load ConvFinQA dataset"""
    # Go up from __tests__/ to graph-solver/ to src/ to project root
    dataset_path = Path(__file__).parent.parent.parent.parent / "data" / "convfinqa_dataset.json"
    with open(dataset_path) as f:
        return json.load(f)


def get_example(dataset, example_id):
    """Get example from dataset by ID (numeric index for train split)"""
    # For now, assume example_id is numeric index in train split
    return dataset['train'][int(example_id)]


def create_turns(example):
    """Convert example to list of turn test cases"""
    turns = []

    questions = example['dialogue']['conv_questions']
    answers = example['dialogue']['conv_answers']

    for i, (question, answer) in enumerate(zip(questions, answers)):
        turn = {
            'example_id': str(i),  # Will be set by test_example
            'turn': i + 1,
            'question': question,
            'gold_answer': parse_answer(answer)
        }
        turns.append(turn)

    return turns


def create_variable_name(question, resolved_question=None, formula=None):
    """
    Create a SHORT Python-safe variable name for the result

    Strategy:
    1. If formula is just a single variable, use that variable name
    2. Otherwise, create a short descriptive name from the question
    """
    import re

    # If formula is just returning a single variable, use that name
    if formula:
        # Check if formula is just a variable name (no operators)
        formula_clean = formula.strip()
        if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', formula_clean):
            # It's just a variable - use that name
            return formula_clean

    # Create short name from original question (not resolved_question with long var names)
    text = question.lower()

    # Extract key terms (entities, operations)
    # Remove common question words
    for word in ['what', 'was', 'were', 'is', 'are', 'the', 'in', 'of', 'and', 'for', 'from', 'to', 'by', 'how', 'much', 'does', 'this', 'that', 'then']:
        text = re.sub(r'\b' + word + r'\b', '', text)

    # Take first 40 chars, remove punctuation
    text = text[:40]
    text = re.sub(r'[^\w\s]', '', text)
    # Replace spaces with underscores, collapse multiple underscores
    text = re.sub(r'\s+', '_', text)
    text = re.sub(r'_+', '_', text)
    # Remove leading/trailing underscores
    text = text.strip('_')

    # Ensure doesn't start with digit
    if text and text[0].isdigit():
        text = 'value_' + text

    # Fallback
    if not text or len(text) < 3:
        text = 'result'

    return text


def parse_answer(answer):
    """Parse gold answer - use raw value from dataset"""
    if isinstance(answer, (int, float)):
        return float(answer)

    answer = str(answer).strip()

    # Remove percentage symbol but keep the number as-is
    if '%' in answer:
        return float(answer.replace('%', ''))

    # Handle const values
    if 'const_' in answer:
        answer = answer.replace('const_', '')
        if answer == 'm1':
            answer = '-1'

    try:
        return float(answer)
    except:
        return answer  # Return as string if can't parse


def compare_answers(our_answer, gold_answer, tolerance=0.03):
    """Compare answers with relative tolerance (default 3%)"""
    # Handle yes/no
    if str(gold_answer).lower() in ['yes', 'no']:
        return str(our_answer).lower() == str(gold_answer).lower()

    # Convert to float
    try:
        our = float(our_answer)
        gold = float(gold_answer)
    except:
        return False

    # If gold is 0, check absolute difference
    if gold == 0:
        return abs(our - gold) < tolerance

    # Use relative tolerance (1% by default)
    relative_diff = abs((our - gold) / gold)
    return relative_diff < tolerance


def test_example(example_id, verbose=True, log_file=None):
    """
    Test all turns of an example

    Args:
        example_id: Numeric index in train split (e.g., '2' for index 2)
        verbose: Print progress
        log_file: Optional file path to write log output

    Returns:
        Results dict with per-turn outcomes
    """
    def log(msg):
        """Log to both console and file"""
        if verbose:
            print(msg)
        if log_file:
            with open(log_file, 'a') as f:
                f.write(msg + '\n')

    log(f"\n{'='*80}")
    log(f"Testing Example {example_id}")
    log(f"{'='*80}")

    # Clear previous logs for this example
    deleted_count = clear_example_logs(example_id)
    if deleted_count > 0:
        log(f"Cleared {deleted_count} previous log entries for example {example_id}")

    # Load dataset and example
    dataset = load_dataset()
    example = get_example(dataset, example_id)
    turns = create_turns(example)

    # Set example_id on turns
    for turn in turns:
        turn['example_id'] = str(example_id)

    # Load calculation rules (once) - Use full ontology
    calculation_rules = load_semantic_guidance()
    log(f"✓ Loaded full ontology guidance ({len(calculation_rules)} chars)")

    # Load knowledge graph (REQUIRED!)
    try:
        kg_graph = load_graph(example_id)
    except FileNotFoundError:
        log(f"\n❌ ERROR: No knowledge graph found for example {example_id}")
        log(f"   Please run: uv run python3 scripts/build-kg-for-example.py {example_id}")
        log(f"   Expected location: data/knowledge-graphs/{example_id}_kg.ttl")
        raise SystemExit(f"Missing KG for example {example_id} - cannot proceed!")

    # Initialize context
    context = {
        'results_by_name': {},
        'kg_graph': kg_graph
    }

    # Track results for each turn
    results = []
    previous_results = {}  # {variable_name: {question, answer, scale}}

    for turn in turns:
        log(f"\n[{turn['turn']}/{len(turns)}] Turn {turn['turn']}: {turn['question'][:80]}...")

        try:
            # PHASE 1: Value Planning
            log("  → Running Phase 1: Value Planning...")
            phase1_output = run_phase1(turn, previous_results, calculation_rules, False, kg_graph)
            log(f"  ✓ Phase 1 complete: {len(phase1_output['values'])} values identified")

            # PHASE 2A: LLM Extraction (if KG values needed)
            kg_values = {k: v for k, v in phase1_output['values'].items() if v.get('source') == 'knowledge_graph'}
            if kg_values:
                # Use LLM extraction (returns value objects directly)
                log(f"  → Running Phase 2A: LLM Extraction ({len(kg_values)} KG values)...")
                value_objects_from_llm = run_phase2_llm_extraction(phase1_output['values'], None, turn, False)
                # Store in context for Phase 3 (will be used instead of SPARQL execution)
                context['llm_extracted_values'] = value_objects_from_llm
                log(f"  ✓ Phase 2A complete: Extracted {len(value_objects_from_llm)} values")

            # PHASE 2B: Formula Planning
            log("  → Running Phase 2B: Formula Planning...")
            formula_plan = run_phase2_formula(
                phase1_output['resolved_question'],
                phase1_output['values'],
                turn,
                False
            )
            log(f"  ✓ Phase 2B complete: {formula_plan['formula']}")

            # PHASE 3: Retrieval
            log("  → Running Phase 3: Retrieval...")
            # Start with LLM-extracted values if they exist, otherwise empty dict
            value_objects = context.get('llm_extracted_values', {}).copy()
            # Retrieve any non-KG values (e.g., previous_result references)
            non_kg_values = {k: v for k, v in phase1_output['values'].items() if v.get('source') != 'knowledge_graph'}
            if non_kg_values:
                non_kg_value_objects = retrieve_values(non_kg_values, context)
                value_objects.update(non_kg_value_objects)
            log(f"  ✓ Phase 3 complete: Retrieved {len(value_objects)} values")

            # PHASE 4: Execution
            log("  → Running Phase 4: Execution...")
            result_obj = execute_formula(formula_plan['formula'], value_objects)
            log(f"  ✓ Phase 4 complete: Result = {result_obj['value']}")

            # Get variable name and description from Phase 1 output
            var_name = phase1_output['result']['variable_name']
            var_description = phase1_output['result']['description']

            # Store ALL intermediate values from this turn (not just the final result!)
            # This allows later turns to reference ANY value extracted/computed in this turn
            for val_name, val_obj in value_objects.items():
                # Skip if already stored from a previous turn
                if val_name not in previous_results:
                    context['results_by_name'][val_name] = val_obj

                    # Get description from Phase 1 values spec
                    val_description = phase1_output['values'].get(val_name, {}).get('description', f"Value {val_name}")

                    previous_results[val_name] = {
                        'turn': turn['turn'],
                        'question': turn['question'],  # Original question that caused extraction
                        'answer': val_obj['value'],
                        'description': val_description
                    }
                    if 'scale' in val_obj:
                        previous_results[val_name]['scale'] = val_obj['scale']

            # Store the final computed result (may overwrite if formula was just a variable)
            context['results_by_name'][var_name] = result_obj
            previous_results[var_name] = {
                'turn': turn['turn'],
                'question': turn['question'],
                'answer': result_obj['value'],
                'description': var_description
            }
            if 'scale' in result_obj:
                previous_results[var_name]['scale'] = result_obj['scale']

            log(f"  → Stored result as: {var_name} = {result_obj['value']}")
            log(f"     Description: {var_description}")

            # Compare with gold answer (use display_value for output, canonical for calculations)
            our_answer = result_obj.get('display_value', result_obj['value'])
            success = compare_answers(our_answer, turn['gold_answer'])

            log(f"  Our answer: {our_answer}")
            log(f"  Gold answer: {turn['gold_answer']}")
            if success:
                log(f"  ✅ PASS")
            else:
                log(f"  ❌ FAIL")

            # Store result
            results.append({
                'turn': turn['turn'],
                'question': turn['question'],
                'gold_answer': turn['gold_answer'],
                'our_answer': our_answer,  # Use display value for comparison
                'success': success,
                'formula': formula_plan['formula']
            })

        except Exception as e:
            log(f"\n  ❌ ERROR: {e}")
            import traceback
            log(traceback.format_exc())

            results.append({
                'turn': turn['turn'],
                'question': turn['question'],
                'gold_answer': turn['gold_answer'],
                'our_answer': None,
                'success': False,
                'error': str(e)
            })

    # Summary
    passed = sum(1 for r in results if r['success'])
    total = len(results)

    log(f"\n{'='*80}")
    log(f"EXAMPLE {example_id} COMPLETE: {passed}/{total} passed ({100*passed/total:.1f}%)")
    log(f"{'='*80}")

    return {
        'example_id': example_id,
        'total_turns': total,
        'passed': passed,
        'failed': total - passed,
        'accuracy': passed / total if total > 0 else 0,
        'turns': results
    }


if __name__ == "__main__":
    import sys

    example_id = sys.argv[1] if len(sys.argv) > 1 else '2'

    # Setup log file
    log_file = Path(__file__).parent / "tmp" / f"test_{example_id}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    # Clear log file
    with open(log_file, 'w') as f:
        f.write(f"Testing Example {example_id}\n")
        f.write("="*80 + "\n\n")

    results = test_example(example_id, verbose=True, log_file=str(log_file))

    # Save results to MongoDB
    save_test_results(example_id, results)

    print(f"\n✓ Test results saved to MongoDB (collection: test_results)")
    print(f"  Log file: {log_file}")
    print(f"  Query: db.test_results.find({{'example_id': '{example_id}'}})")
