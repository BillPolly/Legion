#!/usr/bin/env node
/**
 * Multi-Agent Research System Demo
 * Shows flashcards and creates files with streaming animation
 */

import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 17892;
const URL = `ws://localhost:${PORT}`;

// Path to source files
const SOURCE_DIR = '/Users/williampearson/Legion/python-demo';

// Helper to send command and wait for response
function sendCommand(ws, cmd, args) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    // Longer timeout for large files
    const timeout = setTimeout(() => reject(new Error('Command timeout')), 120000);

    const handler = (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === id || !response.id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Command failed'));
        }
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({ id, cmd, args }));
  });
}

// Helper to show flashcard
async function showFlashcard(ws, title, subtitle, duration = 3000) {
  console.log(`\n📌 ${title}`);
  console.log(`   ${subtitle}`);
  await sendCommand(ws, 'showFlashcard', { title, subtitle, column: 3 });
  await new Promise(resolve => setTimeout(resolve, duration));
}

// Helper to create file with streaming from source
async function createFileFromSource(ws, sourcePath, targetPath, cps = 150) {
  console.log(`\n📝 Creating ${targetPath}...`);
  const content = readFileSync(join(SOURCE_DIR, sourcePath), 'utf-8');
  await sendCommand(ws, 'open', { file: targetPath, column: 1, create: true });
  await sendCommand(ws, 'type', { text: content, cps });
  await sendCommand(ws, 'save', {});
  console.log(`✅ ${targetPath} created (${content.length} characters)`);
}

async function runDemo() {
  // Clean up target directory first
  const targetDir = '/Users/williampearson/Legion/python-demo-practice';
  console.log('🧹 Cleaning target directory...');
  const { execSync } = await import('child_process');
  execSync(`rm -rf ${targetDir}`);
  execSync(`mkdir -p ${targetDir}/src/agents ${targetDir}/src/static/css ${targetDir}/src/static/js ${targetDir}/src/templates`);
  console.log('✅ Target directory cleaned\n');

  const ws = new WebSocket(URL);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log('🎬 Starting Multi-Agent Research System Demo...\n');

  try {
    // Opening
    await showFlashcard(ws,
      '🤖 Multi-Agent Research System',
      'Building an AI-powered research assistant with LangGraph',
      4000
    );

    // Step 1: Models
    await showFlashcard(ws,
      '📊 Step 1: Data Models',
      'Creating Pydantic models for type-safe agent communication',
      3000
    );

    await createFileFromSource(ws,
      'src/models.py',
      'python-demo-practice/src/models.py',
      600
    );

    // Step 2: State
    await showFlashcard(ws,
      '🔄 Step 2: Agent State',
      'Defining TypedDict for LangGraph workflow state',
      3000
    );

    await createFileFromSource(ws,
      'src/state.py',
      'python-demo-practice/src/state.py',
      600
    );

    // Step 3: Web Search Agent
    await showFlashcard(ws,
      '🔍 Step 3: Web Search Agent',
      'Integrating Serper API for intelligent web search',
      3000
    );

    await createFileFromSource(ws,
      'src/agents/web_search.py',
      'python-demo-practice/src/agents/web_search.py',
      600
    );

    // Step 4: Dashboard HTML
    await showFlashcard(ws,
      '🎨 Step 4: Dashboard HTML',
      'Creating clean HTML structure for real-time UI',
      3000
    );

    await createFileFromSource(ws,
      'src/templates/dashboard.html',
      'python-demo-practice/src/templates/dashboard.html',
      600
    );

    // Step 5: Dashboard Styles
    await showFlashcard(ws,
      '✨ Step 5: Dashboard Styles',
      'Crafting beautiful CSS with gradients and animations',
      3000
    );

    await createFileFromSource(ws,
      'src/static/css/dashboard.css',
      'python-demo-practice/src/static/css/dashboard.css',
      600
    );

    // Step 6: Dashboard Logic
    await showFlashcard(ws,
      '⚡ Step 6: Dashboard Logic',
      'WebSocket client with real-time progress tracking',
      3000
    );

    await createFileFromSource(ws,
      'src/static/js/dashboard.js',
      'python-demo-practice/src/static/js/dashboard.js',
      600
    );

    // Step 7: Web Server
    await showFlashcard(ws,
      '🌐 Step 7: Web Server',
      'Python HTTP server with static file handling',
      3000
    );

    await createFileFromSource(ws,
      'web_app.py',
      'python-demo-practice/web_app.py',
      600
    );

    // Finale
    await showFlashcard(ws,
      '✨ Demo Complete!',
      'Multi-agent research system with professional frontend',
      3000
    );

    await sendCommand(ws, 'closeFlashcard', {});

    console.log('\n🎉 Demo complete! All files created successfully.');
    console.log('\nNext: Run from existing python-demo directory to see it in action!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    ws.close();
    process.exit(0);
  }
}

runDemo().catch(console.error);
