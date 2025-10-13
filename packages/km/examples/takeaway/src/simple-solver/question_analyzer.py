"""
Stage 1: Question Analyzer

Analyzes questions to extract structured hints that guide answer generation.
This eliminates ambiguity around question types, units, and expected formats.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from anthropic import Anthropic
from dotenv import load_dotenv
from prompt_loader import PromptLoader


class QuestionAnalyzer:
    """
    Analyzes questions to extract structured hints for answer generation.

    Uses LLM to identify:
    - Question type (table_lookup, raw_difference, percentage_change, etc.)
    - Table measurement types and units
    - Calculation metadata
    - Answer format specification
    """

    def __init__(self):
        """Initialize the question analyzer with Anthropic client."""
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

    def analyze(
        self,
        question: str,
        table: Dict,
        conversation_history: Optional[List[Dict]] = None,
        knowledge_base: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Analyze a question to extract structured hints.

        Args:
            question: The question to analyze
            table: Table data from the example
            conversation_history: Previous turns in the conversation

        Returns:
            Dictionary with analysis results and hints
        """
        # Render analysis prompt using template
        prompt = self.prompt_loader.render('stage1_analyze.j2', {
            'table_json': json.dumps(table, indent=2),
            'conversation_history': conversation_history,
            'question': question,
            'question_types': self.question_types,
            'knowledge_base': knowledge_base
        })

        # Call LLM
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # Parse response
        response_text = response.content[0].text
        hints = self._parse_hints(response_text)

        return {
            "prompt": prompt,
            "response": response_text,
            "hints": hints,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        }

    def _parse_hints(self, response_text: str) -> Dict[str, Any]:
        """Parse the LLM response to extract hints."""
        try:
            # Try to parse as JSON directly
            hints = json.loads(response_text)
            return hints
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                json_str = response_text[json_start:json_end].strip()
                hints = json.loads(json_str)
                return hints
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                json_str = response_text[json_start:json_end].strip()
                hints = json.loads(json_str)
                return hints
            else:
                # Return error structure
                return {
                    "error": "Failed to parse JSON",
                    "raw_response": response_text
                }


if __name__ == "__main__":
    # Quick test
    print("Initializing QuestionAnalyzer...")
    analyzer = QuestionAnalyzer()
    print("✅ Analyzer initialized")

    # Test with the problematic question from example 4
    test_table = {
        "2004": {"ups": 100.00, "s&p_500": 100.00},
        "2005": {"ups": 89.49, "s&p_500": 104.91},
        "2006": {"ups": 91.06, "s&p_500": 121.48},
        "2007": {"ups": 87.88, "s&p_500": 128.16},
        "2008": {"ups": 70.48, "s&p_500": 80.74},
        "2009": {"ups": 75.95, "s&p_500": 102.11}
    }

    question1 = "what was the fluctuation of the performance price of the ups from 2004 to 2006?"

    print("\nTesting Question Analyzer")
    print("=" * 80)
    print(f"Question: {question1}")
    print("\nCalling LLM...")

    result = analyzer.analyze(question1, test_table)

    print("✅ LLM responded")
    print("\nHints Extracted:")
    print(json.dumps(result["hints"], indent=2))

    print("\nUsage:")
    print(f"  Input tokens: {result['usage']['input_tokens']}")
    print(f"  Output tokens: {result['usage']['output_tokens']}")

    print("\n✅ Question Analyzer test completed!")
