#!/bin/bash
# Rebuild all knowledge graphs with enriched value objects

cd "$(dirname "$0")/.."

echo "Rebuilding Knowledge Graphs with Self-Describing Values"
echo "========================================================"

for example_id in 111 112 114 115 116 117; do
    echo ""
    echo "Building KG for Example $example_id..."
    uv run python src/graph-solver/ontology_extractor.py $example_id

    if [ $? -eq 0 ]; then
        echo "✓ Example $example_id KG rebuilt successfully"
    else
        echo "✗ Example $example_id KG build failed"
    fi
done

echo ""
echo "========================================================"
echo "All KGs rebuilt!"
echo ""
