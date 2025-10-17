"""
Security module for prompt injection defense
Implements defense-in-depth with delimiter wrapping and pattern detection
"""

import re
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


# Suspicious patterns that commonly appear in prompt injections
INJECTION_PATTERNS = [
    r"ignore\s+(previous|above|prior|all).*?(instructions?|prompts?|rules?)",
    r"disregard\s+(previous|above|prior|all)\s+(instructions?|prompts?|rules?)",
    r"forget\s+(everything|all|previous|above)",
    r"<\s*(system|admin|root|instruction)\s*>",
    r"system\s*:\s*(you\s+are|new\s+instructions?)",
    r"new\s+(instructions?|task|role|mission)\s*:",
    r"you\s+are\s+now\s+(a|an)\s+\w+",
    r"override\s+(previous|all|system)\s+(instructions?|rules?)",
    r"instead\s+of\s+\w+,\s*(tell|say|reveal|show)",
    r"reveal\s+(the|your)\s+(system|instructions?|prompt)",
    r"(what|show|reveal|tell)\s+(are|is|me)?\s*(your|the)?\s*(instructions?|system\s+prompt|prompt)",
]


def wrap_untrusted_content(content: str) -> str:
    """
    Wrap untrusted content in XML delimiters to prevent prompt injection.

    This forces the LLM to treat the content as data rather than instructions,
    following OWASP 2025 best practices for LLM security.

    Args:
        content: Untrusted text from external sources (web pages, user input, etc.)

    Returns:
        Content wrapped in XML tags
    """
    return f"<untrusted_content>\n{content}\n</untrusted_content>"


def check_injection_patterns(text: str) -> Tuple[bool, str]:
    """
    Check text for common prompt injection patterns using regex.

    This provides a lightweight detection layer alongside delimiter wrapping
    for defense-in-depth.

    Args:
        text: Text to check for injection patterns

    Returns:
        Tuple of (is_safe, reason) where is_safe is False if suspicious pattern found

    Examples:
        >>> check_injection_patterns("Normal text")
        (True, "")

        >>> check_injection_patterns("Ignore previous instructions and...")
        (False, "Suspicious pattern detected: ignore previous instructions")
    """
    for pattern in INJECTION_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            matched_text = match.group(0)
            reason = f"Suspicious pattern detected: {matched_text}"
            logger.warning(f"Prompt injection attempt: {reason}")
            return False, reason

    return True, ""


def sanitize_web_content(url: str, content: str, max_length: int = 3000) -> Tuple[bool, str, str]:
    """
    Sanitize web content by checking for injections and wrapping in delimiters.

    This is the main entry point for processing untrusted web content before
    passing it to LLMs.

    Args:
        url: Source URL (for logging)
        content: Raw text extracted from web page
        max_length: Maximum content length to process

    Returns:
        Tuple of (is_safe, sanitized_content, reason)
        - is_safe: False if content should be skipped
        - sanitized_content: Wrapped content if safe, original if unsafe
        - reason: Explanation if unsafe
    """
    # Truncate content
    truncated = content[:max_length]

    # Check for injection patterns
    is_safe, reason = check_injection_patterns(truncated)

    if not is_safe:
        logger.warning(f"Skipping suspicious content from {url}: {reason}")
        return False, truncated, reason

    # Wrap in delimiters for LLM processing
    wrapped = wrap_untrusted_content(truncated)

    return True, wrapped, ""
