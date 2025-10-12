"""
TableProcessor: Programmatic structure extraction + LLM semantic enhancement

Two-stage approach:
1. Extract table structure deterministically (Python)
2. Add semantic understanding (single LLM call)
"""
import os
import re
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import instructor
from anthropic import Anthropic
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

from table_models import (
    TableStructure, Column, Row, Cell, TextCell,
    TableSemantics
)


class TableProcessor:
    """Process tables: deterministic structure + LLM semantics"""

    def __init__(self):
        """Initialize with LLM client for semantic enhancement"""
        load_dotenv()

        # Create Anthropic client wrapped with Instructor
        base_client = Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            base_url=os.getenv("ANTHROPIC_BASE_URL")
        )
        self.client = instructor.from_anthropic(base_client)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

        # Set up Jinja2 for templates
        template_dir = Path(__file__).parent / "prompts"
        self.jinja_env = Environment(loader=FileSystemLoader(str(template_dir)))

    def _extract_numeric_from_label(self, label: str) -> Optional[float]:
        """
        Extract numeric value from a label if present.

        Examples:
        - "$ 9889" → 9889.0
        - "2,534.0" → 2534.0
        - "fiscal 2009" → None (contains year but not a monetary value)
        - "balance" → None

        Args:
            label: The label string

        Returns:
            Float value if found, None otherwise
        """
        # Remove common currency symbols and whitespace
        cleaned = label.replace('$', '').replace('€', '').replace('£', '').strip()

        # Remove commas from numbers
        cleaned = cleaned.replace(',', '')

        # Try to match a number (integer or decimal)
        # Pattern: optional negative sign, digits, optional decimal point and more digits
        match = re.match(r'^-?\d+(\.\d+)?$', cleaned)
        if match:
            try:
                return float(cleaned)
            except ValueError:
                pass

        return None

    def extract_structure(self, table: Dict[str, Any]) -> TableStructure:
        """
        STAGE 1: Programmatic structure extraction - deterministic, no heuristics

        Detects orientation by analyzing JSON structure, then extracts:
        - All column labels (exact text from JSON keys)
        - All row labels (exact text from JSON keys)
        - All cells with their (row, col) coordinates and values

        Args:
            table: Dict from convfinqa dataset (nested structure)

        Returns:
            TableStructure with orientation, columns, rows, cells
        """
        if not table:
            # Empty table
            return TableStructure(
                orientation="column-first",
                columns=[],
                rows=[],
                cells=[]
            )

        # Detect orientation by checking if values are dicts
        first_key = list(table.keys())[0]
        first_value = table[first_key]

        if not isinstance(first_value, dict):
            # Flat structure - treat as single-row table
            columns = [
                Column(
                    index=i,
                    label=label,
                    numeric_value=self._extract_numeric_from_label(label)
                )
                for i, label in enumerate(table.keys())
            ]
            rows = [Row(index=0, label="value", numeric_value=None)]
            cells = []
            text_cells = []
            for i, val in enumerate(table.values()):
                # Skip empty values
                if val == '' or val is None:
                    continue
                try:
                    cells.append(Cell(row_index=0, col_index=i, value=float(val)))
                except (ValueError, TypeError):
                    # Keep text/categorical values
                    text_cells.append(TextCell(row_index=0, col_index=i, text_value=str(val)))

            return TableStructure(
                orientation="column-first",
                columns=columns,
                rows=rows,
                cells=cells,
                text_cells=text_cells
            )

        # Nested structure - determine orientation
        # Check if all values are dicts
        all_dict = all(isinstance(v, dict) for v in table.values())

        if not all_dict:
            raise ValueError(f"Inconsistent table structure: some values are dicts, some are not")

        # Heuristic: if top-level keys are short (< 5 words) and nested dict has many keys,
        # likely column-first. Otherwise row-first.
        top_level_keys = list(table.keys())
        first_nested = list(table[first_key].keys())

        # Count which level has more entries on average
        nested_counts = [len(table[k].keys()) for k in top_level_keys]
        avg_nested = sum(nested_counts) / len(nested_counts)

        # If nested level has more keys, top level is likely columns
        # If top level has more keys, it's likely rows
        if avg_nested > len(top_level_keys):
            orientation = "column-first"
        else:
            orientation = "row-first"

        # Extract based on orientation
        if orientation == "column-first":
            # Top-level keys are COLUMNS
            columns = [
                Column(
                    index=i,
                    label=label,
                    numeric_value=self._extract_numeric_from_label(label)
                )
                for i, label in enumerate(top_level_keys)
            ]

            # Nested keys are ROWS - collect all unique row labels
            all_row_labels = set()
            for col_dict in table.values():
                all_row_labels.update(col_dict.keys())
            rows = [
                Row(
                    index=i,
                    label=label,
                    numeric_value=self._extract_numeric_from_label(label)
                )
                for i, label in enumerate(sorted(all_row_labels))
            ]
            row_label_to_index = {r.label: r.index for r in rows}

            # Extract cells (numeric and text)
            cells = []
            text_cells = []
            for col_idx, col_label in enumerate(top_level_keys):
                col_dict = table[col_label]
                for row_label, value in col_dict.items():
                    row_idx = row_label_to_index[row_label]
                    # Skip empty cells
                    if value == '' or value is None:
                        continue
                    try:
                        numeric_value = float(value)
                        cells.append(Cell(
                            row_index=row_idx,
                            col_index=col_idx,
                            value=numeric_value
                        ))
                    except (ValueError, TypeError):
                        # Keep text/categorical values
                        text_cells.append(TextCell(
                            row_index=row_idx,
                            col_index=col_idx,
                            text_value=str(value)
                        ))

        else:  # row-first
            # Top-level keys are ROWS
            rows = [
                Row(
                    index=i,
                    label=label,
                    numeric_value=self._extract_numeric_from_label(label)
                )
                for i, label in enumerate(top_level_keys)
            ]

            # Nested keys are COLUMNS - collect all unique column labels
            all_col_labels = set()
            for row_dict in table.values():
                all_col_labels.update(row_dict.keys())
            columns = [
                Column(
                    index=i,
                    label=label,
                    numeric_value=self._extract_numeric_from_label(label)
                )
                for i, label in enumerate(sorted(all_col_labels))
            ]
            col_label_to_index = {c.label: c.index for c in columns}

            # Extract cells (numeric and text)
            cells = []
            text_cells = []
            for row_idx, row_label in enumerate(top_level_keys):
                row_dict = table[row_label]
                for col_label, value in row_dict.items():
                    col_idx = col_label_to_index[col_label]
                    # Skip empty cells
                    if value == '' or value is None:
                        continue
                    try:
                        numeric_value = float(value)
                        cells.append(Cell(
                            row_index=row_idx,
                            col_index=col_idx,
                            value=numeric_value
                        ))
                    except (ValueError, TypeError):
                        # Keep text/categorical values
                        text_cells.append(TextCell(
                            row_index=row_idx,
                            col_index=col_idx,
                            text_value=str(value)
                        ))

        return TableStructure(
            orientation=orientation,
            columns=columns,
            rows=rows,
            cells=cells,
            text_cells=text_cells
        )

    def enhance_with_semantics(
        self,
        structure: TableStructure,
        surrounding_text: str
    ) -> TableSemantics:
        """
        STAGE 2: LLM semantic enhancement - single call for understanding

        Given the programmatic structure and surrounding text, LLM provides:
        - Table caption/title
        - Units (thousands/millions/billions)
        - Semantic type for each column (Year/Category/etc)
        - Semantic type for each row (DataPoint/Total/etc)
        - Additional metrics from text

        Args:
            structure: TableStructure from stage 1
            surrounding_text: Pre-text + post-text from document

        Returns:
            TableSemantics with LLM understanding
        """
        # Load prompt template
        template = self.jinja_env.get_template('table_semantics.j2')

        # Render prompt with structure info
        prompt = template.render(
            structure=structure,
            text=surrounding_text
        )

        # Call LLM with structured output
        result = self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
            response_model=TableSemantics
        )

        return result


if __name__ == "__main__":
    import json
    import sys

    # Test on Example 12
    dataset = json.load(open('data/convfinqa_dataset.json'))
    ex = dataset['train'][12]

    processor = TableProcessor()

    # Stage 1: Extract structure
    print("=== STAGE 1: Programmatic Structure Extraction ===")
    structure = processor.extract_structure(ex['doc']['table'])
    print(f"Orientation: {structure.orientation}")
    print(f"Columns ({len(structure.columns)}):", [c.label for c in structure.columns])
    print(f"Rows ({len(structure.rows)}):", [r.label[:50] for r in structure.rows])
    print(f"Cells: {len(structure.cells)}")

    # Stage 2: Add semantics
    print("\n=== STAGE 2: LLM Semantic Enhancement ===")
    surrounding_text = ex['doc']['pre_text'] + "\n" + ex['doc']['post_text']
    semantics = processor.enhance_with_semantics(structure, surrounding_text)
    print(f"Caption: {semantics.caption}")
    print(f"Units: {semantics.units}")
    print(f"Column types: {[c.semantic_type for c in semantics.columns]}")
    print(f"Row types: {[r.semantic_type for r in semantics.rows[:3]]}")
    print(f"Text metrics: {len(semantics.text_metrics)}")
    for m in semantics.text_metrics:
        print(f"  - {m.metric_name}: {m.value} {m.scale}")
