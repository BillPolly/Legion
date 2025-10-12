#!/usr/bin/env python3
"""Retry framework for LLM phases with validation and error feedback"""
from validators import ValidationError


def run_phase_with_retry(
    phase_func,
    validator_func,
    max_retries=2,
    log_func=None,
    phase_name="Phase"
):
    """
    Run any LLM phase with validation and automatic retry

    Args:
        phase_func: Function that calls LLM, returns result dict.
                    Must accept 'error_context' kwarg for retry attempts.
        validator_func: Function that validates result, returns list of error messages
        max_retries: Maximum retry attempts (default 2)
        log_func: Optional logging function
        phase_name: Name of phase for logging (e.g., "Phase 0: Pronoun Resolution")

    Returns:
        Valid result dict

    Raises:
        ValidationError: If validation fails after all retries
    """
    def log(msg):
        if log_func:
            log_func(msg)

    error_context = None

    for attempt in range(max_retries + 1):  # +1 for initial attempt
        try:
            # Call phase function
            if attempt == 0:
                # First attempt - no error context
                result = phase_func()
            else:
                # Retry attempt - pass error context
                log(f"  → {phase_name} retry attempt {attempt}/{max_retries}...")
                result = phase_func(error_context=error_context)

            # Validate result
            errors = validator_func(result)

            if not errors:
                # Success!
                if attempt > 0:
                    log(f"  ✓ {phase_name} succeeded after {attempt} retry(ies)")
                return result

            # Validation failed
            log(f"  ⚠️  {phase_name} validation failed (attempt {attempt + 1}/{max_retries + 1}):")
            for error in errors:
                log(f"      - {error}")

            # Prepare error context for next attempt
            error_context = {
                'attempt': attempt + 1,
                'errors': errors,
                'previous_result': result
            }

        except Exception as e:
            # Phase function raised an exception
            log(f"  ❌ {phase_name} raised exception (attempt {attempt + 1}/{max_retries + 1}): {e}")

            error_context = {
                'attempt': attempt + 1,
                'errors': [f"Exception: {str(e)}"],
                'previous_result': None
            }

            # Continue to next retry

    # All retries exhausted
    final_errors = error_context['errors'] if error_context else ['Unknown error']
    error_msg = f"{phase_name} failed after {max_retries + 1} attempts. Errors: {final_errors}"
    log(f"  ❌ {error_msg}")
    raise ValidationError(error_msg)


class PhaseExecutor:
    """
    Helper class to execute phases with retry and track metrics
    """
    def __init__(self, log_func=None):
        self.log_func = log_func
        self.metrics = {
            'phases_executed': 0,
            'validations_failed': 0,
            'retries_attempted': 0,
            'retries_succeeded': 0,
            'phases_failed': 0
        }

    def execute(self, phase_func, validator_func, max_retries=2, phase_name="Phase"):
        """Execute phase with retry and track metrics"""
        self.metrics['phases_executed'] += 1

        initial_attempt = True
        error_context = None

        for attempt in range(max_retries + 1):
            try:
                # Call phase
                if initial_attempt:
                    result = phase_func()
                    initial_attempt = False
                else:
                    self.metrics['retries_attempted'] += 1
                    result = phase_func(error_context=error_context)

                # Validate
                errors = validator_func(result)

                if not errors:
                    # Success
                    if attempt > 0:
                        self.metrics['retries_succeeded'] += 1
                        if self.log_func:
                            self.log_func(f"  ✓ {phase_name} succeeded after {attempt} retry(ies)")
                    return result

                # Validation failed
                self.metrics['validations_failed'] += 1
                if self.log_func:
                    self.log_func(f"  ⚠️  {phase_name} validation failed (attempt {attempt + 1}/{max_retries + 1}):")
                    for error in errors:
                        self.log_func(f"      - {error}")

                error_context = {
                    'attempt': attempt + 1,
                    'errors': errors,
                    'previous_result': result
                }

            except Exception as e:
                self.metrics['validations_failed'] += 1
                if self.log_func:
                    self.log_func(f"  ❌ {phase_name} exception (attempt {attempt + 1}/{max_retries + 1}): {e}")

                error_context = {
                    'attempt': attempt + 1,
                    'errors': [f"Exception: {str(e)}"],
                    'previous_result': None
                }

        # All retries exhausted
        self.metrics['phases_failed'] += 1
        final_errors = error_context['errors'] if error_context else ['Unknown error']
        error_msg = f"{phase_name} failed after {max_retries + 1} attempts. Errors: {final_errors}"
        if self.log_func:
            self.log_func(f"  ❌ {error_msg}")
        raise ValidationError(error_msg)

    def get_metrics(self):
        """Get execution metrics"""
        return self.metrics.copy()

    def print_summary(self):
        """Print execution summary"""
        if self.log_func:
            self.log_func("\n" + "=" * 60)
            self.log_func("VALIDATION & RETRY SUMMARY")
            self.log_func("=" * 60)
            self.log_func(f"Phases executed: {self.metrics['phases_executed']}")
            self.log_func(f"Validation failures: {self.metrics['validations_failed']}")
            self.log_func(f"Retry attempts: {self.metrics['retries_attempted']}")
            self.log_func(f"Retry successes: {self.metrics['retries_succeeded']}")
            if self.metrics['retries_attempted'] > 0:
                success_rate = 100 * self.metrics['retries_succeeded'] / self.metrics['retries_attempted']
                self.log_func(f"Retry success rate: {success_rate:.1f}%")
            self.log_func(f"Phases failed: {self.metrics['phases_failed']}")
            self.log_func("=" * 60)
