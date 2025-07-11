# Changelog

All notable changes to @jsenvoy/cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of @jsenvoy/cli
- Dynamic module and tool discovery from @jsenvoy/core
- Multiple configuration sources with precedence (CLI args > env vars > config files)
- Interactive REPL mode with autocomplete and multi-line input
- Command aliases and chaining support
- Batch file execution for running multiple commands
- Comprehensive help system with fuzzy matching
- Multiple output formats (text, JSON, colored output)
- Performance optimizations with module and tool caching
- Environment presets for different deployment scenarios
- Detailed error messages with suggestions
- Full test coverage (~96%) with 313+ tests

### Features
- **Module System**: Automatically discovers and loads modules from @jsenvoy/core
- **Tool Execution**: Validates parameters and executes tools with proper error handling
- **Configuration**: Supports JSON config files, environment variables, and runtime options
- **Interactive Mode**: Full REPL with history, autocomplete, and context variables
- **Help System**: Context-aware help with examples and parameter documentation
- **Output Formats**: Flexible output formatting including tables, JSON, and colored text
- **Performance**: Lazy loading, caching, and streaming for optimal performance
- **Developer Experience**: Clear error messages, suggestions, and comprehensive documentation

## [0.0.1] - 2024-01-11

### Added
- Initial implementation with core features
- TDD approach with tests written first
- Integration with @jsenvoy/core modules
- Monorepo structure support