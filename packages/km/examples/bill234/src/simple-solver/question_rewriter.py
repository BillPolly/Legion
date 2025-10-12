"""
Question Rewriter for ConvFinQA (Stage 0)

Rewrites questions to resolve ALL ambiguity:
- Pronouns: "the stock" → specific entity name
- Temporal references: "this year" → specific year
- Entity tracking: maintain focus across conversation turns

This makes questions explicit BEFORE analysis/answering.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from anthropic import Anthropic

from prompt_loader import PromptLoader


class QuestionRewriter:
    """
    Rewrites conversational questions to resolve ambiguity.

    Handles:
    - Pronoun resolution ("the stock", "that company")
    - Temporal reference resolution ("this year", "that year")
    - Entity tracking across conversation turns
    - Baseline year resolution for index tables
    """

    def __init__(self):
        """Initialize the question rewriter with Anthropic client."""
        load_dotenv()

        self.client = Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            base_url=os.getenv("ANTHROPIC_BASE_URL")
        )
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        self.prompt_loader = PromptLoader()

    def rewrite(
        self,
        question: str,
        table: Dict,
        conversation_history: Optional[List[Dict]] = None,
        knowledge_base: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Rewrite a question to resolve all ambiguity.

        Args:
            question: The original conversational question
            table: The financial table data
            conversation_history: Previous Q&A turns (for entity tracking)
            knowledge_base: Document knowledge base (entities, baseline_year, etc.)

        Returns:
            Dictionary with:
                - rewritten_question: The disambiguated question
                - changes_made: List of changes applied
                - prompt: The prompt used
                - response: The raw LLM response
                - usage: Token usage information
        """
        # Render rewriting prompt using template
        prompt = self.prompt_loader.render('stage0_rewrite.j2', {
            'question': question,
            'table_json': json.dumps(table, indent=2),
            'conversation_history': conversation_history,
            'knowledge_base': knowledge_base
        })

        # Call LLM
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            temperature=0,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # Extract response text
        response_text = response.content[0].text

        # Parse JSON response
        try:
            # Try to extract JSON if wrapped in code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            result = json.loads(response_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse rewriter JSON: {e}\nResponse: {response_text}")

        # Extract usage information
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens
        }

        return {
            "rewritten_question": result.get("rewritten_question", question),
            "changes_made": result.get("changes_made", []),
            "prompt": prompt,
            "response": response_text,
            "usage": usage
        }
