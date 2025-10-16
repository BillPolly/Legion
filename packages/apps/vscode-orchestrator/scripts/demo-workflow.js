import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 17892;
const BASE_DIR = path.join(__dirname, '..', '..', '..', '..');

let ws;
let messageId = 0;

// Helper to send command and wait for response
function sendCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const id = messageId++;

    const handler = (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === id) {
        ws.off('message', handler);
        if (response.ok) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({ id, cmd, args }));
  });
}

// Show flashcard
async function showFlashcard(title, subtitle) {
  console.log(`\n📋 ${title}`);
  await sendCommand('showFlashcard', { title, subtitle, column: 3 });
  // Wait for flashcard to be visible
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Create file with animation
async function createFileAnimated(sourcePath, targetPath) {
  // Read source file
  const content = fs.readFileSync(sourcePath, 'utf-8');

  // Open target file in VSCode
  console.log(`   Creating ${path.basename(targetPath)}...`);
  await sendCommand('open', {
    file: targetPath,
    create: true,
    language: targetPath.endsWith('.py') ? 'python' : 'plaintext'
  });

  // Small delay for file to open
  await new Promise(resolve => setTimeout(resolve, 300));

  // Animate content insertion
  await sendCommand('chunkedInsert', {
    text: content,
    chunkSize: 200,
    intervalMs: 30
  });

  console.log(`   ✓ ${path.basename(targetPath)} created`);
}

async function runDemo() {
  ws = new WebSocket(`ws://localhost:${PORT}`);

  ws.on('open', async () => {
    try {
      console.log('🚀 Starting demo workflow...\n');

      // Step 1: Create requirements.txt
      await showFlashcard(
        'Step 1: Project Setup',
        'Creating requirements.txt with dependencies...'
      );

      await createFileAnimated(
        path.join(BASE_DIR, 'python-demo', 'requirements.txt'),
        path.join(BASE_DIR, 'demo-target', 'requirements.txt')
      );

      // Wait for flashcard to auto-close
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Create main.py
      await showFlashcard(
        'Step 2: Building Agent System',
        'Setting up LangGraph multi-agent orchestration...'
      );

      await createFileAnimated(
        path.join(BASE_DIR, 'python-demo', 'main.py'),
        path.join(BASE_DIR, 'demo-target', 'main.py')
      );

      // Wait for flashcard to auto-close
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Final flashcard
      await showFlashcard(
        'Demo Preview Complete!',
        'Files created successfully'
      );

      await new Promise(resolve => setTimeout(resolve, 2500));

      console.log('\n✅ Demo workflow complete!');
      ws.close();
      process.exit(0);

    } catch (error) {
      console.error('❌ Error:', error.message);
      ws.close();
      process.exit(1);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    console.error('\nMake sure:');
    console.error('1. VSCode is running');
    console.error('2. VSCode Orchestrator extension is installed');
    console.error('3. Extension is activated');
    process.exit(1);
  });
}

runDemo();
