#!/bin/bash

# jsEnvoy CLI - Basic Usage Examples

echo "=== jsEnvoy CLI Basic Examples ==="
echo ""

# 1. Calculator Module Examples
echo "1. Calculator Operations:"
echo "------------------------"

echo "Simple calculation:"
jsenvoy calculator.calculator_evaluate --expression "2 + 2"

echo -e "\nComplex calculation:"
jsenvoy calculator.calculator_evaluate --expression "Math.sqrt(144) + Math.pow(3, 3)"

echo -e "\nUsing the calc alias:"
jsenvoy calc "42 * 10"

# 2. File Module Examples  
echo -e "\n\n2. File Operations:"
echo "-------------------"

echo "Writing a file:"
jsenvoy file.file_writer --filePath "example.txt" --content "Hello from jsEnvoy!"

echo -e "\nReading a file:"
jsenvoy file.file_reader --filePath "example.txt"

echo -e "\nCreating a directory:"
jsenvoy file.directory_creator --directoryPath "example_dir" --recursive true

# 3. List Commands
echo -e "\n\n3. Listing Available Tools:"
echo "---------------------------"

echo "List all modules:"
jsenvoy list modules

echo -e "\nList all tools:"
jsenvoy list tools

# 4. Help System
echo -e "\n\n4. Getting Help:"
echo "----------------"

echo "General help:"
jsenvoy help

echo -e "\nTool-specific help:"
jsenvoy help calculator.calculator_evaluate

# 5. Output Formats
echo -e "\n\n5. Different Output Formats:"
echo "----------------------------"

echo "JSON output:"
jsenvoy --output json calculator.calculator_evaluate --expression "10 + 5"

echo -e "\nVerbose mode:"
jsenvoy --verbose list modules

# Cleanup
rm -f example.txt
rmdir example_dir 2>/dev/null

echo -e "\n\n=== Examples Complete ===\n"