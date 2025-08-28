# Cerebrate

AI-powered Chrome DevTools extension for intelligent frontend debugging using the Legion Agent system.

## Overview

Cerebrate provides a Chrome DevTools extension that connects to a WebSocket server running the Legion Agent. It enables real-time debugging, code analysis, and AI-assisted frontend development through a familiar DevTools interface.

## Architecture

- **Chrome Extension**: DevTools panel with debugging interface
- **WebSocket Server**: Server hosting the Legion Agent for debugging operations  
- **Legion Agent Integration**: Full integration with the existing Legion AI agent system

## Quick Start

1. **Development Server**:
   ```bash
   npm run dev
   ```

2. **Build Extension**:
   ```bash
   npm run build:extension
   ```

3. **Load Extension**: Load the built extension in Chrome Developer Tools

## Documentation

- [Design Document](docs/DESIGN.md) - Complete architecture overview
- Complete WebSocket protocol specification
- Installation and development instructions

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Development mode with hot reload
npm run dev

# Lint code
npm run lint
```

## Integration

Cerebrate integrates with:
- `@legion/agent` - Core AI agent functionality
- `@legion/aiur` - MCP server for tool coordination
- `@legion/module-loader` - Tool and module management

## License

MIT - See LICENSE file for details.