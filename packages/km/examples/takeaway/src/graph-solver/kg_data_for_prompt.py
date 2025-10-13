#!/usr/bin/env python3
"""Extract KG data for inclusion in Phase 0 and Phase 1 prompts"""
import sys
from pathlib import Path
from execution import load_graph, extract_sample_entities
from phase2_llm_extraction import extract_table_data_for_prompt


def format_kg_data_for_prompt(example_id, verbose=False):
    """
    Extract and format KG data structure for Phase 0 and Phase 1 prompts

    Returns a formatted string showing:
    - Available table structure (columns, rows)
    - Sample metrics with values
    - Text-derived metrics
    - Column/row header values

    This helps the LLM ground its understanding in actual available data.
    """
    try:
        kg_graph = load_graph(example_id)
    except FileNotFoundError:
        if verbose:
            print(f"Warning: No KG found for example {example_id}")
        return "No knowledge graph available for this example."

    # Extract structured data
    sample_entities = extract_sample_entities(kg_graph)
    table_data = extract_table_data_for_prompt(kg_graph)

    # Build formatted output
    lines = []
    lines.append("AVAILABLE DATA FROM KNOWLEDGE GRAPH:")
    lines.append("="*60)

    # Table structure
    if table_data['table_cells']:
        lines.append("\nTABLE STRUCTURE:")

        # Get all unique columns
        columns = set()
        for row in table_data['table_cells']:
            columns.update(k for k in row.keys() if k != 'metric')

        lines.append(f"  Columns: {sorted(columns)}")
        lines.append(f"  Rows: {len(table_data['table_cells'])} metrics")
        lines.append("")

        # Show sample of table data (first 10 rows)
        lines.append("  Sample metrics (showing first 10):")
        for i, row in enumerate(table_data['table_cells'][:10]):
            metric_name = row['metric']
            lines.append(f"    • {metric_name}")

            # Show values for each column
            for col, data in row.items():
                if col == 'metric':
                    continue

                if isinstance(data, dict):
                    # Numeric value with scale
                    value = data['value']
                    scale = data['scale']
                    lines.append(f"        [{col}]: {value} ({scale})")
                else:
                    # Text value
                    lines.append(f"        [{col}]: {data}")

        if len(table_data['table_cells']) > 10:
            lines.append(f"    ... and {len(table_data['table_cells']) - 10} more metrics")

    # Column header values (numeric values in column headers)
    if table_data['column_header_values']:
        lines.append("\nCOLUMN HEADER VALUES:")
        for header in table_data['column_header_values']:
            label = header['label']
            value = header['value']
            scale = header['scale']
            lines.append(f"  • Column '{label}': {value} ({scale})")

    # Row header values
    if table_data['row_header_values']:
        lines.append("\nROW HEADER VALUES:")
        for header in table_data['row_header_values']:
            label = header['label']
            value = header['value']
            scale = header['scale']
            lines.append(f"  • Row '{label}': {value} ({scale})")

    # Text-derived metrics (from pre_text/post_text)
    if table_data['text_derived_metrics']:
        lines.append("\nTEXT-DERIVED METRICS:")
        for metric in table_data['text_derived_metrics']:
            label = metric['label']
            value = metric['value']
            scale = metric['scale']
            lines.append(f"  • {label}: {value} ({scale})")

    # Metric comments (footnote explanations)
    if table_data['metric_comments']:
        lines.append("\nMETRIC FOOTNOTES/EXPLANATIONS:")
        for row_label, comment in table_data['metric_comments'].items():
            lines.append(f"  • {row_label}:")
            lines.append(f"      {comment}")

    # Time periods identified
    years = sample_entities.get('years', [])
    if years:
        lines.append("\nTIME PERIODS IDENTIFIED:")
        lines.append(f"  Years: {sorted(years)}")

    lines.append("\n" + "="*60)

    return "\n".join(lines)


if __name__ == "__main__":
    # Test with Example 47
    import sys
    example_id = sys.argv[1] if len(sys.argv) > 1 else "47"

    print(f"Testing KG data extraction for Example {example_id}")
    print()

    formatted_data = format_kg_data_for_prompt(example_id, verbose=True)
    print(formatted_data)
