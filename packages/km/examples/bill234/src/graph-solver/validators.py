#!/usr/bin/env python3
"""Validation functions for each phase with clear error messages"""
import re
import ast


class ValidationError(Exception):
    """Raised when validation fails after all retries"""
    pass


def validate_pronoun_resolution(resolved_question, original_question):
    """
    Check that all pronouns have been resolved

    Args:
        resolved_question: Question after pronoun resolution
        original_question: Original question (for context)

    Returns:
        List of error messages (empty if valid)
    """
    errors = []

    # Work on cleaned text to avoid false positives
    text = resolved_question.lower()

    # Whitelist relative clauses (e.g., "the percentage that X represents")
    # Pattern: (the|a|an) <noun> that <verb>
    text = re.sub(r'\b(the|a|an)\s+\w+\s+that\s+', '', text)

    # Whitelist "that" after conjunctions (e.g., "and that the value...")
    text = re.sub(r'\band\s+that\s+', 'and ', text)

    # Now check for remaining pronouns in cleaned text
    pronouns = ['\\bit\\b', '\\bthis\\b', '\\bthat\\b', '\\bthey\\b', '\\bthem\\b', '\\bthese\\b', '\\bthose\\b']

    for pronoun_pattern in pronouns:
        matches = re.findall(pronoun_pattern, text)
        if matches:
            pronoun = matches[0]
            errors.append(f"Unresolved pronoun '{pronoun}' found in: '{resolved_question}'")

    # Check temporal pronouns
    temporal_patterns = [
        r'\bthis year\b',
        r'\bthat year\b',
        r'\bthis period\b',
        r'\bthat period\b',
        r'\bcurrent year\b'
    ]

    for pattern in temporal_patterns:
        if re.search(pattern, resolved_question.lower()):
            errors.append(f"Unresolved temporal reference found: '{pattern}' in '{resolved_question}'")

    return errors


def validate_scope_detection(scope_result, previous_results):
    """
    Validate scope detection output

    Args:
        scope_result: Dict with keys: is_cumulative, cumulative_base, is_scope_expansion, etc.
        previous_results: Available previous results dict

    Returns:
        List of error messages (empty if valid)
    """
    errors = []

    # Check required fields
    required_fields = ['is_cumulative', 'is_scope_expansion', 'reasoning']
    for field in required_fields:
        if field not in scope_result:
            errors.append(f"Missing required field: '{field}'")

    # If cumulative, must specify base
    if scope_result.get('is_cumulative'):
        if 'cumulative_base' not in scope_result or not scope_result['cumulative_base']:
            errors.append("Marked as cumulative but 'cumulative_base' not specified")
        else:
            base = scope_result['cumulative_base']
            if base not in previous_results:
                available = list(previous_results.keys())
                errors.append(f"Cumulative base '{base}' not found in previous results. Available: {available}")

    # If scope expansion, must provide reasoning
    if scope_result.get('is_scope_expansion'):
        reasoning = scope_result.get('expansion_reasoning', '')
        if not reasoning or len(reasoning) < 20:
            errors.append("Marked as scope expansion but reasoning is missing or too short")

    # General reasoning check
    reasoning = scope_result.get('reasoning', '')
    if not reasoning or len(reasoning) < 10:
        errors.append("Reasoning is missing or too short (must explain decision)")

    return errors


def validate_phase1_output(phase1_output, previous_results, kg_schema=None):
    """
    Validate Phase 1 (Value Planning) output

    Args:
        phase1_output: Dict with keys: resolved_question, values, result
        previous_results: Available previous results dict
        kg_schema: Optional KG schema for deeper validation

    Returns:
        List of error messages (empty if valid)
    """
    errors = []

    # Check required top-level fields
    required_fields = ['resolved_question', 'values', 'result']
    for field in required_fields:
        if field not in phase1_output:
            errors.append(f"Missing required field: '{field}'")
            return errors  # Can't continue validation

    # Validate values
    values = phase1_output['values']
    if not isinstance(values, dict):
        errors.append(f"'values' must be a dict, got {type(values)}")
        return errors

    if len(values) == 0:
        errors.append("No values identified - at least one value is required")

    for var_name, spec in values.items():
        # Check variable name is valid Python identifier
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', var_name):
            errors.append(f"Invalid variable name '{var_name}' - must be valid Python identifier")

        # Check required fields in spec
        required_spec_fields = ['description', 'semantic_type', 'source']
        for field in required_spec_fields:
            if field not in spec:
                errors.append(f"Value '{var_name}' missing required field: '{field}'")

        # Validate source
        source = spec.get('source')
        if source not in ['knowledge_graph', 'previous_result']:
            errors.append(f"Value '{var_name}' has invalid source: '{source}' (must be 'knowledge_graph' or 'previous_result')")

        # If source is previous_result, check it exists
        if source == 'previous_result':
            if var_name not in previous_results:
                available = list(previous_results.keys())
                errors.append(f"Value '{var_name}' marked as previous_result but not found. Available: {available}")

        # Check description is meaningful
        description = spec.get('description', '')
        if len(description) < 10:
            errors.append(f"Value '{var_name}' has too short description: '{description}'")

    # Validate result
    result = phase1_output['result']
    if not isinstance(result, dict):
        errors.append(f"'result' must be a dict, got {type(result)}")
    else:
        if 'variable_name' not in result:
            errors.append("Result missing 'variable_name' field")
        else:
            result_name = result['variable_name']
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', result_name):
                errors.append(f"Invalid result variable name '{result_name}' - must be valid Python identifier")

        if 'description' not in result:
            errors.append("Result missing 'description' field")
        elif len(result['description']) < 10:
            errors.append(f"Result description too short: '{result['description']}'")

    return errors


def validate_phase2a_extraction(value_objects, expected_values):
    """
    Validate Phase 2A (LLM Extraction) output

    Args:
        value_objects: Dict of {var_name: {value, scale, description}}
        expected_values: Dict of value specs from Phase 1

    Returns:
        List of error messages (empty if valid)
    """
    errors = []

    # Check all expected values were extracted
    for var_name in expected_values.keys():
        if expected_values[var_name].get('source') == 'knowledge_graph':
            if var_name not in value_objects:
                errors.append(f"Expected value '{var_name}' was not extracted from KG")

    # Check extracted values have required fields
    for var_name, value_obj in value_objects.items():
        if not isinstance(value_obj, dict):
            errors.append(f"Value '{var_name}' must be a dict, got {type(value_obj)}")
            continue

        # Check has 'value' field
        if 'value' not in value_obj:
            errors.append(f"Value '{var_name}' missing 'value' field")
        else:
            val = value_obj['value']
            # Check value is numeric or valid string
            if val is None:
                errors.append(f"Value '{var_name}' has None value")
            elif not isinstance(val, (int, float, str)):
                errors.append(f"Value '{var_name}' has invalid type: {type(val)}")

        # Check has 'scale' if numeric
        if 'value' in value_obj and isinstance(value_obj['value'], (int, float)):
            if 'scale' not in value_obj:
                errors.append(f"Numeric value '{var_name}' missing 'scale' field")

    return errors


def validate_phase2b_formula(formula, available_vars):
    """
    Validate Phase 2B (Formula Planning) output

    Args:
        formula: Python expression string
        available_vars: Set/dict of variable names that are available

    Returns:
        List of error messages (empty if valid)
    """
    errors = []

    if not formula or not isinstance(formula, str):
        errors.append(f"Formula must be a non-empty string, got: {type(formula)}")
        return errors

    # Try to parse as Python expression
    try:
        tree = ast.parse(formula, mode='eval')
    except SyntaxError as e:
        errors.append(f"Formula has syntax error: {e}")
        return errors

    # Extract all variable names used
    used_vars = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            used_vars.add(node.id)

    # Check all variables are available
    available_set = set(available_vars.keys()) if isinstance(available_vars, dict) else set(available_vars)
    undefined_vars = used_vars - available_set

    if undefined_vars:
        errors.append(f"Formula uses undefined variables: {undefined_vars}. Available: {available_set}")

    return errors


def validate_json_structure(json_obj, required_fields):
    """
    Generic JSON structure validator

    Args:
        json_obj: Parsed JSON object (dict)
        required_fields: List of required field names

    Returns:
        List of error messages (empty if valid)
    """
    errors = []

    if not isinstance(json_obj, dict):
        errors.append(f"Expected dict, got {type(json_obj)}")
        return errors

    for field in required_fields:
        if field not in json_obj:
            errors.append(f"Missing required field: '{field}'")

    return errors
