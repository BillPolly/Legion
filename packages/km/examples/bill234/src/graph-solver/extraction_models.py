"""Pydantic models for structured knowledge graph extraction"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class FinancialValue(BaseModel):
    """A financial value with metadata"""
    uri: str = Field(description="Unique identifier for the value entity")
    numericValue: float = Field(description="The numeric value")
    displayValue: str = Field(description="The value as displayed in the source")
    scale: Literal["Units", "Thousands", "Millions", "Billions"] = Field(
        default="Units",
        description="The scale/magnitude of the value"
    )
    currency: Optional[str] = Field(
        default=None,
        description="Currency code (e.g., 'USD')"
    )


class FinancialMetric(BaseModel):
    """A financial metric extracted from tables or text"""
    uri: str = Field(description="Unique identifier for the metric")
    label: str = Field(description="Human-readable label for the metric")
    tableRow: Optional[str] = Field(
        default=None,
        description="Table row label if from a table"
    )
    tableColumn: Optional[str] = Field(
        default=None,
        description="Table column label if from a table"
    )
    year: Optional[int] = Field(
        default=None,
        description="Year for the metric if specified"
    )
    comment: Optional[str] = Field(
        default=None,
        description="Footnote or explanation of what this metric represents (from document footnotes)"
    )
    value: FinancialValue = Field(description="The value entity for this metric")


class Year(BaseModel):
    """A time period/year entity"""
    uri: str = Field(description="Unique identifier for the year")
    yearValue: int = Field(description="The year number (e.g., 2009)")


class Company(BaseModel):
    """A company entity"""
    uri: str = Field(description="Unique identifier for the company")
    label: str = Field(description="Company name")


class Triple(BaseModel):
    """An RDF triple (subject, predicate, object)"""
    subject: str = Field(description="The subject URI")
    predicate: str = Field(description="The predicate/relationship")
    object: str = Field(description="The object URI or literal")


class ExtractionResult(BaseModel):
    """Complete extraction result with all entities and relationships"""
    companies: List[Company] = Field(
        default_factory=list,
        description="List of company entities"
    )
    metrics: List[FinancialMetric] = Field(
        default_factory=list,
        description="List of financial metrics"
    )
    years: List[Year] = Field(
        default_factory=list,
        description="List of year/time period entities"
    )
    values: List[FinancialValue] = Field(
        default_factory=list,
        description="List of value entities (may be redundant with metrics.value)"
    )
    triples: List[Triple] = Field(
        default_factory=list,
        description="List of RDF triples connecting entities"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "companies": [
                    {
                        "uri": "entity_Company_Example0",
                        "label": "Example Company"
                    }
                ],
                "metrics": [
                    {
                        "uri": "entity_Metric_NetIncome_2009",
                        "label": "Net income",
                        "tableRow": "net income",
                        "tableColumn": "2009",
                        "year": 2009,
                        "value": {
                            "uri": "value_NetIncome_2009",
                            "numericValue": 206588,
                            "displayValue": "206588",
                            "scale": "Thousands",
                            "currency": "USD"
                        }
                    }
                ],
                "years": [
                    {
                        "uri": "entity_Year_2009",
                        "yearValue": 2009
                    }
                ],
                "values": [],
                "triples": [
                    {
                        "subject": "entity_Company_Example0",
                        "predicate": "hasMetric",
                        "object": "entity_Metric_NetIncome_2009"
                    }
                ]
            }
        }
