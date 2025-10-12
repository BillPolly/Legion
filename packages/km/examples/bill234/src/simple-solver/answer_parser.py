"""
Answer Parser for ConvFinQA

Parses LLM responses to extract numerical answers or yes/no values.
Handles various formats that the LLM might return.
"""

import re
from typing import Union


def parse_answer(text: str) -> Union[float, str]:
    """
    Parse LLM response to extract the answer.

    Args:
        text: Raw LLM response text

    Returns:
        Parsed answer as float or string (for yes/no)

    Raises:
        ValueError: If answer cannot be parsed
    """
    # Clean up the text
    text = text.strip()

    # Check for yes/no answers
    text_lower = text.lower()
    if text_lower in ["yes", "no"]:
        return text_lower

    # Try to extract just the number from the response
    # Patterns to try:
    # 1. Just a number: "0.14136"
    # 2. Number with explanation: "0.14136 (This represents..."
    # 3. In a sentence: "The answer is 0.14136"

    # Remove common prefixes
    prefixes = [
        "the answer is",
        "answer:",
        "result:",
        "=",
    ]
    for prefix in prefixes:
        if text_lower.startswith(prefix):
            text = text[len(prefix):].strip()

    # Remove commas from the text before pattern matching
    text = text.replace(',', '')

    # Try to find a number in the text
    # Match: optional minus, digits, optional decimal point and more digits, optional percentage
    number_pattern = r'-?(?:\d+\.?\d*|\.\d+)%?'
    matches = re.findall(number_pattern, text)

    if not matches:
        raise ValueError(f"Could not parse answer from: {text}")

    # Take the first number found
    number_str = matches[0]

    # Handle percentages
    if number_str.endswith('%'):
        number_str = number_str[:-1]
        try:
            return float(number_str) / 100.0
        except ValueError:
            raise ValueError(f"Could not convert percentage to float: {number_str}")

    try:
        return float(number_str)
    except ValueError:
        raise ValueError(f"Could not convert to float: {number_str}")


def format_number_for_display(value: Union[float, str]) -> str:
    """
    Format a number for display in logs/output.

    Args:
        value: Number or yes/no string

    Returns:
        Formatted string
    """
    if isinstance(value, str):
        return value

    # For very small or very large numbers, use scientific notation
    if abs(value) < 0.001 or abs(value) > 1000000:
        return f"{value:.6e}"

    # Otherwise, show up to 5 decimal places (matching eval precision)
    return f"{value:.5f}".rstrip('0').rstrip('.')
