#!/usr/bin/env node

import PlaywrightWrapper from '../../playwright/src/PlaywrightWrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function mp4VideoDemo() {
  console.log('🎬 MP4 Video Demo - VSCode Compatible\n');

  let serverProcess = null;
  const wrapper = new PlaywrightWrapper({ headless: false });
  
  try {
    const demoDir = path.join(__dirname, '..', '__tests__', 'tmp', 'mp4-demo');
    await fs.mkdir(demoDir, { recursive: true });
    
    // Create the beautiful server
    console.log('📄 Creating server...');
    await fs.writeFile(path.join(demoDir, 'server.mjs'), `
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`<!DOCTYPE html>
<html>
<head>
    <title>Legion AI - MP4 Recording Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100vh;
            background: #0f172a;
            color: white;
            overflow: hidden;
        }
        
        /* Animated background */
        .bg {
            position: fixed;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, #6366f1 0%, #8b5cf6 25%, #ec4899 50%, #f59e0b 75%, #6366f1 100%);
            animation: rotate 20s linear infinite;
            opacity: 0.1;
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
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
        
        /* Format indicator */
        .format-badge {
            position: fixed;
            top: 40px;
            right: 40px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            padding: 12px 24px;
            border-radius: 30px;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.5);
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        /* Main title */
        h1 {
            font-size: 6em;
            font-weight: 900;
            margin-bottom: 20px;
            background: linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6, #fbbf24);
            background-size: 300% 100%;
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: gradient 3s ease-in-out infinite;
            text-align: center;
        }
        
        @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .subtitle {
            font-size: 2em;
            margin-bottom: 60px;
            opacity: 0.8;
        }
        
        /* Demo grid */
        .demo-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 30px;
            max-width: 900px;
            width: 100%;
        }
        
        .demo-card {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
            border: 1px solid rgba(99, 102, 241, 0.3);
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            animation: cardFloat 3s ease-in-out infinite;
        }
        
        .demo-card:nth-child(1) { animation-delay: 0s; }
        .demo-card:nth-child(2) { animation-delay: 1s; }
        .demo-card:nth-child(3) { animation-delay: 2s; }
        
        @keyframes cardFloat {
            0%, 100% { transform: translateY(0) rotateX(0); }
            50% { transform: translateY(-20px) rotateX(5deg); }
        }
        
        .demo-card:hover {
            transform: translateY(-10px) scale(1.05);
            border-color: rgba(139, 92, 246, 0.6);
            box-shadow: 0 20px 40px rgba(139, 92, 246, 0.3);
        }
        
        .icon {
            font-size: 3em;
            margin-bottom: 20px;
            display: inline-block;
            animation: iconRotate 4s ease-in-out infinite;
        }
        
        @keyframes iconRotate {
            0%, 100% { transform: rotateY(0); }
            50% { transform: rotateY(180deg); }
        }
        
        /* Loading bar */
        .loading-container {
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            width: 400px;
        }
        
        .loading-text {
            text-align: center;
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        
        .loading-bar {
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
        }
        
        .loading-progress {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
            animation: load 10s linear;
            border-radius: 3px;
        }
        
        @keyframes load {
            from { width: 0%; }
            to { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="bg"></div>
    
    <div class="format-badge">
        📹 MP4 Format
    </div>
    
    <div class="content">
        <h1>Legion AI</h1>
        <p class="subtitle">Recording in VSCode-Compatible MP4 Format</p>
        
        <div class="demo-grid">
            <div class="demo-card">
                <div class="icon">🎥</div>
                <h3>MP4 Recording</h3>
                <p>High-quality video capture</p>
            </div>
            
            <div class="demo-card">
                <div class="icon">💻</div>
                <h3>VSCode Ready</h3>
                <p>Play directly in editor</p>
            </div>
            
            <div class="demo-card">
                <div class="icon">✨</div>
                <h3>Beautiful UI</h3>
                <p>Smooth animations</p>
            </div>
        </div>
    </div>
    
    <div class="loading-container">
        <p class="loading-text">Recording Progress</p>
        <div class="loading-bar">
            <div class="loading-progress"></div>
        </div>
    </div>
</body>
</html>\`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3462, () => {
  console.log('Server running at http://localhost:3462');
});
`);
    
    // Start server
    console.log('\n🌐 Starting server...');
    serverProcess = spawn('node', [path.join(demoDir, 'server.mjs')], {
      stdio: 'pipe',
      detached: false
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server timeout')), 5000);
      serverProcess.stdout.on('data', (data) => {
        console.log('   ', data.toString().trim());
        if (data.toString().includes('Server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Server is running\n');

    // Test different video formats
    console.log('🎬 Recording videos in different formats...\n');
    
    // Test 1: MP4 format (using path extension)
    console.log('1️⃣  Recording MP4 (path extension)...');
    const mp4Path = path.join(demoDir, 'demo-vscode.mp4');
    const mp4Result = await wrapper.recordVideo({
      path: mp4Path,
      duration: 8,
      url: 'http://localhost:3462'
    });
    
    if (mp4Result.success) {
      console.log('   ✅ MP4 recorded:', mp4Path);
      console.log('   📏 Size:', (mp4Result.size / 1024 / 1024).toFixed(2), 'MB\n');
    }
    
    // Test 2: WebM format (using format parameter)
    console.log('2️⃣  Recording WebM (format parameter)...');
    const webmPath = path.join(demoDir, 'demo-original');
    const webmResult = await wrapper.recordVideo({
      path: webmPath, // No extension
      format: 'webm',
      duration: 5,
      url: 'http://localhost:3462'
    });
    
    if (webmResult.success) {
      console.log('   ✅ WebM recorded:', webmResult.path);
      console.log('   📏 Size:', (webmResult.size / 1024 / 1024).toFixed(2), 'MB\n');
    }
    
    // Test 3: Default format (no path, no format)
    console.log('3️⃣  Recording with defaults...');
    const defaultResult = await wrapper.recordVideo({
      duration: 5,
      url: 'http://localhost:3462'
    });
    
    if (defaultResult.success) {
      console.log('   ✅ Default recorded:', defaultResult.path);
      console.log('   📏 Size:', (defaultResult.size / 1024 / 1024).toFixed(2), 'MB\n');
    }
    
    console.log('🎉 All recordings complete!');
    console.log('\n📁 Files saved in:', demoDir);
    console.log('\n💡 Tips:');
    console.log('   • The .mp4 file should be playable in VSCode');
    console.log('   • WebM files may need external player');
    console.log('   • Use path extension or format parameter to control output');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (serverProcess) {
      console.log('\n🛑 Stopping server...');
      serverProcess.kill();
    }
    await wrapper.close();
  }
}

mp4VideoDemo().catch(console.error);