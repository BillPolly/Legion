# Claude Tools Package Design Document

## Executive Summary

The Claude Tools package (`@legion/claude-tools`) implements all Claude Code tools as Legion framework modules, providing a comprehensive set of file operations, search capabilities, system operations, web tools, and task management utilities. This package serves as a bridge between Claude Code's tool interface and the Legion framework's architecture, enabling seamless integration of Claude's powerful tools within Legion-based applications.

The package is designed as an MVP implementation that prioritizes functionality and reliability over non-functional requirements. All tools follow the Legion framework patterns for modules, error handling, and resource management.

## Architecture Overview

### Package Structure

```
packages/claude-tools/
├── package.json
├── docs/
│   └── DESIGN.md
├── src/
│   ├── index.js                    # Main package export
│   ├── file-operations/
│   │   ├── FileOperationsModule.js # Enhanced file operations
│   │   ├── ReadTool.js
│   │   ├── WriteTool.js
│   │   ├── EditTool.js
│   │   ├── MultiEditTool.js
│   │   └── NotebookEditTool.js
│   ├── search-navigation/
│   │   ├── SearchNavigationModule.js
│   │   ├── GlobTool.js
│   │   ├── GrepTool.js
│   │   └── LSTool.js
│   ├── task-management/
│   │   ├── TaskManagementModule.js
│   │   ├── TaskTool.js
│   │   ├── TodoWriteTool.js
│   │   └── ExitPlanModeTool.js
│   ├── system-operations/
│   │   ├── SystemOperationsModule.js
│   │   └── BashTool.js
│   └── web-tools/
│       ├── WebToolsModule.js
│       ├── WebSearchTool.js
│       └── WebFetchTool.js
└── __tests__/
    ├── setup.js
    ├── unit/
    └── integration/
```

## Tool Specifications

### File Operations Module

This module provides comprehensive file system operations, extending the existing file capabilities to match Claude Code's interface.

#### Read Tool

**Purpose**: Read files from the filesystem with support for text, images, PDFs, and Jupyter notebooks.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    file_path: string (required) // Absolute path to file
    limit?: number              // Number of lines to read
    offset?: number             // Line number to start from
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      content: string | Buffer,   // File contents
      file_path: string,          // Path that was read
      size: number,               // File size in bytes
      encoding?: string,          // Detected encoding
      metadata?: object           // Additional file metadata
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Uses Node.js `fs.promises` for file operations
- Automatic content type detection (text, binary, image, PDF)
- Line-based reading with offset/limit support
- Support for multiple encodings (UTF-8, binary, etc.)
- Image files return base64-encoded data with metadata
- PDF files return extracted text content
- Jupyter notebooks return parsed cell structure

#### Write Tool

**Purpose**: Write new files to the filesystem.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    file_path: string (required), // Absolute path for new file
    content: string | Buffer (required), // Content to write
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      file_path: string,
      bytes_written: number,
      created: boolean // true if new file, false if overwritten
    },
    error?: ErrorObject
  }
  ```

#### Edit Tool

**Purpose**: Make exact string replacements in files.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    file_path: string (required),
    old_string: string (required),    // Exact text to replace
    new_string: string (required),    // Replacement text
    replace_all?: boolean = false     // Replace all occurrences
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      file_path: string,
      replacements_made: number,
      preview?: string // Preview of changes made
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Atomic file operations (read → modify → write)
- Exact string matching (no regex by default)
- Backup creation before modification
- Validation that old_string exists in file
- Line number tracking for error reporting

#### MultiEdit Tool

**Purpose**: Make multiple edits to a single file in one atomic operation.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    file_path: string (required),
    edits: Array<{
      old_string: string (required),
      new_string: string (required),
      replace_all?: boolean = false
    }> (required)
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      file_path: string,
      total_edits: number,
      successful_edits: number,
      edit_summary: Array<{
        edit_index: number,
        replacements_made: number,
        status: 'success' | 'failed'
      }>
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Sequential application of edits
- All-or-nothing transaction semantics
- Validation that all edits are applicable before execution
- Detailed tracking of which edits succeeded/failed

#### NotebookEdit Tool

**Purpose**: Edit specific cells in Jupyter notebooks.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    notebook_path: string (required),
    new_source: string (required),
    cell_id?: string,                // Target cell ID
    cell_type?: 'code' | 'markdown', // Cell type
    edit_mode?: 'replace' | 'insert' | 'delete' = 'replace'
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      notebook_path: string,
      cell_modified: string,        // ID of modified cell
      operation: string,            // Type of operation performed
      notebook_metadata?: object    // Updated notebook metadata
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Full Jupyter notebook format support
- Cell ID management and validation
- Preservation of notebook metadata
- Support for code and markdown cells
- Atomic notebook file operations

### Search & Navigation Module

This module provides powerful search and file system navigation capabilities.

#### Glob Tool

**Purpose**: Find files by pattern matching using glob patterns.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    pattern: string (required),     // Glob pattern (e.g., "**/*.js")
    path?: string,                  // Base directory to search
    ignore?: string[]               // Patterns to ignore
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      pattern: string,
      matches: Array<{
        path: string,
        relative_path: string,
        size: number,
        modified_time: string
      }>,
      total_matches: number,
      search_time_ms: number
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Uses `fast-glob` library for high-performance pattern matching
- Support for complex glob patterns including negation
- Results sorted by modification time
- Efficient handling of large directory trees
- Configurable ignore patterns (.gitignore support)

#### Grep Tool

**Purpose**: Search file contents using regex patterns, powered by ripgrep.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    pattern: string (required),           // Regex pattern to search
    path?: string,                        // File/directory to search
    glob?: string,                        // File pattern filter
    type?: string,                        // File type filter
    output_mode?: 'content' | 'files_with_matches' | 'count' = 'files_with_matches',
    case_insensitive?: boolean = false,
    show_line_numbers?: boolean = false,
    context_before?: number = 0,          // Lines before match
    context_after?: number = 0,           // Lines after match
    context_around?: number = 0,          // Lines before and after
    multiline?: boolean = false,          // Enable multiline matching
    head_limit?: number                   // Limit results
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      pattern: string,
      results: Array<{
        file_path: string,
        matches: Array<{
          line_number: number,
          line_content: string,
          match_start: number,
          match_end: number,
          context_before?: string[],
          context_after?: string[]
        }>,
        match_count: number
      }>,
      total_matches: number,
      search_time_ms: number
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Integration with ripgrep for maximum performance
- Full regex support with multiline capabilities
- Context line extraction
- Multiple output formats (content, files, counts)
- File type filtering and glob pattern support
- Case-sensitive and case-insensitive search modes

#### LS Tool

**Purpose**: List files and directories in a given path.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    path: string (required),        // Absolute path to list
    ignore?: string[]               // Glob patterns to ignore
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      path: string,
      entries: Array<{
        name: string,
        type: 'file' | 'directory' | 'symlink',
        size?: number,               // For files
        permissions: string,
        modified_time: string,
        created_time: string
      }>,
      total_entries: number
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Comprehensive file system metadata extraction
- Support for symbolic links
- Permission and timestamp information
- Configurable ignore patterns
- Large directory handling with pagination support

### Task Management Module

This module provides tools for managing complex tasks and workflows.

#### Task Tool

**Purpose**: Launch specialized sub-agents for complex tasks.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    description: string (required),   // Short task description
    prompt: string (required),        // Detailed task prompt
    subagent_type: string (required)  // Agent type to launch
  }
  ```

- **Available Subagent Types**:
  - `general-purpose`: Complex multi-step tasks
  - `context-fetcher`: Information retrieval from documentation
  - `file-creator`: File and directory creation with templates
  - `git-workflow`: Git operations and branch management
  - `test-runner`: Test execution and failure analysis

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      task_id: string,
      subagent_type: string,
      result: object,               // Agent-specific results
      execution_time_ms: number,
      status: 'completed' | 'failed' | 'timeout'
    },
    error?: ErrorObject
  }
  ```

#### TodoWrite Tool

**Purpose**: Create and manage structured task lists.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    todos: Array<{
      content: string (required),   // Task description
      status: 'pending' | 'in_progress' | 'completed' (required),
      id: string (required)         // Unique task identifier
    }> (required)
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      todos: Array<TodoItem>,
      total_tasks: number,
      completed_tasks: number,
      pending_tasks: number,
      in_progress_tasks: number,
      last_updated: string
    },
    error?: ErrorObject
  }
  ```

#### ExitPlanMode Tool

**Purpose**: Exit planning mode and present implementation plan.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    plan: string (required)         // Markdown-formatted plan
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      plan: string,
      plan_id: string,
      timestamp: string,
      status: 'presented' | 'approved' | 'rejected'
    },
    error?: ErrorObject
  }
  ```

### System Operations Module

This module provides system-level operations and command execution.

#### Bash Tool

**Purpose**: Execute bash commands with optional timeout and security controls.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    command: string (required),     // Command to execute
    description?: string,           // Command description
    timeout?: number = 120000,      // Timeout in milliseconds
    working_directory?: string,     // Working directory
    environment_variables?: object, // Additional env vars
    capture_output?: boolean = true // Capture stdout/stderr
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      command: string,
      exit_code: number,
      stdout: string,
      stderr: string,
      execution_time_ms: number,
      working_directory: string,
      timeout_occurred: boolean
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Uses Node.js `child_process.spawn` for command execution
- Configurable timeout with process termination
- Environment variable isolation
- Working directory management
- Output truncation for large outputs (>30000 characters)
- Security restrictions on dangerous commands
- Proper signal handling for process cleanup

### Web Tools Module

This module provides web search and content fetching capabilities.

#### WebSearch Tool

**Purpose**: Search the web for current information.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    query: string (required, min: 2), // Search query
    allowed_domains?: string[],        // Domain whitelist
    blocked_domains?: string[]         // Domain blacklist
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      query: string,
      results: Array<{
        title: string,
        url: string,
        snippet: string,
        domain: string,
        published_date?: string,
        relevance_score?: number
      }>,
      search_metadata: {
        total_results: number,
        search_time_ms: number,
        search_engine: string
      }
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- Integration with search engine APIs
- Domain filtering capabilities
- Result relevance scoring
- Rate limiting and API key management
- Geographic location handling (US-only restriction)

#### WebFetch Tool

**Purpose**: Fetch and analyze content from URLs.

**Interface**:
- **Input Schema**:
  ```javascript
  {
    url: string (required, format: uri), // URL to fetch
    prompt: string (required)             // Analysis prompt
  }
  ```

- **Output Schema**:
  ```javascript
  {
    success: boolean,
    data?: {
      url: string,
      final_url?: string,           // After redirects
      content_type: string,
      content: string,              // Processed content
      analysis: string,             // AI analysis result
      metadata: {
        title?: string,
        description?: string,
        author?: string,
        published_date?: string,
        word_count: number,
        processing_time_ms: number
      }
    },
    error?: ErrorObject
  }
  ```

**Implementation Details**:
- HTTP/HTTPS content fetching with redirect handling
- HTML to Markdown conversion using `turndown`
- Content cleaning and processing with `cheerio`
- AI-powered content analysis
- Metadata extraction from HTML headers
- Caching mechanism for repeated requests (15-minute TTL)
- Content size limits and timeout handling

## Framework Integration

### Legion Module Architecture

All tools follow the Legion framework's module architecture:

1. **Module Classes**: Each module extends the base `Module` class from `@legion/tools-registry`
2. **Tool Registration**: Tools are registered in module constructors using the `registerTool()` method
3. **Resource Management**: All modules use the `ResourceManager` singleton for configuration
4. **Event System**: Tools emit progress, error, info, and warning events

### Resource Manager Integration

All configuration is accessed through the ResourceManager singleton:

```javascript
// Example configuration access pattern
const resourceManager = ResourceManager.getInstance();
const config = {
  basePath: resourceManager.get('BASE_PATH') || process.cwd(),
  timeout: resourceManager.get('COMMAND_TIMEOUT') || 120000,
  searchEngine: resourceManager.get('SEARCH_ENGINE_API_KEY')
};
```

### Error Handling Strategy

All tools implement consistent error handling:

1. **Error Codes**: Standardized error codes across all tools
2. **Error Context**: Detailed error context with stack traces
3. **Fail-Fast**: No fallbacks or graceful degradation - tools fail immediately on errors
4. **Error Propagation**: Errors bubble up through the module hierarchy

**Standard Error Codes**:
- `MISSING_PARAMETER`: Required parameter not provided
- `INVALID_PARAMETER`: Parameter validation failed
- `RESOURCE_NOT_FOUND`: File, directory, or resource not found
- `PERMISSION_DENIED`: Insufficient permissions
- `OPERATION_TIMEOUT`: Operation exceeded timeout
- `NETWORK_ERROR`: Network-related failures
- `EXECUTION_ERROR`: Command or operation execution failed

### Input Validation

All tools use Zod schemas for input validation:

```javascript
import { z } from 'zod';

const readToolSchema = z.object({
  file_path: z.string().min(1),
  limit: z.number().positive().optional(),
  offset: z.number().non-negative().optional()
});
```

### Tool Registry Integration

All modules are designed for automatic registration with the Legion tool registry:

1. **Module Discovery**: Modules are discoverable through the registry's loading system
2. **Metadata Export**: Each tool provides comprehensive metadata for registry population
3. **Semantic Search**: Tool descriptions are optimized for semantic search capabilities
4. **Database Storage**: Module and tool metadata is stored in MongoDB for persistence

## Testing Strategy

### Test Structure

Following Legion's TDD principles:

```
__tests__/
├── setup.js                    # Test environment setup
├── unit/
│   ├── file-operations/        # Unit tests for each tool
│   ├── search-navigation/
│   ├── task-management/
│   ├── system-operations/
│   └── web-tools/
└── integration/
    ├── ToolRegistryIntegration.test.js
    ├── EndToEndWorkflows.test.js
    └── CrossModuleIntegration.test.js
```

### Testing Principles

1. **No Mocks**: Integration tests use live components and real resources
2. **Fail Fast**: Tests fail immediately if required resources are unavailable
3. **Clean Setup**: Tests clean up before execution rather than after
4. **Comprehensive Coverage**: All error paths and edge cases tested
5. **Resource Requirements**: Tests document and validate required external resources

### Test Categories

1. **Unit Tests**: Individual tool functionality with isolated dependencies
2. **Integration Tests**: Tool interaction with Legion framework components
3. **End-to-End Tests**: Complete workflows using multiple tools
4. **Error Scenario Tests**: Comprehensive error handling validation

## Security Considerations

### Input Sanitization

- All file paths validated and canonicalized
- Command injection prevention in Bash tool
- URL validation and protocol restrictions
- Content size limits to prevent DoS

### Resource Access Control

- File system operations restricted to configured base paths
- Network operations with domain filtering
- Command execution with restricted command sets
- Environment variable isolation

### Error Information Disclosure

- Stack traces only in development mode
- Sanitized error messages in production
- No sensitive information in logs
- Path traversal prevention

## Performance Considerations

### Caching Strategy

- Web content caching with configurable TTL
- File metadata caching for repeated operations
- Search result caching for identical queries
- Tool metadata caching in registry

### Resource Management

- Connection pooling for external services
- Process cleanup for long-running operations
- Memory management for large file operations
- Timeout enforcement for all operations

### Optimization Techniques

- Streaming for large file operations
- Parallel processing where applicable
- Lazy loading of heavy dependencies
- Efficient glob pattern matching

## Dependencies

### Core Dependencies

- `@legion/tools-registry`: Framework integration
- `@legion/resource-manager`: Configuration management
- `zod`: Input validation schemas

### Tool-Specific Dependencies

- `fast-glob`: High-performance file pattern matching
- `ripgrep-js`: File content search capabilities
- `axios`: HTTP client for web operations
- `cheerio`: HTML parsing and manipulation
- `marked`: Markdown processing
- `turndown`: HTML to Markdown conversion

### Development Dependencies

- `jest`: Testing framework
- `@shelf/jest-mongodb`: MongoDB test integration

## Module Exports

### Main Package Export

```javascript
// src/index.js
export { FileOperationsModule } from './file-operations/FileOperationsModule.js';
export { SearchNavigationModule } from './search-navigation/SearchNavigationModule.js';
export { TaskManagementModule } from './task-management/TaskManagementModule.js';
export { SystemOperationsModule } from './system-operations/SystemOperationsModule.js';
export { WebToolsModule } from './web-tools/WebToolsModule.js';

// Convenience exports for individual tools
export * from './file-operations/index.js';
export * from './search-navigation/index.js';
export * from './task-management/index.js';
export * from './system-operations/index.js';
export * from './web-tools/index.js';
```

### Module Registration

Each module provides a factory method for easy instantiation:

```javascript
// Example module factory
export class FileOperationsModule extends Module {
  static async create(resourceManager) {
    const module = new FileOperationsModule(resourceManager);
    await module.initialize();
    return module;
  }
}
```

## Configuration

### Environment Variables

All configuration accessed through ResourceManager:

- `BASE_PATH`: Base directory for file operations
- `COMMAND_TIMEOUT`: Default timeout for system commands
- `SEARCH_ENGINE_API_KEY`: API key for web search
- `WEB_FETCH_TIMEOUT`: Timeout for web content fetching
- `MAX_FILE_SIZE`: Maximum file size for operations
- `CACHE_TTL`: Cache time-to-live in seconds

### Default Configuration

Sensible defaults for all configuration values:

- File operations default to current working directory
- Command timeout defaults to 2 minutes
- Web operations timeout after 30 seconds
- File size limit of 10MB for safety
- Cache TTL of 15 minutes

This design document provides a comprehensive technical specification for the Claude Tools package, ensuring all tools integrate seamlessly with the Legion framework while maintaining the familiar Claude Code interface and capabilities.