#!/usr/bin/env node

/**
 * Voice Chat CLI - Interactive voice-enabled chatbot
 *
 * Features:
 * - Text input via readline
 * - Voice transcription (pass audio file path)
 * - ZAI chatbot with conversation history
 * - Text-to-speech responses
 *
 * Usage:
 *   node index.js
 *
 * Commands:
 *   /voice <audio-file>  - Transcribe audio and send to chatbot
 *   /clear               - Clear conversation history
 *   /history             - Show conversation history
 *   /help                - Show help
 *   /exit                - Exit program
 *   <text>               - Send text message to chatbot
 */

import readline from 'readline';
import { ResourceManager } from '@legion/resource-manager';
import VoiceModule from '../../src/VoiceModule.js';
import { VoiceChatBot } from './src/VoiceChatBot.js';
import fs from 'fs/promises';

async function main() {
  console.log('🎙️  Voice Chat CLI');
  console.log('==================');
  console.log('Initializing...\n');

  // Get ResourceManager singleton
  const resourceManager = await ResourceManager.getInstance();

  // Initialize Voice Module
  const voiceModule = await VoiceModule.create(resourceManager);

  // Get API keys from ResourceManager
  const zaiApiKey = resourceManager.get('env.ZAI_API_KEY');
  const zaiBaseURL = resourceManager.get('env.ZAI_BASE_URL');
  const zaiModel = resourceManager.get('env.ZAI_MODEL') || 'glm-4.6';

  // Initialize chatbot
  const chatbot = new VoiceChatBot({
    provider: 'zai',
    apiKey: zaiApiKey,
    baseURL: zaiBaseURL,
    model: zaiModel,
    systemPrompt: 'You are a helpful, friendly assistant. Keep responses concise and conversational.',
    maxHistoryLength: 20
  });

  const providerInfo = chatbot.getProviderInfo();
  console.log(`✅ Initialized with ${providerInfo.provider} (${providerInfo.model})`);
  console.log(`✅ Voice transcription and TTS ready`);
  console.log('\nCommands:');
  console.log('  /voice <file>  - Transcribe audio file and chat');
  console.log('  /clear         - Clear conversation history');
  console.log('  /history       - Show conversation history');
  console.log('  /help          - Show this help');
  console.log('  /exit          - Exit program');
  console.log('  <text>         - Send text message\n');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n💬 You: '
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.split(/\s+/);
      const command = parts[0].toLowerCase();

      if (command === '/exit' || command === '/quit') {
        console.log('\nGoodbye! 👋\n');
        rl.close();
        process.exit(0);
      }

      if (command === '/help') {
        console.log('\nCommands:');
        console.log('  /voice <file>  - Transcribe audio file and chat');
        console.log('  /clear         - Clear conversation history');
        console.log('  /history       - Show conversation history');
        console.log('  /help          - Show this help');
        console.log('  /exit          - Exit program');
        console.log('  <text>         - Send text message');
        rl.prompt();
        return;
      }

      if (command === '/clear') {
        chatbot.clearHistory();
        console.log('\n✅ Conversation history cleared');
        rl.prompt();
        return;
      }

      if (command === '/history') {
        const history = chatbot.getHistoryText();
        if (history) {
          console.log('\n--- Conversation History ---');
          console.log(history);
          console.log('----------------------------');
        } else {
          console.log('\n(No conversation history yet)');
        }
        rl.prompt();
        return;
      }

      if (command === '/voice') {
        const audioPath = parts[1];
        if (!audioPath) {
          console.log('\n❌ Please provide audio file path: /voice <file>');
          rl.prompt();
          return;
        }

        try {
          // Check if file exists
          await fs.access(audioPath);

          console.log('\n🎙️  Transcribing audio...');

          // Transcribe audio
          const transcribeResult = await voiceModule.transcribeAudio({
            audio: audioPath,
            format: audioPath.split('.').pop() || 'mp3'
          });

          if (!transcribeResult.success || !transcribeResult.data.text) {
            console.log('❌ Transcription failed');
            rl.prompt();
            return;
          }

          const transcription = transcribeResult.data.text;
          console.log(`📝 Transcription: "${transcription}"`);

          // Send to chatbot
          console.log('\n🤖 Assistant is thinking...');
          const response = await chatbot.sendMessage(transcription);

          console.log(`\n🤖 Assistant: ${response}`);

          // Generate TTS for response
          console.log('\n🔊 Generating speech...');
          const ttsResult = await voiceModule.generateVoice({
            text: response,
            voice: 'nova',
            model: 'tts-1'
          });

          if (ttsResult.success) {
            // Save TTS audio to temp file
            const tempFile = `/tmp/voice-chat-${Date.now()}.mp3`;
            const audioBuffer = Buffer.from(ttsResult.data.audio, 'base64');
            await fs.writeFile(tempFile, audioBuffer);
            console.log(`✅ Audio saved to: ${tempFile}`);
            console.log('   (Play with: afplay ${tempFile})');
          }

        } catch (error) {
          console.log(`\n❌ Error: ${error.message}`);
        }

        rl.prompt();
        return;
      }

      console.log(`\n❌ Unknown command: ${command}. Type /help for available commands.`);
      rl.prompt();
      return;
    }

    // Handle text message
    try {
      console.log('\n🤖 Assistant is thinking...');
      const response = await chatbot.sendMessage(trimmed);
      console.log(`\n🤖 Assistant: ${response}`);
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}

// Run the CLI
main().catch(error => {
  console.error('Failed to start CLI:', error);
  process.exit(1);
});
