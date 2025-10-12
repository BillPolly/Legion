#!/usr/bin/env python3
"""Extract semantic guidance from ConvFinQA ontology for formula planning"""
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


def _load_ontology_graph(ontology_path, use_cache=True):
    """
    Load ontology graph with optional SQLite caching

    Args:
        ontology_path: Path to ontology turtle file
        use_cache: If True, use SQLite cache (default)

    Returns:
        rdflib.Graph with ontology data
    """
    if not use_cache:
        # Fallback: load from turtle directly
        g = Graph()
        g.parse(str(ontology_path), format='turtle')
        return g

    # Use shared SQLite cache (same as KG cache)
    base_path = Path(__file__).parent.parent.parent / "data"
    db_path = base_path / ".kg_cache.db"

    # Initialize cache DB if needed
    if not db_path.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cache_metadata (
            example_id TEXT PRIMARY KEY,
            turtle_mtime REAL,
            cached_at REAL
        )
    """)
    conn.commit()

    # Check if ontology is cached and up-to-date
    turtle_mtime = ontology_path.stat().st_mtime
    cursor = conn.execute(
        "SELECT turtle_mtime FROM cache_metadata WHERE example_id = ?",
        ('ontology',)
    )
    row = cursor.fetchone()
    cache_valid = row is not None and row[0] >= turtle_mtime

    conn.close()

    # Create graph with SQLAlchemy store (backed by SQLite)
    store = plugin.get('SQLAlchemy', Store)()
    g = Graph(store, identifier='ontology')

    if not cache_valid:
        # Cache miss or stale - rebuild from turtle
        g.open(f"sqlite:///{db_path}", create=True)
        g.remove((None, None, None))
        g.parse(str(ontology_path), format='turtle')

        # Mark as cached
        import time
        conn = sqlite3.connect(str(db_path))
        conn.execute("""
            INSERT OR REPLACE INTO cache_metadata (example_id, turtle_mtime, cached_at)
            VALUES (?, ?, ?)
        """, ('ontology', turtle_mtime, time.time()))
        conn.commit()
        conn.close()
    else:
        # Cache hit - just open the store
        g.open(f"sqlite:///{db_path}", create=False)

    return g


def load_semantic_guidance(ontology_path=None, use_cache=True):
    """
    Extract semantic guidance from ontology for formula planning

    Args:
        ontology_path: Path to ontology file (defaults to ontology/convfinqa-ontology.ttl)
        use_cache: If True, use SQLite cache for faster loading (default)

    Returns:
        Formatted string with patterns, operations, and rules for LLM prompts
    """
    if ontology_path is None:
        # Default: relative to this file's location
        base_dir = Path(__file__).parent.parent.parent
        ontology_path = base_dir / "ontology" / "convfinqa-ontology.ttl"

    g = _load_ontology_graph(ontology_path, use_cache=use_cache)

    kg = Namespace("http://example.org/convfinqa/")

    # Extract LinguisticPatterns
    patterns = []
    pattern_query = """
        PREFIX kg: <http://example.org/convfinqa/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?pattern ?phrase ?operation ?comment
        WHERE {
            ?pattern a kg:LinguisticPattern .
            ?pattern kg:naturalLanguagePhrase ?phrase .
            ?pattern kg:semanticOperation ?operation .
            OPTIONAL { ?pattern rdfs:comment ?comment }
        }
    """

    for row in g.query(pattern_query):
        operation_name = str(row.operation).split('/')[-1] if row.operation else 'Unknown'
        patterns.append({
            'phrase': str(row.phrase),
            'operation': operation_name,
            'guidance': str(row.comment) if row.comment else ''
        })

    # Extract Semantic Operations
    operations = []
    operation_query = """
        PREFIX kg: <http://example.org/convfinqa/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        SELECT ?operation ?label ?comment
        WHERE {
            ?operation rdfs:subClassOf kg:SemanticOperation .
            OPTIONAL { ?operation rdfs:label ?label }
            OPTIONAL { ?operation rdfs:comment ?comment }
        }
    """

    for row in g.query(operation_query):
        operation_name = str(row.operation).split('/')[-1] if row.operation else 'Unknown'
        operations.append({
            'name': operation_name,
            'label': str(row.label) if row.label else operation_name,
            'description': str(row.comment) if row.comment else ''
        })

    # Format as readable guidance text for LLM
    guidance_text = """SEMANTIC PATTERNS AND OPERATIONS FROM ONTOLOGY:
===============================================

This ontology defines how to interpret financial questions and build formulas.

"""

    # Add Linguistic Patterns
    guidance_text += "\nLINGUISTIC PATTERNS (phrases → operations):\n"
    guidance_text += "-" * 60 + "\n"

    for p in sorted(patterns, key=lambda x: x['phrase']):
        guidance_text += f"\nPhrase: \"{p['phrase']}\"\n"
        guidance_text += f"Operation: {p['operation']}\n"
        if p['guidance']:
            # Clean up guidance text
            cleaned = p['guidance'].replace('\n', '\n  ')
            guidance_text += f"Guidance: {cleaned}\n"

    # Add Semantic Operations
    if operations:
        guidance_text += "\n" + "=" * 60 + "\n"
        guidance_text += "\nSEMANTIC OPERATIONS (how to calculate):\n"
        guidance_text += "-" * 60 + "\n"

        for op in sorted(operations, key=lambda x: x['name']):
            guidance_text += f"\n{op['label']}:\n"
            if op['description']:
                cleaned = op['description'].replace('\n', '\n  ')
                guidance_text += f"  {cleaned}\n"

    return guidance_text


if __name__ == "__main__":
    # Test the loader
    guidance = load_semantic_guidance()
    print(guidance)
    print(f"\n\nTotal length: {len(guidance)} characters")
