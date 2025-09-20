# ROMA CLI - Chat Interface Guide

## Installation

First, ensure the CLI dependencies are installed:
```bash
npm run cli:install
```

## Usage

The ROMA CLI works as a **chat interface** - just type what you want ROMA to do!

### Quick Start
```bash
npm run roma
```

This will:
- ✅ Check if the server is running
- 🚀 Start the server if needed (with 5-minute auto-shutdown)
- 💬 Launch the chat interface

### Chat Mode (Default)

Once in the CLI, just type your tasks naturally:

```
roma> Create a calculator function that adds two numbers
roma> Write a test for the calculator
roma> Generate a README for this project
```

### Slash Commands

Use slash commands for control and information:

```bash
/help       # Show available commands
/status     # Check agent status
/history    # View execution history
/watch <id> # Watch a specific execution
/clear      # Clear the screen
/exit       # Exit the CLI
```

Short aliases are also available:
- `/s` for `/status`
- `/h` for `/history`
- `/w <id>` for `/watch`
- `/q` for `/exit`

### Discrete Commands (For Scripts)

For automation and scripting, use discrete commands:

```bash
npm run roma:status              # Check status
npm run roma:execute "task"      # Execute a task
npm run roma:history             # View history
npm run roma:stop                # Stop the server
```

## Features

### 💬 Natural Language Interface
Just type what you want ROMA to do - no need for special syntax or commands. The CLI treats all input as tasks by default.

### 🚀 Auto-Start Server
The CLI automatically starts the ROMA server if it's not running. No need to manage the server separately!

### ⏰ Auto-Shutdown
The server automatically shuts down after 5 minutes of inactivity to save resources.

### 📊 Real-time Progress
Watch tasks being decomposed and executed in real-time with live progress updates.

### 🎯 Slash Commands
Quick access to status, history, and control functions without leaving the chat flow.

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────┐
│   ROMA CLI  │ ◄──────────────────► │ ROMA Server  │
│             │                      │  Port 4020   │
└─────────────┘                      └──────────────┘
      │                                     │
      │                                     │
      ▼                                     ▼
┌─────────────┐                      ┌──────────────┐
│ ROMACLIActor│                      │ROMAServerActor│
└─────────────┘                      └──────────────┘
                                            │
                                            ▼
                                      ┌──────────────┐
                                      │ SimpleROMAAgent│
                                      └──────────────┘
```

## Tips

1. **Chat Naturally**: Just type what you want - no special syntax needed!
   ```
   roma> Create a Python script that generates random passwords
   ```

2. **Quick Status Check**: Use `/s` for a quick status update without interrupting your flow.

3. **Watch Progress**: Your tasks automatically show progress. Use `/watch <id>` to monitor a specific execution.

4. **Resource Efficient**: The server auto-stops after 5 minutes of inactivity.

5. **History**: Use `/h` to see what you've done recently.

## Troubleshooting

If the CLI can't connect:
1. Check if port 4020 is available
2. Try stopping and restarting: `npm run roma:stop && npm run roma`
3. Check server logs when running `npm run roma:server` directly