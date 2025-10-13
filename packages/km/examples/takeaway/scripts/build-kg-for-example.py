#!/usr/bin/env python3
"""Build knowledge graph for a specific example"""
import sys
import json
from pathlib import Path
from rdflib import Graph, Namespace

# Add src to path
src_dir = Path(__file__).parent.parent / "src" / "graph-solver"
sys.path.insert(0, str(src_dir))

from kg_extractor import KGExtractor


def load_dataset():
    """Load ConvFinQA dataset"""
    dataset_file = Path(__file__).parent.parent / "data" / "convfinqa_dataset.json"
    with open(dataset_file, 'r') as f:
        data = json.load(f)

    # Combine all splits
    all_examples = []
    for split in ['train', 'dev', 'test']:
        if split in data:
            all_examples.extend(data[split])

    return all_examples


def check_kg_version(kg_path: Path, current_version: str) -> bool:
    """
    Check if existing KG was built with current ontology version

    Returns:
        True if KG is up-to-date, False if needs rebuilding
    """
    if not kg_path.exists():
        return False

    # Load the KG and check version
    g = Graph()
    g.parse(str(kg_path), format='turtle')

    KG = Namespace("http://example.org/convfinqa/")

    # Find the version
    for _, _, version in g.triples((KG.KnowledgeGraph, KG.builtWithOntologyVersion, None)):
        kg_version = str(version)
        return kg_version == current_version

    # No version found - needs rebuilding
    return False


def build_kg(example_num: int, force: bool = False):
    """Build KG for specific example

    Args:
        example_num: Example number
        force: If True, rebuild even if version matches
    """
    print(f"Building KG for Example {example_num}...")

    # Initialize extractor to get ontology version
    extractor = KGExtractor()
    current_version = extractor.ontology_version
    print(f"  Current ontology version: {current_version}")

    # Check if KG already exists and is up-to-date
    kg_dir = Path(__file__).parent.parent / "data" / "knowledge-graphs"
    kg_dir.mkdir(parents=True, exist_ok=True)
    kg_path = kg_dir / f"{example_num}_kg.ttl"

    if not force and check_kg_version(kg_path, current_version):
        print(f"  ✓ KG is already up-to-date with ontology version {current_version}")
        print(f"  → Skipping rebuild (use --force to rebuild anyway)")
        return True

    # Load dataset
    dataset = load_dataset()

    if example_num >= len(dataset):
        print(f"ERROR: Example {example_num} not found (dataset has {len(dataset)} examples)")
        return False

    example_data = dataset[example_num]
    example_id = example_data['id']

    print(f"  Example ID: {example_id}")
    print(f"  → Rebuilding KG...")

    # Create preprocessed data structure
    preprocessed = {
        'example_id': example_id,
        'table': {},
        'knowledge_base': {
            'extracted_values': {},
            'table_metadata': {}
        }
    }

    # Extract table data
    doc = example_data.get('doc', {})
    if 'table' in doc and isinstance(doc['table'], dict):
        # Table is already in dict format
        preprocessed['table'] = doc['table']
    elif 'table' in doc and isinstance(doc['table'], list):
        # Convert table from list format
        raw_table = doc['table']
        if len(raw_table) > 1:
            headers = raw_table[0]
            for row in raw_table[1:]:
                if len(row) > 0:
                    row_label = str(row[0]).strip()
                    preprocessed['table'][row_label] = {}
                    for i, value in enumerate(row[1:], 1):
                        if i < len(headers):
                            col_label = str(headers[i]).strip()
                            preprocessed['table'][row_label][col_label] = value

    # Add text content for entity extraction
    # CRITICAL: pre_text and post_text are character-by-character lists, must join them
    text_parts = []
    if 'pre_text' in doc:
        pre_text = doc['pre_text']
        if isinstance(pre_text, list):
            pre_text = ''.join(pre_text)
        text_parts.append(pre_text)
    if 'post_text' in doc:
        post_text = doc['post_text']
        if isinstance(post_text, list):
            post_text = ''.join(post_text)
        text_parts.append(post_text)
    preprocessed['knowledge_base']['text_content'] = text_parts

    # Extract entities and relationships (extractor already initialized above)
    print("  Extracting entities with LLM...")
    extraction = extractor.extract(preprocessed, str(example_num))

    # DEBUG: Save extraction for inspection
    debug_file = kg_dir / f"{example_num}_extraction_debug.json"
    import json
    with open(debug_file, 'w') as f:
        json.dump(extraction, f, indent=2)
    print(f"  DEBUG: Saved extraction to {debug_file}")

    # Build RDFLib graph
    print("  Building RDF graph...")
    rdf_graph = extractor.build_rdflib_graph(extraction)

    # Save TTL to knowledge-graphs directory (ONLY .ttl files!)
    kg_dir = Path(__file__).parent.parent / "data" / "knowledge-graphs"
    kg_dir.mkdir(parents=True, exist_ok=True)

    ttl_file = kg_dir / f"{example_num}_kg.ttl"
    rdf_graph.serialize(destination=str(ttl_file), format='turtle')
    print(f"  ✓ Saved KG: {ttl_file}")

    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python build-kg-for-example.py <example_number> [--force]")
        print("  --force: Rebuild even if ontology version hasn't changed")
        sys.exit(1)

    example_num = int(sys.argv[1])
    force = "--force" in sys.argv

    success = build_kg(example_num, force=force)

    if success:
        print(f"\n✓ Successfully processed KG for Example {example_num}")
        sys.exit(0)
    else:
        print(f"\n✗ Failed to build KG for Example {example_num}")
        sys.exit(1)
