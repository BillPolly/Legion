import WebSocket from 'ws';

const PORT = 17892;

// Test sequence with delays
const tests = [
  { title: 'Step 1: Project Setup', subtitle: 'Creating project structure...', delay: 2000 },
  { title: 'Step 2: Installing Dependencies', subtitle: 'Installing LangChain and required packages...', delay: 3000 },
  { title: 'Step 3: Building Orchestrator', subtitle: 'Setting up supervisor agent...', delay: 3000 },
  { title: 'Step 4: Web Search Agent', subtitle: 'Configuring Serper API integration...', delay: 3000 },
  { title: 'Step 5: Link Checker', subtitle: 'Implementing URL validation...', delay: 3000 },
  { title: 'Step 6: Running Analysis', subtitle: 'Executing agent workflow...', delay: 3000 },
  { title: 'Demo Complete!', subtitle: 'Report generated successfully', delay: 2000 }
];

async function runTest() {
  const ws = new WebSocket(`ws://localhost:${PORT}`);

  ws.on('open', async () => {
    console.log('Connected to VSCode Orchestrator');

    // Run through test sequence
    for (const test of tests) {
      console.log(`\nShowing: ${test.title}`);

      const id = Date.now();
      ws.send(JSON.stringify({
        id,
        cmd: 'showFlashcard',
        args: {
          title: test.title,
          subtitle: test.subtitle,
          column: 3
        }
      }));

      // Wait for next step
      await new Promise(resolve => setTimeout(resolve, test.delay));
    }

    console.log('\nTest complete! Closing flashcard...');

    // Close the flashcard
    ws.send(JSON.stringify({
      id: Date.now(),
      cmd: 'closeFlashcard',
      args: {}
    }));

    // Wait a bit then disconnect
    setTimeout(() => {
      ws.close();
      console.log('Disconnected');
      process.exit(0);
    }, 1000);
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    if (response.ok) {
      console.log('✓ Command successful');
    } else {
      console.error('✗ Command failed:', response.error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    console.error('\nMake sure:');
    console.error('1. VSCode is running');
    console.error('2. VSCode Orchestrator extension is installed');
    console.error('3. Extension is activated (run any orchestrator command first)');
    process.exit(1);
  });

  ws.on('close', () => {
    console.log('Connection closed');
  });
}

runTest();
