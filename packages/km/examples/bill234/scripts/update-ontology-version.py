#!/usr/bin/env python3
"""Update ontology version number"""
import sys
from pathlib import Path
from datetime import date
from rdflib import Graph, Namespace, Literal
from rdflib.namespace import OWL, DCTERMS


def update_ontology_version(version_type: str = "patch"):
    """
    Update ontology version and modified date

    Args:
        version_type: "major", "minor", or "patch" (default: patch)
    """
    ontology_path = Path(__file__).parent.parent / "ontology" / "convfinqa-ontology.ttl"

    # Load ontology
    g = Graph()
    g.parse(str(ontology_path), format='turtle')

    KG = Namespace("http://example.org/convfinqa/")
    ontology_uri = KG.ConvFinQAOntology

    # Read current version
    current_version = None
    for _, _, v in g.triples((ontology_uri, OWL.versionInfo, None)):
        current_version = str(v)
        break

    if not current_version:
        print("ERROR: No version found in ontology")
        return False

    # Parse version
    parts = current_version.split('.')
    if len(parts) != 3:
        print(f"ERROR: Invalid version format: {current_version}")
        return False

    major, minor, patch = map(int, parts)

    # Increment version
    if version_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif version_type == "minor":
        minor += 1
        patch = 0
    elif version_type == "patch":
        patch += 1
    else:
        print(f"ERROR: Invalid version type: {version_type}")
        print("  Must be 'major', 'minor', or 'patch'")
        return False

    new_version = f"{major}.{minor}.{patch}"
    today = date.today().isoformat()

    print(f"Updating ontology version:")
    print(f"  {current_version} → {new_version}")
    print(f"  Modified date: {today}")

    # Remove old version and date
    g.remove((ontology_uri, OWL.versionInfo, None))
    g.remove((ontology_uri, DCTERMS.modified, None))

    # Add new version and date
    g.add((ontology_uri, OWL.versionInfo, Literal(new_version)))
    g.add((ontology_uri, DCTERMS.modified, Literal(today)))

    # Save ontology
    g.serialize(destination=str(ontology_path), format='turtle')

    print(f"\n✓ Ontology updated successfully")
    print(f"  New version: {new_version}")
    print(f"  Modified: {today}")
    print(f"\nNote: All KGs will be rebuilt on next build with version {new_version}")

    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python update-ontology-version.py <major|minor|patch>")
        print()
        print("Examples:")
        print("  python update-ontology-version.py patch  # 1.0.0 → 1.0.1")
        print("  python update-ontology-version.py minor  # 1.0.0 → 1.1.0")
        print("  python update-ontology-version.py major  # 1.0.0 → 2.0.0")
        sys.exit(1)

    version_type = sys.argv[1].lower()

    if version_type not in ["major", "minor", "patch"]:
        print(f"ERROR: Invalid version type: {version_type}")
        print("  Must be 'major', 'minor', or 'patch'")
        sys.exit(1)

    success = update_ontology_version(version_type)

    sys.exit(0 if success else 1)
