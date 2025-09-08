# ShowMe Module

A Legion module for displaying various types of assets (images, code, JSON, data tables, web content) in appropriate viewer windows.

## Overview

The ShowMe module provides a generic asset display tool that intelligently detects asset types and displays them in appropriate viewer formats. It's designed to work seamlessly with the Legion framework for AI agents to display results, data, and media.

## Features

- **Intelligent Asset Detection**: Automatically detects asset type (image, code, JSON, data, web, text)
- **Multiple Display Formats**: Specialized viewers for each asset type
- **Server-Client Architecture**: Built on ConfigurableActorServer for real-time updates
- **Tool Registry Integration**: Works with Legion tool registry system
- **Error Handling**: Fail-fast approach with clear error messages
- **No Mocks**: Full integration testing with real components

## Installation

```bash
npm install @legion/showme
```

## Usage

### As a Legion Module

```javascript
import { ShowMeModule } from '@legion/showme';

const module = new ShowMeModule();
const tools = module.getTools();
```

### Using the ShowAssetTool

```javascript
const showAssetTool = tools.find(tool => tool.name === 'show_asset');

// Display JSON data
const result = await showAssetTool.execute({
  asset: { name: 'Test', value: 123 },
  title: 'My JSON Data'
});

// Display an image from file
const result = await showAssetTool.execute({
  asset: '/path/to/image.png',
  hint: 'image'
});

// Display code
const result = await showAssetTool.execute({
  asset: 'console.log("Hello World");',
  hint: 'code',
  title: 'JavaScript Example'
});

// Display tabular data
const result = await showAssetTool.execute({
  asset: [
    { id: 1, name: 'Item 1', value: 100 },
    { id: 2, name: 'Item 2', value: 200 }
  ],
  hint: 'data'
});

// Display web content
const result = await showAssetTool.execute({
  asset: 'https://example.com',
  hint: 'web'
});
```

### Tool Parameters

- `asset` (required): The asset to display (any type)
- `hint` (optional): Type hint - one of: 'image', 'code', 'json', 'data', 'web', 'text'
- `title` (optional): Window title
- `options` (optional): Display options (width, height, resizable, etc.)

### Return Value

```javascript
{
  success: boolean,
  window_id: string,      // Unique window identifier
  detected_type: string,  // Detected asset type
  title: string,         // Window title
  url: string,          // Server URL for asset
  assetId: string,      // Unique asset identifier
  error?: string        // Error message if failed
}
```

## Asset Type Detection

The module automatically detects asset types based on:

1. **Explicit hints**: If provided, validates and uses the hint
2. **File extensions**: `.png`, `.jpg`, `.js`, `.json`, `.csv`, etc.
3. **Content patterns**: URLs, HTML tags, JSON structure, CSV format
4. **Data structure**: Arrays of objects, 2D arrays, objects
5. **Binary signatures**: Image file headers, etc.

## Architecture

```
ShowMeModule
├── ShowAssetTool         # Main tool for displaying assets
├── AssetTypeDetector     # Intelligent type detection
├── ShowMeServer          # ConfigurableActorServer extension
│   ├── API Endpoints     # REST API for asset operations
│   ├── WebSocket         # Real-time communication
│   └── Asset Storage     # Session-based storage
├── ShowMeServerActor     # Server-side actor
├── ShowMeClientActor     # Client-side actor
└── Renderers            # Asset-specific renderers
    ├── ImageRenderer
    ├── JSONRenderer
    ├── TableRenderer
    └── TextRenderer
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:ui

# Run integration tests only
npm run test:node

# Run specific test file
NODE_OPTIONS='--experimental-vm-modules' npm test -- __tests__/unit/ShowMeTool.test.js
```

### Test Coverage

- **Unit Tests**: 295+ tests covering all components
- **Integration Tests**: Real server-client communication tests
- **No Mocks**: Integration tests use real dependencies

### Building

```bash
npm run build
```

## Server Configuration

The ShowMe server can be configured with:

```javascript
const server = new ShowMeServer({
  port: 3700,              // Server port (default: 3700)
  skipLegionPackages: true // Skip package discovery for faster startup
});
```

## Environment Variables

- `SHOWME_PORT`: Server port (default: 3700)

## Requirements

- Node.js 18+
- ES6 module support
- Legion framework dependencies

## Implementation Status

- ✅ Phase 1: Foundation & Core Detection (100%)
- ✅ Phase 2: Tool Implementation (100%)
- 🟨 Phase 3: Server Infrastructure (67%)
- 🟨 Phase 4: UI Client Implementation (67%)
- ⬜ Phase 5: Integration & End-to-End Testing (0%)
- ⬜ Phase 6: Tool Registry Integration (0%)
- ⬜ Phase 7: System Validation & UAT (0%)

**Total Progress**: 43.2% complete (38/88 steps)

## License

MIT

## Contributing

This module follows TDD methodology with comprehensive testing. All contributions must:
- Include tests (unit and integration)
- Pass all existing tests
- Follow fail-fast principles
- Provide clear error messages
- Not use mocks in integration tests or implementation code