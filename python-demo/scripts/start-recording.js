#!/usr/bin/env node
/**
 * Start screen recording for demo
 * Records full screen using ffmpeg
 * Runs WebSocket server to receive stop command
 */

import { spawn } from 'child_process';
import WebSocket, { WebSocketServer } from 'ws';

const WS_PORT = 9999;
const OUTPUT_FILE = process.cwd() + '/demo-recording.mp4';

console.log('🎥 Starting full screen recording...');
console.log(`📁 Output will be saved to: ${OUTPUT_FILE}`);

try {
  // Start ffmpeg with spawn - full screen capture (no cropping)
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'avfoundation',
    '-i', '2:none',
    '-r', '30',
    '-y',
    OUTPUT_FILE
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  console.log(`✅ Recording started (PID: ${ffmpeg.pid})`);
  console.log('📌 Recording full screen');
  console.log(`📌 Output: ${OUTPUT_FILE}`);

  // Log ffmpeg output
  ffmpeg.stderr.on('data', (data) => {
    // Only log important messages, not every frame
    const msg = data.toString();
    if (msg.includes('error') || msg.includes('Error')) {
      console.error('⚠️ ', msg.trim());
    }
  });

  ffmpeg.on('close', (code) => {
    console.log(`\n✅ FFmpeg exited with code ${code}`);
    console.log(`📁 Video saved to: ${OUTPUT_FILE}`);
    process.exit(0);
  });

  // Create WebSocket server to listen for stop command
  const wss = new WebSocketServer({ port: WS_PORT });

  console.log(`🔌 WebSocket server listening on port ${WS_PORT}`);
  console.log('📌 Run stop-recording.js to stop\n');

  wss.on('connection', (ws) => {
    console.log('🔌 Stop command received via WebSocket');

    ws.on('message', (message) => {
      const cmd = message.toString();

      if (cmd === 'stop') {
        console.log('⏳ Sending quit command to ffmpeg...');

        // Send 'q' to ffmpeg stdin to stop gracefully
        ffmpeg.stdin.write('q\n');

        // Wait for ffmpeg to close, then respond
        ffmpeg.on('close', () => {
          ws.send('done');
          setTimeout(() => {
            wss.close();
          }, 100);
        });
      }
    });
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Interrupted by user');
    console.log('⏳ Stopping ffmpeg gracefully...');
    ffmpeg.stdin.write('q\n');
  });

} catch (error) {
  console.error('❌ Failed to start recording:', error.message);
  process.exit(1);
}
