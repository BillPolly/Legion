# VSCode Orchestrator - Quick Start Guide

A complete VSCode extension for external demo automation with animated typing, file operations, and OBS overlay cards.

## What You've Built

✅ **VSCode Extension** - WebSocket server for external control
✅ **File Operations** - Open, create, save files
✅ **Animated Editing** - Typewriter effects and chunked inserts
✅ **Cursor Control** - Position, reveal, highlight
✅ **Browser Integration** - Open URLs in Simple Browser
✅ **OBS Overlay** - Stage cards with fade animations
✅ **Demo Scripts** - Full example orchestration

## Installation Steps

### 1. Build the Extension

```bash
cd /Users/williampearson/Legion/packages/apps/vscode-orchestrator
npm install
npm run build
```

### 2. Install in VSCode

**Option A: Load for Development**
1. Open VSCode
2. Press F5 to open Extension Development Host
3. The extension will auto-activate

**Option B: Package and Install**
```bash
npm run package
# This creates vscode-orchestrator-0.1.0.vsix
```

Then in VSCode:
1. Cmd+Shift+P → "Extensions: Install from VSIX..."
2. Select the `.vsix` file
3. Reload VSCode

## Running a Demo

### Step 1: Start the Overlay Server

```bash
cd /Users/williampearson/Legion/packages/apps/vscode-orchestrator
node overlay/overlay-server.js
```

You should see:
```
Overlay HTTP server listening on http://localhost:17901
Overlay WebSocket server listening on ws://localhost:17900
Overlay control server listening on ws://localhost:17901
```

### Step 2: Test the Overlay

```bash
node examples/test-overlay.js
```

Open `http://localhost:17901` in a browser to see the card appear and disappear.

### Step 3: Configure OBS (Optional)

1. Add Browser Source to OBS
2. URL: `http://localhost:17901`
3. Width: 1920, Height: 1080
4. Enable "Shutdown source when not visible"

### Step 4: Open a Workspace in VSCode

The extension requires an open workspace folder to create files.

1. Open VSCode
2. File → Open Folder
3. Select any folder (or create a test folder)

### Step 5: Verify Extension is Running

Check the Output panel:
1. View → Output
2. Select "VSCode Orchestrator" from dropdown
3. You should see: "Orchestrator WebSocket server listening on ws://127.0.0.1:17892"

### Step 6: Run the Demo Script

```bash
node examples/demo-orchestrator.js
```

This will:
1. Show cards in the overlay
2. Create `src/agents.ts` with animated typing
3. Create `src/tools.ts` with full content
4. Highlight code sections
5. Save files automatically

## File Structure

```
packages/apps/vscode-orchestrator/
├── src/
│   ├── extension.ts              # Main extension entry
│   ├── orchestrator-server.ts    # WebSocket server
│   ├── command-handler.ts        # Command routing
│   ├── types.ts                  # Type definitions
│   └── commands/
│       ├── file-ops.ts           # open, save, replaceAll
│       ├── animated-edit.ts      # type, chunkedInsert
│       ├── cursor-ops.ts         # setCursor, reveal, highlight
│       └── utils.ts              # openUrl, sleep, batch
├── overlay/
│   ├── overlay-server.js         # Card broadcast server
│   ├── index.html                # OBS overlay page
│   └── styles.css                # Card animations
├── examples/
│   ├── demo-orchestrator.js      # Full demo script
│   └── test-overlay.js           # Overlay test
├── dist/
│   └── extension.js              # Built extension (135KB)
└── package.json
```

## Command Reference

### Connecting

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:17892');

function sendCommand(cmd, args = {}) {
  const id = Date.now();
  return new Promise((resolve, reject) => {
    const handler = (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === id) {
        ws.off('message', handler);
        response.ok ? resolve(response.data) : reject(new Error(response.error));
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, cmd, args }));
  });
}
```

### File Operations

```javascript
// Create and open file
await sendCommand('open', {
  file: 'src/example.ts',
  create: true,
  language: 'typescript',
  column: 1
});

// Save current file
await sendCommand('save');

// Replace entire content
await sendCommand('replaceAll', {
  text: 'export const hello = "world";\n'
});
```

### Animated Editing

```javascript
// Typewriter effect
await sendCommand('type', {
  text: 'console.log("Hello");\n',
  cps: 40  // characters per second
});

// Fast chunked insert
await sendCommand('chunkedInsert', {
  text: largeCodeBlock,
  chunkSize: 160,
  intervalMs: 50
});
```

### Cursor & Visibility

```javascript
// Move cursor
await sendCommand('setCursor', { line: 10, ch: 5 });

// Scroll to line
await sendCommand('reveal', {
  line: 20,
  ch: 0,
  strategy: 'center'  // or 'top', 'default'
});

// Highlight region
await sendCommand('highlight', {
  start: { line: 5, ch: 0 },
  end: { line: 15, ch: 0 },
  ms: 1500  // auto-clear after 1.5s
});
```

### Browser Integration

```javascript
// Open URL in Simple Browser
await sendCommand('openUrl', {
  url: 'https://example.com',
  column: 2
});
```

### Utilities

```javascript
// Delay
await sendCommand('sleep', { ms: 1000 });

// Batch commands
await sendCommand('batch', {
  ops: [
    { cmd: 'open', args: { file: 'test.ts', create: true } },
    { cmd: 'type', args: { text: 'const x = 1;\n' } },
    { cmd: 'save' }
  ]
});
```

### Overlay Cards

```javascript
const overlayWs = new WebSocket('ws://127.0.0.1:17901');

// Show card
overlayWs.send(JSON.stringify({
  cmd: 'showCard',
  args: {
    title: 'Step 1',
    subtitle: 'Creating the project'
  }
}));

// Hide card
overlayWs.send(JSON.stringify({ cmd: 'hideCard' }));
```

## Troubleshooting

### Extension Not Starting

Check VSCode Output:
- View → Output → "VSCode Orchestrator"
- Look for errors or port conflicts

Try manual toggle:
- Cmd+Shift+P → "Toggle Orchestrator Server"

### Can't Connect from Script

1. Verify extension is running (check Output panel)
2. Verify port 17892 is not blocked
3. Ensure workspace folder is open in VSCode

### Overlay Not Showing

1. Check overlay server is running: `node overlay/overlay-server.js`
2. Test in browser: `http://localhost:17901`
3. Verify WebSocket connections in browser console (F12)

### Commands Failing

Common issues:
- **"No workspace folder"** → Open a folder in VSCode
- **"No active editor"** → Use `open` command first
- **Timeout** → Large operations may need time, check status bar

## Next Steps

### Custom Orchestration

Create your own demo scripts based on `examples/demo-orchestrator.js`:

```javascript
// Your custom timeline
async function myDemo() {
  // Show intro
  showCard('My Demo', 'Building something cool');
  await sleep(2000);
  hideCard();

  // Create files
  await sendCommand('open', { file: 'src/app.ts', create: true });
  await sendCommand('type', { text: '// Your code here\n', cps: 50 });
  await sendCommand('save');

  // Show results
  showCard('Done!', 'Demo complete');
}
```

### Advanced Features

- **Multiple columns**: Open files side-by-side with `column: 1/2/3`
- **Search results**: Use `openUrl` to show multiple URLs
- **Code highlights**: Draw attention to specific regions
- **Batch operations**: Chain commands for complex flows

## Configuration

Settings in `.vscode/settings.json`:

```json
{
  "orchestrator.port": 17892,
  "orchestrator.typing.cpsDefault": 40,
  "orchestrator.typing.chunkSize": 160,
  "orchestrator.typing.intervalMs": 50
}
```

## Recording Workflow

1. Start OBS recording
2. Start overlay server
3. Open VSCode with extension active
4. Run orchestrator script
5. OBS captures everything:
   - Animated code editing
   - Overlay cards with transitions
   - Browser windows opening
   - File creation in real-time

## Architecture

```
┌──────────────────┐
│ Demo Script      │
│ (Node.js)        │
└─────┬────────┬───┘
      │        │
      │        │ ws://17901 (cards)
      │        ↓
      │   ┌────────────────┐     ws://17900      ┌─────────────┐
      │   │ Overlay Server │ ─────────────────> │ OBS Browser │
      │   └────────────────┘  (broadcast)        │ Source      │
      │                                           └─────────────┘
      │
      │ ws://17892 (commands)
      ↓
┌──────────────────┐
│ VSCode Extension │
│ - File ops       │
│ - Animated edit  │
│ - Cursor control │
└──────────────────┘
```

## Success Indicators

✅ Overlay server shows "listening" messages
✅ VSCode Output shows "Orchestrator WebSocket server listening"
✅ Test overlay shows card in browser
✅ Demo script creates files with animations
✅ OBS captures smooth typing effects

## Support

For issues or questions:
- Check README.md for full API reference
- Review examples/ for working code
- Check Output panels for error messages

---

**You're ready to create automated VSCode demos!** 🎬
