# VSCode Demo Orchestrator

External control of VSCode for demo recording and automation. Drive VSCode actions via WebSocket commands to create animated demos with overlay cards.

## Features

- **File Operations**: Open, create, save files
- **Animated Editing**: Typewriter effect and chunked inserts
- **Cursor Control**: Set position, reveal, highlight regions
- **Browser Integration**: Open URLs in Simple Browser
- **OBS Overlay**: Show/hide stage cards during demos
- **Batch Commands**: Execute multiple commands transactionally

## Installation

### 1. Build the Extension

```bash
cd packages/apps/vscode-orchestrator
npm install
npm run build
```

### 2. Install in VSCode

```bash
npm run package
```

Then in VSCode:
1. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
2. Run "Extensions: Install from VSIX..."
3. Select the generated `.vsix` file

### 3. Activate Extension

The extension activates automatically on startup and starts a WebSocket server on port 17892 (configurable).

## Usage

### Starting the Overlay Server

```bash
cd packages/apps/vscode-orchestrator
node overlay/overlay-server.js
```

This starts:
- HTTP server on port 17901 (serves overlay HTML)
- WebSocket server on port 17900 (broadcast to overlay)
- Control server on port 17901 (receive card commands)

### Add Overlay to OBS

1. Add a new Browser Source
2. Set URL to: `http://localhost:17901`
3. Set Width: 1920, Height: 1080
4. Enable "Shutdown source when not visible"
5. Position overlay on your scene

### Running a Demo

```bash
node examples/demo-orchestrator.js
```

## Command Protocol

All commands use JSON over WebSocket:

```json
{
  "id": "unique-id",
  "cmd": "command-name",
  "args": { /* command-specific args */ }
}
```

Responses:

```json
{
  "id": "same-id",
  "ok": true,
  "data": { /* result data */ }
}
```

### Available Commands

#### File Operations

**open** - Open or create a file
```javascript
await sendCommand('open', {
  file: 'src/example.ts',
  create: true,
  language: 'typescript',
  column: 1  // 1, 2, or 3
});
```

**save** - Save active document
```javascript
await sendCommand('save');
```

**replaceAll** - Replace entire file content (fast)
```javascript
await sendCommand('replaceAll', {
  text: 'export const x = 1;\n'
});
```

#### Animated Editing

**type** - Character-by-character typing
```javascript
await sendCommand('type', {
  text: 'Hello World\n',
  cps: 40  // characters per second (5-120)
});
```

**chunkedInsert** - Insert large text in bursts
```javascript
await sendCommand('chunkedInsert', {
  text: largeCodeBlock,
  chunkSize: 160,  // chars per chunk
  intervalMs: 50   // ms between chunks
});
```

#### Cursor & Visibility

**setCursor** - Set cursor position
```javascript
await sendCommand('setCursor', {
  line: 10,  // 0-based
  ch: 5      // 0-based
});
```

**reveal** - Scroll to position
```javascript
await sendCommand('reveal', {
  line: 20,
  ch: 0,
  strategy: 'center'  // 'center', 'top', 'default'
});
```

**highlight** - Temporary decoration
```javascript
await sendCommand('highlight', {
  start: { line: 10, ch: 0 },
  end: { line: 20, ch: 0 },
  ms: 1500  // duration
});
```

#### Browser Integration

**openUrl** - Open URL in Simple Browser
```javascript
await sendCommand('openUrl', {
  url: 'https://example.com',
  column: 2
});
```

#### Utilities

**sleep** - Delay execution
```javascript
await sendCommand('sleep', { ms: 1000 });
```

**batch** - Execute multiple commands
```javascript
await sendCommand('batch', {
  ops: [
    { cmd: 'open', args: { file: 'test.ts', create: true } },
    { cmd: 'type', args: { text: 'console.log("hi");\n' } },
    { cmd: 'save' }
  ]
});
```

### Overlay Cards

Send to overlay control server (ws://127.0.0.1:17901):

```javascript
// Show card
overlayWs.send(JSON.stringify({
  cmd: 'showCard',
  args: {
    title: 'Step 1',
    subtitle: 'Creating the project'
  }
}));

// Hide card
overlayWs.send(JSON.stringify({
  cmd: 'hideCard'
}));
```

## Configuration

Settings in `.vscode/settings.json`:

```json
{
  "orchestrator.port": 17892,
  "orchestrator.typing.cpsDefault": 40,
  "orchestrator.typing.chunkSize": 160,
  "orchestrator.typing.intervalMs": 50,
  "orchestrator.disableOnTypeFormat": true
}
```

## Example Timeline

```javascript
// 1. Show intro card
showCard('Building an App', 'Step 1: Create files');
await sleep(2000);
hideCard();

// 2. Open and edit file
await sendCommand('open', { file: 'src/index.ts', create: true });
await sendCommand('type', { text: 'export const app = "demo";\n', cps: 40 });
await sendCommand('save');

// 3. Show completion
showCard('Complete!', 'Demo finished');
await sleep(2000);
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│ Orchestrator    │ ─────────────────> │ VSCode Extension │
│ Script          │    ws://17892      │ (commands)       │
└─────────────────┘                    └──────────────────┘
        │
        │ WebSocket
        │ ws://17901
        ↓
┌─────────────────┐     WebSocket      ┌──────────────────┐
│ Overlay Control │ ─────────────────> │ OBS Browser      │
│ Server          │    ws://17900      │ Source           │
└─────────────────┐                    └──────────────────┘
```

## Development

```bash
# Build extension
npm run build

# Watch mode
npm run watch

# Package VSIX
npm run package
```

## Troubleshooting

**Extension not connecting**
- Check Output panel: "VSCode Orchestrator"
- Verify port 17892 is not in use
- Try restarting VSCode

**Overlay not showing**
- Verify overlay server is running
- Check OBS Browser Source URL
- Look for WebSocket errors in browser console (F12)

**Commands timing out**
- Large operations may take time
- Check VSCode isn't frozen
- Reduce `chunkSize` or increase `intervalMs` for large inserts

## License

MIT
