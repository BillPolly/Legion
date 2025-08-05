#!/usr/bin/env node

import PlaywrightWrapper from '../../playwright/src/PlaywrightWrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function completeVideoDemo() {
  console.log('🎬 Complete Video Demo - Server + Recording\n');

  let serverProcess = null;
  const wrapper = new PlaywrightWrapper({ headless: false }); // Show browser for demo
  
  try {
    const demoDir = path.join(__dirname, '..', '__tests__', 'tmp', 'complete-video-demo');
    await fs.mkdir(demoDir, { recursive: true });
    
    // Create server file (reuse the beautiful animated page)
    console.log('📄 Creating server file...');
    await fs.writeFile(path.join(demoDir, 'server.mjs'), `
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`<!DOCTYPE html>
<html>
<head>
    <title>Legion AI - Video Recording Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100vh;
            background: linear-gradient(270deg, #1a1c20, #2d1b69, #4c1d95, #2d1b69, #1a1c20);
            background-size: 500% 500%;
            animation: gradientShift 15s ease infinite;
            color: white;
            overflow-x: hidden;
        }
        
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        /* Animated particles */
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
            background: rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            animation: float 15s infinite linear;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
        
        @keyframes float {
            from {
                transform: translateY(100vh) translateX(0) scale(0);
                opacity: 0;
            }
            10% {
                transform: scale(1);
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            to {
                transform: translateY(-100vh) translateX(100px) scale(0);
                opacity: 0;
            }
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
            backdrop-filter: blur(10px);
            animation: slideIn 0.5s ease-out;
            z-index: 10;
        }
        
        .recording-dot {
            width: 12px;
            height: 12px;
            background: #ef4444;
            border-radius: 50%;
            animation: recordPulse 1.5s infinite;
        }
        
        @keyframes recordPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.3); }
        }
        
        /* Animated orb */
        .orb-container {
            position: relative;
            margin-bottom: 60px;
        }
        
        .orb {
            width: 300px;
            height: 300px;
            background: radial-gradient(circle at 30% 30%, #f59e0b, #ec4899, #8b5cf6);
            border-radius: 50%;
            position: relative;
            animation: pulse 3s ease-in-out infinite, rotate 20s linear infinite;
            box-shadow: 
                0 0 100px rgba(236, 72, 153, 0.8),
                inset 0 0 50px rgba(255, 255, 255, 0.3);
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        /* Title */
        h1 {
            font-size: 5em;
            font-weight: 800;
            background: linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6, #10b981);
            background-size: 200% auto;
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shine 3s linear infinite;
            text-align: center;
            margin-bottom: 20px;
        }
        
        @keyframes shine {
            to { background-position: 200% center; }
        }
        
        .subtitle {
            font-size: 2em;
            margin-bottom: 50px;
            opacity: 0.9;
            text-align: center;
            animation: fadeInUp 1s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 0.9;
                transform: translateY(0);
            }
        }
        
        /* Feature cards with stagger animation */
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
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            animation: cardFloat 4s ease-in-out infinite;
            transition: all 0.3s ease;
        }
        
        .feature-card:nth-child(1) { animation-delay: 0s; }
        .feature-card:nth-child(2) { animation-delay: 0.5s; }
        .feature-card:nth-child(3) { animation-delay: 1s; }
        
        @keyframes cardFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        
        .feature-icon {
            font-size: 4em;
            margin-bottom: 20px;
            animation: iconSpin 8s linear infinite;
        }
        
        @keyframes iconSpin {
            from { transform: rotateY(0deg); }
            to { transform: rotateY(360deg); }
        }
        
        /* Progress bar */
        .progress-container {
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            width: 300px;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
        }
        
        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6);
            animation: progress 10s linear;
        }
        
        @keyframes progress {
            from { width: 0%; }
            to { width: 100%; }
        }
        
        @keyframes slideIn {
            from { transform: translateX(-100px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
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
        \${Array.from({length: 100}, (_, i) => \`
            <div class="particle" style="
                left: \${Math.random() * 100}%;
                animation-delay: \${Math.random() * 15}s;
                animation-duration: \${10 + Math.random() * 10}s;
            "></div>
        \`).join('')}
    </div>
    
    <div class="content">
        <div class="orb-container">
            <div class="orb"></div>
        </div>
        
        <h1>Legion AI Framework</h1>
        <p class="subtitle">🎥 Video Recording Demo in Progress</p>
        
        <div class="features">
            <div class="feature-card">
                <div class="feature-icon">🚀</div>
                <h3>High Performance</h3>
                <p>Lightning-fast execution</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">🎨</div>
                <h3>Beautiful UI</h3>
                <p>Stunning animations</p>
            </div>
            
            <div class="feature-card">
                <div class="feature-icon">📹</div>
                <h3>Video Recording</h3>
                <p>Capture everything</p>
            </div>
        </div>
    </div>
    
    <!-- Progress bar -->
    <div class="progress-container">
        <div class="progress-bar"></div>
    </div>
</body>
</html>\`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3461, () => {
  console.log('Server running at http://localhost:3461');
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

    // Record video
    const videoPath = path.join(demoDir, 'animated-demo.webm');
    console.log('🎬 Recording video...');
    console.log(`   Duration: 10 seconds`);
    console.log(`   Output: ${videoPath}`);
    console.log('\n   Recording in progress...\n');
    
    const result = await wrapper.recordVideo({
      path: videoPath,
      duration: 10,
      url: 'http://localhost:3461'
    });
    
    if (result.success) {
      console.log('✅ Video recorded successfully!');
      console.log(`   📁 Path: ${result.path}`);
      console.log(`   📏 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   ⏱️  Duration: ${result.duration} seconds`);
      
      console.log('\n🎉 Success! The video captures:');
      console.log('   • Animated gradient background');
      console.log('   • Floating particles with glow effects');
      console.log('   • Rotating and pulsing orb');
      console.log('   • Animated title with color gradient');
      console.log('   • Floating feature cards');
      console.log('   • Progress bar animation');
      console.log('   • Recording indicator');
    } else {
      console.error('\n❌ Recording failed');
    }

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

completeVideoDemo().catch(console.error);