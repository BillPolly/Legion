"""
Comprehensive tests for TableProcessor

Tests both:
1. Programmatic structure extraction (deterministic)
2. LLM semantic enhancement (understanding)
"""
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from table_processor import TableProcessor
from table_models import TableStructure, TableSemantics


# Load dataset once
DATASET_PATH = Path(__file__).parent.parent.parent.parent / "data" / "convfinqa_dataset.json"
with open(DATASET_PATH) as f:
    DATASET = json.load(f)


def get_example(index):
    """Get example from dataset"""
    return DATASET['train'][index]


def test_structure_extraction_column_first():
    """Test programmatic extraction on column-first table (Example 12)"""
    ex = get_example(12)
    processor = TableProcessor()

    structure = processor.extract_structure(ex['doc']['table'])

    # Verify orientation
    assert structure.orientation == "column-first", \
        f"Expected column-first, got {structure.orientation}"

    # Verify columns (should be 2: class a, class b)
    assert len(structure.columns) == 2, \
        f"Expected 2 columns, got {len(structure.columns)}"
    assert structure.columns[0].label == "class a common stock"
    assert structure.columns[1].label == "class b common stock"

    # Verify rows (should have 6 row labels)
    assert len(structure.rows) == 6, \
        f"Expected 6 rows, got {len(structure.rows)}"

    # Verify cells (2 columns × 6 rows = 12 cells)
    assert len(structure.cells) == 12, \
        f"Expected 12 cells, got {len(structure.cells)}"

    # Verify specific cell values
    # Find cell at row "issue of shares on business combination..." and column "class b common stock"
    row_label = "issue of shares on business combination at july 3 2017"
    col_label = "class b common stock"

    row_idx = next((r.index for r in structure.rows if row_label in r.label), None)
    col_idx = next((c.index for c in structure.columns if c.label == col_label), None)

    assert row_idx is not None, f"Could not find row with label containing '{row_label}'"
    assert col_idx is not None, f"Could not find column '{col_label}'"

    cell = next((c for c in structure.cells if c.row_index == row_idx and c.col_index == col_idx), None)
    assert cell is not None, f"Could not find cell at ({row_idx}, {col_idx})"
    assert cell.value == 717111.0, f"Expected 717111.0, got {cell.value}"

    print("✓ Column-first structure extraction passed")


def test_structure_extraction_row_first():
    """Test programmatic extraction on row-first table (Example 8)"""
    ex = get_example(8)
    processor = TableProcessor()

    structure = processor.extract_structure(ex['doc']['table'])

    # Verify orientation
    assert structure.orientation == "column-first", \
        f"Expected column-first (time periods as columns), got {structure.orientation}"

    # Example 8 has time periods as top-level keys
    columns = [c.label for c in structure.columns]
    assert "total" in columns or any("year" in c.lower() for c in columns), \
        f"Expected time period columns, got {columns}"

    # Should have multiple rows (obligations, debt, etc)
    assert len(structure.rows) > 0, "Expected multiple rows"

    # Should have cells
    assert len(structure.cells) > 0, "Expected cells with values"

    print("✓ Row-first structure extraction passed")


def test_structure_extraction_year_columns():
    """Test extraction on table with year columns (Example 31)"""
    ex = get_example(31)
    processor = TableProcessor()

    structure = processor.extract_structure(ex['doc']['table'])

    # Years as columns
    assert structure.orientation == "column-first"

    # Should have year columns (2018, 2017, 2016)
    column_labels = [c.label for c in structure.columns]
    assert any(c.isdigit() and int(c) >= 2016 for c in column_labels), \
        f"Expected year columns, got {column_labels}"

    print("✓ Year-column structure extraction passed")


def test_semantic_enhancement_example_12():
    """Test LLM semantic enhancement on Example 12"""
    ex = get_example(12)
    processor = TableProcessor()

    # First extract structure
    structure = processor.extract_structure(ex['doc']['table'])

    # Then enhance with semantics
    text = ex['doc']['pre_text'] + "\n" + ex['doc']['post_text']
    semantics = processor.enhance_with_semantics(structure, text)

    # Verify caption was extracted
    assert semantics.caption, "Caption should not be empty"
    assert "stock" in semantics.caption.lower() or "share" in semantics.caption.lower(), \
        f"Caption should mention stock/shares: {semantics.caption}"

    # Verify units were detected (should find "in thousands" somewhere)
    assert semantics.units in ["Thousands", "Millions", "Units"], \
        f"Invalid units: {semantics.units}"

    # Verify column semantics
    assert len(semantics.columns) == len(structure.columns), \
        "Should have semantics for each column"

    for col_sem in semantics.columns:
        assert col_sem.semantic_type in ["Year", "Category", "EntityType", "Metric"], \
            f"Invalid column type: {col_sem.semantic_type}"
        assert col_sem.description, "Column description should not be empty"

    # Verify row semantics
    assert len(semantics.rows) == len(structure.rows), \
        "Should have semantics for each row"

    for row_sem in semantics.rows:
        assert row_sem.semantic_type in ["DataPoint", "CalculatedTotal", "Subtotal", "Header"], \
            f"Invalid row type: {row_sem.semantic_type}"
        assert row_sem.description, "Row description should not be empty"

    # Verify text metrics were extracted
    # Should find "1.25 billion shares of class b common stock authorized"
    metric_names = [m.metric_name.lower() for m in semantics.text_metrics]
    assert any("class b" in name and "authorized" in name for name in metric_names), \
        f"Should extract 'authorized class b shares' metric, got: {metric_names}"

    # Find the authorized class b metric
    class_b_auth = next((m for m in semantics.text_metrics
                         if "class b" in m.metric_name.lower() and "authorized" in m.metric_name.lower()),
                        None)
    assert class_b_auth is not None, "Should find authorized class b metric"
    assert class_b_auth.value == 1.25, f"Expected 1.25, got {class_b_auth.value}"
    assert class_b_auth.scale == "Billions", f"Expected Billions, got {class_b_auth.scale}"

    print("✓ Semantic enhancement passed")
    print(f"  Caption: {semantics.caption}")
    print(f"  Units: {semantics.units}")
    print(f"  Text metrics found: {len(semantics.text_metrics)}")


def test_semantic_enhancement_different_units():
    """Test that LLM correctly identifies different unit scales"""
    # Test on examples with different units
    test_cases = [
        (8, ["Thousands", "Millions", "Units"]),  # Could be any
        (20, ["Thousands", "Millions", "Units"]),
        (31, ["Thousands", "Millions", "Billions", "Units"])
    ]

    processor = TableProcessor()

    for ex_num, allowed_units in test_cases:
        ex = get_example(ex_num)
        structure = processor.extract_structure(ex['doc']['table'])
        text = ex['doc']['pre_text'] + "\n" + ex['doc']['post_text']
        semantics = processor.enhance_with_semantics(structure, text)

        assert semantics.units in allowed_units, \
            f"Example {ex_num}: units '{semantics.units}' not in {allowed_units}"

        print(f"✓ Example {ex_num} units: {semantics.units}")


def test_cell_coordinates_consistency():
    """Test that cell coordinates are consistent with row/column indices"""
    ex = get_example(12)
    processor = TableProcessor()
    structure = processor.extract_structure(ex['doc']['table'])

    for cell in structure.cells:
        # Verify row index is valid
        assert 0 <= cell.row_index < len(structure.rows), \
            f"Cell row_index {cell.row_index} out of range [0, {len(structure.rows)})"

        # Verify column index is valid
        assert 0 <= cell.col_index < len(structure.columns), \
            f"Cell col_index {cell.col_index} out of range [0, {len(structure.columns)})"

    print("✓ Cell coordinates are consistent")


def test_no_duplicate_cells():
    """Test that no two cells have the same coordinates"""
    ex = get_example(12)
    processor = TableProcessor()
    structure = processor.extract_structure(ex['doc']['table'])

    coordinates = set()
    for cell in structure.cells:
        coord = (cell.row_index, cell.col_index)
        assert coord not in coordinates, \
            f"Duplicate cell at ({cell.row_index}, {cell.col_index})"
        coordinates.add(coord)

    print("✓ No duplicate cells")


def test_all_values_numeric():
    """Test that all cell values are successfully converted to float"""
    ex = get_example(12)
    processor = TableProcessor()
    structure = processor.extract_structure(ex['doc']['table'])

    for cell in structure.cells:
        assert isinstance(cell.value, float), \
            f"Cell value should be float, got {type(cell.value)}: {cell.value}"
        assert not (cell.value != cell.value), \
            f"Cell value is NaN at ({cell.row_index}, {cell.col_index})"

    print("✓ All values are numeric")


def run_all_tests():
    """Run all tests"""
    print("=" * 70)
    print("TableProcessor Comprehensive Tests")
    print("=" * 70)

    tests = [
        ("Structure: Column-first", test_structure_extraction_column_first),
        ("Structure: Row-first", test_structure_extraction_row_first),
        ("Structure: Year columns", test_structure_extraction_year_columns),
        ("Semantics: Example 12", test_semantic_enhancement_example_12),
        ("Semantics: Different units", test_semantic_enhancement_different_units),
        ("Validation: Cell coordinates", test_cell_coordinates_consistency),
        ("Validation: No duplicates", test_no_duplicate_cells),
        ("Validation: Numeric values", test_all_values_numeric),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        print(f"\n{name}:")
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"  ✗ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
