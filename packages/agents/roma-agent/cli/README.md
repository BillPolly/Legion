# ROMA CLI

Command-line interface for ROMA (Recursive Objective Management Agent) with both interactive and discrete command modes.

## Installation

From the CLI directory:
```bash
npm install
```

Make sure the ROMA server is running on port 4020:
```bash
cd ..
node src/server/server.js
```

## Usage

### Interactive Mode

Start an interactive session with persistent prompt:

```bash
npm run dev
# or
./bin/roma-cli.js
```

Inside the interactive session:
```
roma> execute "Create a simple calculator app"
roma> status
roma> history 5
roma> watch exec_1234567890
roma> help
roma> exit
```

### Discrete Commands

Execute one-off commands for scripting and automation:

```bash
# Execute a task
./bin/roma.js execute "Create a Node.js server with express" --watch

# Check server status
./bin/roma.js status

# View execution history
./bin/roma.js history --limit 10 --json

# Watch specific execution
./bin/roma.js watch exec_1234567890

# Server management
./bin/roma.js server start
./bin/roma.js server status
```

## Command Reference

### Interactive Commands

- **execute \<task\>** - Execute a task using ROMA agent
- **status** - Show current agent status and statistics  
- **history [limit]** - Show execution history (default limit: 10)
- **watch \<execution-id\>** - Watch specific execution in real-time
- **clear** - Clear the terminal screen
- **help** - Show available commands
- **exit** - Exit the CLI

### Discrete Command Options

#### Execute Command
```bash
roma execute <task> [options]

Options:
  -t, --tool <tool>      Specify a specific tool to use
  -p, --params <params>  JSON parameters for the task
  -w, --watch           Watch execution progress in real-time
  -j, --json            Output results in JSON format
  --timeout <seconds>   Execution timeout in seconds (default: 300)
```

#### Status Command
```bash
roma status [options]

Options:
  -j, --json             Output status in JSON format
  -r, --refresh <sec>    Auto-refresh interval in seconds
```

#### History Command
```bash
roma history [options]

Options:
  -l, --limit <number>   Limit number of results (default: 10)
  -j, --json            Output history in JSON format
  -f, --filter <status>  Filter by status (completed, failed, running)
```

#### Watch Command
```bash
roma watch <executionId> [options]

Options:
  -j, --json    Output progress in JSON format
```

## Examples

### Interactive Mode Examples

```bash
# Start interactive session
roma-cli

# Execute a complex task
roma> execute "Build a REST API for a todo application with user authentication"

# Check what's happening
roma> status

# Look at recent history
roma> history 3

# Watch a specific execution
roma> watch exec_1234567890_abcdef123
```

### Scripting Examples

```bash
# Execute and watch progress
./bin/roma.js execute "Create a simple web scraper" --watch

# Get status in JSON for parsing
./bin/roma.js status --json | jq '.statistics.successRate'

# Execute with specific tool and parameters
./bin/roma.js execute "Calculate fibonacci" \
  --tool calculator \
  --params '{"sequence": 10}' \
  --json

# Monitor status every 5 seconds
./bin/roma.js status --refresh 5

# Get recent failures
./bin/roma.js history --filter failed --limit 5
```

### Pipeline Examples

```bash
# Execute task and save result
RESULT=$(./bin/roma.js execute "Generate API documentation" --json)
echo "$RESULT" | jq '.success'

# Execute multiple tasks in sequence
for task in "Create database schema" "Setup API endpoints" "Add tests"; do
  ./bin/roma.js execute "$task" --watch
done

# Monitor until completion
EXEC_ID=$(./bin/roma.js execute "Deploy application" --json | jq -r '.executionId')
./bin/roma.js watch "$EXEC_ID"
```

## Architecture

The CLI uses an actor-based architecture that mirrors the web interface:

- **ROMACLIActor** - Client-side actor handling server communication
- **ROMAWebSocketClient** - WebSocket connection management with auto-reconnection  
- **ProgressRenderer** - Real-time progress visualization for terminal
- **MessageFormatter** - Consistent formatting for all output types
- **InteractivePrompt** - REPL-style interface with command history

### Message Flow

```
CLI Command → ROMACLIActor → ROMAWebSocketClient → [WebSocket] → ROMAServerActor → SimpleROMAAgent
                    ↑                                                    ↓
Progress Updates ←──┴─── ProgressRenderer ←─── MessageFormatter ←─── Server Events
```

## Development

### Project Structure

```
cli/
├── bin/                     # Executable entry points
│   ├── roma-cli.js         # Interactive mode
│   └── roma.js             # Discrete commands
├── src/
│   ├── actors/             # Actor implementations
│   │   └── ROMACLIActor.js
│   ├── client/             # WebSocket client
│   │   └── ROMAWebSocketClient.js  
│   ├── commands/           # Command handlers
│   │   ├── ExecuteCommand.js
│   │   ├── StatusCommand.js
│   │   ├── HistoryCommand.js
│   │   └── WatchCommand.js
│   └── ui/                 # User interface components
│       ├── InteractivePrompt.js
│       ├── ProgressRenderer.js
│       └── MessageFormatter.js
└── package.json
```

### Testing

Start the ROMA server:
```bash
cd /Users/maxximus/Documents/max/pocs/Legion/packages/agents/roma-agent
node src/server/server.js
```

Test the CLI:
```bash
cd cli

# Test interactive mode
npm run dev

# Test discrete commands
./bin/roma.js status
./bin/roma.js execute "test task" --watch
```

## Troubleshooting

### Connection Issues

If the CLI can't connect to the server:

1. Verify the server is running on port 4020
2. Check the WebSocket URL in ROMAWebSocketClient.js
3. Look for firewall or network issues

### Command Not Found

If `roma` command is not found:

1. Make sure you're in the CLI directory
2. Use the full path: `./bin/roma.js`
3. Check that the files are executable: `chmod +x bin/*.js`

### Progress Not Updating

If progress updates aren't showing:

1. Ensure you're using `--watch` flag for discrete commands
2. Check WebSocket connection status with `roma status`
3. Verify the server is sending progress events

## Contributing

When adding new commands:

1. Create command handler in `src/commands/`
2. Add command to `bin/roma.js` 
3. Add interactive handler to `InteractivePrompt.js`
4. Update help text and documentation