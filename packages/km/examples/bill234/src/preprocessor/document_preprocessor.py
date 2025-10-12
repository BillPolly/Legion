"""
Document Preprocessor for ConvFinQA

Extracts structured knowledge from financial documents to create rich knowledge bases
that improve downstream question answering performance.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from anthropic import Anthropic
from jinja2 import Environment, FileSystemLoader

from preprocessor_logger import PreprocessorLogger


def detect_malformed_table(table: Dict[str, Dict[str, Any]]) -> bool:
    """
    Detect if a table has missing/malformed headers.

    Heuristics:
    - Single row with numeric/currency key (e.g., "$ 25621", "12345")
    - Key looks like a data value, not a category label

    Args:
        table: Table dictionary

    Returns:
        True if table appears malformed
    """
    if not table or len(table) != 1:
        return False

    # Get the single row key
    row_key = list(table.keys())[0]

    # Strip whitespace
    key_stripped = row_key.strip()

    # Check if it's a currency value (starts with $)
    if key_stripped.startswith('$'):
        # Remove $ and whitespace, check if rest is numeric
        value_part = key_stripped[1:].strip().replace(',', '').replace('.', '')
        if value_part.isdigit():
            return True

    # Check if it's just a number (with possible commas/decimals)
    numeric_only = key_stripped.replace(',', '').replace('.', '')
    if numeric_only.isdigit() and len(numeric_only) > 2:  # Avoid detecting years as malformed
        return True

    return False


class DocumentPreprocessor:
    """
    Extracts structured knowledge from ConvFinQA documents.

    For each example, extracts:
    - Entities (companies, indices, financial instruments)
    - Key facts from pre_text/post_text
    - Table metadata (units, baseline years, structure)
    - Important numerical values mentioned in text (not table)
    - Financial term definitions
    """

    def __init__(self, enable_logging: bool = True):
        """
        Initialize the document preprocessor.

        Args:
            enable_logging: Whether to log preprocessing runs to MongoDB
        """
        # Load .env from project root
        project_root = Path(__file__).parent.parent.parent
        load_dotenv(dotenv_path=project_root / ".env")

        # Initialize Anthropic client
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-20250514"

        # Initialize Jinja2 environment for prompt templates
        prompts_path = Path(__file__).parent / "prompts"
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(prompts_path)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True
        )

        # Initialize logger if enabled
        self.enable_logging = enable_logging
        if enable_logging:
            self.logger = PreprocessorLogger()

    def extract_knowledge_base(
        self,
        table: Dict[str, Dict[str, Any]],
        pre_text: str,
        post_text: str
    ) -> Dict[str, Any]:
        """
        Extract structured knowledge base from document components.

        Args:
            table: Financial table data
            pre_text: Text before the table
            post_text: Text after the table

        Returns:
            Dictionary with extracted knowledge base
        """
        # Render prompt
        template = self.jinja_env.get_template('extract_knowledge.j2')
        prompt = template.render(
            table_json=json.dumps(table, indent=2),
            pre_text=pre_text,
            post_text=post_text
        )

        # Call LLM
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
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

            knowledge_base = json.loads(response_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse knowledge base JSON: {e}\nResponse: {response_text}")

        # Extract usage information
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens
        }

        return {
            "knowledge_base": knowledge_base,
            "prompt": prompt,
            "response": response_text,
            "usage": usage
        }

    def fix_table_structure(
        self,
        table: Dict[str, Dict[str, Any]],
        pre_text: str,
        post_text: str
    ) -> Dict[str, Any]:
        """
        Fix malformed table structure where row key is actually a data value.

        Args:
            table: Malformed table with numeric row key
            pre_text: Text before the table
            post_text: Text after the table

        Returns:
            Dictionary with fixed table and metadata
        """
        # Get the malformed row key
        row_key = list(table.keys())[0]

        # Render prompt
        template = self.jinja_env.get_template('fix_table_structure.j2')
        prompt = template.render(
            table_json=json.dumps(table, indent=2),
            row_key=row_key,
            pre_text=pre_text,
            post_text=post_text
        )

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
            fixed_table = result["fixed_table"]
            reasoning = result.get("reasoning", "")

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse fixed table JSON: {e}\nResponse: {response_text}")

        # Extract usage information
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens
        }

        return {
            "fixed_table": fixed_table,
            "reasoning": reasoning,
            "prompt": prompt,
            "response": response_text,
            "usage": usage
        }

    def preprocess_example(self, example: Dict[str, Any]) -> Dict[str, Any]:
        """
        Preprocess a single example to add knowledge base.

        Args:
            example: ConvFinQA example with structure:
                {
                    "id": str,
                    "doc": {
                        "table": dict,
                        "pre_text": str,
                        "post_text": str
                    },
                    "dialogue": dict
                }

        Returns:
            Same example structure with added "knowledge_base" field
        """
        example_id = example["id"]
        doc = example["doc"]
        table = doc["table"]
        pre_text = doc.get("pre_text", "")
        post_text = doc.get("post_text", "")

        try:
            # Step 1: Check if table needs structural fixing
            if detect_malformed_table(table):
                print(f"  ⚠️  Malformed table detected - fixing structure...")
                fix_result = self.fix_table_structure(table, pre_text, post_text)
                table = fix_result["fixed_table"]
                print(f"  ✓ Table fixed: {fix_result['reasoning']}")

            # Step 2: Extract knowledge base (using potentially fixed table)
            result = self.extract_knowledge_base(table, pre_text, post_text)

            # Log to MongoDB if enabled
            if self.enable_logging:
                self.logger.log_preprocessing(
                    example_id=example_id,
                    prompt=result["prompt"],
                    llm_response=result["response"],
                    knowledge_base=result["knowledge_base"],
                    usage=result["usage"]
                )

            # Add knowledge base to example
            example["knowledge_base"] = result["knowledge_base"]

            # Update table in doc if it was fixed
            example["doc"]["table"] = table

            return example

        except Exception as e:
            error_msg = str(e)
            print(f"Error preprocessing {example_id}: {error_msg}")

            # Log error to MongoDB
            if self.enable_logging:
                self.logger.log_preprocessing(
                    example_id=example_id,
                    prompt="",
                    llm_response="",
                    knowledge_base={},
                    usage={},
                    error=error_msg
                )

            # Add empty knowledge base on error
            example["knowledge_base"] = {}
            return example

    def preprocess_dataset(
        self,
        input_path: str,
        output_path: str,
        start_idx: int = 0,
        end_idx: Optional[int] = None
    ) -> None:
        """
        Preprocess a range of examples from the dataset.

        Args:
            input_path: Path to input ConvFinQA dataset JSON
            output_path: Path to output preprocessed dataset JSON
            start_idx: Starting index (inclusive)
            end_idx: Ending index (exclusive), None = to end
        """
        # Load dataset
        print(f"Loading dataset from {input_path}...")
        with open(input_path, 'r') as f:
            data = json.load(f)

        # Get train split
        if isinstance(data, dict) and 'train' in data:
            examples = data['train']
        else:
            examples = data

        # Apply range
        if end_idx is None:
            end_idx = len(examples)
        examples_to_process = examples[start_idx:end_idx]

        print(f"Processing {len(examples_to_process)} examples ({start_idx} to {end_idx-1})...")

        # Process each example
        preprocessed_examples = []
        for i, example in enumerate(examples_to_process):
            example_num = start_idx + i
            example_id = example["id"]
            print(f"[{example_num + 1}/{end_idx}] {example_id}")

            preprocessed = self.preprocess_example(example)

            # Extract only the knowledge base and document (no dialogue!)
            output = {
                "example_id": example_id,
                "table": preprocessed["doc"]["table"],
                "knowledge_base": preprocessed["knowledge_base"]
            }
            preprocessed_examples.append(output)

        # Save to output file
        print(f"\nSaving preprocessed data to {output_path}...")
        with open(output_path, 'w') as f:
            json.dump(preprocessed_examples, f, indent=2)

        print(f"✅ Preprocessing complete! Processed {len(preprocessed_examples)} examples.")

    def preprocess_single_by_index(
        self,
        input_path: str,
        example_index: int,
        output_path: str
    ) -> None:
        """
        Preprocess a single example by index.

        Args:
            input_path: Path to input ConvFinQA dataset JSON
            example_index: The example index (0-indexed) to preprocess
            output_path: Path to output JSON file
        """
        # Load dataset
        print(f"Loading dataset from {input_path}...")
        with open(input_path, 'r') as f:
            data = json.load(f)

        # Get train split
        if isinstance(data, dict) and 'train' in data:
            examples = data['train']
        else:
            examples = data

        # Get the example
        if example_index < 0 or example_index >= len(examples):
            print(f"❌ Example index {example_index} out of range (0-{len(examples)-1})")
            return

        example = examples[example_index]
        example_id = example["id"]

        print(f"Processing example {example_index}: {example_id}")
        preprocessed = self.preprocess_example(example)

        # Extract only the knowledge base and document (no dialogue!)
        output = {
            "example_id": example_id,
            "table": preprocessed["doc"]["table"],
            "knowledge_base": preprocessed["knowledge_base"]
        }

        # Save to output file
        print(f"\nSaving to {output_path}...")
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2)

        print(f"✅ Preprocessing complete!")

    def close(self) -> None:
        """Close MongoDB connection if logging is enabled."""
        if self.enable_logging:
            self.logger.close()
