#!/usr/bin/env python3
"""Phase 3 & 4: Clean, generic value retrieval and formula execution"""
import ast
import os
import sqlite3
from rdflib import Graph, Namespace
from rdflib.store import Store
from rdflib import plugin
from pathlib import Path

# Register SQLite plugin for RDFLib
try:
    import rdflib_sqlalchemy
    rdflib_sqlalchemy.registerplugins()
except ImportError:
    pass  # SQLite plugin not available, will use fallback


def retrieve_values(values_spec, context):
    """
    Generic value retrieval - NO special handling for "previous results"

    Args:
        values_spec: From Phase 1 - {name: {source, description, semantic_type, sparql?}}
        context: {
            'results_by_name': {var_name: value_obj, ...},
            'kg_graph': rdflib.Graph (optional)
        }

    Returns:
        {name: value_object} where value_object = {value, scale, source, description}
    """
    value_objects = {}

    for name, spec in values_spec.items():
        if spec['source'] == 'previous_result':
            # The variable name itself is the lookup key!
            if name not in context['results_by_name']:
                raise ValueError(
                    f"Variable '{name}' not found in previous results. "
                    f"Available variables: {list(context['results_by_name'].keys())}"
                )
            value_objects[name] = context['results_by_name'][name]

        elif spec['source'] == 'knowledge_graph':
            # Execute SPARQL and create value object
            if 'sparql' not in spec:
                raise ValueError(f"No SPARQL query for {name}")
            result = execute_sparql(context['kg_graph'], spec['sparql'])
            value_objects[name] = {
                'value': result['value'],
                'scale': result.get('scale', 'Units'),
                'source': 'knowledge graph',
                'description': spec['description']
            }

    return value_objects


def validate_formula(formula, variable_names):
    """
    Validate formula before execution

    Args:
        formula: Python expression string
        variable_names: List/set of valid variable names

    Raises:
        ValueError: If formula uses undefined variables
        SyntaxError: If formula is not valid Python

    Returns:
        True if validation passes
    """
    # Parse formula to AST
    try:
        tree = ast.parse(formula, mode='eval')
    except SyntaxError as e:
        raise SyntaxError(f"Invalid formula syntax: {e}")

    # Extract all variable names used in formula
    used_vars = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}

    # Check for undefined variables
    allowed_vars = set(variable_names)
    # Also allow built-in function names (they're in the safe_dict)
    allowed_vars.update(['abs', 'min', 'max', 'round', 'to_percentage'])

    undefined_vars = used_vars - allowed_vars
    if undefined_vars:
        raise ValueError(
            f"Formula uses undefined variables: {undefined_vars}. "
            f"Available variables: {set(variable_names)}"
        )

    return True


def to_percentage(decimal_ratio):
    """Convert decimal ratio to percentage number (e.g., 0.013 → 1.3)"""
    return decimal_ratio * 100


def execute_formula(formula, value_objects):
    """
    Execute formula with named values, maintaining scale metadata

    Args:
        formula: String like "(change_in_net_sales / net_sales_2000)"
        value_objects: {name: {value, scale, source, description}}

    Returns:
        value_object: {value, scale, source, description}
    """
    # Validate formula before execution
    validate_formula(formula, value_objects.keys())

    # Extract numeric values for eval
    values = {name: obj['value'] for name, obj in value_objects.items()}

    # Safe eval (only math operations, no builtins)
    # Allow common math functions + to_percentage
    safe_dict = {
        "__builtins__": {},
        "abs": abs,
        "min": min,
        "max": max,
        "round": round,
        "to_percentage": to_percentage
    }
    safe_dict.update(values)

    result = eval(formula, safe_dict)

    # Determine output scale intelligently
    scales = [obj.get('scale', 'Units') for obj in value_objects.values()]
    unique_scales = set(scales)

    if len(unique_scales) == 1:
        # All values have the same scale - result has that scale
        # This works for addition/subtraction of same-scale values
        output_scale = list(unique_scales)[0]
    elif 'to_percentage' in formula:
        # Division followed by percentage conversion - result is Units (percentage number)
        output_scale = 'Units'
    elif '/' in formula or '*' in formula:
        # Division or multiplication - result is typically Units or derived unit
        # For now, default to first value's scale
        output_scale = scales[0] if scales else 'Units'
    else:
        # Mixed scales with addition/subtraction - this is problematic!
        # For now, use first value's scale but this should ideally convert first
        output_scale = scales[0] if scales else 'Units'

    # Return new value object
    return {
        'value': result,
        'scale': output_scale,
        'source': 'calculated',
        'description': f'result of {formula}'
    }


def execute_sparql(graph, sparql_query):
    """
    Execute SPARQL query and return value object

    Args:
        graph: rdflib.Graph
        sparql_query: SPARQL SELECT query

    Returns:
        {value, scale, source}
    """
    # Add namespace prefixes if not present
    if 'PREFIX' not in sparql_query:
        sparql_query = add_namespaces(sparql_query)

    # Execute query
    results = list(graph.query(sparql_query))

    if not results:
        raise ValueError(f"SPARQL query returned no results: {sparql_query}")

    # Check if query uses aggregation (SUM, AVG, etc.) - if so, single row expected
    if 'SUM(' in sparql_query.upper() or 'AVG(' in sparql_query.upper() or 'COUNT(' in sparql_query.upper():
        # Aggregation query - take first row
        row = results[0]
        value = float(row.value) if hasattr(row, 'value') else float(row[0])
        scale = str(row.scale) if hasattr(row, 'scale') and row.scale else 'Units'
    elif len(results) > 1:
        # Multiple rows - sum all values (assumes same scale)
        # This handles cases where broad filter matches multiple metrics
        values = []
        scales = set()
        for row in results:
            val = float(row.value) if hasattr(row, 'value') else float(row[0])
            scl = str(row.scale) if hasattr(row, 'scale') and row.scale else 'Units'
            values.append(val)
            scales.add(scl)

        value = sum(values)
        scale = list(scales)[0] if len(scales) == 1 else 'Units'
    else:
        # Single row - extract directly
        row = results[0]
        value = float(row.value) if hasattr(row, 'value') else float(row[0])
        scale = str(row.scale) if hasattr(row, 'scale') and row.scale else 'Units'

    return {
        'value': value,
        'scale': scale,
        'source': 'knowledge graph'
    }


def add_namespaces(sparql_query):
    """Add standard namespace prefixes to SPARQL query"""
    prefixes = """
PREFIX kg: <http://example.org/convfinqa/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX entity: <http://example.org/convfinqa/entity/>
PREFIX value: <http://example.org/convfinqa/value/>
"""
    return prefixes + "\n" + sparql_query


def _get_cache_db_path():
    """Get path to shared SQLite cache database"""
    return Path(__file__).parent.parent.parent / "data" / ".kg_cache.db"


def _init_cache_db(db_path):
    """Initialize cache metadata table"""
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cache_metadata (
            example_id TEXT PRIMARY KEY,
            turtle_mtime REAL,
            cached_at REAL
        )
    """)
    conn.commit()
    conn.close()


def _is_cache_valid(example_id, turtle_path, db_path):
    """Check if cached graph is up-to-date"""
    if not db_path.exists():
        return False

    turtle_mtime = turtle_path.stat().st_mtime

    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute(
        "SELECT turtle_mtime FROM cache_metadata WHERE example_id = ?",
        (example_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if row is None:
        return False

    cached_mtime = row[0]
    return cached_mtime >= turtle_mtime


def _mark_cached(example_id, turtle_mtime, db_path):
    """Record cache metadata"""
    import time
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        INSERT OR REPLACE INTO cache_metadata (example_id, turtle_mtime, cached_at)
        VALUES (?, ?, ?)
    """, (example_id, turtle_mtime, time.time()))
    conn.commit()
    conn.close()


def load_graph(example_id, use_cache=True):
    """
    Load knowledge graph for example with optional SQLite caching

    Args:
        example_id: Example identifier (e.g., "10")
        use_cache: If True, use SQLite cache (default). If False, load from turtle directly.

    Returns:
        rdflib.Graph with KG data
    """
    base_path = Path(__file__).parent.parent.parent / "data"
    kg_path = base_path / "knowledge-graphs" / f"{example_id}_kg.ttl"

    if not kg_path.exists():
        raise FileNotFoundError(f"Knowledge graph not found: {kg_path}")

    if not use_cache:
        # Fallback: load from turtle directly (old behavior)
        g = Graph()
        g.parse(str(kg_path), format='turtle')
        return g

    # Use SQLite caching
    db_path = _get_cache_db_path()
    _init_cache_db(db_path)

    # Check if cache is valid
    cache_valid = _is_cache_valid(str(example_id), kg_path, db_path)

    # Create graph with SQLAlchemy store (backed by SQLite)
    store = plugin.get('SQLAlchemy', Store)()
    g = Graph(store, identifier=f'example_{example_id}')

    if not cache_valid:
        # Cache miss or stale - rebuild from turtle
        g.open(f"sqlite:///{db_path}", create=True)

        # Clear existing data for this example
        g.remove((None, None, None))

        # Parse turtle into SQLite
        g.parse(str(kg_path), format='turtle')

        # Mark as cached
        turtle_mtime = kg_path.stat().st_mtime
        _mark_cached(str(example_id), turtle_mtime, db_path)
    else:
        # Cache hit - just open the store
        g.open(f"sqlite:///{db_path}", create=False)

    return g


def extract_sample_entities(graph):
    """
    Extract sample entities from loaded graph for prompt

    Shows what entities actually exist in THIS graph:
    - Extracted metrics (from text, no tableRow/tableColumn) WITH YEARS
    - Table structure metadata (orientation, caption)
    - Table row labels
    - Table column labels

    Args:
        graph: rdflib.Graph loaded from .ttl file

    Returns:
        {
            "extracted_metrics": [
                {"label": "Capitalized compensation expense", "year": 2011},
                ...
            ],
            "table_metadata": {
                "orientation": "column-first" | "row-first" | None,
                "caption": "..." | None
            },
            "financial_metrics": {
                "row_labels": ["total debt", "shares subject to..."],
                "column_labels": ["december 31 2015", ...]
            }
        }
    """
    from rdflib.namespace import RDF

    KG = Namespace('http://example.org/convfinqa/')
    ENTITY = Namespace('http://example.org/convfinqa/entity/')

    extracted_metrics = []
    row_labels = set()
    col_labels = set()

    # Query for table metadata (orientation, caption)
    table_metadata = {
        "orientation": None,
        "caption": None
    }

    table_uri = ENTITY['FinancialTable']
    for orientation in graph.objects(table_uri, KG.tableOrientation):
        table_metadata["orientation"] = str(orientation)
    for caption in graph.objects(table_uri, KG.tableCaption):
        table_metadata["caption"] = str(caption)

    # Query for metrics with tableRow/tableColumn
    for s, p, o in graph.triples((None, KG.tableRow, None)):
        row_labels.add(str(o))
    for s, p, o in graph.triples((None, KG.tableColumn, None)):
        col_labels.add(str(o))

    # Query for extracted metrics (have label but no tableRow)
    for metric in graph.subjects(RDF.type, KG.FinancialMetric):
        has_table = False
        for _ in graph.triples((metric, KG.tableRow, None)):
            has_table = True
            break
        if not has_table:
            label = None
            for l in graph.objects(metric, KG.label):
                label = str(l)
                break

            if label:
                # Check if metric has year
                year = None
                for year_entity in graph.objects(metric, KG.forTimePeriod):
                    for year_val in graph.objects(year_entity, KG.yearValue):
                        year = int(year_val)
                        break

                extracted_metrics.append({
                    "label": label,
                    "year": year
                })

    return {
        "extracted_metrics": extracted_metrics,
        "table_metadata": table_metadata,
        "financial_metrics": {
            "row_labels": sorted(list(row_labels)),
            "column_labels": sorted(list(col_labels))
        }
    }


if __name__ == "__main__":
    # Test retrieve_values with Example 2 Turn 4
    import json

    # Simulate context with name-based lookup
    context = {
        'results_by_name': {
            'net_sales_2001': {'value': 5363.0, 'scale': 'Millions', 'source': 'calculated', 'description': 'net sales in 2001'},
            'net_sales_2000': {'value': 7983.0, 'scale': 'Millions', 'source': 'calculated', 'description': 'net sales in 2000'},
            'change_in_net_sales': {'value': -2620.0, 'scale': 'Millions', 'source': 'calculated', 'description': 'change in net sales'}
        },
        'kg_graph': None
    }

    # Values spec from Phase 1 (using existing variable names)
    values_spec = {
        "change_in_net_sales": {
            "description": "the change in the total of net sales over the year (from 2000 to 2001)",
            "semantic_type": "change_value",
            "source": "previous_result"
        },
        "net_sales_2000": {
            "description": "the total of net sales in 2000",
            "semantic_type": "total_value",
            "source": "previous_result"
        }
    }

    # Test Phase 3: Retrieval
    print("=== PHASE 3: Retrieval ===")
    value_objects = retrieve_values(values_spec, context)
    print(json.dumps(value_objects, indent=2))

    # Test Phase 4: Execution
    print("\n=== PHASE 4: Execution ===")
    formula = "(change_in_net_sales / net_sales_2000) * 100"
    print(f"Formula: {formula}")
    result = execute_formula(formula, value_objects)
    print(f"Result: {json.dumps(result, indent=2)}")
    print(f"\nOur answer: {result['value']}")
    print(f"Gold answer: -32.0")
    print(f"Match: {abs(result['value'] - (-32.0)) < 1.0}")
