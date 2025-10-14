# @legion/computer-use

Browser automation with LLM-guided computer use powered by Gemini Computer Use API.

## Features

- **Gemini Computer Use API**: Uses Gemini 2.5's native computer use capabilities
- **Hybrid Execution**: DOM/AX-first with coordinate fallback for stability
- **Resource Manager Integration**: Follows Legion architecture patterns
- **Full Observability**: Screenshots, traces, and logs for every run
- **Safety Features**: Host allowlisting, time budgets, redaction hooks

## Installation

```bash
npm install @legion/computer-use
```

## Prerequisites

1. **Google Gemini API Key**: Get one from https://aistudio.google.com/apikey
2. **Playwright**: Chromium browser will be installed automatically

Add to your `.env` file:
```env
GOOGLE_API_KEY=your_api_key_here
GOOGLE_MODEL=gemini-2.5-computer-use-preview-10-2025
```

## Quick Start

```javascript
import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseAgent } from '@legion/computer-use';

// Initialize with ResourceManager
const resourceManager = await ResourceManager.getInstance();

const agent = new ComputerUseAgent(resourceManager, {
  headless: false,
  maxTurns: 20,
  startUrl: 'https://www.google.com'
});

await agent.initialize();

const result = await agent.executeTask(
  'Search for "Anthropic Claude" and summarize the top result'
);

console.log(result.resultText);
await agent.cleanup();
```

## Options

```javascript
{
  headless: false,           // Show browser window
  width: 1440,               // Viewport width
  height: 900,               // Viewport height
  startUrl: 'https://...',   // Initial URL
  maxTurns: 30,              // Max conversation turns
  excludedActions: [],       // Exclude specific actions
  allowlistHosts: undefined, // Restrict navigation to specific hosts
  outDir: 'output_runs',     // Output directory for artifacts
  stepTimeBudgetMs: 60000,   // Per-turn timeout (60s)
  totalTimeBudgetMs: 600000, // Total run timeout (10m)
  redact: (s) => s           // Optional redaction function for logs
}
```

## Supported Actions

The agent can perform these browser actions via Gemini Computer Use:

- **Navigation**: `navigate`, `go_back`, `go_forward`
- **Clicks**: `click_at`, `double_click`, `right_click`
- **Typing**: `type_text_at`
- **Mouse**: `hover_at`, `drag_and_drop`
- **Scrolling**: `scroll_document`, `scroll_at`
- **Waiting**: `wait_5_seconds`

## Architecture

```
ComputerUseAgent
├── BrowserManager (Playwright lifecycle)
├── ActionExecutor (Hybrid DOM/coordinate actions)
├── LLMClient (Gemini provider via ResourceManager)
└── Artifacts (screenshots, traces, logs)
```

## Output Artifacts

Each run creates a timestamped directory with:
- `step_*.png` - Screenshot after each action
- `trace.zip` - Playwright trace (open with `npx playwright show-trace`)
- `run.log` - Detailed execution log

## Example Tasks

```javascript
// Web research
await agent.executeTask(
  'Find the latest Anthropic blog post and summarize it'
);

// Form filling
await agent.executeTask(
  'Go to example.com/contact and fill out the form with test data'
);

// Multi-step workflows
await agent.executeTask(
  'Search for "best pizza near me", click the first result, and tell me their hours'
);
```

## Safety & Limits

**Host Allowlisting**:
```javascript
const agent = new ComputerUseAgent(resourceManager, {
  allowlistHosts: ['google.com', 'wikipedia.org']
});
```

**Time Budgets**:
- `stepTimeBudgetMs`: Kills a single turn if it takes too long
- `totalTimeBudgetMs`: Terminates entire run after time limit

**Excluded Actions**:
```javascript
const agent = new ComputerUseAgent(resourceManager, {
  excludedActions: ['drag_and_drop'] // Exclude until hardened
});
```

## Troubleshooting

### "GOOGLE_API_KEY not found"
Ensure your `.env` file in the monorepo root contains:
```env
GOOGLE_API_KEY=your_key_here
```

### "Model not found"
The computer use preview model may have a different ID. Check Google's docs for the latest model name.

### Browser hangs
Increase `stepTimeBudgetMs` or check if the page has infinite loading states.

## Development

Run the example:
```bash
cd packages/modules/computer-use
node examples/basic-example.js "your task here"
```

Run tests:
```bash
npm test
```

## License

MIT
