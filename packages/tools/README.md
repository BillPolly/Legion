# @jsenvoy/tools

A comprehensive collection of tools for AI agents, providing various functionalities including file operations, web scraping, code analysis, and more.

## Installation

```bash
npm install @jsenvoy/tools
```

## Usage

### Legacy Tools

```javascript
const { calculatorTool, fileReaderTool, webPageToMarkdownTool } = require('@jsenvoy/tools');

// Use calculator tool
const result = await calculatorTool.execute({ expression: "2 + 2" });
console.log(result); // { result: 4 }

// Read a file
const content = await fileReaderTool.execute({ path: "./example.txt" });
console.log(content); // { content: "file contents..." }
```

### OpenAI-Compatible Tools

```javascript
const { openAITools, invokeOpenAIToolByFunctionName } = require('@jsenvoy/tools');

// Get all OpenAI tool descriptions for function calling
const tools = openAITools;

// Invoke a tool by function name
const result = await invokeOpenAIToolByFunctionName('calculator', {
  expression: "10 * 5"
});
console.log(result); // { result: 50 }
```

## Available Tools

### Legacy Tools
- **calculatorTool** - Evaluate mathematical expressions
- **fileReaderTool** - Read file contents
- **fileWriterTool** - Write content to files
- **serverStarterTool** - Start local development servers
- **googleSearchTool** - Search Google via Serper API
- **bashExecutorTool** - Execute shell commands
- **crawlerTool** - Crawl and extract content from web pages
- **pageScreenshotTool** - Take screenshots of web pages
- **webPageToMarkdownTool** - Convert web pages to Markdown
- **youtubeTranscriptTool** - Extract YouTube video transcripts
- **githubTool** - Interact with GitHub repositories

### OpenAI-Compatible Tools
All legacy tools are also available in OpenAI function calling format:
- calculator
- file_reader
- file_writer
- command_executor
- crawler
- page_screenshoter
- serper
- server_starter
- webpage_to_markdown
- youtube_transcript
- github

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