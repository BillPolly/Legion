# Interactive Mode Session Examples

This document demonstrates various features of jsEnvoy's interactive mode.

## Starting Interactive Mode

```bash
$ jsenvoy interactive

jsEnvoy Interactive Mode
Type "help" for commands, "exit" to quit

jsenvoy> 
```

## Basic Commands

```
jsenvoy> calc "42 * 10"
Result: 420

jsenvoy> list modules

Available Modules

name       | tools   | dependencies
-----------|---------|-------------
calculator | 1 tool  | none
file       | 3 tools | 4

jsenvoy> help calculator

Module: calculator
Tools:
  - calculator_evaluate: Evaluates a mathematical expression

jsenvoy> 
```

## Using Aliases

```
jsenvoy> calc "Math.sqrt(16)"
Result: 4

jsenvoy> ls modules
[Same as 'list modules' - ls is a built-in alias]
```

## Tab Completion

```
jsenvoy> cal[TAB]
calculator  calc

jsenvoy> calculator.[TAB]
calculator.calculator_evaluate

jsenvoy> calculator.calculator_evaluate --[TAB]
--expression  --json
```

## Multi-line Input

### JSON Input
```
jsenvoy> file.file_writer --json {
... "filePath": "test.json",
... "content": {
...   "message": "Hello from interactive mode",
...   "timestamp": "2024-01-01"
... }
... }
File written successfully

jsenvoy> 
```

### Multi-line Strings
```
jsenvoy> file.file_writer --filePath "poem.txt" --content """
... Roses are red,
... Violets are blue,
... jsEnvoy is awesome,
... And so are you!
... """
File written successfully
```

## Context Variables

```
jsenvoy> set baseDir "/home/user/data"
Set baseDir = /home/user/data

jsenvoy> set pi 3.14159
Set pi = 3.14159

jsenvoy> show
Context:
  baseDir: /home/user/data
  pi: 3.14159

jsenvoy> calc "pi * 2"
Result: 6.28318
```

## Command History

```
jsenvoy> calc "1 + 1"
Result: 2

jsenvoy> calc "2 + 2"
Result: 4

jsenvoy> [UP ARROW]
jsenvoy> calc "2 + 2"  # Previous command recalled

jsenvoy> [UP ARROW]
jsenvoy> calc "1 + 1"  # Command before that
```

## Error Handling with Suggestions

```
jsenvoy> calculater.evaluate --expression "2+2"
Error: Module not found: calculater
Did you mean: calculator?

jsenvoy> calculator.calculator_evaluat --expression "2+2"
Error: Tool not found: calculator.calculator_evaluat
Did you mean: calculator.calculator_evaluate?

jsenvoy> file.file_reader
Error: Missing required parameter: 'filePath'

Usage:
  jsenvoy file.file_reader --filePath <path>

Required parameters:
  * --filePath <string> - The path to the file to read

Example:
  jsenvoy file.file_reader --filePath "README.md"
```

## Special Commands

```
jsenvoy> help
jsEnvoy CLI - Help

Available commands:
  help                    Show this help message
  help <command>         Show help for a specific command
  help <module.tool>     Show help for a specific tool
  list                   List all modules and tools
  list modules           List available modules
  list tools            List all tools
  ...

jsenvoy> clear
[Screen clears]

jsenvoy> exit
Goodbye!
$
```

## Advanced Interactive Features

### Command Chaining in Interactive Mode
```
jsenvoy> calc "10 * 10" && write "result.txt" --content "100"
Result: 100
File written successfully
```

### Using Verbose Mode
```
jsenvoy> set verbose true
Set verbose = true

jsenvoy> calc "2 + 2"
[VERBOSE] Executing tool: calculator.calculator_evaluate
[VERBOSE] Arguments: { expression: '2 + 2' }
[VERBOSE] Tool execution time: 2ms
Result: 4
```

### Quick Module Exploration
```
jsenvoy> list tools file

Available Tools in 'file' module

name             | description
-----------------|------------------------------------------
file_reader      | Reads the contents of a file
file_writer      | Writes content to a file
directory_creator| Creates directories in the file system

jsenvoy> help file.file_writer

Tool: file.file_writer
Description: Writes content to a file in the file system

Parameters:
  * filePath (string) - The path where the file should be written
  * content (string) - The content to write to the file
  * append (boolean) - Whether to append to existing file (default: false)

Example:
  jsenvoy file.file_writer --filePath "output.txt" --content "Hello, World!"
```

## Tips and Tricks

1. **Quick Exit**: Use Ctrl+C or Ctrl+D instead of typing 'exit'
2. **Cancel Multi-line**: Type `.cancel` to cancel multi-line input
3. **Clear History**: History is limited to 100 commands automatically
4. **No Color**: Start with `jsenvoy interactive --no-color` for plain text
5. **Aliases Work**: All configured aliases work in interactive mode

## Interactive Mode Best Practices

1. Use `set` to store frequently used values
2. Use tab completion to explore available tools
3. Use `help` liberally - it's context-aware
4. Multi-line mode is great for complex JSON inputs
5. Command history persists only for the current session