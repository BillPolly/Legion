#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function videoRecordingPlan() {
  console.log('🎬 Video Recording Plan - Beautiful Animated Webpage\n');

  let serverProcess = null;
  
  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading modules...');
    
    // Load required modules
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'video-demo');

    // Plan to create server files
    const createServerPlan = {
      id: 'create-animated-server',
      name: 'Create Animated Server',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'setup',
          name: 'Create directories',
          actions: [
            {
              id: 'create-dir',
              type: 'file_operations',
              parameters: {
                dirpath: '$workspaceDir',
                operation: 'create'
              }
            }
          ]
        },
        {
          id: 'create-files',
          name: 'Create animated webpage',
          actions: [
            {
              id: 'write-server',
              type: 'file_operations',
              parameters: {
                operation: 'write',
                filepath: '$workspaceDir/server.mjs',
                content: `import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`<!DOCTYPE html>
<html>
<head>
    <title>Legion AI - Animated Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1c20 0%, #2d1b69 100%);
            color: white;
            overflow-x: hidden;
        }
        
        /* Animated background particles */
        .particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: 1;
        }
        
        .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            animation: float 20s infinite linear;
        }
        
        @keyframes float {
            from {
                transform: translateY(100vh) translateX(0);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            to {
                transform: translateY(-100vh) translateX(100px);
                opacity: 0;
            }
        }
        
        /* Main content */
        .content {
            position: relative;
            z-index: 2;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
        }
        
        /* Glowing orb */
        .orb {
            width: 300px;
            height: 300px;
            background: radial-gradient(circle at 30% 30%, #7c3aed, #2563eb);
            border-radius: 50%;
            position: relative;
            margin-bottom: 60px;
            box-shadow: 
                0 0 100px rgba(124, 58, 237, 0.8),
                inset 0 0 50px rgba(255, 255, 255, 0.2);
            animation: pulse 4s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
                box-shadow: 
                    0 0 100px rgba(124, 58, 237, 0.8),
                    inset 0 0 50px rgba(255, 255, 255, 0.2);
            }
            50% {
                transform: scale(1.05);
                box-shadow: 
                    0 0 150px rgba(124, 58, 237, 1),
                    inset 0 0 80px rgba(255, 255, 255, 0.3);
            }
        }
        
        /* Inner glow effect */
        .orb::before {
            content: '';
            position: absolute;
            top: 20%;
            left: 20%;
            width: 40%;
            height: 40%;
            background: radial-gradient(circle, rgba(255,255,255,0.8), transparent);
            border-radius: 50%;
            filter: blur(20px);
        }
        
        /* Title with gradient */
        h1 {
            font-size: 5em;
            font-weight: 800;
            background: linear-gradient(45deg, #7c3aed, #3b82f6, #8b5cf6);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
            text-align: center;
            text-shadow: 0 0 80px rgba(124, 58, 237, 0.5);
            animation: glow 2s ease-in-out infinite alternate;
        }
        
        @keyframes glow {
            from {
                filter: brightness(1);
            }
            to {
                filter: brightness(1.2);
            }
        }
        
        /* Subtitle */
        .subtitle {
            font-size: 1.8em;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 50px;
            text-align: center;
            letter-spacing: 2px;
        }
        
        /* Feature cards */
        .features {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 30px;
            max-width: 1000px;
            width: 100%;
            margin-top: 40px;
        }
        
        .feature-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }
        
        .feature-card:hover::before {
            left: 100%;
        }
        
        .feature-card:hover {
            transform: translateY(-10px);
            background: rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        .feature-icon {
            font-size: 3em;
            margin-bottom: 20px;
        }
        
        .feature-title {
            font-size: 1.5em;
            margin-bottom: 15px;
            color: #a78bfa;
        }
        
        .feature-description {
            font-size: 1.1em;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.7);
        }
        
        /* Status indicator */
        .status {
            position: fixed;
            top: 40px;
            right: 40px;
            background: rgba(16, 185, 129, 0.2);
            border: 2px solid #10b981;
            border-radius: 50px;
            padding: 15px 30px;
            display: flex;
            align-items: center;
            gap: 15px;
            backdrop-filter: blur(10px);
            animation: slideIn 0.5s ease-out;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .status-dot {
            width: 12px;
            height: 12px;
            background: #10b981;
            border-radius: 50%;
            animation: blink 2s infinite;
        }
        
        @keyframes blink {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.3;
            }
        }
        
        /* Timestamp */
        .timestamp {
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 1.2em;
            color: rgba(255, 255, 255, 0.5);
            letter-spacing: 1px;
        }
        
        /* Gradient border effect */
        .gradient-border {
            position: relative;
            background: linear-gradient(0deg, transparent, rgba(124, 58, 237, 0.5), transparent);
            padding: 2px;
            border-radius: 22px;
            margin-top: 40px;
        }
        
        .gradient-content {
            background: rgba(26, 28, 32, 0.9);
            border-radius: 20px;
            padding: 30px 50px;
            text-align: center;
        }
        
        .cta-text {
            font-size: 1.3em;
            color: #a78bfa;
            margin-bottom: 20px;
        }
        
        .tech-stack {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .tech-badge {
            background: rgba(124, 58, 237, 0.2);
            border: 1px solid rgba(124, 58, 237, 0.5);
            border-radius: 30px;
            padding: 8px 20px;
            font-size: 0.9em;
            color: #c4b5fd;
            transition: all 0.3s ease;
        }
        
        .tech-badge:hover {
            background: rgba(124, 58, 237, 0.4);
            transform: scale(1.1);
        }
        
        /* Recording indicator */
        .recording-indicator {
            position: fixed;
            top: 40px;
            left: 40px;
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(239, 68, 68, 0.2);
            border: 2px solid #ef4444;
            border-radius: 50px;
            padding: 10px 20px;
            animation: fadeIn 0.5s ease-out;
        }
        
        .recording-dot {
            width: 10px;
            height: 10px;
            background: #ef4444;
            border-radius: 50%;
            animation: recordPulse 1.5s infinite;
        }
        
        @keyframes recordPulse {
            0%, 100% {
                opacity: 1;
                transform: scale(1);
            }
            50% {
                opacity: 0.5;
                transform: scale(1.2);
            }
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <!-- Recording indicator -->
    <div class="recording-indicator">
        <div class="recording-dot"></div>
        <span>🎬 Recording Video</span>
    </div>
    
    <!-- Animated particles -->
    <div class="particles">
        \${Array.from({length: 50}, (_, i) => \`
            <div class="particle" style="
                left: \${Math.random() * 100}%;
                animation-delay: \${Math.random() * 20}s;
                animation-duration: \${15 + Math.random() * 10}s;
            "></div>
        \`).join('')}
    </div>
    
    <!-- Main content -->
    <div class="content">
        <!-- Status indicator -->
        <div class="status">
            <div class="status-dot"></div>
            <span>System Active</span>
        </div>
        
        <!-- Glowing orb -->
        <div class="orb"></div>
        
        <!-- Title and subtitle -->
        <h1>Legion AI Framework</h1>
        <p class="subtitle">Orchestrating Intelligence at Scale</p>
        
        <!-- Feature cards -->
        <div class="features">
            <div class="feature-card">
                <div class="feature-icon">🧠</div>
                <h3 class="feature-title">AI-Powered</h3>
                <p class="feature-description">Advanced neural processing with state-of-the-art language models</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3 class="feature-title">Lightning Fast</h3>
                <p class="feature-description">Optimized execution engine for real-time performance</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">🔧</div>
                <h3 class="feature-title">Modular Design</h3>
                <p class="feature-description">Extensible architecture with plug-and-play components</p>
            </div>
        </div>
        
        <!-- Call to action with gradient border -->
        <div class="gradient-border">
            <div class="gradient-content">
                <p class="cta-text">Built with cutting-edge technologies</p>
                <div class="tech-stack">
                    <span class="tech-badge">Node.js</span>
                    <span class="tech-badge">Playwright</span>
                    <span class="tech-badge">ES Modules</span>
                    <span class="tech-badge">AI Integration</span>
                    <span class="tech-badge">Real-time Processing</span>
                </div>
            </div>
        </div>
        
        <!-- Timestamp -->
        <div class="timestamp">
            Generated at \${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>\`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3460, () => {
  console.log('Server running at http://localhost:3460');
});
`
              }
            }
          ]
        }
      ]
    };

    console.log('\n📋 Step 1: Creating animated webpage...\n');
    
    // Execute the create server plan
    const createResult = await executor.executePlan(createServerPlan);
    
    if (!createResult.success) {
      throw new Error('Failed to create server files');
    }
    console.log('✅ Animated webpage created');

    // Start the server
    console.log('\n🌐 Step 2: Starting server...');
    serverProcess = spawn('node', [path.join(workspaceDir, 'server.mjs')], {
      stdio: 'pipe',
      detached: false
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
      
      serverProcess.stdout.on('data', (data) => {
        console.log('   Server:', data.toString().trim());
        if (data.toString().includes('Server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error('   Server error:', data.toString());
      });
    });

    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Server is running');

    // Plan to record video
    const recordVideoPlan = {
      id: 'record-video',
      name: 'Record Video of Animated Page',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'record',
          name: 'Record video for 15 seconds',
          actions: [
            {
              id: 'record-video',
              type: 'record_video',
              parameters: {
                path: '$workspaceDir/animated-webpage.webm',
                duration: 15, // 15 seconds to capture all animations
                url: 'http://localhost:3460'
              }
            }
          ]
        }
      ]
    };

    console.log('\n🎬 Step 3: Recording video...\n');
    console.log('   Recording 15 seconds of animated content...');
    
    // Add event listeners
    executor.on('action:start', (data) => {
      console.log(`   → Starting: ${data.action.type}`);
    });
    
    executor.on('action:complete', (data) => {
      if (data.action.type === 'record_video' && data.result?.data) {
        console.log(`   ✓ Video recorded successfully`);
        console.log(`   📁 Path: ${data.result.data.path}`);
        console.log(`   📏 Size: ${(data.result.data.size / 1024 / 1024).toFixed(2)} MB`);
      }
    });
    
    executor.on('action:error', (data) => {
      console.error(`   ❌ Error: ${data.error?.message || data.error}`);
    });

    const recordResult = await executor.executePlan(recordVideoPlan);
    
    if (!recordResult.success) {
      throw new Error('Failed to record video');
    }

    console.log('\n✅ Video recording complete!');
    console.log(`\n🎉 Success! Video saved at:`);
    console.log(`   ${path.join(workspaceDir, 'animated-webpage.webm')}`);
    console.log('\n   The video captures all the beautiful animations:');
    console.log('   • Floating particles');
    console.log('   • Pulsing orb');
    console.log('   • Glowing text');
    console.log('   • Hover effects on cards');
    console.log('   • Blinking status indicators');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (serverProcess) {
      console.log('\n🛑 Stopping server...');
      serverProcess.kill();
    }
  }
}

// Run the video recording plan
videoRecordingPlan().catch(console.error);