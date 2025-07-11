# @jsenvoy/cli

The official command-line interface for jsEnvoy - a modular, extensible JavaScript environment for tool execution.

## Features

- **Dynamic Module Discovery**: Automatically discovers and loads modules from @jsenvoy/core
- **Zero Configuration**: Works out-of-the-box with sensible defaults
- **Interactive Mode**: REPL with autocomplete, multi-line input, and context preservation
- **Flexible Arguments**: Support for named args, JSON, boolean flags, and positional parameters
- **Advanced Features**: Command aliases, chaining, batch execution, and environment presets
- **Comprehensive Help**: Context-aware help with examples and suggestions
- **High Performance**: Optimized for fast startup (< 150ms) and execution
- **Error Recovery**: Helpful error messages with fuzzy matching suggestions
- **Module Agnostic**: Works with any module following jsEnvoy patterns

## Installation

```bash
npm install -g @jsenvoy/cli
```

## Quick Start

```bash
# Execute a tool
jsenvoy calculator.calculator_evaluate --expression "42 * 10"

# List available modules
jsenvoy list modules

# Get help
jsenvoy help

# Start interactive mode
jsenvoy interactive
```

## Command Structure

```
jsenvoy [global-options] <command> [arguments]
```

### Global Options

- `--verbose` - Enable verbose output
- `--output <format>` - Output format: text (default) or json
- `--no-color` - Disable colored output
- `--config <path>` - Path to configuration file
- `--preset <name>` - Load environment preset
- `--batch <file>` - Execute commands from batch file

### Basic Commands

#### Execute Tool
```bash
jsenvoy <module>.<tool> [options]
```

Examples:
```bash
# Calculator operations
jsenvoy calculator.calculator_evaluate --expression "Math.sqrt(16) + Math.pow(2, 3)"

# File operations
jsenvoy file.file_reader --filePath ./README.md
jsenvoy file.file_writer --filePath ./output.txt --content "Hello, World!"

# Using JSON arguments
jsenvoy file.file_writer --json '{"filePath": "data.json", "content": {"key": "value"}}'
```

#### List Commands
```bash
# List all modules and tools
jsenvoy list

# List only modules
jsenvoy list modules

# List only tools
jsenvoy list tools

# List aliases
jsenvoy list aliases

# List presets
jsenvoy list presets
```

#### Help Command
```bash
# General help
jsenvoy help

# Command help
jsenvoy help list

# Tool help
jsenvoy help calculator.calculator_evaluate
```

#### Interactive Mode
```bash
# Start interactive mode
jsenvoy interactive
# or
jsenvoy i
# or
jsenvoy -i
```

## Documentation

- [Design Document](docs/CLI_DESIGN.md) - Comprehensive design and architecture
- [Implementation Plan](docs/CLI_IMPLEMENTATION_PLAN.md) - TDD implementation roadmap

## Configuration

jsEnvoy supports configuration through multiple sources (in order of precedence):

1. Command-line arguments
2. Environment variables (`JSENVOY_*`)
3. Configuration files (`.jsenvoy.json`, `jsenvoy.config.js`)
4. Default values

### Configuration File Example

`.jsenvoy.json`:
```json
{
  "verbose": false,
  "output": "text",
  "color": true,
  "resources": {
    "API_KEY": "${JSENVOY_API_KEY}",
    "basePath": "/home/user/data",
    "encoding": "utf8"
  },
  "modules": {
    "file": {
      "createDirectories": true,
      "permissions": 755
    }
  },
  "aliases": {
    "calc": "calculator.calculator_evaluate --expression",
    "read": "file.file_reader --filePath",
    "write": "file.file_writer --filePath"
  },
  "presets": {
    "dev": {
      "verbose": true,
      "output": "json",
      "resources": {
        "API_URL": "http://localhost:3000"
      }
    },
    "prod": {
      "verbose": false,
      "output": "text",
      "resources": {
        "API_URL": "https://api.example.com"
      }
    }
  }
}
```

## Advanced Features

### Command Aliases

Create shortcuts for frequently used commands:

```bash
# Using aliases
jsenvoy calc "2 + 2"
# Expands to: jsenvoy calculator.calculator_evaluate --expression "2 + 2"

jsenvoy read "config.json"
# Expands to: jsenvoy file.file_reader --filePath "config.json"
```

### Command Chaining

Execute multiple commands in sequence:

```bash
# Stop on error (&&)
jsenvoy calc --expression "10*10" && jsenvoy write "result.txt" --content "100"

# Continue on error (;)
jsenvoy read "input.txt" ; jsenvoy calc --expression "42"
```

### Batch Execution

Execute commands from a file:

```bash
jsenvoy --batch commands.jsenvoy
```

`commands.jsenvoy`:
```bash
# Calculate values
calculator.calculator_evaluate --expression "5 * 5"
calculator.calculator_evaluate --expression "10 + 15"

# File operations
file.file_writer --filePath "output.txt" --content "Results saved"
```

### Environment Presets

Use environment-specific configurations:

```bash
# Use development preset
jsenvoy --preset dev list modules

# Use production preset
jsenvoy --preset prod calc "42"
```

## Interactive Mode

The interactive mode provides a REPL environment with:

- **Autocomplete**: Tab completion for modules, tools, and parameters
- **Multi-line Input**: Support for JSON and multi-line strings
- **Command History**: Navigate with up/down arrows (limited to 100 entries)
- **Context Variables**: Set and use variables within the session
- **Special Commands**:
  - `help` - Show help
  - `clear` or `cls` - Clear screen
  - `exit`, `quit`, or `.exit` - Exit interactive mode
  - `set <var> <value>` - Set context variable
  - `show` - Show current context

Example session:
```
jsenvoy> calc "42 * 10"
Result: 420

jsenvoy> set baseValue 100
Set baseValue = 100

jsenvoy> list modules
Available Modules
...

jsenvoy> exit
Goodbye!
```

## Error Handling

jsEnvoy provides helpful error messages with suggestions:

```bash
# Typo in module name
jsenvoy calculater.evaluate --expression "2+2"
Error: Module not found: calculater
Did you mean: calculator?

# Missing required parameter
jsenvoy file.file_reader
Error: Missing required parameter: 'filePath'

Usage:
  jsenvoy file.file_reader --filePath <path>

Example:
  jsenvoy file.file_reader --filePath "README.md"
```

## Performance

jsEnvoy CLI is optimized for performance:

- **Fast Startup**: < 150ms for simple commands
- **Efficient Module Loading**: < 100ms with caching
- **Quick Command Parsing**: < 0.1ms for simple, < 1ms for complex commands
- **Memory Efficient**: No memory leaks, limited history in interactive mode
- **Large Output Handling**: Efficiently handles MB-sized outputs

## Development

This package is part of the jsEnvoy monorepo.

### Running Tests

```bash
# From monorepo root
npm run test:cli

# Run specific test
npm run test:cli -- __tests__/cli.test.js

# Run with coverage
npm run test:cli -- --coverage
```

### Test Statistics

- **Tests**: 299+ passing
- **Coverage**: ~96%
- **Test Files**: 22 comprehensive test suites

### Project Structure

```
packages/cli/
├── bin/
│   └── jsenvoy          # Executable entry point
├── src/
│   └── index.js         # Main CLI implementation (2450+ lines)
├── __tests__/           # Comprehensive test suite
│   ├── cli.test.js
│   ├── argument-parser.test.js
│   ├── module-loader.test.js
│   ├── configuration.test.js
│   ├── tool-executor.test.js
│   ├── interactive-mode.test.js
│   ├── error-handling.test.js
│   ├── advanced-features.test.js
│   ├── core-integration.test.js
│   ├── performance.test.js
│   └── ... (22 test files)
├── docs/
│   ├── CLI_DESIGN.md
│   └── CLI_IMPLEMENTATION_PLAN.md
└── package.json
```

## Available Core Modules

- **calculator**: Mathematical expression evaluation
  - `calculator_evaluate`: Evaluate mathematical expressions

- **file**: File system operations
  - `file_reader`: Read file contents
  - `file_writer`: Write content to files
  - `directory_creator`: Create directories

## API Integration

jsEnvoy CLI automatically discovers and integrates modules from @jsenvoy/core. Each module can:

- Expose multiple tools
- Define dependencies (resolved via ResourceManager)
- Specify parameter schemas for validation
- Provide descriptions and examples

## Contributing

Contributions are welcome! Please:

1. Follow the TDD approach outlined in the implementation plan
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## License

See the root repository for license information.