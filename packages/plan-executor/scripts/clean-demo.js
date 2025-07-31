#!/usr/bin/env node

import PlaywrightWrapper from '../../playwright/src/PlaywrightWrapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanDemo() {
  console.log('🎯 Clean Demo: Server + Screenshot\n');

  let serverProcess = null;
  const wrapper = new PlaywrightWrapper({ headless: true });
  
  try {
    const demoDir = path.join(__dirname, '..', '__tests__', 'tmp', 'clean-demo');
    
    // Create directory
    await fs.mkdir(demoDir, { recursive: true });
    console.log(`📁 Created directory: ${demoDir}`);

    // Create server file
    await fs.writeFile(path.join(demoDir, 'server.mjs'), `
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`<!DOCTYPE html>
<html>
<head>
    <title>Legion AI Framework - Beautiful Demo</title>
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
    </style>
</head>
<body>
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

server.listen(3459, () => {
  console.log('Server running at http://localhost:3459');
});
`);
    console.log('✅ Created server file');

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

    // Navigate and screenshot
    console.log('📸 Taking screenshot...');
    const navResult = await wrapper.navigateToPage('http://localhost:3459');
    console.log('   Navigation:', navResult.success ? '✅ Success' : '❌ Failed');

    const screenshotPath = path.join(demoDir, 'screenshot.png');
    const screenshotResult = await wrapper.takeScreenshot({
      path: screenshotPath,
      fullPage: false,
      format: 'png'
    });

    console.log('   Screenshot:', screenshotResult.success ? '✅ Success' : '❌ Failed');
    
    if (screenshotResult.savedPath) {
      const stats = await fs.stat(screenshotResult.savedPath);
      console.log(`\n✅ Screenshot saved successfully!`);
      console.log(`   📍 Location: ${screenshotResult.savedPath}`);
      console.log(`   📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    }

    await wrapper.close();
    console.log('\n✅ Browser closed');
    
    // Kill server
    serverProcess.kill();
    console.log('✅ Server stopped');
    
    console.log('\n🎉 Demo complete! Check the screenshot at:');
    console.log(`   ${screenshotPath}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (serverProcess) serverProcess.kill();
    await wrapper.close();
  }
}

cleanDemo().catch(console.error);