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


def _load_keyword_matched_patterns(question, ontology_path=None, use_cache=True, top_k=10):
    """
    Fallback: Load patterns using improved keyword matching (when sentence-transformers unavailable)
    """
    if ontology_path is None:
        base_dir = Path(__file__).parent.parent.parent
        ontology_path = base_dir / "ontology" / "convfinqa-ontology.ttl"

    g = _load_ontology_graph(ontology_path, use_cache=use_cache)

    # Extract keywords from question, filtering stopwords
    question_lower = question.lower()

    # Common stopwords to ignore
    stopwords = {'what', 'was', 'were', 'is', 'are', 'the', 'a', 'an', 'in', 'of', 'and',
                 'to', 'for', 'on', 'with', 'as', 'at', 'by', 'from', 'this', 'that',
                 'it', 'they', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
                 'did', 'will', 'would', 'should', 'could', 'may', 'might'}

    question_words = {w for w in question_lower.split() if w not in stopwords}

    # Query all patterns
    patterns = []
    pattern_query = """
        PREFIX kg: <http://example.org/convfinqa/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT DISTINCT ?pattern ?phrase ?operation ?comment
        WHERE {
            ?pattern a kg:LinguisticPattern .
            ?pattern kg:naturalLanguagePhrase ?phrase .
            ?pattern kg:semanticOperation ?operation .
            OPTIONAL { ?pattern rdfs:comment ?comment }
        }
    """

    for row in g.query(pattern_query):
        operation_name = str(row.operation).split('/')[-1] if row.operation else 'Unknown'
        phrase_lower = str(row.phrase).lower()

        # Score based on multiple factors
        score = 0

        # Factor 1: Exact phrase match (highest priority)
        if phrase_lower in question_lower:
            score += 100

        # Factor 2: All phrase words present in question
        phrase_words = {w for w in phrase_lower.split() if w not in stopwords}
        if phrase_words and phrase_words.issubset(question_words):
            score += 50

        # Factor 3: Keyword overlap (filtered stopwords)
        overlap = len(question_words & phrase_words)
        score += overlap * 10

        # Factor 4: Check for key financial terms in both
        key_terms = {'change', 'difference', 'percentage', 'percent', 'net', 'total',
                    'increase', 'decrease', 'ratio', 'growth', 'decline'}
        phrase_key_terms = phrase_words & key_terms
        question_key_terms = question_words & key_terms
        common_key_terms = phrase_key_terms & question_key_terms
        score += len(common_key_terms) * 20

        if score > 0:
            patterns.append({
                'phrase': str(row.phrase),
                'operation': operation_name,
                'guidance': str(row.comment) if row.comment else '',
                'score': score
            })

    # Sort by score and take top K
    patterns.sort(key=lambda x: x['score'], reverse=True)
    matched_patterns = patterns[:top_k]

    # Format as readable guidance text
    guidance_text = f"""RELEVANT ONTOLOGY PATTERNS (top {len(matched_patterns)} by keyword matching):
===============================================

Question: {question}

"""

    if matched_patterns:
        guidance_text += "\nLINGUISTIC PATTERNS:\n"
        guidance_text += "-" * 60 + "\n"

        for p in matched_patterns:
            guidance_text += f"\nPhrase: \"{p['phrase']}\"\n"
            guidance_text += f"Operation: {p['operation']}\n"
            if p['guidance']:
                cleaned = p['guidance'].replace('\n', '\n  ')
                guidance_text += f"Guidance: {cleaned}\n"

    return guidance_text


def load_question_relevant_guidance(question, ontology_path=None, use_cache=True, top_k=10):
    """
    Load only ontology patterns that are semantically relevant to the given question.

    Uses sentence embeddings to find the most similar patterns to the question.
    This is legitimate because we're only using the question text (available at runtime)
    to find relevant ontology guidance, not using gold answers or programs.

    Args:
        question: The question text to analyze
        ontology_path: Path to ontology file
        use_cache: If True, use cached pattern embeddings
        top_k: Number of most relevant patterns to return (default: 10)

    Returns:
        Formatted string with only relevant patterns for this question
    """
    if ontology_path is None:
        base_dir = Path(__file__).parent.parent.parent
        ontology_path = base_dir / "ontology" / "convfinqa-ontology.ttl"

    # Check if sentence-transformers is available
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        import pickle
    except ImportError:
        # Fallback: use simple keyword matching instead
        return _load_keyword_matched_patterns(question, ontology_path, use_cache, top_k)

    # Cache file path
    cache_dir = Path(__file__).parent.parent.parent / "data"
    cache_dir.mkdir(exist_ok=True)
    cache_file = cache_dir / ".pattern_embeddings_cache.pkl"

    # Load or build pattern embeddings cache
    ontology_mtime = Path(ontology_path).stat().st_mtime

    if use_cache and cache_file.exists():
        try:
            with open(cache_file, 'rb') as f:
                cache_data = pickle.load(f)
                if cache_data['ontology_mtime'] >= ontology_mtime:
                    # Cache is valid
                    patterns = cache_data['patterns']
                    pattern_embeddings = cache_data['embeddings']
                    model = SentenceTransformer('all-MiniLM-L6-v2')
                else:
                    # Cache is stale, rebuild
                    cache_data = None
        except:
            cache_data = None
    else:
        cache_data = None

    if cache_data is None:
        # Build cache from scratch
        g = _load_ontology_graph(ontology_path, use_cache=use_cache)

        # Query all patterns
        patterns = []
        pattern_query = """
            PREFIX kg: <http://example.org/convfinqa/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT DISTINCT ?pattern ?phrase ?operation ?comment
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
                'guidance': str(row.comment) if row.comment else '',
                'uri': str(row.pattern)
            })

        # Load model and compute embeddings
        model = SentenceTransformer('all-MiniLM-L6-v2')

        # Embed pattern phrases (including their guidance text for better matching)
        pattern_texts = [f"{p['phrase']}. {p['guidance'][:200]}" for p in patterns]
        pattern_embeddings = model.encode(pattern_texts, show_progress_bar=False)

        # Save to cache
        with open(cache_file, 'wb') as f:
            pickle.dump({
                'ontology_mtime': ontology_mtime,
                'patterns': patterns,
                'embeddings': pattern_embeddings
            }, f)

    # Embed the question
    question_embedding = model.encode([question], show_progress_bar=False)[0]

    # Compute cosine similarity
    from sklearn.metrics.pairwise import cosine_similarity
    similarities = cosine_similarity([question_embedding], pattern_embeddings)[0]

    # Get top-K most similar patterns
    top_indices = similarities.argsort()[-top_k:][::-1]
    matched_patterns = [patterns[i] for i in top_indices]

    # Format as readable guidance text
    guidance_text = f"""RELEVANT ONTOLOGY PATTERNS (top {len(matched_patterns)} by semantic similarity):
===============================================

Question: {question}

"""

    if matched_patterns:
        guidance_text += "\nLINGUISTIC PATTERNS:\n"
        guidance_text += "-" * 60 + "\n"

        for p in matched_patterns:
            guidance_text += f"\nPhrase: \"{p['phrase']}\"\n"
            guidance_text += f"Operation: {p['operation']}\n"
            if p['guidance']:
                cleaned = p['guidance'].replace('\n', '\n  ')
                guidance_text += f"Guidance: {cleaned}\n"

    return guidance_text


def load_targeted_guidance(example_id, ontology_path=None, use_cache=True):
    """
    Load only the ontology elements needed for a specific example

    Args:
        example_id: Example ID to load sections for
        ontology_path: Path to ontology file (defaults to ontology/convfinqa-ontology.ttl)
        use_cache: If True, use SQLite cache for faster loading (default)

    Returns:
        Formatted string with only the relevant patterns, operations, and types for this example
    """
    import json

    if ontology_path is None:
        base_dir = Path(__file__).parent.parent.parent
        ontology_path = base_dir / "ontology" / "convfinqa-ontology.ttl"

    # Load example sections mapping
    sections_path = Path(__file__).parent.parent.parent / "ontology" / "example_sections.json"
    with open(sections_path) as f:
        sections_data = json.load(f)

    example_id_str = str(example_id)
    if example_id_str not in sections_data['examples']:
        raise ValueError(
            f"❌ ERROR: No ontology section mapping found for example {example_id}\n"
            f"   You must add an entry to ontology/example_sections.json for this example.\n"
            f"   Existing examples: {', '.join(sorted(sections_data['examples'].keys()))}"
        )

    section = sections_data['examples'][example_id_str]

    # Load ontology graph
    g = _load_ontology_graph(ontology_path, use_cache=use_cache)
    kg = Namespace("http://example.org/convfinqa/")

    guidance_text = f"""TARGETED ONTOLOGY GUIDANCE FOR EXAMPLE {example_id}:
===============================================

{section['description']}

"""

    # Load specified patterns
    if section['patterns']:
        guidance_text += "\nRELEVANT LINGUISTIC PATTERNS:\n"
        guidance_text += "-" * 60 + "\n"

        for pattern_name in section['patterns']:
            pattern_uri = f"http://example.org/convfinqa/{pattern_name}"
            query = f"""
                PREFIX kg: <http://example.org/convfinqa/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?phrase ?operation ?comment
                WHERE {{
                    <{pattern_uri}> kg:naturalLanguagePhrase ?phrase .
                    <{pattern_uri}> kg:semanticOperation ?operation .
                    OPTIONAL {{ <{pattern_uri}> rdfs:comment ?comment }}
                }}
            """
            for row in g.query(query):
                operation_name = str(row.operation).split('/')[-1] if row.operation else 'Unknown'
                guidance_text += f"\nPattern: {pattern_name}\n"
                guidance_text += f"Phrase: \"{row.phrase}\"\n"
                guidance_text += f"Operation: {operation_name}\n"
                if row.comment:
                    cleaned = str(row.comment).replace('\n', '\n  ')
                    guidance_text += f"Guidance: {cleaned}\n"

    # Load specified operations
    if section['operations']:
        guidance_text += "\n" + "=" * 60 + "\n"
        guidance_text += "\nRELEVANT SEMANTIC OPERATIONS:\n"
        guidance_text += "-" * 60 + "\n"

        for op_name in section['operations']:
            op_uri = f"http://example.org/convfinqa/{op_name}"
            query = f"""
                PREFIX kg: <http://example.org/convfinqa/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?label ?comment
                WHERE {{
                    <{op_uri}> rdfs:label ?label .
                    OPTIONAL {{ <{op_uri}> rdfs:comment ?comment }}
                }}
            """
            for row in g.query(query):
                guidance_text += f"\n{row.label}:\n"
                if row.comment:
                    cleaned = str(row.comment).replace('\n', '\n  ')
                    guidance_text += f"  {cleaned}\n"

    # Load specified value types
    if section['value_types']:
        guidance_text += "\n" + "=" * 60 + "\n"
        guidance_text += "\nRELEVANT VALUE TYPES:\n"
        guidance_text += "-" * 60 + "\n"

        for type_name in section['value_types']:
            type_uri = f"http://example.org/convfinqa/{type_name}"
            query = f"""
                PREFIX kg: <http://example.org/convfinqa/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT ?label ?comment
                WHERE {{
                    <{type_uri}> rdfs:label ?label .
                    OPTIONAL {{ <{type_uri}> rdfs:comment ?comment }}
                }}
            """
            for row in g.query(query):
                guidance_text += f"\n{row.label}:\n"
                if row.comment:
                    cleaned = str(row.comment).replace('\n', '\n  ')
                    guidance_text += f"  {cleaned}\n"

    return guidance_text


if __name__ == "__main__":
    # Test the loader
    import sys

    if len(sys.argv) > 1:
        # Test targeted loading
        example_id = sys.argv[1]
        print(f"Testing targeted loading for example {example_id}...\n")
        guidance = load_targeted_guidance(example_id)
        print(guidance)
        print(f"\n\nTotal length: {len(guidance)} characters")
    else:
        # Test full loading
        guidance = load_semantic_guidance()
        print(guidance)
        print(f"\n\nTotal length: {len(guidance)} characters")
