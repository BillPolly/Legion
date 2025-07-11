#!/bin/bash

# jsEnvoy CLI - Advanced Features Examples

echo "=== jsEnvoy CLI Advanced Features ==="
echo ""

# 1. Command Aliases
echo "1. Using Command Aliases:"
echo "------------------------"

# First, create a config file with aliases
cat > .jsenvoy.json << EOF
{
  "aliases": {
    "calc": "calculator.calculator_evaluate --expression",
    "read": "file.file_reader --filePath",
    "write": "file.file_writer --filePath",
    "eval": "calculator.calculator_evaluate"
  }
}
EOF

echo "Using calc alias:"
jsenvoy calc "100 / 4"

echo -e "\nUsing nested expressions:"
jsenvoy calc "Math.PI * Math.pow(5, 2)"

# 2. Command Chaining
echo -e "\n\n2. Command Chaining:"
echo "--------------------"

echo "Chain with && (stop on error):"
jsenvoy calc "25 * 4" && echo "First command succeeded!"

echo -e "\nChain with ; (continue on error):"
jsenvoy file.file_reader --filePath "nonexistent.txt" ; echo "Continued despite error"

echo -e "\nPractical chaining example:"
jsenvoy calc "42 * 10" && jsenvoy write "result.txt" --content "The answer is 420"

# 3. Batch File Execution
echo -e "\n\n3. Batch File Execution:"
echo "------------------------"

# Create a batch file
cat > commands.jsenvoy << EOF
# This is a batch file for jsEnvoy
# Comments start with #

# Calculate some values
calculator.calculator_evaluate --expression "5 * 5"
calculator.calculator_evaluate --expression "10 + 15"

# Write results to a file
file.file_writer --filePath "batch_output.txt" --content "Batch execution complete!"

# Read the file we just created
file.file_reader --filePath "batch_output.txt"
EOF

echo "Executing batch file:"
jsenvoy --batch commands.jsenvoy

# 4. Environment Presets
echo -e "\n\n4. Environment Presets:"
echo "-----------------------"

# Update config with presets
cat > .jsenvoy.json << EOF
{
  "aliases": {
    "calc": "calculator.calculator_evaluate --expression"
  },
  "presets": {
    "dev": {
      "verbose": true,
      "output": "json"
    },
    "prod": {
      "verbose": false,
      "output": "text",
      "color": false
    }
  }
}
EOF

echo "Using development preset:"
jsenvoy --preset dev calc "1 + 1"

echo -e "\nUsing production preset:"
jsenvoy --preset prod calc "2 + 2"

# 5. JSON Arguments
echo -e "\n\n5. Using JSON Arguments:"
echo "------------------------"

echo "Complex file write with JSON:"
jsenvoy file.file_writer --json '{
  "filePath": "data.json",
  "content": "{\"name\": \"jsEnvoy\", \"version\": \"1.0.0\", \"features\": [\"modular\", \"extensible\", \"fast\"]}"
}'

echo -e "\nReading the JSON file:"
jsenvoy read "data.json"

# 6. Interactive Mode Features
echo -e "\n\n6. Interactive Mode Demo:"
echo "-------------------------"
echo "To try interactive mode, run: jsenvoy interactive"
echo ""
echo "Interactive mode features:"
echo "- Tab completion for modules and tools"
echo "- Command history (up/down arrows)"
echo "- Multi-line JSON input"
echo "- Context variables (set/show commands)"
echo "- Built-in help"

# Cleanup
rm -f .jsenvoy.json commands.jsenvoy result.txt batch_output.txt data.json

echo -e "\n\n=== Advanced Examples Complete ===\n"