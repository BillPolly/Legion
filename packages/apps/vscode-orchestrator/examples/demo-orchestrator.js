import WebSocket from 'ws';

/**
 * Demo Orchestrator - Example script showing how to control VSCode
 *
 * Prerequisites:
 * 1. Install and activate the vscode-orchestrator extension in VSCode
 * 2. Open a workspace folder in VSCode
 * 3. Run the overlay server: node overlay/overlay-server.js
 * 4. Run this script: node examples/demo-orchestrator.js
 */

// Connect to VSCode extension
const vscodeWs = new WebSocket('ws://127.0.0.1:17892');

// Connect to overlay control (for cards)
const overlayWs = new WebSocket('ws://127.0.0.1:17901');

let commandId = 0;

function sendCommand(cmd, args = {}) {
  return new Promise((resolve, reject) => {
    const id = commandId++;
    const message = { id, cmd, args };

    const timeout = setTimeout(() => {
      reject(new Error(`Command ${cmd} timed out`));
    }, 30000);

    const handler = (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === id) {
        clearTimeout(timeout);
        vscodeWs.off('message', handler);

        if (response.ok) {
          resolve(response.data);
        } else {
          reject(new Error(`Command ${cmd} failed: ${response.error}`));
        }
      }
    };

    vscodeWs.on('message', handler);
    vscodeWs.send(JSON.stringify(message));
  });
}

function showCard(title, subtitle) {
  overlayWs.send(JSON.stringify({
    cmd: 'showCard',
    args: { title, subtitle }
  }));
}

function hideCard() {
  overlayWs.send(JSON.stringify({
    cmd: 'hideCard'
  }));
}

async function sleep(ms) {
  await sendCommand('sleep', { ms });
}

async function runDemo() {
  console.log('Starting demo orchestration...');

  // Step 1: Show intro card
  showCard('Building an AI Agent', 'Creating agents.ts, tools.ts, graph.ts');
  await sleep(2000);
  hideCard();
  await sleep(500);

  // Step 2: Create and edit agents.ts
  console.log('Creating agents.ts...');
  await sendCommand('open', {
    file: 'src/agents.ts',
    create: true,
    language: 'typescript',
    column: 1
  });

  await sendCommand('type', {
    text: '// AI Agent Definition\n\n',
    cps: 40
  });

  const agentCode = `export interface Agent {
  id: string;
  name: string;
  role: string;
  execute(input: string): Promise<string>;
}

export class RetrieverAgent implements Agent {
  id = 'retriever';
  name = 'Retriever';
  role = 'Search and retrieve information';

  async execute(input: string): Promise<string> {
    // Search implementation
    return \`Found: \${input}\`;
  }
}
`;

  await sendCommand('chunkedInsert', {
    text: agentCode,
    chunkSize: 160,
    intervalMs: 50
  });

  await sendCommand('save');
  console.log('agents.ts created and saved');

  await sleep(1000);

  // Step 3: Show card for tools
  showCard('Implementing Tools', 'search + citations');
  await sleep(2000);
  hideCard();
  await sleep(500);

  // Step 4: Create tools.ts
  console.log('Creating tools.ts...');
  await sendCommand('open', {
    file: 'src/tools.ts',
    create: true,
    language: 'typescript',
    column: 2
  });

  const toolsCode = `export interface Tool {
  name: string;
  description: string;
  execute(params: any): Promise<any>;
}

export const searchTool: Tool = {
  name: 'search',
  description: 'Search for information',
  async execute(params: { query: string }) {
    return {
      results: ['Result 1', 'Result 2', 'Result 3'],
      citations: ['Source A', 'Source B']
    };
  }
};
`;

  await sendCommand('replaceAll', { text: toolsCode });

  // Highlight the search tool
  await sendCommand('highlight', {
    start: { line: 5, ch: 0 },
    end: { line: 14, ch: 0 },
    ms: 1500
  });

  await sendCommand('save');
  console.log('tools.ts created and saved');

  await sleep(1000);

  // Step 5: Show completion card
  showCard('Demo Complete!', 'Files created successfully');
  await sleep(3000);
  hideCard();

  console.log('Demo orchestration complete!');
  process.exit(0);
}

// Wait for connections
vscodeWs.on('open', () => {
  console.log('Connected to VSCode orchestrator');

  overlayWs.on('open', () => {
    console.log('Connected to overlay server');
    runDemo().catch((error) => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
  });
});

vscodeWs.on('error', (error) => {
  console.error('VSCode WebSocket error:', error);
  process.exit(1);
});

overlayWs.on('error', (error) => {
  console.error('Overlay WebSocket error:', error);
  process.exit(1);
});
