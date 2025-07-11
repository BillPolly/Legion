# @jsenvoy/tools

Collection of AI agent tools for various tasks. All tools follow the standard function calling format.

## Installation

```bash
npm install @jsenvoy/tools
```

## Structure

```
src/
├── index.js              # Main exports
├── calculator/           # Calculator module
│   ├── CalculatorModule.js
│   └── index.js
├── file/                # File system module
│   ├── FileModule.js    # Main module with file operations tool
│   ├── FileReaderTool.js
│   ├── FileWriterTool.js
│   ├── DirectoryCreatorTool.js
│   └── index.js
├── command-executor/    # Command execution tool
├── crawler/             # Web crawler tool
├── github/              # GitHub operations tool
├── page-screenshoter/   # Web page screenshot tool
├── serper/              # Google search tool
├── server-starter/      # Development server tool
├── webpage-to-markdown/ # HTML to Markdown converter
└── youtube-transcript/  # YouTube transcript extractor
```

## Tool Types

1. **Tool** (from @jsenvoy/modules) - Base class for tools that work with LLMs using standard function calling
2. **ModularTool** (from @jsenvoy/modules) - Base class for tools that can be used in Modules with dependency injection
3. **Module** (from @jsenvoy/modules) - Base class for collections of related tools

## Usage

### Using Tools

```javascript
const { tools, getAllToolDescriptions, invokeToolByFunctionName } = require('@jsenvoy/tools');

// Get all tool descriptions for function calling
const toolDescriptions = getAllToolDescriptions();

// Invoke a tool by function name
const toolCall = {
  id: "call_123",
  type: "function",
  function: {
    name: "calculator_evaluate",
    arguments: JSON.stringify({ expression: "10 * 5" })
  }
};

const result = await invokeToolByFunctionName('calculator_evaluate', toolCall);
console.log(result); // { tool_call_id: "call_123", role: "tool", name: "calculator_evaluate", content: '{"result":50}' }
```

### Using Modules

```javascript
const { CalculatorModule, FileModule } = require('@jsenvoy/tools');

// Create module instances with dependencies
const calcModule = new CalculatorModule({});
const fileModule = new FileModule({ basePath: '/tmp', encoding: 'utf8' });

// Get tools from a module
const calcTools = calcModule.getTools();
```

### Using ModularTool Implementations

```javascript
const { CalculatorEvaluateTool, FileReaderTool } = require('@jsenvoy/tools');

// Create tool instances
const calculator = new CalculatorEvaluateTool();
const fileReader = new FileReaderTool();

// Execute tools directly
const result = await calculator.execute({ expression: "2 + 2" });
console.log(result); // { result: 4 }
```

## Available Tools

### Available Tools
- **calculator** - Evaluate mathematical expressions
- **file_reader** - Read file contents
- **file_writer** - Write content to files
- **command_executor** - Execute shell commands
- **crawler** - Crawl and extract content from web pages
- **page_screenshoter** - Take screenshots of web pages
- **serper** - Search Google via Serper API
- **server_starter** - Start local development servers
- **webpage_to_markdown** - Convert web pages to Markdown
- **youtube_transcript** - Extract YouTube video transcripts
- **github** - Interact with GitHub repositories

## Tool Categories

### File Operations
- Read, write, and manipulate files
- Navigate directory structures
- Extract content from various file formats

### Web Tools
- Scrape web pages
- Take screenshots
- Convert HTML to Markdown
- Search the web

### Development Tools
- Execute shell commands
- Start development servers
- Analyze and edit code
- Work with GitHub

### Content Tools
- Extract YouTube transcripts
- Parse and format content
- Perform calculations

## Configuration

Some tools require environment variables:
- `SERPER_API_KEY` - For Google search functionality
- `GITHUB_TOKEN` - For GitHub operations

## License

MIT