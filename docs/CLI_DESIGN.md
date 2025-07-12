# @jsenvoy/cli Design Document

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Command Structure](#command-structure)
4. [Implementation Details](#implementation-details)
5. [Module Discovery](#module-discovery)
6. [Tool Execution](#tool-execution)
7. [Interactive Mode](#interactive-mode)
8. [Error Handling](#error-handling)
9. [Configuration](#configuration)
10. [Examples](#examples)
11. [Testing Strategy](#testing-strategy)
12. [Future Enhancements](#future-enhancements)

## Overview

@jsenvoy/cli is a package within the jsEnvoy monorepo that provides a generic command-line interface tool for dynamically discovering and executing tools from any module in the jsEnvoy ecosystem. As a separate package, it depends on @jsenvoy/core and leverages its ResourceManager and ModuleFactory infrastructure to provide a unified interface for all tools without requiring hard-coded tool references.

### Package Structure
This CLI package is part of the jsEnvoy monorepo:
```
jsEnvoy/
├── packages/
│   ├── core/     # @jsenvoy/core - Framework and modules
│   └── cli/      # @jsenvoy/cli - This package
└── package.json  # Monorepo root with workspaces

### Goals
- **Dynamic Tool Discovery**: Automatically discover all available modules and tools
- **Generic Execution**: Execute any tool without prior knowledge of its existence
- **Zero Configuration**: Work out-of-the-box with sensible defaults
- **Extensible**: Support new modules and tools without CLI modifications
- **User-Friendly**: Provide interactive mode and helpful error messages
- **Type-Safe**: Validate arguments against tool parameter definitions

### Non-Goals
- Tool-specific UI customization
- Complex workflow orchestration (use Agent for that)
- Direct LLM integration (tools are meant to be atomic operations)

## Installation

### As a Global Package

```bash
# From npm registry (when published)
npm install -g @jsenvoy/cli

# From monorepo (development)
npm install -g ./packages/cli
```

### As a Project Dependency

```bash
# Add to your project
npm install @jsenvoy/cli

# Run via npx
npx jsenvoy calculator.calculator_evaluate --expression "2 + 2"
```

### Development Setup

Within the jsEnvoy monorepo:

```bash
# Install all dependencies
npm install

# Link CLI for development
npm link ./packages/cli

# Run tests
npm run test:cli
```

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   CLI Entry     │
│  (bin/jsenvoy)  │
└────────┬────────┘
         │
┌────────▼────────┐
│   CLI Parser    │
│   (src/index)   │
└────────┬────────┘
         │
┌────────▼────────┐     ┌──────────────────┐
│ Module Loader   │────▶│ Module Discovery │
└────────┬────────┘     └──────────────────┘
         │
┌────────▼────────┐     ┌──────────────────┐
│ Tool Executor   │────▶│ ResourceManager  │
└────────┬────────┘     └──────────────────┘
         │
┌────────▼────────┐     ┌──────────────────┐
│ Result Handler  │────▶│ ModuleFactory    │
└─────────────────┘     └──────────────────┘
```

### Component Relationships

The CLI integrates with @jsenvoy/core infrastructure:

1. **ResourceManager** (from @jsenvoy/core): Manages dependencies required by modules
2. **ModuleFactory** (from @jsenvoy/core): Creates module instances with resolved dependencies
3. **Module** (from @jsenvoy/modules): Base class for all modules containing tools
4. **ModularTool** (from @jsenvoy/modules): Base class for individual tools with execute() method

The CLI package imports these components:
```javascript
const { ResourceManager, ModuleFactory } = require('@jsenvoy/core');
```

## Command Structure

### Basic Syntax

```bash
jsenvoy [options] <command> [arguments]
```

### Commands

#### Direct Tool Execution
```bash
jsenvoy <module>.<tool> [--arg1 value1] [--arg2 value2] ...
```

#### List Available Resources
```bash
jsenvoy list [modules|tools|all] [--module <module-name>]
```

#### Interactive Mode
```bash
jsenvoy interactive
jsenvoy -i
```

#### Help
```bash
jsenvoy help [command]
jsenvoy --help
jsenvoy -h
```

### Global Options

- `--config <path>`: Path to configuration file
- `--resources <path>`: Path to resources configuration
- `--modules-dir <path>`: Directory containing modules (default: node_modules/@jsenvoy/core/src/modules)
- `--verbose`: Enable verbose logging
- `--json`: Output results in JSON format
- `--no-color`: Disable colored output
- `--core-path <path>`: Override @jsenvoy/core location (for development)

## Implementation Details

### Directory Structure

```
packages/cli/
├── bin/
│   └── jsenvoy            # Executable entry point
├── src/
│   ├── index.js           # Main CLI class
│   ├── parser.js          # Command line parser
│   ├── loader.js          # Module loader
│   ├── executor.js        # Tool executor
│   ├── interactive.js     # Interactive mode
│   ├── formatter.js       # Output formatter
│   └── config.js          # Configuration loader
├── __tests__/             # Test files
├── docs/                  # Package documentation
└── package.json           # Package dependencies
```

### Core Components

#### 1. CLI Entry Point (`src/index.js`)

```javascript
const { ResourceManager, ModuleFactory } = require('@jsenvoy/core');

class CLI {
  constructor(options = {}) {
    this.modulesDir = options.modulesDir || this.getDefaultModulesDir();
    this.resourceManager = new ResourceManager();
    this.moduleFactory = new ModuleFactory(this.resourceManager);
    this.modules = new Map();
  }

  getDefaultModulesDir() {
    // Resolve @jsenvoy/core modules directory
    try {
      const corePath = require.resolve('@jsenvoy/core');
      return path.join(path.dirname(corePath), 'modules');
    } catch (e) {
      // Fallback for development
      return path.join(__dirname, '../../core/src/modules');
    }
  }

  async run(argv) {
    const { command, args, options } = this.parseArguments(argv);
    
    switch (command) {
      case 'list':
        return this.listCommand(args, options);
      case 'interactive':
        return this.interactiveMode();
      case 'help':
        return this.showHelp(args[0]);
      default:
        return this.executeTool(command, args, options);
    }
  }
}
```

#### 2. Module Loader (`src/loader.js`)

```javascript
class ModuleLoader {
  async loadModules(directory) {
    const modules = new Map();
    const files = await fs.readdir(directory);
    
    for (const file of files) {
      if (file.endsWith('Module.js')) {
        const ModuleClass = require(path.join(directory, file));
        const moduleName = this.extractModuleName(ModuleClass);
        modules.set(moduleName, ModuleClass);
      }
    }
    
    return modules;
  }

  async createModuleInstance(ModuleClass, resourceManager, moduleFactory) {
    // Load module-specific configuration
    const config = await this.loadModuleConfig(ModuleClass.name);
    
    // Register required resources
    for (const [key, value] of Object.entries(config.resources || {})) {
      resourceManager.register(key, value);
    }
    
    // Create module instance
    return moduleFactory.createModule(ModuleClass);
  }
}
```

#### 3. Tool Executor (`src/executor.js`)

```javascript
class ToolExecutor {
  async execute(moduleName, toolName, args) {
    // Get module instance
    const module = this.modules.get(moduleName);
    if (!module) {
      throw new Error(`Module '${moduleName}' not found`);
    }
    
    // Find tool
    const tool = module.getTools().find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in module '${moduleName}'`);
    }
    
    // Validate arguments
    const validatedArgs = this.validateArguments(args, tool.parameters);
    
    // Execute tool
    const result = await tool.execute(validatedArgs);
    
    return result;
  }

  validateArguments(args, parameters) {
    // Validate against function parameters schema
    const schema = parameters.properties || {};
    const required = parameters.required || [];
    const validated = {};
    
    // Check required parameters
    for (const param of required) {
      if (!(param in args)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
    
    // Validate and convert types
    for (const [key, value] of Object.entries(args)) {
      if (key in schema) {
        validated[key] = this.convertType(value, schema[key].type);
      }
    }
    
    return validated;
  }
}
```

## Module Discovery

### Discovery Process

1. **Scan Module Directory**: Read all files ending with `Module.js`
2. **Load Module Classes**: Dynamically require each module file
3. **Extract Metadata**: Get module name and dependencies
4. **Cache Results**: Store module metadata for quick access

### Module Registration

```javascript
// Automatic discovery from @jsenvoy/core
const modules = await moduleLoader.discoverModules();

// Discovery from custom location
const customModules = await moduleLoader.discoverModules('./my-modules');

// Manual registration
cli.registerModule('custom', CustomModule);
```

### Module Configuration

Each module can have an optional configuration file. The CLI will look for these in:
1. The same directory as the module
2. A `.jsenvoy/modules/` directory in the project root
3. The CLI's configuration directory

```
@jsenvoy/core/src/modules/
├── FileModule.js
└── CalculatorModule.js

project-root/.jsenvoy/modules/
├── FileModule.config.json
└── CalculatorModule.config.json
```

Example `FileModule.config.json`:
```json
{
  "resources": {
    "basePath": "./data",
    "encoding": "utf8",
    "createDirectories": true,
    "permissions": 0o755
  },
  "enabled": true,
  "description": "File system operations"
}
```

## Tool Execution

### Execution Flow

1. **Parse Command**: Extract module.tool syntax
2. **Load Module**: Create module instance if not cached
3. **Find Tool**: Locate tool within module
4. **Parse Arguments**: Convert CLI arguments to tool parameters
5. **Validate**: Check against tool's parameter schema
6. **Execute**: Call tool.execute() with validated arguments
7. **Format Output**: Display results based on output options

### Argument Parsing

Arguments can be provided in multiple formats:

```bash
# Named arguments (preferred)
jsenvoy file.file_reader --filePath ./readme.md --encoding utf8

# JSON argument
jsenvoy calculator.calculator_evaluate --json '{"expression": "2 + 2"}'

# Positional arguments (if tool defines them)
jsenvoy file.file_reader ./readme.md
```

### Output Formatting

Results are formatted based on options:

```javascript
class OutputFormatter {
  format(result, options) {
    if (options.json) {
      return JSON.stringify(result, null, 2);
    }
    
    if (typeof result === 'string') {
      return result;
    }
    
    if (result.error) {
      return this.formatError(result.error);
    }
    
    return this.formatObject(result);
  }
}
```

## Interactive Mode

### Features

1. **Command Autocomplete**: Tab completion for modules and tools
2. **Context Preservation**: Maintain state between commands
3. **History**: Command history with arrow key navigation
4. **Help Integration**: Inline help for tools and parameters
5. **Multi-line Input**: Support for complex JSON arguments

### Interactive Commands

```
jsenvoy> help
Available commands:
  list modules              - List all available modules
  list tools <module>       - List tools in a module
  describe <module.tool>    - Show tool description and parameters
  execute <module.tool>     - Execute a tool
  set <option> <value>      - Set session option
  history                   - Show command history
  clear                     - Clear screen
  exit                      - Exit interactive mode

jsenvoy> list modules
Available modules:
  - calculator: Mathematical calculations
  - file: File system operations
  - github: GitHub repository management

jsenvoy> describe file.file_reader
file.file_reader - Read contents of a file
Parameters:
  - filePath (string, required): Path to the file
  - encoding (string, optional): File encoding (default: utf8)

jsenvoy> execute file.file_reader --filePath ./README.md
[File contents displayed here]
```

## Error Handling

### Error Types

1. **Module Errors**
   - Module not found
   - Module loading failure
   - Missing dependencies

2. **Tool Errors**
   - Tool not found
   - Invalid parameters
   - Execution failure

3. **System Errors**
   - File system errors
   - Network errors
   - Configuration errors

### Error Messages

```javascript
class ErrorHandler {
  handle(error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error(`Module '${error.module}' not found.`);
      console.error('Available modules:', this.listModules());
      process.exit(1);
    }
    
    if (error.code === 'TOOL_NOT_FOUND') {
      console.error(`Tool '${error.tool}' not found in module '${error.module}'.`);
      const suggestions = this.suggestTools(error.tool, error.module);
      if (suggestions.length > 0) {
        console.error('Did you mean:', suggestions.join(', '));
      }
      process.exit(1);
    }
    
    // Generic error
    console.error('Error:', error.message);
    if (this.options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
```

## Configuration

### Configuration File

Configuration can be placed in (in order of precedence):
1. `.jsenvoy.json` or `jsenvoy.config.js` in current directory
2. `~/.jsenvoy/config.json` (user home directory)
3. Default configuration

`.jsenvoy.json` or `jsenvoy.config.js`:

```json
{
  "modulesDir": "node_modules/@jsenvoy/core/src/modules",
  "resources": {
    "basePath": "./data",
    "apiKey": "${OPENAI_API_KEY}",
    "database": {
      "host": "localhost",
      "port": 5432
    }
  },
  "cli": {
    "colors": true,
    "interactive": {
      "prompt": "jsenvoy> ",
      "historySize": 100
    }
  },
  "modules": {
    "file": {
      "resources": {
        "basePath": "./project-data"
      }
    }
  }
}
```

### Environment Variables

```bash
JSENVOY_MODULES_DIR=./custom/modules
JSENVOY_CONFIG=./custom-config.json
JSENVOY_VERBOSE=true
JSENVOY_CORE_PATH=/path/to/local/core  # For development
```

### Resource Configuration

Resources can be configured at multiple levels:

1. **Global**: In main configuration file
2. **Module**: In module-specific configuration
3. **Runtime**: Via CLI arguments
4. **Environment**: Via environment variables

Priority: Runtime > Environment > Module > Global

## Examples

### Basic Usage

```bash
# Calculate an expression
jsenvoy calculator.calculator_evaluate --expression "25 * 4 + 10"

# Read a file
jsenvoy file.file_reader --filePath ./package.json

# Write a file
jsenvoy file.file_writer --filePath ./output.txt --content "Hello, World!"

# Create a directory
jsenvoy file.directory_creator --directoryPath ./new-folder
```

### GitHub Integration

```bash
# Create and push repository
jsenvoy github.github_create_and_push \
  --repoName "my-awesome-project" \
  --description "A new project" \
  --private false

# Just create a repository
jsenvoy github.github_create_repo \
  --repoName "another-project" \
  --description "Another project" \
  --private true

# Push existing repository
jsenvoy github.github_push_to_repo \
  --repoUrl "https://github.com/user/repo.git" \
  --branch "main"
```

### Using JSON Arguments

```bash
# Complex arguments as JSON
jsenvoy file.file_writer --json '{
  "filePath": "./data.json",
  "content": {"name": "test", "value": 123}
}'
```

### Interactive Mode

```bash
$ jsenvoy -i
jsenvoy> list modules
Available modules:
  - calculator
  - file
  - github

jsenvoy> list tools file
Tools in 'file' module:
  - file_reader: Read contents of a file
  - file_writer: Write content to a file
  - directory_creator: Create a directory

jsenvoy> execute file.file_reader
? filePath: ./README.md
[README contents displayed]

jsenvoy> set output json
Output format set to: json

jsenvoy> execute calculator.calculator_evaluate --expression "100 / 4"
{
  "result": 25,
  "expression": "100 / 4"
}
```

## Testing Strategy

Tests are located in `packages/cli/__tests__/` and follow the same structure as the source code.

### Running Tests

```bash
# From monorepo root
npm run test:cli

# From CLI package directory
cd packages/cli && npm test

# With coverage
npm run test:coverage
```

### Unit Tests

```javascript
// Test module discovery
describe('ModuleLoader', () => {
  it('should discover modules from @jsenvoy/core', async () => {
    const loader = new ModuleLoader();
    const modules = await loader.discoverModules();
    expect(modules.has('calculator')).toBe(true);
    expect(modules.has('file')).toBe(true);
  });
  
  it('should discover modules from custom directory', async () => {
    const modules = await loader.discoverModules('./test/fixtures/modules');
    expect(modules.size).toBeGreaterThan(0);
  });
});

// Test argument parsing
describe('ArgumentParser', () => {
  it('should parse named arguments', () => {
    const args = parser.parse(['--name', 'value', '--flag']);
    expect(args).toEqual({ name: 'value', flag: true });
  });
});

// Test tool execution
describe('ToolExecutor', () => {
  it('should execute tool with valid arguments', async () => {
    const result = await executor.execute('calculator', 'evaluate', {
      expression: '2 + 2'
    });
    expect(result).toBe(4);
  });
});
```

### Integration Tests

```javascript
describe('CLI Integration', () => {
  it('should execute tool via command line', async () => {
    const result = await cli.run([
      'calculator.calculator_evaluate',
      '--expression', '10 * 5'
    ]);
    expect(result).toBe(50);
  });

  it('should handle module not found', async () => {
    await expect(cli.run(['unknown.tool'])).rejects.toThrow('Module not found');
  });
});
```

### E2E Tests

```bash
# Test script
#!/bin/bash

# Test basic execution
jsenvoy calculator.calculator_evaluate --expression "2 + 2" | grep "4"

# Test file operations
echo "test content" > test.txt
jsenvoy file.file_reader --filePath ./test.txt | grep "test content"
rm test.txt

# Test error handling
jsenvoy nonexistent.tool 2>&1 | grep "Module 'nonexistent' not found"
```

## Future Enhancements

### 1. Plugin System
- Allow third-party modules to be installed via npm
- Module registry for discovering community modules
- Version management for modules

### 2. Advanced Features
- **Piping**: Chain tool outputs to inputs
- **Scripting**: Execute jsenvoy scripts (.jse files)
- **Profiles**: Save common command configurations
- **Aliases**: Create shortcuts for common commands

### 3. Tool Composition
```bash
# Pipe output from one tool to another
jsenvoy file.file_reader --filePath ./data.json | jsenvoy calculator.calculator_evaluate --expression "$.value * 2"

# Batch operations
jsenvoy batch --file ./operations.txt
```

### 4. Remote Execution
- Execute tools on remote jsEnvoy instances
- Distributed tool execution
- Result aggregation

### 5. GUI Integration
- Web-based interface for tool execution
- Visual tool builder
- Result visualization

### 6. Enhanced Interactive Mode
- Syntax highlighting
- Code completion for parameters
- Interactive parameter builders
- Result inspection tools

### 7. Performance Optimizations
- Module lazy loading
- Tool result caching
- Parallel execution support
- Connection pooling for resources

### 8. Security Features
- Tool execution sandboxing
- Resource access controls
- Audit logging
- Rate limiting

## Conclusion

The jsEnvoy CLI provides a powerful, extensible interface for executing tools from any module in the ecosystem. By leveraging the existing ResourceManager and ModuleFactory infrastructure, it maintains consistency with the core architecture while providing a user-friendly command-line experience.

The design prioritizes:
- **Simplicity**: Easy to use for basic operations
- **Flexibility**: Supports complex configurations and workflows
- **Extensibility**: New modules and tools work automatically
- **Maintainability**: Clear separation of concerns and testable components

This CLI tool transforms jsEnvoy from a programmatic framework into a practical command-line utility that can be used for automation, scripting, and interactive exploration of available tools.