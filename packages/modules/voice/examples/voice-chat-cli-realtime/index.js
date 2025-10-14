#!/usr/bin/env node

/**
 * OpenAI Realtime API Voice Chat CLI
 *
 * Real-time voice conversation with OpenAI GPT-4o using the Realtime API.
 *
 * Features:
 * - Push-to-talk with Shift+Space
 * - Automatic mic pause when agent speaks
 * - Cost tracking and token usage
 * - Real-time audio streaming
 *
 * Usage:
 *   node index.js
 *
 * Controls:
 *   Shift+Space - Pause/resume microphone
 *   Ctrl+C      - Exit
 */

import { ResourceManager } from '@legion/resource-manager';
import { RealtimeVoiceCLI } from './src/RealtimeVoiceCLI.js';

// Filter out ALL noisy native library warnings from stderr AND console.error
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const originalConsoleError = console.error.bind(console);

const shouldFilter = (str) => {
  return str.includes('coreaudio.c') ||
         str.includes('buffer underflow') ||
         str.includes('mpg123') ||
         str.includes('../deps/') ||
         str.includes('warning: Didn');
};

process.stderr.write = (chunk, encoding, callback) => {
  const str = chunk.toString();
  if (shouldFilter(str)) {
    if (typeof callback === 'function') callback();
    return true;
  }
  return originalStderrWrite(chunk, encoding, callback);
};

console.error = (...args) => {
  const str = args.join(' ');
  if (!shouldFilter(str)) {
    originalConsoleError(...args);
  }
};

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  OpenAI Realtime Voice Chat CLI       ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Get ResourceManager singleton
    const resourceManager = await ResourceManager.getInstance();

    // Get OpenAI API key from ResourceManager
    const openaiApiKey = resourceManager.get('env.OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('❌ Error: OPENAI_API_KEY not found in .env file\n');
      console.log('Please add your OpenAI API key to the .env file:');
      console.log('   OPENAI_API_KEY=sk-...\n');
      process.exit(1);
    }

    // Create and initialize CLI
    const cli = new RealtimeVoiceCLI({
      apiKey: openaiApiKey,
      instructions: 'You are a helpful, friendly assistant. Keep responses concise and conversational.',
      voice: 'alloy', // Options: alloy, echo, shimmer
      model: 'gpt-4o-realtime-preview-2024-12-17'
    });

    await cli.initialize();

    // Connect to OpenAI Realtime API
    await cli.connect();

    // Setup keyboard controls
    cli.setupKeyboardControls();

    // Start microphone
    cli.startMicrophone();

    console.log('💬 Ready for conversation!\n');
    console.log('Controls:');
    console.log('  Hold SPACE  - Talk (release when done)');
    console.log('  Ctrl+C      - Exit\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Received interrupt signal...\n');
      await cli.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Received terminate signal...\n');
      await cli.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the CLI
main().catch(error => {
  console.error('Failed to start CLI:', error);
  process.exit(1);
});
