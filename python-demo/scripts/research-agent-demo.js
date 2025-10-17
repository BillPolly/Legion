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

// Path to source files (relative to this script)
// This script is in python-demo/scripts/
// Source files are in python-demo (parent directory)
const SOURCE_DIR = join(__dirname, '..');

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
async function createFileFromSource(ws, sourcePath, targetPath, cps = 600) {
  console.log(`\n📝 Creating ${targetPath}...`);
  const content = readFileSync(join(SOURCE_DIR, sourcePath), 'utf-8');
  await sendCommand(ws, 'open', { file: targetPath, column: 1, create: true });
  await sendCommand(ws, 'type', { text: content, cps });
  await sendCommand(ws, 'save', {});
  console.log(`✅ ${targetPath} created (${content.length} characters)`);

  // Wait for formatting, then close the tab
  await new Promise(r => setTimeout(r, 1500));
  await sendCommand(ws, 'closeTab', { column: 1 });
}

async function runDemo() {
  // Target directory is the current working directory where the user runs the script
  const targetDir = process.cwd();
  console.log(`🎯 Creating project in: ${targetDir}\n`);
  console.log('🧹 Setting up directory structure...');
  const { execSync } = await import('child_process');
  execSync(`mkdir -p ${targetDir}/src/agents ${targetDir}/src/static/css ${targetDir}/src/static/js ${targetDir}/src/templates`);
  console.log('✅ Directory structure ready\n');

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
    // Show PRD first
    console.log('📋 Showing Product Requirements Document...');
    await showFlashcard(ws,
      '📋 Product Requirements',
      'Multi-Agent Research System with 6 AI Agents',
      2000
    );

    const prdPath = `file://${SOURCE_DIR}/src/static/prd.html`;
    await sendCommand(ws, 'openUrl', { url: prdPath, column: 2 });
    await new Promise(r => setTimeout(r, 10000)); // Give time to read the PRD

    // Close PRD
    await sendCommand(ws, 'closeWebview', { url: prdPath });

    // Opening
    await showFlashcard(ws,
      '🤖 Multi-Agent Research System',
      'Building a sophisticated multi-agent system that does web search, synthesizes reports, and adds sources with verified links',
      4000
    );

    // Dependencies
    await showFlashcard(ws, '📦 Dependencies', 'requirements.txt - Python packages', 1500);
    await createFileFromSource(ws, 'requirements.txt', 'requirements.txt', 600);

    // Core Infrastructure
    await showFlashcard(ws, '📦 Package Init', 'src/__init__.py', 1500);
    await createFileFromSource(ws, 'src/__init__.py', 'src/__init__.py', 600);

    await showFlashcard(ws, '📊 Data Models', 'Pydantic models for type-safe agent communication', 1500);
    await createFileFromSource(ws, 'src/models.py', 'src/models.py', 600);

    await showFlashcard(ws, '🔄 State Management', 'TypedDict for LangGraph workflow state', 1500);
    await createFileFromSource(ws, 'src/state.py', 'src/state.py', 600);

    await showFlashcard(ws, '💬 LLM Prompts', 'Carefully crafted prompts for each agent', 1500);
    await createFileFromSource(ws, 'src/prompts.py', 'src/prompts.py', 600);

    await showFlashcard(ws, '🔀 LangGraph Workflow', 'Orchestrating multi-agent collaboration', 1500);
    await createFileFromSource(ws, 'src/main.py', 'src/main.py', 600);

    // Agents
    await showFlashcard(ws, '🤖 Agent Package', 'src/agents/__init__.py', 1500);
    await createFileFromSource(ws, 'src/agents/__init__.py', 'src/agents/__init__.py', 600);

    await showFlashcard(ws, '📝 Query Planner', 'Planning intelligent search queries', 1500);
    await createFileFromSource(ws, 'src/agents/query_planner.py', 'src/agents/query_planner.py', 600);

    await showFlashcard(ws, '🔍 Web Search', 'Executing searches via Serper API', 1500);
    await createFileFromSource(ws, 'src/agents/web_search.py', 'src/agents/web_search.py', 600);

    await showFlashcard(ws, '🔗 Link Checker', 'Validating URL accessibility', 1500);
    await createFileFromSource(ws, 'src/agents/link_checker.py', 'src/agents/link_checker.py', 600);

    await showFlashcard(ws, '📄 Content Extractor', 'Extracting and summarizing pages', 1500);
    await createFileFromSource(ws, 'src/agents/content_extractor.py', 'src/agents/content_extractor.py', 600);

    await showFlashcard(ws, '📊 Analyst', 'Generating comprehensive reports', 1500);
    await createFileFromSource(ws, 'src/agents/analyst.py', 'src/agents/analyst.py', 600);

    await showFlashcard(ws, '🎯 Supervisor', 'Routing workflow between agents', 1500);
    await createFileFromSource(ws, 'src/agents/supervisor.py', 'src/agents/supervisor.py', 600);

    // Frontend
    await showFlashcard(ws, '🎨 Dashboard HTML', 'Clean structure for real-time UI', 1500);
    await createFileFromSource(ws, 'src/templates/dashboard.html', 'src/templates/dashboard.html', 600);

    await showFlashcard(ws, '✨ Dashboard CSS', 'Beautiful gradients and animations', 1500);
    await createFileFromSource(ws, 'src/static/css/dashboard.css', 'src/static/css/dashboard.css', 600);

    await showFlashcard(ws, '⚡ Dashboard JS', 'WebSocket client with progress tracking', 1500);
    await createFileFromSource(ws, 'src/static/js/dashboard.js', 'src/static/js/dashboard.js', 600);

    // Web Server
    await showFlashcard(ws, '🌐 Web Server', 'HTTP + WebSocket server', 1500);
    await createFileFromSource(ws, 'web_app.py', 'web_app.py', 600);

    // Installation
    await showFlashcard(ws,
      '📦 Installing Dependencies',
      'pip install langchain langgraph anthropic python-dotenv websockets',
      2000
    );

    // Show PR
    console.log('\n\n📋 Here is the PR...');
    await showFlashcard(ws,
      '📋 Here is the PR',
      'feat: Add Multi-Agent Research System with 6 AI Agents',
      2000
    );

    const prPath = `file://${SOURCE_DIR}/src/static/pr.html`;
    await sendCommand(ws, 'openUrl', { url: prPath, column: 2 });
    await new Promise(r => setTimeout(r, 8000)); // Give time to read the PR

    // Close PR
    await sendCommand(ws, 'closeWebview', { url: prPath });

    // Open dashboard
    console.log('\n\n🌐 Opening dashboard...');
    await sendCommand(ws, 'openUrl', { url: 'http://localhost:8000', column: 2 });
    await new Promise(r => setTimeout(r, 2000));

    await sendCommand(ws, 'closeFlashcard', {});

    // Stop timer
    clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(totalTime / 60);
    const secs = totalTime % 60;

    console.log(`\n\n🎉 Demo complete!`);
    console.log(`⏱️  Total time: ${mins}:${secs.toString().padStart(2, '0')}`);
    console.log(`📁 16 files created`);
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
