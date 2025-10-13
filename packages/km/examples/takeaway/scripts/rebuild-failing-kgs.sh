#!/bin/bash
# Rebuild KGs for failing examples

EXAMPLES="10 12 13 15 16 18 19 23 24 25 26 27 28 29 30"

for ex in $EXAMPLES; do
  echo "=== Rebuilding Example $ex ==="
  uv run python scripts/build-kg-for-example.py $ex --force
  if [ $? -eq 0 ]; then
    echo "✓ Example $ex rebuilt successfully"
  else
    echo "✗ Example $ex FAILED"
  fi
  echo ""
done

echo "=== REBUILD COMPLETE ==="
