#!/usr/bin/env node
/**
 * Stop screen recording for demo
 * Reads PID from /tmp/demo-recording.pid and stops ffmpeg gracefully
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync } from 'fs';

const PID_FILE = '/tmp/demo-recording.pid';

console.log('🛑 Stopping screen recording...');

try {
  // Check if PID file exists
  if (!existsSync(PID_FILE)) {
    console.error('❌ No recording found (PID file missing)');
    console.error('Did you run start-recording.js first?');
    process.exit(1);
  }

  // Read PID
  const pid = readFileSync(PID_FILE, 'utf-8').trim();
  console.log(`📌 Found recording process (PID: ${pid})`);

  // Send SIGINT to ffmpeg for graceful shutdown
  // This allows ffmpeg to finalize the video file properly
  execSync(`kill -INT ${pid}`);

  console.log('⏳ Waiting for ffmpeg to finalize video...');

  // Wait a moment for ffmpeg to finish writing
  execSync('sleep 3');

  // Clean up PID file
  unlinkSync(PID_FILE);

  console.log('✅ Recording stopped successfully!');
  console.log('📁 Video saved to: demo-recording.mp4');

} catch (error) {
  console.error('❌ Failed to stop recording:', error.message);

  // Try to clean up PID file anyway
  if (existsSync(PID_FILE)) {
    unlinkSync(PID_FILE);
  }

  process.exit(1);
}
