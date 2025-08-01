# Aiur Actors UI

Modern web-based debugging interface for Aiur server using Umbilical MVVM components and Actor communication.

## Overview

This package provides a next-generation debugging interface for the Aiur server that leverages:

- **Umbilical MVVM Component Model** from `@legion/components` for clean, testable UI architecture
- **Actor-based Communication** from `@legion/actors` for distributed, message-passing communication with the server
- **Modern Web Technologies** with enhanced user experience and developer tooling

## Key Features

- **Component-Based Architecture**: Each UI element is an isolated, testable Umbilical component
- **Actor Communication**: Real-time, bidirectional communication using the actor model
- **Session Management**: Multi-session support with proper isolation
- **Enhanced CLI**: Improved command-line interface with better autocomplete and syntax highlighting
- **Real-time Updates**: Live synchronization of tool lists, variables, and session state

## Quick Start

```bash
# Install dependencies
npm install

# Start the debug UI server
npm start

# Or run in development mode
npm run dev
```

The debug UI will be available at http://localhost:3002

## Architecture

This application uses a layered architecture:

1. **Actor Layer**: Manages communication with Aiur server via WebSocket
2. **Component Layer**: Umbilical MVVM components for UI logic and presentation
3. **Service Layer**: Business logic and state management
4. **Protocol Layer**: Message serialization and actor protocol implementation

See `docs/Design.md` for detailed architectural information.

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Format code
npm run format
```

## Testing

The project uses Jest with jsdom for comprehensive testing:

- **Unit Tests**: Individual component and service testing
- **Integration Tests**: Actor communication and server integration
- **Component Tests**: Full UI component testing with DOM validation

## Documentation

- `docs/Design.md` - Comprehensive design document and architectural overview
- `docs/ActorProtocol.md` - Actor communication protocol specification
- `docs/ComponentAPI.md` - Umbilical component interfaces and usage

## License

MIT