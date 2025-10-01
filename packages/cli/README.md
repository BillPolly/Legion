# Legion CLI

A Handle-centric command-line interface for interacting with Legion framework resources through a unified interface.

## Overview

The Legion CLI provides an interactive prompt for executing commands and displaying Handles (resources) in browser windows. It integrates with the Legion framework's ShowMe system for rich Handle visualization.

## Features

- **Interactive Prompt**: Readline-based command prompt with history
- **Handle Display**: Display Handles in browser windows via `/show` command
- **Colored Output**: Terminal output with colored messages and formatting
- **Command System**: Extensible slash-command system
- **ShowMe Integration**: Browser-based Handle visualization

## Installation

From the monorepo root:

```bash
npm install
```

## Usage

### Running the CLI

From the CLI package directory:

```bash
node src/index.js
```

Or using the bin script:

```bash
legion
```

### Available Commands

#### `/show <uri> [options]`

Display a Handle in a browser window.

**Arguments:**
- `<uri>` - Legion Handle URI (e.g., `legion://local/file/path/to/file`)

**Options:**
- `--width <px>` - Window width in pixels (default: 1000)
- `--height <px>` - Window height in pixels (default: 700)
- `--title <text>` - Window title (default: Handle URI)

**Examples:**

```bash
/show legion://local/file/README.md
/show legion://local/strategy/MyStrategy.js --width 1200 --height 800
/show legion://local/image/photo.jpg --title "My Photo"
```

## Architecture

### Core Components

#### CLI Gateway
Main CLI class managing lifecycle and component initialization:
- ResourceManager integration
- ShowMeController for browser visualization
- CommandProcessor for command routing
- InputHandler for interactive prompt
- OutputHandler for formatted output

#### ShowMe Integration
Uses ShowMeController to display Handles in browser windows:
- Launches chromeless browser windows in app mode
- Sends Handle data via Actor/WebSocket communication
- Tracks open windows for management

#### Command System
Extensible command registration and routing:
- `BaseCommand` abstract class for all commands
- `CommandProcessor` for registration and routing
- Slash command parsing (`/command args`)

#### Input/Output Handlers
- `InputHandler`: Readline-based prompt with command history
- `OutputHandler`: Colored terminal output with formatting (tables, JSON, lists)

## Development

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch
```

### Test Structure

```
__tests__/
├── unit/                  # Unit tests for individual classes
│   ├── CLI.test.js
│   ├── BaseCommand.test.js
│   ├── CommandProcessor.test.js
│   ├── ShowCommand.test.js
│   ├── InputHandler.test.js
│   └── OutputHandler.test.js
└── integration/           # Integration tests with real components
    ├── CLI.lifecycle.integration.test.js
    ├── ShowCommand.integration.test.js
    └── CLI.e2e.integration.test.js
```

## Implementation Status

**Current Version**: MVP Complete

**Implemented Features:**
- ✅ Core CLI infrastructure
- ✅ ShowMe integration
- ✅ DisplayEngine (= ShowMeController)
- ✅ Command processing
- ✅ `/show` command
- ✅ Input/Output handling
- ✅ Interactive prompt
- ✅ 103 tests passing (100%)

**Future Features:**
- `/help` command
- `/tools` command
- `/memory` command
- `/session` command
- Natural language processing
- Terminal rendering modes

## Design Documents

- [DESIGN.md](./docs/DESIGN.md) - Architecture and design
- [IMPLEMENTATION-PLAN.md](./docs/IMPLEMENTATION-PLAN.md) - Implementation phases

## License

Part of the Legion framework.
