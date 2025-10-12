"""Pydantic models for table structure and semantics"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ============================================================================
# STAGE 1: Programmatic Structure (deterministic)
# ============================================================================

class Column(BaseModel):
    """A table column with exact label from JSON"""
    index: int = Field(description="Zero-based column index")
    label: str = Field(description="Exact column label from table JSON")
    numeric_value: Optional[float] = Field(
        default=None,
        description="If column label contains a numeric value (e.g., '$ 9889'), extract it here"
    )


class Row(BaseModel):
    """A table row with exact label from JSON"""
    index: int = Field(description="Zero-based row index")
    label: str = Field(description="Exact row label from table JSON")
    numeric_value: Optional[float] = Field(
        default=None,
        description="If row label contains a numeric value, extract it here"
    )


class Cell(BaseModel):
    """A table cell at the intersection of a row and column"""
    row_index: int = Field(description="Index of the row this cell belongs to")
    col_index: int = Field(description="Index of the column this cell belongs to")
    value: float = Field(description="Numeric value in this cell")


class TextCell(BaseModel):
    """A table cell containing text/categorical data"""
    row_index: int = Field(description="Index of the row this cell belongs to")
    col_index: int = Field(description="Index of the column this cell belongs to")
    text_value: str = Field(description="Text/categorical value in this cell")


class TableStructure(BaseModel):
    """Programmatically extracted table structure - deterministic, no heuristics"""
    orientation: Literal["column-first", "row-first"] = Field(
        description="Whether top-level keys are columns or rows"
    )
    columns: List[Column] = Field(description="All columns in order")
    rows: List[Row] = Field(description="All rows in order")
    cells: List[Cell] = Field(description="All numeric cells with values")
    text_cells: List[TextCell] = Field(
        default_factory=list,
        description="All text/categorical cells (non-numeric)"
    )


# ============================================================================
# STAGE 2: LLM Semantic Enhancement (understanding)
# ============================================================================

class ColumnSemantics(BaseModel):
    """Semantic understanding of a column added by LLM"""
    index: int = Field(description="Links back to Column by index")
    semantic_type: Literal["Year", "Category", "EntityType", "Metric"] = Field(
        description="What this column represents semantically"
    )
    description: str = Field(description="LLM's understanding of what this column means")


class RowSemantics(BaseModel):
    """Semantic understanding of a row added by LLM"""
    index: int = Field(description="Links back to Row by index")
    semantic_type: Literal["DataPoint", "CalculatedTotal", "Subtotal", "Header"] = Field(
        description="What this row represents semantically"
    )
    description: str = Field(description="LLM's understanding of what this row means")
    temporal_info: Optional[dict] = Field(
        default=None,
        description="Temporal information if present (e.g., {'year': 2017, 'date': 'july 3 2017'})"
    )


class ExtractedMetric(BaseModel):
    """A financial metric extracted from narrative text (not in table)"""
    metric_name: str = Field(description="Name of the metric")
    value: float = Field(description="Numeric value")
    scale: Literal["Units", "Thousands", "Millions", "Billions"] = Field(
        description="Scale/magnitude of the value"
    )
    source_text: str = Field(description="The text snippet this was extracted from")


class TableSemantics(BaseModel):
    """Semantic understanding of table added by LLM in single call"""
    caption: str = Field(
        description="Table title/caption from surrounding context"
    )
    units: Literal["Units", "Thousands", "Millions", "Billions"] = Field(
        description="Default units for values in this table"
    )
    columns: List[ColumnSemantics] = Field(
        description="Semantic understanding of each column"
    )
    rows: List[RowSemantics] = Field(
        description="Semantic understanding of each row"
    )
    text_metrics: List[ExtractedMetric] = Field(
        default_factory=list,
        description="Additional metrics mentioned in surrounding text but not in table"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "caption": "Changes in common stock shares",
                "units": "Thousands",
                "columns": [
                    {
                        "index": 0,
                        "semantic_type": "EntityType",
                        "description": "Class A common stock shares"
                    },
                    {
                        "index": 1,
                        "semantic_type": "EntityType",
                        "description": "Class B common stock shares"
                    }
                ],
                "rows": [
                    {
                        "index": 0,
                        "semantic_type": "DataPoint",
                        "description": "Opening balance at end of 2016",
                        "temporal_info": {"year": 2016, "date": "december 31 2016"}
                    },
                    {
                        "index": 1,
                        "semantic_type": "DataPoint",
                        "description": "Shares issued in business combination",
                        "temporal_info": {"year": 2017, "date": "july 3 2017"}
                    }
                ],
                "text_metrics": [
                    {
                        "metric_name": "authorized shares of class a common stock",
                        "value": 2.0,
                        "scale": "Billions",
                        "source_text": "authorized to issue 2 billion shares of class a common stock"
                    },
                    {
                        "metric_name": "authorized shares of class b common stock",
                        "value": 1.25,
                        "scale": "Billions",
                        "source_text": "1.25 billion shares of class b common stock"
                    }
                ]
            }
        }
