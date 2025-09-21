# Available Tools in Legion Framework

This document lists all available tools in the Legion Framework database that can be used by ROMA agent strategies.

**Total Tools: 113**  
**Modules: 31**

## Tool Categories

### AI and Generation
- **AIGenerationModule** (1 tool)
  - `generate_image` - Generate an image using DALL-E 3 AI model. Automatically saves image to PNG format

### Agent Management
- **AgentToolsModule** (3 tools)
  - `close_window` - Close floating windows programmatically by window ID
  - `display_resource` - Display any resource handle in appropriate viewer
  - `notify_user` - Show notifications, progress updates, or user queries to the user

### Mathematical Operations
- **CalculatorModule** (1 tool)
  - `calculator` - Evaluates mathematical expressions and performs calculations
- **mock-calculator-module** (4 tools)
  - `add` - Add two numbers together
  - `subtract` - Subtract second number from first number
  - `multiply` - Multiply two numbers together
  - `divide` - Divide first number by second number

### Code Development
- **CodeAgentModule** (4 tools)
  - `generate_css` - Generate CSS stylesheets with modern patterns
  - `generate_html` - Generate HTML pages with templates and content
  - `generate_javascript` - Generate JavaScript functions, classes, and modules
  - `generate_test` - Generate test files for JavaScript code

- **CodeAnalysisModule** (1 tool)
  - `validate_javascript` - Validate JavaScript code for syntax and quality issues

### File Operations
- **FileModule** (6 tools)
  - `directory_change` - Changes the current working directory
  - `directory_create` - Creates directories in the file system
  - `directory_current` - Gets the current working directory
  - `directory_list` - Lists files and directories in a directory
  - `file_read` - Reads the contents of a file from the file system
  - `file_write` - Writes content to a file in the file system

- **FileOperationsModule** (5 tools)
  - `Edit` - Make exact string replacements in files
  - `MultiEdit` - Make multiple edits to a single file in one atomic operation
  - `NotebookEdit` - Edit specific cells in Jupyter notebooks (.ipynb files)
  - `Read` - Read files from the filesystem (supports text, images, PDFs, Jupyter notebooks)
  - `Write` - Write new files to the filesystem

### Search and Navigation
- **SearchNavigationModule** (3 tools)
  - `Glob` - Fast file pattern matching tool that works with any codebase size
  - `Grep` - A powerful search tool for file contents with regex support and multiple output modes
  - `LS` - Lists files and directories in a given path with detailed metadata

### System Operations
- **CommandExecutorModule** (1 tool)
  - `command_executor` - Execute a bash command in the terminal and return the output

- **SystemOperationsModule** (1 tool)
  - `Bash` - Executes bash commands in a persistent shell session with security measures

- **SystemModule** (5 tools)
  - `module_info` - Get detailed information about a module
  - `module_list` - List all loaded and available modules
  - `module_load` - Load a module to make its tools available
  - `module_tools` - List tools available in a specific module
  - `module_unload` - Unload a module and remove its tools

### Server and Process Management
- **NodeRunnerModule** (5 tools)
  - `list_sessions` - List and filter run sessions with optional statistics and sorting
  - `run_node` - Run Node.js scripts and applications with session management
  - `search_logs` - Search across all captured logs using keyword, semantic, or regex search
  - `server_health` - Check health status of running processes, servers, and system resources
  - `stop_node` - Stop running Node.js processes by process ID, session ID, or all processes

- **ServerStarterModule** (3 tools)
  - `server_read_output` - Read output from a running server process
  - `server_start` - Start a server process with the specified command
  - `server_stop` - Stop a running server process

### Web and Network
- **CrawlerModule** (1 tool)
  - `web_crawler` - Crawls web pages and extracts content including text, links, and metadata

- **WebToolsModule** (2 tools)
  - `WebFetch` - Fetch content from a URL and process it with a prompt
  - `WebSearch` - Search the web for current information

- **WebPageToMarkdownModule** (1 tool)
  - `webpage_to_markdown` - Converts web pages to markdown format, preserving structure and formatting

- **PageScreenshoterModule** (1 tool)
  - `page_screenshot` - Takes screenshots of web pages using Puppeteer browser automation

- **SerperModule** (1 tool)
  - `google_search` - Performs Google searches using the Serper API

### Data Processing
- **JsonModule** (5 tools)
  - `json_extract` - Extract a value from a JSON object using dot notation path
  - `json_parse` - Parse JSON string into JavaScript object
  - `json_stringify` - Convert JavaScript object to JSON string
  - `json_validate` - Validate if a string is valid JSON and provide detailed error information

- **EncodeModule** (4 tools)
  - `base64_decode` - Decode base64 encoded data
  - `base64_encode` - Encode data to base64 format
  - `url_decode` - URL decode a string
  - `url_encode` - URL encode a string

### Database
- **MongoDBModule** (1 tool)
  - `mongo_query` - Execute MongoDB database operations including queries, updates, inserts, deletes

### AI and Search
- **RAGModule** (4 tools)
  - `index_content` - Index content from directories or URLs for semantic search
  - `manage_index` - Manage document indexes (list, clear, update, status)
  - `query_rag` - Execute RAG queries combining semantic search with LLM response generation
  - `search_content` - Perform semantic search over indexed content

- **PictureAnalysisModule** (1 tool)
  - `analyse_picture` - Analyze images using AI vision models. Accepts image file paths and natural language queries

### Cloud Deployment
- **RailwayModule** (6 tools)
  - `railway_deploy` - Deploy an application to Railway from GitHub repository or Docker image
  - `railway_list_projects` - List all Railway projects in the account
  - `railway_logs` - Retrieve logs from a Railway deployment
  - `railway_remove` - Remove a deployment or entire project from Railway
  - `railway_status` - Get the status and details of a Railway deployment
  - `railway_update_env` - Update environment variables for a Railway service

### Task Management
- **TaskManagementModule** (3 tools)
  - `ExitPlanMode` - Exit plan mode and present implementation plan to user for approval
  - `Task` - Launch a new agent to handle complex, multi-step tasks autonomously
  - `TodoWrite` - Create and manage a structured task list for your current coding session

### Claude Integration
- **ClaudeToolsModule** (14 tools)
  - `Bash` - Executes bash commands in a persistent shell session with security measures
  - `Edit` - Make exact string replacements in files
  - `ExitPlanMode` - Exit plan mode and present implementation plan to user for approval
  - `Glob` - Fast file pattern matching tool that works with any codebase size
  - `Grep` - A powerful search tool for file contents with regex support and multiple output modes
  - `LS` - Lists files and directories in a given path with detailed metadata
  - `MultiEdit` - Make multiple edits to a single file in one atomic operation
  - `NotebookEdit` - Edit specific cells in Jupyter notebooks (.ipynb files)
  - `Read` - Read files from the filesystem (supports text, images, PDFs, Jupyter notebooks)
  - `Task` - Launch a new agent to handle complex, multi-step tasks autonomously
  - `TodoWrite` - Create and manage a structured task list for your current coding session
  - `WebFetch` - Fetch content from a URL and process it with a prompt
  - `WebSearch` - Search the web for current information
  - `Write` - Write new files to the filesystem

### Gemini Integration
- **GeminiToolsModule** (16 tools)
  - `edit_file` - Edit files with Gemini AI assistance
  - Various other Gemini-specific tools for AI-powered operations

## Tools Needed by Strategy Implementations

Based on the strategy code analysis, the following tools are required:

### CodingStrategy Requirements
- ✅ `file_write` - Available in FileModule and FileOperationsModule
- ✅ `directory_create` - Available in FileModule
- ✅ `generate_javascript` - Available in CodeAgentModule
- ✅ `generate_css` - Available in CodeAgentModule
- ✅ `generate_html` - Available in CodeAgentModule
- ✅ `validate_javascript` - Available in CodeAnalysisModule

### TestingStrategy Requirements
- ✅ `run_jest` - Can use `command_executor` or `Bash` tools
- ✅ `run_tests` - Can use `command_executor` or `Bash` tools
- ✅ `test_runner` - Can use `command_executor` or `Bash` tools
- ✅ `generate_test` - Available in CodeAgentModule
- ✅ `file_read` - Available in FileModule and FileOperationsModule
- ✅ `file_write` - Available in FileModule and FileOperationsModule

### DebuggingStrategy Requirements
- ✅ `validate_javascript` - Available in CodeAnalysisModule
- ✅ `command_executor` - Available in CommandExecutorModule
- ✅ `file_read` - Available in FileModule and FileOperationsModule
- ✅ `file_write` - Available in FileModule and FileOperationsModule
- ✅ `analyse_picture` - Available in PictureAnalysisModule (for screenshot analysis)

## Usage Notes

- All tools are accessed via `ToolRegistry.getInstance()`
- Tools can be retrieved using `await toolRegistry.getTool(toolName)`
- Each tool has an `execute(params)` method that returns a result object
- Tool execution results typically have `success`, `result`, and optionally `error` properties

## Strategy Refactoring Plan

All required tools are available in the database. The strategies can be refactored to:

1. **Load required tools during construction** instead of dynamic lookup
2. **Cache tool instances** for better performance
3. **Validate tool availability** at initialization time
4. **Fail fast** if required tools are missing

This will eliminate the inefficient pattern of repeatedly calling `toolRegistry.getTool()` during execution.