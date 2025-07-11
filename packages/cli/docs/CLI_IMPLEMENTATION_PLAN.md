# @jsenvoy/cli Implementation Plan (TDD)

## Overview
This document outlines a Test-Driven Development (TDD) implementation plan for @jsenvoy/cli package within the jsEnvoy monorepo. Each phase includes specific steps with checkboxes to track progress. Tests are written first, followed by implementation to make them pass.

### Package Context
The CLI is developed as a package in the jsEnvoy monorepo:
- **Location**: `packages/cli/`
- **Dependencies**: `@jsenvoy/core` (from `packages/core/`)
- **Testing**: Run with `npm run test:cli` from monorepo root

### Development Workflow

#### Initial Setup
```bash
# Clone and install monorepo
git clone <repository>
cd jsEnvoy
npm install  # Installs all workspace dependencies
```

#### Development Commands
```bash
# From monorepo root
npm run test:cli          # Run CLI tests
npm run test:core         # Run core tests
npm test                  # Run all tests

# From CLI package directory
cd packages/cli
npm test                  # Run CLI tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

#### Working with @jsenvoy/core
- Changes to core are immediately available to CLI (no need to publish)
- Use relative imports during development if needed
- The CLI will automatically resolve @jsenvoy/core from the workspace

## Phase 1: Project Setup and Core Structure
### Objectives
- Set up CLI package structure within monorepo
- Create basic entry points
- Configure testing environment
- Establish @jsenvoy/core dependency

### Steps
- [x] Create CLI package directory structure (`packages/cli/`)
- [x] Set up package.json with @jsenvoy/core dependency
- [x] Create bin/jsenvoy executable
- [ ] Write test for CLI class initialization
- [ ] Implement basic CLI class in src/index.js
- [ ] Write test for @jsenvoy/core imports
- [ ] Verify ResourceManager and ModuleFactory imports work
- [ ] Write test for executable file
- [ ] Set up Jest configuration to work with monorepo

## Phase 2: Argument Parser
### Objectives
- Parse command-line arguments
- Support various argument formats
- Handle global options

### Steps
- [ ] Write test for basic command parsing (module.tool format)
- [ ] Implement command parser to handle module.tool syntax
- [ ] Write test for named arguments (--key value)
- [ ] Implement named argument parsing
- [ ] Write test for boolean flags (--verbose)
- [ ] Implement boolean flag parsing
- [ ] Write test for JSON arguments (--json '{...}')
- [ ] Implement JSON argument parsing
- [ ] Write test for global options (--config, --verbose, etc.)
- [ ] Implement global option handling
- [ ] Write test for command validation
- [ ] Implement command validation logic
- [ ] Write test for help command detection
- [ ] Implement help command handling

## Phase 3: Module Loader
### Objectives
- Discover modules from @jsenvoy/core
- Support custom module directories
- Load module classes dynamically
- Cache loaded modules

### Steps
- [ ] Write test for @jsenvoy/core module discovery
- [ ] Implement core module path resolution
- [ ] Write test for module directory scanning
- [ ] Implement directory scanner
- [ ] Write test for module file filtering (*Module.js)
- [ ] Implement module file filter
- [ ] Write test for module class loading from node_modules
- [ ] Implement dynamic require for @jsenvoy/core modules
- [ ] Write test for custom module directory support
- [ ] Implement custom directory loading
- [ ] Write test for module name extraction
- [ ] Implement module name extraction logic
- [ ] Write test for module caching
- [ ] Implement module cache
- [ ] Write test for invalid module handling
- [ ] Implement error handling for invalid modules
- [ ] Write test for module metadata extraction
- [ ] Implement metadata extraction

## Phase 4: Configuration System
### Objectives
- Load configuration from multiple sources
- Support environment variables
- Merge configurations with proper precedence

### Steps
- [ ] Write test for default configuration
- [ ] Implement default configuration
- [ ] Write test for file-based configuration (.jsenvoy.json)
- [ ] Implement configuration file loader
- [ ] Write test for JavaScript configuration (jsenvoy.config.js)
- [ ] Implement JS config support
- [ ] Write test for environment variable support
- [ ] Implement environment variable parsing
- [ ] Write test for configuration merging precedence
- [ ] Implement configuration merger
- [ ] Write test for module-specific configuration
- [ ] Implement module config loading
- [ ] Write test for runtime configuration override
- [ ] Implement runtime config support

## Phase 5: Resource Management Integration
### Objectives
- Integrate with @jsenvoy/core ResourceManager
- Load and register resources from configuration
- Support module-specific resources

### Steps
- [ ] Write test for importing ResourceManager from @jsenvoy/core
- [ ] Import and use ResourceManager from core package
- [ ] Write test for ResourceManager initialization
- [ ] Implement ResourceManager creation in CLI
- [ ] Write test for resource registration from config
- [ ] Implement resource registration
- [ ] Write test for environment variable substitution
- [ ] Implement variable substitution (${VAR})
- [ ] Write test for module-specific resource loading
- [ ] Implement module resource loader
- [ ] Write test for resource validation
- [ ] Implement resource validation
- [ ] Write test for missing resource handling
- [ ] Implement missing resource errors

## Phase 6: Module Factory Integration
### Objectives
- Create module instances using @jsenvoy/core ModuleFactory
- Handle dependency injection
- Cache module instances

### Steps
- [ ] Write test for importing ModuleFactory from @jsenvoy/core
- [ ] Import and use ModuleFactory from core package
- [ ] Write test for ModuleFactory initialization
- [ ] Implement ModuleFactory creation
- [ ] Write test for module instantiation
- [ ] Implement module creation via factory
- [ ] Write test for dependency resolution
- [ ] Implement dependency injection
- [ ] Write test for module instance caching
- [ ] Implement module instance cache
- [ ] Write test for failed module creation
- [ ] Implement error handling
- [ ] Write test for module lifecycle
- [ ] Implement module lifecycle management

## Phase 7: Tool Discovery and Metadata
### Objectives
- Discover tools within modules
- Extract tool metadata
- Build tool registry

### Steps
- [ ] Write test for tool discovery in module
- [ ] Implement tool discovery
- [ ] Write test for tool metadata extraction
- [ ] Implement metadata extraction
- [ ] Write test for tool registry building
- [ ] Implement tool registry
- [ ] Write test for tool name uniqueness
- [ ] Implement uniqueness validation
- [ ] Write test for tool parameter schema extraction
- [ ] Implement schema extraction
- [ ] Write test for tool description formatting
- [ ] Implement description formatter

## Phase 8: Tool Executor
### Objectives
- Execute tools with validated arguments
- Handle tool responses
- Format output appropriately

### Steps
- [ ] Write test for tool lookup by name
- [ ] Implement tool lookup
- [ ] Write test for argument validation against schema
- [ ] Implement schema validation
- [ ] Write test for required parameter checking
- [ ] Implement required parameter validation
- [ ] Write test for type conversion (string to number, etc.)
- [ ] Implement type converter
- [ ] Write test for tool execution
- [ ] Implement tool executor
- [ ] Write test for async tool execution
- [ ] Implement async execution handling
- [ ] Write test for tool error handling
- [ ] Implement error handling
- [ ] Write test for execution timeout
- [ ] Implement timeout mechanism

## Phase 9: Output Formatter
### Objectives
- Format tool outputs for display
- Support multiple output formats
- Handle different data types

### Steps
- [ ] Write test for string output formatting
- [ ] Implement string formatter
- [ ] Write test for object output formatting
- [ ] Implement object formatter
- [ ] Write test for array output formatting
- [ ] Implement array formatter
- [ ] Write test for JSON output mode
- [ ] Implement JSON formatter
- [ ] Write test for error formatting
- [ ] Implement error formatter
- [ ] Write test for colored output
- [ ] Implement color support
- [ ] Write test for no-color mode
- [ ] Implement no-color option
- [ ] Write test for verbose output mode
- [ ] Implement verbose formatter

## Phase 10: List Commands
### Objectives
- List available modules
- List tools within modules
- Show detailed information

### Steps
- [ ] Write test for 'list modules' command
- [ ] Implement module listing
- [ ] Write test for 'list tools' command
- [ ] Implement tool listing
- [ ] Write test for 'list all' command
- [ ] Implement comprehensive listing
- [ ] Write test for module filtering
- [ ] Implement module filter
- [ ] Write test for tool description display
- [ ] Implement description display
- [ ] Write test for parameter documentation
- [ ] Implement parameter docs

## Phase 11: Help System
### Objectives
- Provide contextual help
- Show usage examples
- Display parameter information

### Steps
- [ ] Write test for general help command
- [ ] Implement general help
- [ ] Write test for command-specific help
- [ ] Implement command help
- [ ] Write test for tool-specific help
- [ ] Implement tool help
- [ ] Write test for parameter documentation
- [ ] Implement parameter help
- [ ] Write test for example generation
- [ ] Implement example generator
- [ ] Write test for error suggestions
- [ ] Implement suggestion system

## Phase 12: Interactive Mode Foundation
### Objectives
- Create REPL infrastructure
- Handle interactive commands
- Maintain session state

### Steps
- [ ] Write test for REPL initialization
- [ ] Implement basic REPL
- [ ] Write test for command parsing in interactive mode
- [ ] Implement interactive parser
- [ ] Write test for session state management
- [ ] Implement session state
- [ ] Write test for command history
- [ ] Implement history tracking
- [ ] Write test for exit handling
- [ ] Implement clean exit
- [ ] Write test for error recovery
- [ ] Implement error recovery

## Phase 13: Interactive Mode Features
### Objectives
- Add autocomplete functionality
- Support multi-line input
- Provide interactive prompts

### Steps
- [ ] Write test for module name autocomplete
- [ ] Implement module autocomplete
- [ ] Write test for tool name autocomplete
- [ ] Implement tool autocomplete
- [ ] Write test for parameter name autocomplete
- [ ] Implement parameter autocomplete
- [ ] Write test for multi-line JSON input
- [ ] Implement multi-line support
- [ ] Write test for interactive prompts
- [ ] Implement prompt system
- [ ] Write test for context preservation
- [ ] Implement context manager

## Phase 14: Error Handling and Recovery
### Objectives
- Provide helpful error messages
- Suggest corrections
- Handle edge cases gracefully

### Steps
- [ ] Write test for module not found errors
- [ ] Implement module error handling
- [ ] Write test for tool not found errors
- [ ] Implement tool error handling
- [ ] Write test for parameter validation errors
- [ ] Implement validation error handling
- [ ] Write test for fuzzy matching suggestions
- [ ] Implement fuzzy matcher
- [ ] Write test for stack trace toggling
- [ ] Implement verbose error mode
- [ ] Write test for error recovery in interactive mode
- [ ] Implement recovery mechanism

## Phase 15: Advanced Features
### Objectives
- Support command aliases
- Enable command chaining
- Add batch operations

### Steps
- [ ] Write test for command aliases
- [ ] Implement alias system
- [ ] Write test for alias configuration
- [ ] Implement alias loader
- [ ] Write test for command chaining (future)
- [ ] Implement basic chaining support
- [ ] Write test for batch file execution
- [ ] Implement batch processor
- [ ] Write test for environment presets
- [ ] Implement preset system

## Phase 16: Integration Testing
### Objectives
- Test complete workflows with @jsenvoy/core modules
- Verify monorepo package integration
- Ensure resource management works across packages

### Steps
- [ ] Write integration test for @jsenvoy/core calculator module
- [ ] Verify calculator operations work through CLI
- [ ] Write integration test for @jsenvoy/core file module
- [ ] Verify file operations work through CLI
- [ ] Write integration test for GitHub tool from core
- [ ] Verify GitHub operations work through CLI
- [ ] Write test for cross-package module loading
- [ ] Verify CLI can find and load core modules
- [ ] Write test for module interdependencies
- [ ] Verify dependency injection works
- [ ] Write test for configuration precedence
- [ ] Verify config merging works
- [ ] Write test for error propagation
- [ ] Verify errors bubble correctly

## Phase 17: Performance and Optimization
### Objectives
- Optimize module loading
- Implement caching strategies
- Reduce startup time

### Steps
- [ ] Write performance test for module loading
- [ ] Implement lazy loading
- [ ] Write test for module cache effectiveness
- [ ] Optimize caching strategy
- [ ] Write test for command parsing speed
- [ ] Optimize parser
- [ ] Write test for large output handling
- [ ] Implement streaming support
- [ ] Write test for memory usage
- [ ] Implement memory optimizations

## Phase 18: Documentation and Examples
### Objectives
- Generate command documentation
- Create example scripts
- Build tutorial system

### Steps
- [ ] Write test for documentation generator
- [ ] Implement doc generator
- [ ] Write test for example validator
- [ ] Implement example validation
- [ ] Write test for tutorial system
- [ ] Implement tutorial mode
- [ ] Create example scripts
- [ ] Write user guide
- [ ] Generate API documentation

## Phase 19: Package and Distribution
### Objectives
- Prepare for npm publication as part of monorepo
- Set up workspace scripts
- Configure CI/CD for monorepo

### Steps
- [ ] Write test for npm package structure
- [ ] Verify package.json is correct for publishing
- [ ] Write test for @jsenvoy/core peer dependency
- [ ] Ensure core is properly listed as dependency
- [ ] Write test for global installation from monorepo
- [ ] Test global install with npm workspaces
- [ ] Write test for local development linking
- [ ] Verify npm link works in monorepo
- [ ] Create workspace scripts in root package.json
- [ ] Set up GitHub Actions for monorepo
- [ ] Create release process for individual packages

## Phase 20: Final Testing and Polish
### Objectives
- Complete E2E testing
- Fix edge cases
- Performance tuning

### Steps
- [ ] Run full test suite
- [ ] Fix any failing tests
- [ ] Manual testing of all features
- [ ] Performance profiling
- [ ] Security audit
- [ ] Documentation review
- [ ] Create demo video
- [ ] Prepare release notes

## Success Criteria
Each phase is considered complete when:
1. All tests are written and passing
2. Code coverage is above 90% for the phase
3. Documentation is updated
4. No linting errors
5. Integration with @jsenvoy/core modules verified
6. Monorepo workspace commands work correctly

## Notes
- Each checkbox represents a test-first approach: write the test, then implement
- Phases can be worked on in parallel where dependencies allow
- Regular commits should be made after each checkbox is completed
- Code review should happen at the end of each phase
- Development happens within the monorepo structure
- Use `npm run test:cli` from root or `npm test` from packages/cli
- The CLI depends on @jsenvoy/core as a sibling package

## Time Estimates
- Phase 1-5: Foundation (2-3 days)
- Phase 6-10: Core Features (3-4 days)
- Phase 11-15: Advanced Features (3-4 days)
- Phase 16-20: Polish and Release (2-3 days)

Total estimated time: 10-14 days for complete implementation