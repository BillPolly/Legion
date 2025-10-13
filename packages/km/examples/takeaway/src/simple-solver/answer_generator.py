"""
Stage 2: Answer Generator

Generates precise numerical answers using hints from Stage 1.
The structured hints eliminate ambiguity and guide the LLM to the correct format.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from anthropic import Anthropic
from dotenv import load_dotenv
from prompt_loader import PromptLoader


class AnswerGenerator:
    """
    Generates answers using structured hints from question analysis.

    Takes hints about question type, units, magnitude, and warnings to
    produce precise numerical answers in the correct format.
    """

    def __init__(self):
        """Initialize the answer generator with Anthropic client."""
        load_dotenv()

        self.client = Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            base_url=os.getenv("ANTHROPIC_BASE_URL")
        )
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        self.prompt_loader = PromptLoader()

        # Load question types catalog
        question_types_path = Path(__file__).parent / "question_types.json"
        with open(question_types_path, 'r') as f:
            self.question_types = json.load(f)

    def generate(
        self,
        question: str,
        table: Dict,
        hints: Dict[str, Any],
        conversation_history: Optional[List[Dict]] = None,
        knowledge_base: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate an answer using structured hints.

        Args:
            question: The question to answer
            table: Table data from the example
            hints: Structured hints from Stage 1 analysis
            conversation_history: Previous turns in the conversation

        Returns:
            Dictionary with answer, prompt, response, and usage
        """
        # Get type-specific guidance from catalog
        question_type = hints.get("question_type", "unknown")
        type_guidance = ""
        if question_type in self.question_types:
            type_guidance = self.question_types[question_type].get("stage2_guidance", "")

        # Render answer prompt using template
        # Note: Stage 1 now extracts values, so we pass hints.extracted_values instead of full table
        prompt = self.prompt_loader.render('stage2_answer.j2', {
            'conversation_history': conversation_history,
            'question': question,
            'hints': hints,
            'type_guidance': type_guidance,
            'knowledge_base': knowledge_base
        })

        # Call LLM
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # Parse response
        response_text = response.content[0].text
        answer = self._parse_answer(response_text)

        return {
            "prompt": prompt,
            "response": response_text,
            "answer": answer,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        }

    def _parse_answer(self, response_text: str) -> Any:
        """Parse the LLM response to extract the answer."""
        import re

        # Clean the response
        text = response_text.strip()

        # Handle yes/no
        if text.lower() in ["yes", "no"]:
            return text.lower()

        # Remove any common text prefixes
        text = re.sub(r'^(the answer is|answer:|result:)\s*', '', text, flags=re.IGNORECASE)

        # Remove commas from numbers
        text = text.replace(',', '')

        # Extract number (handle negatives, decimals, percentages)
        number_pattern = r'-?(?:\d+\.?\d*|\.\d+)%?'
        matches = re.findall(number_pattern, text)

        if matches:
            # Take the first match
            num_str = matches[0]

            # Handle percentage symbol (but respect magnitude hint)
            # If the response has %, convert to decimal
            if '%' in num_str:
                return float(num_str.rstrip('%')) / 100
            else:
                return float(num_str)

        # If no number found, return the text as-is
        return text


if __name__ == "__main__":
    # Quick test
    print("Initializing AnswerGenerator...")
    generator = AnswerGenerator()
    print("✅ Generator initialized")

    # Test with hints from Stage 1
    test_table = {
        "2004": {"ups": 100.00, "s&p_500": 100.00},
        "2005": {"ups": 89.49, "s&p_500": 104.91},
        "2006": {"ups": 91.06, "s&p_500": 121.48},
        "2007": {"ups": 87.88, "s&p_500": 128.16},
        "2008": {"ups": 70.48, "s&p_500": 80.74},
        "2009": {"ups": 75.95, "s&p_500": 102.11}
    }

    question = "what was the fluctuation of the performance price of the ups from 2004 to 2006?"

    # These are the hints we got from Stage 1
    hints = {
        "question_type": "raw_difference",
        "table_analysis": {
            "relevant_columns": ["ups"],
            "measurement_type": "performance price index",
            "units": "index value (2004=100)"
        },
        "calculation": {
            "operation": "subtract",
            "operands": ["ups value for 2006", "ups value for 2004"],
            "reference_previous": False
        },
        "answer_format": {
            "type": "number",
            "units": "index points",
            "magnitude": "raw_value",
            "warnings": [
                "The question uses 'fluctuation' which implies a raw difference, not a percentage change. Calculate: (Value in 2006) - (Value in 2004)."
            ]
        }
    }

    print("\nTesting Answer Generator")
    print("=" * 80)
    print(f"Question: {question}")
    print("\nCalling LLM with hints...")

    result = generator.generate(question, test_table, hints)

    print("✅ LLM responded")
    print(f"\nAnswer: {result['answer']}")
    print(f"Expected: -8.94")
    print(f"Match: {abs(result['answer'] - (-8.94)) < 0.001}")

    print("\nUsage:")
    print(f"  Input tokens: {result['usage']['input_tokens']}")
    print(f"  Output tokens: {result['usage']['output_tokens']}")

    print("\n✅ Answer Generator test completed!")
