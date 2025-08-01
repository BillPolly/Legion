#!/usr/bin/env node

import PlaywrightWrapper from '../../playwright/src/PlaywrightWrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createVSCodeCompatibleVideo() {
  console.log('🎬 Creating VS Code Compatible Video (WebM VP8/VP9)\n');

  let serverProcess = null;
  const wrapper = new PlaywrightWrapper({ headless: false });
  
  try {
    const demoDir = path.join(__dirname, '..', '__tests__', 'tmp', 'vscode-compatible');
    await fs.mkdir(demoDir, { recursive: true });
    
    // Create an animated webpage optimized for VS Code video recording
    console.log('📄 Creating animated webpage...');
    await fs.writeFile(path.join(demoDir, 'server.mjs'), `
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`<!DOCTYPE html>
<html>
<head>
    <title>VS Code Compatible Video Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100vh;
            background: linear-gradient(45deg, #0f172a 0%, #1e293b 25%, #334155 50%, #475569 75%, #64748b 100%);
            background-size: 400% 400%;
            animation: gradientShift 8s ease-in-out infinite;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        /* VS Code Compatible indicator */
        .compatibility-badge {
            position: fixed;
            top: 30px;
            right: 30px;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            padding: 15px 25px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 1.1em;
            box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
            animation: pulse 3s ease-in-out infinite;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        
        @keyframes pulse {
            0%, 100% { 
                transform: scale(1);
                box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
            }
            50% { 
                transform: scale(1.05);
                box-shadow: 0 8px 25px rgba(34, 197, 94, 0.6);
            }
        }
        
        /* Main content */
        .main-content {
            text-align: center;
            z-index: 10;
            position: relative;
        }
        
        /* Animated title */
        .main-title {
            font-size: 4.5em;
            font-weight: 900;
            margin-bottom: 30px;
            background: linear-gradient(90deg, #fbbf24, #f59e0b, #d97706, #92400e);
            background-size: 300% 100%;
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: titleGlow 4s ease-in-out infinite;
            text-shadow: 0 0 30px rgba(251, 191, 36, 0.5);
        }
        
        @keyframes titleGlow {
            0%, 100% { 
                background-position: 0% 50%;
                filter: brightness(1);
            }
            50% { 
                background-position: 100% 50%;
                filter: brightness(1.3);
            }
        }
        
        /* Subtitle */
        .subtitle {
            font-size: 1.8em;
            margin-bottom: 50px;
            color: rgba(255, 255, 255, 0.9);
            letter-spacing: 2px;
            animation: fadeInOut 6s ease-in-out infinite;
        }
        
        @keyframes fadeInOut {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        /* Feature grid */
        .features {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 25px;
            max-width: 900px;
            margin-top: 40px;
        }
        
        .feature {
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            transition: all 0.4s ease;
            position: relative;
            overflow: hidden;
            animation: cardFloat 4s ease-in-out infinite;
        }
        
        .feature:nth-child(1) { animation-delay: 0s; }
        .feature:nth-child(2) { animation-delay: 1.3s; }
        .feature:nth-child(3) { animation-delay: 2.6s; }
        
        @keyframes cardFloat {
            0%, 100% { 
                transform: translateY(0) rotate(0deg);
                border-color: rgba(255, 255, 255, 0.15);
            }
            33% { 
                transform: translateY(-15px) rotate(1deg);
                border-color: rgba(251, 191, 36, 0.4);
            }
            66% { 
                transform: translateY(-5px) rotate(-0.5deg);
                border-color: rgba(34, 197, 94, 0.4);
            }
        }
        
        .feature::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            transition: left 0.6s;
        }
        
        .feature:hover::before {
            left: 100%;
        }
        
        .feature-icon {
            font-size: 2.5em;
            margin-bottom: 15px;
            display: inline-block;
            animation: iconSpin 6s linear infinite;
        }
        
        .feature:nth-child(1) .feature-icon { animation-delay: 0s; }
        .feature:nth-child(2) .feature-icon { animation-delay: 2s; }
        .feature:nth-child(3) .feature-icon { animation-delay: 4s; }
        
        @keyframes iconSpin {
            0% { transform: rotateY(0deg); }
            25% { transform: rotateY(90deg); }
            50% { transform: rotateY(180deg); }
            75% { transform: rotateY(270deg); }
            100% { transform: rotateY(360deg); }
        }
        
        .feature-title {
            font-size: 1.3em;
            margin-bottom: 10px;
            color: #fbbf24;
            font-weight: 600;
        }
        
        .feature-desc {
            font-size: 1em;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.5;
        }
        
        /* Progress bar */
        .progress-container {
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            width: 400px;
        }
        
        .progress-label {
            text-align: center;
            margin-bottom: 10px;
            font-size: 1.1em;
            color: rgba(255, 255, 255, 0.9);
        }
        
        .progress-bar {
            height: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #22c55e, #16a34a, #15803d);
            border-radius: 4px;
            animation: progressLoad 12s linear infinite;
        }
        
        @keyframes progressLoad {
            0% { width: 0%; }
            100% { width: 100%; }
        }
        
        /* Floating particles */
        .particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        }
        
        .particle {
            position: absolute;
            width: 3px;
            height: 3px;
            background: rgba(251, 191, 36, 0.6);
            border-radius: 50%;
            animation: particleFloat 15s infinite linear;
        }
        
        @keyframes particleFloat {
            from {
                transform: translateY(100vh) translateX(0) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            to {
                transform: translateY(-10vh) translateX(50px) rotate(360deg);
                opacity: 0;
            }
        }
        
        /* Format indicator */
        .format-info {
            position: fixed;
            top: 30px;
            left: 30px;
            background: rgba(59, 130, 246, 0.2);
            border: 2px solid #3b82f6;
            border-radius: 20px;
            padding: 12px 20px;
            font-size: 0.9em;
            backdrop-filter: blur(10px);
            animation: slideIn 1s ease-out;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(-100px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <!-- Format info -->
    <div class="format-info">
        🎥 WebM VP8/VP9<br>
        🎵 Vorbis Audio
    </div>
    
    <!-- VS Code compatible badge -->
    <div class="compatibility-badge">
        ✅ VS Code Compatible
    </div>
    
    <!-- Floating particles -->
    <div class="particles">
        \${Array.from({length: 30}, (_, i) => \`
            <div class="particle" style="
                left: \${Math.random() * 100}%;
                animation-delay: \${Math.random() * 15}s;
                animation-duration: \${12 + Math.random() * 6}s;
            "></div>
        \`).join('')}
    </div>
    
    <!-- Main content -->
    <div class="main-content">
        <h1 class="main-title">Legion AI</h1>
        <p class="subtitle">VS Code Video Playback Demo</p>
        
        <div class="features">
            <div class="feature">
                <div class="feature-icon">🎬</div>
                <h3 class="feature-title">WebM Format</h3>
                <p class="feature-desc">VP8/VP9 video codec with Vorbis audio</p>
            </div>
            
            <div class="feature">
                <div class="feature-icon">💻</div>
                <h3 class="feature-title">VS Code Native</h3>
                <p class="feature-desc">Plays directly in editor without extensions</p>
            </div>
            
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <h3 class="feature-title">Optimized</h3>
                <p class="feature-desc">Smooth animations and transitions</p>
            </div>
        </div>
    </div>
    
    <!-- Progress indicator -->
    <div class="progress-container">
        <div class="progress-label">Recording Progress</div>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
    </div>
</body>
</html>\`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3465, () => {
  console.log('Server running at http://localhost:3465');
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

    // Record MP4 video for VS Code preview
    console.log('🎬 Recording VS Code Compatible MP4 video...\n');
    console.log('   Recording 12 seconds of animated content...');
    console.log('   Format: MP4 (VS Code can preview this)');
    console.log('   Note: Will record as WebM first, then convert if possible');
    
    const mp4Path = path.join(demoDir, 'vscode-compatible-demo.mp4');
    const result = await wrapper.recordVideo({
      path: mp4Path,
      duration: 12,
      url: 'http://localhost:3465',
      format: 'mp4'
    });
    
    if (result.success) {
      console.log(`\n✅ ${result.format?.toUpperCase() || 'Video'} recorded successfully!`);
      console.log(`📁 Path: ${result.path}`);
      console.log(`📏 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
      if (result.warning) {
        console.log(`⚠️  ${result.warning}`);
      }
      
      // Verify the file exists and get stats
      try {
        const stats = await fs.stat(result.path);
        console.log(`📅 Created: ${stats.birthtime.toLocaleString()}`);
        console.log(`🔧 Mode: ${stats.mode.toString(8)}`);
        
        console.log('\n🎉 Success! Video is ready for VS Code:');
        console.log(`   • Open VS Code`);
        console.log(`   • Navigate to: ${result.path}`);
        console.log(`   • Click on the file to preview`);
        console.log(`   • Video should display in VS Code's preview pane`);
        
        console.log('\n✨ Features in the video:');
        console.log('   • Animated gradient background');
        console.log('   • Floating particles');
        console.log('   • Pulsing compatibility badge');
        console.log('   • Rotating feature icons');
        console.log('   • Progressive loading bar');
        console.log('   • Smooth card animations');
        
      } catch (error) {
        console.error('❌ Error verifying file:', error.message);
      }
    } else {
      throw new Error('Failed to record WebM video');
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

createVSCodeCompatibleVideo().catch(console.error);