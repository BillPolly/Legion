# @legion/tools-collection

Collection of tool implementations for the Legion framework. Provides various utilities including file operations, web scraping, AI generation, and more.

## Installation

```bash
npm install @legion/tools-collection
```

## Available Modules

### FileModule
File system operations including read, write, search, and manipulation.

```javascript
import { FileModule } from '@legion/tools-collection';

const fileModule = new FileModule();
const fileTool = fileModule.getTool('file_read');
const content = await fileTool.execute({ filePath: '/path/to/file' });
```

### SerperModule
Google search integration using the Serper API.

```javascript
import { SerperModule } from '@legion/tools-collection';

const serperModule = new SerperModule({ 
  resourceManager: await ResourceManager.getInstance() 
});
const searchTool = serperModule.getTool('google_search');
const results = await searchTool.execute({ query: 'Legion framework' });
```

### WebpageToMarkdownModule
Convert web pages to clean Markdown format.

```javascript
import { WebpageToMarkdownModule } from '@legion/tools-collection';

const module = new WebpageToMarkdownModule();
const tool = module.getTool('webpage_to_markdown');
const markdown = await tool.execute({ url: 'https://example.com' });
```

### CrawlerModule
Advanced web crawling with depth control and content extraction.

```javascript
import { CrawlerModule } from '@legion/tools-collection';

const crawlerModule = new CrawlerModule();
const tool = crawlerModule.getTool('crawl_website');
const pages = await tool.execute({ 
  url: 'https://example.com',
  maxDepth: 2,
  maxPages: 10 
});
```

### PageScreenshoterModule
Capture screenshots of web pages.

```javascript
import { PageScreenshoterModule } from '@legion/tools-collection';

const module = new PageScreenshoterModule();
const tool = module.getTool('screenshot_page');
const screenshot = await tool.execute({ 
  url: 'https://example.com',
  outputPath: './screenshot.png' 
});
```

### AIGenerationModule
AI-powered code and content generation.

```javascript
import { AIGenerationModule } from '@legion/tools-collection';

const aiModule = new AIGenerationModule({ 
  resourceManager: await ResourceManager.getInstance() 
});
const tool = aiModule.getTool('generate_code');
const code = await tool.execute({ 
  prompt: 'Create a React component for a todo list',
  language: 'javascript' 
});
```

### CommandExecutorModule
Execute shell commands safely.

```javascript
import { CommandExecutorModule } from '@legion/tools-collection';

const cmdModule = new CommandExecutorModule();
const tool = cmdModule.getTool('execute_command');
const result = await tool.execute({ 
  command: 'ls -la',
  workingDir: '/tmp' 
});
```

## Module Pattern

All modules extend from `@legion/tools-registry` base Module class:

```javascript
import { Module } from '@legion/tools-registry';

class MyCustomModule extends Module {
  constructor() {
    super({
      name: 'my-custom-module',
      version: '1.0.0',
      description: 'Custom tool module'
    });
    
    // Register tools
    this.registerTool(new MyCustomTool());
  }
}
```

## Error Handling

All tools use structured error handling with cause objects:

```javascript
try {
  const result = await tool.execute(args);
} catch (error) {
  console.error('Tool failed:', error.message);
  console.error('Error context:', error.cause);
}
```

## Testing

```bash
npm test
```

## Dependencies

- `zod`: Schema validation
- `puppeteer`: Web automation (for crawling/screenshots)
- `@legion/tools-registry`: Base module framework
- `@legion/resource-manager`: Resource management

## License

MIT