#!/bin/bash

# Download the Nomic GGUF model
MODEL_URL="https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf"
MODEL_DIR="models"
MODEL_FILE="$MODEL_DIR/nomic-embed-text-v1.5.Q4_K_M.gguf"

echo "Creating models directory..."
mkdir -p "$MODEL_DIR"

echo "Downloading model from Hugging Face..."
echo "URL: $MODEL_URL"
echo "Destination: $MODEL_FILE"

# Try curl first
if command -v curl &> /dev/null; then
    echo "Using curl..."
    curl -L -o "$MODEL_FILE" "$MODEL_URL"
elif command -v wget &> /dev/null; then
    echo "Using wget..."
    wget -O "$MODEL_FILE" "$MODEL_URL"
else
    echo "Error: Neither curl nor wget found!"
    exit 1
fi

# Check if download was successful
if [ -f "$MODEL_FILE" ]; then
    SIZE=$(du -h "$MODEL_FILE" | cut -f1)
    echo "✅ Download complete! File size: $SIZE"
else
    echo "❌ Download failed!"
    exit 1
fi