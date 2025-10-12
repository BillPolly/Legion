"""
Ontology-Driven Entity and Relationship Extractor

Uses LLM with ConvFinQA ontology to extract:
- Entities (Company, FinancialMetric, TimePeriod, Category)
- FinancialValue entities with ALL attributes (numericValue, scale, currency)
- Relationships (hasMetric, hasValue, forTimePeriod, inCategory)

All values must be proper entities, not raw literals!
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import instructor
from anthropic import Anthropic, APIError
from jinja2 import Environment, FileSystemLoader
from rdflib import Graph, Namespace, Literal, URIRef
from rdflib.namespace import RDF, RDFS, XSD, OWL, DCTERMS
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from extraction_models import ExtractionResult
from table_processor import TableProcessor
from table_models import TableStructure, TableSemantics


class OntologyExtractor:
    """Extracts entities and relationships using ConvFinQA ontology"""

    def __init__(self):
        """Initialize extractor with Instructor for structured outputs"""
        load_dotenv()

        # Create base Anthropic client
        base_client = Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            base_url=os.getenv("ANTHROPIC_BASE_URL")
        )

        # Wrap with Instructor for structured outputs
        self.client = instructor.from_anthropic(base_client)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

        # Load ontology
        ontology_path = Path(__file__).parent.parent.parent / "ontology" / "convfinqa-ontology.ttl"
        with open(ontology_path, 'r') as f:
            self.ontology_ttl = f.read()

        # Read ontology version
        self.ontology_version, self.ontology_modified = self._read_ontology_version(ontology_path)

        # Set up Jinja2
        template_dir = Path(__file__).parent / "prompts"
        self.jinja_env = Environment(loader=FileSystemLoader(str(template_dir)))

        # Initialize TableProcessor for programmatic table structure extraction
        self.table_processor = TableProcessor()

    def _read_ontology_version(self, ontology_path: Path) -> tuple[str, str]:
        """
        Read version information from the ontology

        Args:
            ontology_path: Path to ontology .ttl file

        Returns:
            Tuple of (version_string, modified_date_string)
        """
        g = Graph()
        g.parse(str(ontology_path), format='turtle')

        KG = Namespace("http://example.org/convfinqa/")

        # Find the ontology resource
        ontology_uri = KG.ConvFinQAOntology

        # Read owl:versionInfo
        version = None
        for _, _, v in g.triples((ontology_uri, OWL.versionInfo, None)):
            version = str(v)
            break

        # Read dc:modified
        modified = None
        for _, _, m in g.triples((ontology_uri, DCTERMS.modified, None)):
            modified = str(m)
            break

        if version is None:
            raise ValueError(f"Ontology {ontology_path} missing owl:versionInfo")
        if modified is None:
            raise ValueError(f"Ontology {ontology_path} missing dc:modified (dcterms:modified)")

        return version, modified

    def extract(
        self,
        preprocessed_data: Dict[str, Any],
        example_id: str
    ) -> Dict[str, Any]:
        """
        Extract entities and relationships from preprocessed data using ontology

        NEW: Two-stage table processing:
        Stage 1: Programmatic structure extraction (deterministic)
        Stage 2: LLM semantic enhancement

        Then two-pass entity extraction:
        Pass 1: Extract table metrics with semantic table structure
        Pass 2: Extract narrative text metrics

        Args:
            preprocessed_data: Dict with 'table' and 'knowledge_base'
            example_id: Example identifier

        Returns:
            Dict with extracted entities, values, and relationships in JSON format
        """
        table = preprocessed_data.get('table', {})
        kb = preprocessed_data.get('knowledge_base', {})
        text_content = kb.get('text_content', [])

        # STAGE 1: Process table structure (if table exists)
        table_structure = None
        table_semantics = None
        if table:
            print("  Stage 1: Programmatic table structure extraction...")
            table_structure = self.table_processor.extract_structure(table)

            print("  Stage 2: LLM semantic table enhancement...")
            surrounding_text = '\n'.join(text_content) if text_content else ""
            table_semantics = self.table_processor.enhance_with_semantics(
                table_structure,
                surrounding_text
            )

        # PASS 1: Extract from table with semantic structure
        print("  Pass 1: Extracting table metrics with semantic structure...")
        table_extraction = self._extract_from_table(
            table,
            kb,
            example_id,
            table_structure,
            table_semantics
        )

        # PASS 2: Extract from narrative text (but sees table)
        if text_content:
            print("  Pass 2: Extracting narrative text metrics...")
            text_extraction = self._extract_from_text(
                table,
                text_content,
                example_id,
                table_semantics  # Pass table semantics for context
            )

            # Merge extractions
            extraction = self._merge_extractions(table_extraction, text_extraction)
        else:
            extraction = table_extraction

        # Add metadata
        extraction['_meta'] = {
            'example_number': example_id,
            'example_id': preprocessed_data.get('example_id', ''),
            'model': self.model,
            'extraction_passes': 2 if text_content else 1,
            'table_orientation': table_structure.orientation if table_structure else None,
            'table_caption': table_semantics.caption if table_semantics else None
        }

        # Store table structure for graph building
        if table_structure:
            extraction['_table_structure'] = table_structure.model_dump()
        if table_semantics:
            extraction['_table_semantics'] = table_semantics.model_dump()

        return extraction

    @retry(
        retry=retry_if_exception_type((APIError, json.JSONDecodeError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def _extract_from_table(
        self,
        table: Dict,
        kb: Dict,
        example_id: str,
        table_structure: Optional[TableStructure] = None,
        table_semantics: Optional[TableSemantics] = None
    ) -> Dict[str, Any]:
        """Extract metrics from table with programmatic structure and semantic enhancement"""
        template = self.jinja_env.get_template('ontology_extraction.j2')
        prompt = template.render(
            ontology=self.ontology_ttl,
            example_id=example_id,
            table=table,
            knowledge_base=kb,
            extraction_mode="table_only",
            table_structure=table_structure.model_dump() if table_structure else None,
            table_semantics=table_semantics.model_dump() if table_semantics else None
        )

        # Use Instructor for structured output with Pydantic validation
        result = self.client.messages.create(
            model=self.model,
            max_tokens=8000,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
            response_model=ExtractionResult
        )

        # Convert Pydantic model to dict
        return result.model_dump()

    @retry(
        retry=retry_if_exception_type((APIError, json.JSONDecodeError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def _extract_from_text(
        self,
        table: Dict,
        text_content: list,
        example_id: str,
        table_semantics: Optional[TableSemantics] = None
    ) -> Dict[str, Any]:
        """Extract metrics from narrative text with table context and semantic information"""
        template = self.jinja_env.get_template('ontology_extraction.j2')
        prompt = template.render(
            ontology=self.ontology_ttl,
            example_id=example_id,
            table=table,
            knowledge_base={'text_content': text_content},
            extraction_mode="text_only",
            table_semantics=table_semantics.model_dump() if table_semantics else None
        )

        # Use Instructor for structured output with Pydantic validation
        result = self.client.messages.create(
            model=self.model,
            max_tokens=8000,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
            response_model=ExtractionResult
        )

        # Convert Pydantic model to dict
        return result.model_dump()

    def _merge_extractions(self, table_extraction: Dict, text_extraction: Dict) -> Dict:
        """
        Merge table and text extractions, deduplicating table metrics by position

        CRITICAL: Each table cell (tableRow + tableColumn) must map to exactly ONE metric entity.
        If LLM extracted multiple entities for the same cell, keep only the first one.
        """
        # Deduplicate table metrics by (tableRow, tableColumn) position
        table_metrics = table_extraction.get('metrics', [])
        text_metrics = text_extraction.get('metrics', [])

        # Track seen table positions
        seen_positions = set()
        deduped_table_metrics = []

        for metric in table_metrics:
            table_row = metric.get('tableRow')
            table_col = metric.get('tableColumn')

            if table_row and table_col:
                position = (table_row, table_col)
                if position in seen_positions:
                    # Duplicate! Skip this one
                    print(f"  WARNING: Skipping duplicate metric for cell ({table_row}, {table_col}): {metric.get('label')}")
                    continue
                seen_positions.add(position)

            deduped_table_metrics.append(metric)

        merged = {
            'companies': table_extraction.get('companies', []) + text_extraction.get('companies', []),
            'metrics': deduped_table_metrics + text_metrics,
            'years': table_extraction.get('years', []) + text_extraction.get('years', []),
            'values': table_extraction.get('values', []) + text_extraction.get('values', []),
            'triples': table_extraction.get('triples', []) + text_extraction.get('triples', [])
        }
        return merged

    def build_rdflib_graph(self, extraction: Dict[str, Any]) -> Graph:
        """
        Convert Pydantic extraction result to RDFLib graph

        Args:
            extraction: Dict from ExtractionResult.model_dump() with companies, metrics, years, values, triples

        Returns:
            RDFLib Graph
        """
        g = Graph()

        # Namespaces
        KG = Namespace("http://example.org/convfinqa/")
        ENTITY = Namespace("http://example.org/convfinqa/entity/")
        VALUE = Namespace("http://example.org/convfinqa/value/")

        g.bind("kg", KG)
        g.bind("entity", ENTITY)
        g.bind("value", VALUE)
        g.bind("rdf", RDF)
        g.bind("rdfs", RDFS)
        g.bind("owl", OWL)
        g.bind("dcterms", DCTERMS)

        # Add KG metadata with ontology version
        kg_resource = KG.KnowledgeGraph
        g.add((kg_resource, RDF.type, OWL.Ontology))
        g.add((kg_resource, KG.builtWithOntologyVersion, Literal(self.ontology_version)))
        g.add((kg_resource, KG.builtWithOntologyModified, Literal(self.ontology_modified)))

        # Add table structure metadata if available
        if '_table_structure' in extraction:
            table_struct = extraction['_table_structure']
            table_uri = ENTITY['FinancialTable']
            g.add((table_uri, RDF.type, KG.Table))

            # Add orientation (CRITICAL for query generation!)
            if table_struct.get('orientation'):
                g.add((table_uri, KG.tableOrientation, Literal(table_struct['orientation'])))

            # Add row labels as ordered list
            for idx, row_label in enumerate(table_struct.get('rows', [])):
                row_uri = ENTITY[f'TableRow_{idx}']
                g.add((row_uri, RDF.type, KG.TableRow))
                g.add((row_uri, KG.label, Literal(row_label)))
                g.add((row_uri, KG.rowIndex, Literal(idx, datatype=XSD.integer)))
                g.add((table_uri, KG.hasRow, row_uri))

            # Add column labels as ordered list
            for idx, col_label in enumerate(table_struct.get('columns', [])):
                col_uri = ENTITY[f'TableColumn_{idx}']
                g.add((col_uri, RDF.type, KG.TableColumn))
                g.add((col_uri, KG.label, Literal(col_label)))
                g.add((col_uri, KG.columnIndex, Literal(idx, datatype=XSD.integer)))
                g.add((table_uri, KG.hasColumn, col_uri))

        # Add table semantics if available
        if '_table_semantics' in extraction:
            table_sem = extraction['_table_semantics']
            if table_sem.get('caption'):
                g.add((ENTITY['FinancialTable'], KG.tableCaption, Literal(table_sem['caption'])))

        # CRITICAL: Create metrics for column/row headers with numeric values
        # This handles cases like column header "$ 9889" which represents a fiscal year value
        if '_table_structure' in extraction and '_table_semantics' in extraction:
            table_struct = extraction['_table_structure']
            table_sem = extraction['_table_semantics']

            # Get default scale from table semantics
            default_scale = table_sem.get('units', 'Units')

            # Check columns for numeric values
            for col in table_struct.get('columns', []):
                if col.get('numeric_value') is not None:
                    col_idx = col['index']
                    col_label = col['label']
                    col_value = col['numeric_value']

                    # Create a metric for this column header value
                    metric_uri = ENTITY[f"Metric_ColumnHeaderValue_{col_idx}"]
                    value_uri = VALUE[f"ColumnHeaderValue_{col_idx}"]

                    g.add((metric_uri, RDF.type, KG.FinancialMetric))
                    g.add((metric_uri, KG.label, Literal(f"Column header value: {col_label}")))
                    g.add((metric_uri, KG.tableColumn, Literal(col_label)))

                    # Create value entity
                    g.add((value_uri, RDF.type, KG.MonetaryValue))
                    g.add((value_uri, KG.numericValue, Literal(col_value, datatype=XSD.decimal)))
                    g.add((value_uri, KG.displayValue, Literal(col_label)))
                    g.add((value_uri, KG.hasScale, KG[default_scale]))

                    # Link metric to value
                    g.add((metric_uri, KG.hasValue, value_uri))

            # Check rows for numeric values (less common but possible)
            for row in table_struct.get('rows', []):
                if row.get('numeric_value') is not None:
                    row_idx = row['index']
                    row_label = row['label']
                    row_value = row['numeric_value']

                    # Create a metric for this row header value
                    metric_uri = ENTITY[f"Metric_RowHeaderValue_{row_idx}"]
                    value_uri = VALUE[f"RowHeaderValue_{row_idx}"]

                    g.add((metric_uri, RDF.type, KG.FinancialMetric))
                    g.add((metric_uri, KG.label, Literal(f"Row header value: {row_label}")))
                    g.add((metric_uri, KG.tableRow, Literal(row_label)))

                    # Create value entity
                    g.add((value_uri, RDF.type, KG.MonetaryValue))
                    g.add((value_uri, KG.numericValue, Literal(row_value, datatype=XSD.decimal)))
                    g.add((value_uri, KG.displayValue, Literal(row_label)))
                    g.add((value_uri, KG.hasScale, KG[default_scale]))

                    # Link metric to value
                    g.add((metric_uri, KG.hasValue, value_uri))

            # NEW: Create metrics for text/categorical cells
            # These don't have numeric values but are needed for filtering
            for text_cell in table_struct.get('text_cells', []):
                row_idx = text_cell['row_index']
                col_idx = text_cell['col_index']
                text_value = text_cell['text_value']

                # Get row and column labels
                row_label = table_struct['rows'][row_idx]['label']
                col_label = table_struct['columns'][col_idx]['label']

                # Create a metric for this text cell
                metric_uri = ENTITY[f"Metric_TextCell_{row_idx}_{col_idx}"]

                g.add((metric_uri, RDF.type, KG.FinancialMetric))
                g.add((metric_uri, KG.label, Literal(f"{row_label}: {text_value}")))
                g.add((metric_uri, KG.tableRow, Literal(row_label)))
                g.add((metric_uri, KG.tableColumn, Literal(col_label)))

                # Store the text value as a literal property
                g.add((metric_uri, KG.textValue, Literal(text_value)))

        # Helper to convert URI string to RDFLib URIRef
        def make_uri(uri_str: str) -> URIRef:
            if uri_str.startswith('entity_'):
                return ENTITY[uri_str.replace('entity_', '')]
            elif uri_str.startswith('value_'):
                return VALUE[uri_str.replace('value_', '')]
            else:
                # It's a class/scale reference
                return KG[uri_str]

        # Add Company entities
        for company in extraction.get('companies', []):
            company_uri = make_uri(company['uri'])
            g.add((company_uri, RDF.type, KG.Company))
            g.add((company_uri, KG.label, Literal(company['label'])))

        # Add Year entities
        for year in extraction.get('years', []):
            year_uri = make_uri(year['uri'])
            g.add((year_uri, RDF.type, KG.Year))
            g.add((year_uri, KG.yearValue, Literal(year['yearValue'], datatype=XSD.integer)))

        # Add Financial Metrics (which include their values)
        for metric in extraction.get('metrics', []):
            metric_uri = make_uri(metric['uri'])
            g.add((metric_uri, RDF.type, KG.FinancialMetric))
            g.add((metric_uri, KG.label, Literal(metric['label'])))

            # Add table position if present
            if metric.get('tableRow'):
                g.add((metric_uri, KG.tableRow, Literal(metric['tableRow'])))
            if metric.get('tableColumn'):
                g.add((metric_uri, KG.tableColumn, Literal(metric['tableColumn'])))

            # Add comment if present (from footnote processing)
            if metric.get('comment'):
                g.add((metric_uri, RDFS.comment, Literal(metric['comment'])))

            # Add year relationship if present
            if metric.get('year'):
                year_uri = ENTITY[f"entity_Year_{metric['year']}"]
                g.add((metric_uri, KG.forTimePeriod, year_uri))

            # Add the value entity
            value = metric['value']
            value_uri = make_uri(value['uri'])
            g.add((value_uri, RDF.type, KG.MonetaryValue))  # Assume MonetaryValue
            g.add((value_uri, KG.numericValue, Literal(value['numericValue'], datatype=XSD.decimal)))
            g.add((value_uri, KG.displayValue, Literal(value['displayValue'])))

            # CRITICAL: Add scale
            if value.get('scale'):
                scale_uri = KG[value['scale']]
                g.add((value_uri, KG.hasScale, scale_uri))

            # Add currency
            if value.get('currency'):
                g.add((value_uri, KG.hasCurrency, KG[value['currency']]))

            # Link metric to value
            g.add((metric_uri, KG.hasValue, value_uri))

        # Add standalone values (if any - usually redundant with metric.value)
        for value in extraction.get('values', []):
            if not value.get('uri'):
                continue
            value_uri = make_uri(value['uri'])
            # Only add if not already added via metrics
            if (value_uri, None, None) not in g:
                g.add((value_uri, RDF.type, KG.MonetaryValue))
                g.add((value_uri, KG.numericValue, Literal(value['numericValue'], datatype=XSD.decimal)))
                if value.get('displayValue'):
                    g.add((value_uri, KG.displayValue, Literal(value['displayValue'])))
                if value.get('scale'):
                    g.add((value_uri, KG.hasScale, KG[value['scale']]))

        # Add triples (relationships)
        for triple in extraction.get('triples', []):
            subject_uri = make_uri(triple['subject'])
            predicate_uri = KG[triple['predicate']]
            object_uri = make_uri(triple['object'])

            g.add((subject_uri, predicate_uri, object_uri))

        return g


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ontology_extractor.py <example_id>")
        sys.exit(1)

    example_id = sys.argv[1]

    # Load dataset and create preprocessed structure
    dataset_file = Path(__file__).parent.parent.parent / "data" / "convfinqa_dataset.json"
    with open(dataset_file, 'r') as f:
        dataset = json.load(f)

    # Find example by ID
    all_examples = []
    for split in ['train', 'dev', 'test']:
        if split in dataset:
            all_examples.extend(dataset[split])

    if int(example_id) >= len(all_examples):
        print(f"ERROR: Example {example_id} not found")
        sys.exit(1)

    example_data = all_examples[int(example_id)]
    doc = example_data.get('doc', {})

    # Create preprocessed data structure
    preprocessed_data = {
        'example_id': example_data['id'],
        'table': doc.get('table', {}),
        'knowledge_base': {
            'text_content': [doc.get('pre_text', ''), doc.get('post_text', '')]
        }
    }

    # Extract
    extractor = OntologyExtractor()
    print(f"\n{'='*80}")
    print(f"Ontology-Driven Extraction - Example {example_id}")
    print(f"{'='*80}\n")

    extraction = extractor.extract(preprocessed_data, example_id)

    print("EXTRACTED ENTITIES:")
    for entity in extraction.get('entities', []):
        print(f"  {entity['id']}: {entity['type']} - {entity.get('label', 'N/A')}")

    print(f"\nEXTRACTED VALUES:")
    for value in extraction.get('values', []):
        print(f"  {value['id']}: {value['type']} - {value['numericValue']} ({value.get('scale', 'N/A')})")

    print(f"\nEXTRACTED RELATIONSHIPS: {len(extraction.get('relationships', []))}")

    # Build graph
    graph = extractor.build_rdflib_graph(extraction)

    print(f"\nRDFLib Graph: {len(graph)} triples")

    # Save to knowledge-graphs directory
    kg_dir = Path(__file__).parent.parent.parent / "data" / "knowledge-graphs"
    kg_dir.mkdir(parents=True, exist_ok=True)

    output_ttl = kg_dir / f"{example_id}_kg.ttl"
    graph.serialize(destination=str(output_ttl), format='turtle')

    print(f"\n✓ Saved graph to: {output_ttl}")
