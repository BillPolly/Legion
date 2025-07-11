# @jsenvoy/cli

A generic command-line interface for jsEnvoy that dynamically discovers and executes tools from any module.

## Features

- **Dynamic Discovery**: Automatically finds all available modules and tools
- **Zero Configuration**: Works out-of-the-box with sensible defaults
- **Interactive Mode**: REPL with autocomplete and context preservation
- **Flexible Arguments**: Support for named args, JSON, and positional parameters
- **Module Agnostic**: Works with any module following jsEnvoy patterns

## Installation

```bash
npm install -g @jsenvoy/cli
```

## Usage

### Basic Commands

```bash
# Execute a tool
jsenvoy calculator.calculator_evaluate --expression "2 + 2"

# List available modules
jsenvoy list modules

# List tools in a module
jsenvoy list tools calculator

# Interactive mode
jsenvoy -i
```

### Examples

```bash
# File operations
jsenvoy file.file_reader --filePath ./README.md
jsenvoy file.file_writer --filePath ./output.txt --content "Hello, World!"

# GitHub operations
jsenvoy github.github_create_and_push --repoName "my-project" --description "New project"

# Using JSON arguments
jsenvoy file.file_writer --json '{"filePath": "data.json", "content": {"key": "value"}}'
```

## Documentation

- [Design Document](docs/CLI_DESIGN.md) - Comprehensive design and architecture
- [Implementation Plan](docs/CLI_IMPLEMENTATION_PLAN.md) - TDD implementation roadmap

## Configuration

Create a `.jsenvoy.json` file in your project root:

```json
{
  "modulesDir": "./src/modules",
  "resources": {
    "basePath": "./data",
    "apiKey": "${OPENAI_API_KEY}"
  }
}
```

## Development

This package is part of the jsEnvoy monorepo. See the root README for development instructions.