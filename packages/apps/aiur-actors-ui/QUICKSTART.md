# Quick Start Guide - Aiur Actors UI

## Prerequisites

1. Ensure you have Node.js 18+ installed
2. Install dependencies from Legion root:
   ```bash
   npm install
   ```

## Running the Complete System

### Option 1: Use the Combined Launch Script (Recommended)

From the Legion root directory:

```bash
./run-aiur-with-ui.sh
```

This will:
- Start Aiur server on port 8080
- Start UI server on port 3002
- Open http://localhost:3002 in your browser

### Option 2: Start Servers Individually

#### Terminal 1 - Start Aiur Server:
```bash
cd packages/aiur
npm start
```

#### Terminal 2 - Start UI Server:
```bash
cd packages/apps/aiur-actors-ui
npm start
```

### Option 3: Using Node Scripts

From the UI directory:
```bash
cd packages/apps/aiur-actors-ui
node scripts/start-both.js
```

## Accessing the Application

Once both servers are running:

1. Open your browser to: **http://localhost:3002**
2. The UI will automatically connect to the Aiur server at `ws://localhost:8080/actors`

## Verifying the Setup

You should see:
- ✅ Connection status showing "Connected" in the UI header
- ✅ Terminal ready for commands
- ✅ Tools panel populated (after loading modules)
- ✅ Session panel showing active session

## Basic Usage

1. **Load a module**: Type `module_load file` in the terminal
2. **List tools**: Type `tools_list` to see available tools
3. **Execute a tool**: Type the tool name with arguments, e.g., `directory_list path:/`
4. **Create a session**: Click the "+" button in the Sessions panel
5. **Set variables**: Click the "+" button in the Variables panel

## Troubleshooting

### UI won't connect to Aiur
- Ensure Aiur server is running on port 8080
- Check browser console for WebSocket errors
- Verify no firewall blocking localhost connections

### "Cannot find module" errors
- Run `npm install` from Legion root
- Ensure you're using Node.js 18+

### Port already in use
- Kill existing processes:
  ```bash
  # Kill Aiur server
  lsof -ti:8080 | xargs kill -9
  
  # Kill UI server
  lsof -ti:3002 | xargs kill -9
  ```

### UI shows blank page
- Check browser console for errors
- Ensure you're accessing http://localhost:3002 (not https)
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Development Mode

For hot-reload development:

```bash
# Terminal 1 - Aiur with debug logging
cd packages/aiur
DEBUG=* npm start

# Terminal 2 - UI with dev mode
cd packages/apps/aiur-actors-ui
npm run dev
```

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Browser       │         │  Aiur Server    │
│                 │         │                 │
│  UI (Port 3002) │◄──WS───►│  Port 8080     │
│                 │         │                 │
│  - Terminal     │         │  - Modules      │
│  - Tools Panel  │         │  - Tools        │
│  - Sessions     │         │  - Sessions     │
│  - Variables    │         │  - Execution    │
└─────────────────┘         └─────────────────┘
```

## Next Steps

1. Explore the terminal commands
2. Load different Legion modules
3. Create and manage sessions
4. Set up variables for your workflows
5. Check the docs/ directory for detailed documentation