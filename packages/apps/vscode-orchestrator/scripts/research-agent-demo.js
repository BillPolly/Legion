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

  // Start timer
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    process.stdout.write(`\r⏱️  Elapsed: ${mins}:${secs.toString().padStart(2, '0')}`);
  }, 1000);

  console.log('🎬 Starting Multi-Agent Research System Demo...\n');

  try {
    // Opening
    await showFlashcard(ws,
      '🤖 Multi-Agent Research System',
      'Building an AI-powered research assistant with LangGraph',
      4000
    );

    // Core Infrastructure
    await showFlashcard(ws, '📦 Package Init', 'src/__init__.py', 1500);
    await createFileFromSource(ws, 'src/__init__.py', 'python-demo-practice/src/__init__.py', 600);

    await showFlashcard(ws, '📊 Data Models', 'Pydantic models for type-safe agent communication', 1500);
    await createFileFromSource(ws, 'src/models.py', 'python-demo-practice/src/models.py', 600);

    await showFlashcard(ws, '🔄 State Management', 'TypedDict for LangGraph workflow state', 1500);
    await createFileFromSource(ws, 'src/state.py', 'python-demo-practice/src/state.py', 600);

    await showFlashcard(ws, '💬 LLM Prompts', 'Carefully crafted prompts for each agent', 1500);
    await createFileFromSource(ws, 'src/prompts.py', 'python-demo-practice/src/prompts.py', 600);

    await showFlashcard(ws, '🔀 LangGraph Workflow', 'Orchestrating multi-agent collaboration', 1500);
    await createFileFromSource(ws, 'src/main.py', 'python-demo-practice/src/main.py', 600);

    // Agents
    await showFlashcard(ws, '🤖 Agent Package', 'src/agents/__init__.py', 1500);
    await createFileFromSource(ws, 'src/agents/__init__.py', 'python-demo-practice/src/agents/__init__.py', 600);

    await showFlashcard(ws, '📝 Query Planner', 'Planning intelligent search queries', 1500);
    await createFileFromSource(ws, 'src/agents/query_planner.py', 'python-demo-practice/src/agents/query_planner.py', 600);

    await showFlashcard(ws, '🔍 Web Search', 'Executing searches via Serper API', 1500);
    await createFileFromSource(ws, 'src/agents/web_search.py', 'python-demo-practice/src/agents/web_search.py', 600);

    await showFlashcard(ws, '🔗 Link Checker', 'Validating URL accessibility', 1500);
    await createFileFromSource(ws, 'src/agents/link_checker.py', 'python-demo-practice/src/agents/link_checker.py', 600);

    await showFlashcard(ws, '📄 Content Extractor', 'Extracting and summarizing pages', 1500);
    await createFileFromSource(ws, 'src/agents/content_extractor.py', 'python-demo-practice/src/agents/content_extractor.py', 600);

    await showFlashcard(ws, '📊 Analyst', 'Generating comprehensive reports', 1500);
    await createFileFromSource(ws, 'src/agents/analyst.py', 'python-demo-practice/src/agents/analyst.py', 600);

    await showFlashcard(ws, '🎯 Supervisor', 'Routing workflow between agents', 1500);
    await createFileFromSource(ws, 'src/agents/supervisor.py', 'python-demo-practice/src/agents/supervisor.py', 600);

    // Frontend
    await showFlashcard(ws, '🎨 Dashboard HTML', 'Clean structure for real-time UI', 1500);
    await createFileFromSource(ws, 'src/templates/dashboard.html', 'python-demo-practice/src/templates/dashboard.html', 600);

    await showFlashcard(ws, '✨ Dashboard CSS', 'Beautiful gradients and animations', 1500);
    await createFileFromSource(ws, 'src/static/css/dashboard.css', 'python-demo-practice/src/static/css/dashboard.css', 600);

    await showFlashcard(ws, '⚡ Dashboard JS', 'WebSocket client with progress tracking', 1500);
    await createFileFromSource(ws, 'src/static/js/dashboard.js', 'python-demo-practice/src/static/js/dashboard.js', 600);

    // Web Server
    await showFlashcard(ws, '🌐 Web Server', 'HTTP + WebSocket server', 1500);
    await createFileFromSource(ws, 'web_app.py', 'python-demo-practice/web_app.py', 600);

    // Installation
    await showFlashcard(ws,
      '📦 Installing Dependencies',
      'pip install langchain langgraph anthropic python-dotenv websockets',
      2000
    );

    // Starting Server
    await showFlashcard(ws,
      '🚀 Starting Server',
      'Launching HTTP (8000) and WebSocket (8765) servers...',
      2000
    );

    // Open dashboard
    console.log('\n\n🌐 Opening dashboard...');
    await sendCommand(ws, 'openUrl', { url: 'http://localhost:8000', column: 2 });
    await new Promise(r => setTimeout(r, 2000));

    // Fill search input
    await showFlashcard(ws,
      '🔍 Running Research',
      'Topic: "AI agents in 2025"',
      2000
    );

    console.log('📝 Filling search input...');
    await sendCommand(ws, 'fillInput', {
      url: 'http://localhost:8000',
      selector: '#topic-input',
      value: 'AI agents in 2025'
    });

    await new Promise(r => setTimeout(r, 500));

    // Click start button
    console.log('🖱️  Clicking start button...');
    await sendCommand(ws, 'clickElement', {
      url: 'http://localhost:8000',
      selector: '#start-button'
    });

    await sendCommand(ws, 'closeFlashcard', {});

    // Stop timer
    clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(totalTime / 60);
    const secs = totalTime % 60;

    console.log(`\n\n🎉 Demo complete!`);
    console.log(`⏱️  Total time: ${mins}:${secs.toString().padStart(2, '0')}`);
    console.log(`📁 ${15} files created`);
    console.log(`🤖 6 AI agents built`);
    console.log(`🌐 Dashboard live at http://localhost:8000`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    clearInterval(timerInterval);
  } finally {
    ws.close();
    process.exit(0);
  }
}

runDemo().catch(console.error);
