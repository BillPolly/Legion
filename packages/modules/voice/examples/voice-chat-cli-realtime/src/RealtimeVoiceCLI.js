import { RealtimeClient } from '@openai/realtime-api-beta';
import record from 'node-record-lpcm16';
import Speaker from 'speaker';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Realtime Voice CLI using OpenAI Realtime API
 *
 * Features:
 * - Real-time voice conversation with OpenAI GPT-4o
 * - Push-to-talk with Shift+Space toggle
 * - Automatic audio input pause when agent speaks
 * - Cost tracking and token usage monitoring
 */
export class RealtimeVoiceCLI {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.instructions = config.instructions || 'You are a helpful, friendly assistant. Keep responses concise and conversational.';
    this.voice = config.voice || 'alloy';
    this.model = config.model || 'gpt-4o-realtime-preview-2024-12-17';

    // Client and streams
    this.client = null;
    this.recording = null;
    this.speaker = null;

    // State management
    this.connected = false;
    this.spaceHeld = false; // Only listen when Space is held down
    this.autoPaused = false; // Auto-pause when agent speaks
    this.hasAudioBuffer = false; // Track if we've sent any audio

    // Audio level monitoring
    this.lastAudioLevel = 0;
    this.audioLevelInterval = null;
    this.spaceReleaseInterval = null;

    // Cost tracking
    this.tokenUsage = {
      input_text: 0,
      input_audio: 0,
      output_text: 0,
      output_audio: 0,
      total: 0
    };
    this.responseCount = 0;
    this.costUSD = 0;

    // Audio buffer for speaker
    this.audioQueue = [];
    this.isPlaying = false;

    // Debug logging
    const logDir = path.join(process.cwd(), '__tests__', 'tmp');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFile = path.join(logDir, `voice-cli-debug-${Date.now()}.log`);
    this.log(`===== Voice CLI Session Started =====`);
  }

  log(message, alsoConsole = false) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logLine);
    if (alsoConsole) {
      console.log(message);
    }
  }

  /**
   * Initialize the Realtime API client and audio streams
   */
  async initialize() {
    console.log('🎙️  Initializing OpenAI Realtime Voice CLI...\n');

    // Validate API key
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Create Realtime client
    this.client = new RealtimeClient({
      apiKey: this.apiKey,
      dangerouslyAllowAPIKeyInBrowser: false
    });

    // Configure session
    this.client.updateSession({
      instructions: this.instructions,
      voice: this.voice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1'
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500  // Wait 500ms of silence before triggering
      }
    });

    // Setup event handlers
    this._setupEventHandlers();

    // Initialize speaker for audio output
    this._initializeSpeaker();

    console.log('✅ Realtime client initialized');
    console.log(`   Model: ${this.model}`);
    console.log(`   Voice: ${this.voice}`);
    console.log(`   Instructions: ${this.instructions}\n`);
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect() {
    console.log('🔌 Connecting to OpenAI Realtime API...\n');

    try {
      await this.client.connect();
      this.connected = true;
      console.log('✅ Connected to OpenAI Realtime API\n');
    } catch (error) {
      console.error('❌ Failed to connect:', error.message);
      throw error;
    }
  }

  /**
   * Start microphone recording
   */
  startMicrophone() {
    if (this.recording) {
      console.log('⚠️  Microphone already started');
      return;
    }

    console.log('🎤 Starting microphone...');
    console.log('   Hold SPACE to talk (release to stop)');
    console.log('   Press Ctrl+C to exit\n');

    this.recording = record.record({
      sampleRate: 24000,
      channels: 1,
      audioType: 'raw',
      recorder: 'sox'
    });

    // Start paused - only record when Space is held
    if (this.recording.pause) {
      this.recording.pause();
    }

    this.recording.stream().on('data', (chunk) => {
      // Calculate audio level for visualization
      const int16Data = new Int16Array(
        chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
      );

      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < int16Data.length; i++) {
        const normalized = int16Data[i] / 32768.0;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / int16Data.length);
      const level = Math.min(100, Math.floor(rms * 1000)); // Amplify for visibility
      this.lastAudioLevel = level;

      // Only send audio AND show level when Space is held down
      if (!this.spaceHeld) {
        return;
      }

      // Show level indicator
      this._showAudioLevel(level);

      // Stream audio to Realtime API in real-time
      if (this.connected && this.client) {
        try {
          this.client.appendInputAudio(int16Data);
          this.hasAudioBuffer = true; // Mark that we've sent audio
        } catch (error) {
          this.log('[ERROR] Error appending audio: ' + error.message);
        }
      }
    });

    this.recording.stream().on('error', (error) => {
      console.error('❌ Microphone error:', error.message);
    });

    console.log('⏸️  Ready - Hold SPACE to talk\n');
  }

  /**
   * Stop microphone recording
   */
  stopMicrophone() {
    if (this.recording) {
      this.recording.stop();
      this.recording = null;
      console.log('🛑 Microphone stopped');
    }
  }

  /**
   * Setup keyboard controls for hold-to-talk
   */
  setupKeyboardControls() {
    // Enable raw mode for keypress events
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let lastSpaceTime = 0;
    const RELEASE_TIMEOUT = 100; // ms without seeing space = released

    process.stdin.on('keypress', (str, key) => {
      if (!key) return;

      // Space key pressed - start or continue listening
      if (key.name === 'space') {
        const now = Date.now();
        lastSpaceTime = now;

        if (!this.spaceHeld) {
          this.spaceHeld = true;
          this.hasAudioBuffer = false; // Reset audio buffer flag
          this.log('[USER ACTION] Space pressed - starting audio capture');
          console.log('\n🎤 LISTENING...');

          // Resume the microphone recording stream
          if (this.recording && this.recording.isPaused && this.recording.isPaused()) {
            this.recording.resume();
          }
        }
      }

      // Ctrl+C exits
      if (key.name === 'c' && key.ctrl) {
        console.log('\n\n👋 Shutting down...\n');
        this.shutdown();
        process.exit(0);
      }
    });

    // Poll to detect Space release
    const checkSpaceRelease = setInterval(() => {
      if (this.spaceHeld && Date.now() - lastSpaceTime > RELEASE_TIMEOUT) {
        this.spaceHeld = false;

        // Clear the level indicator line and show stopped message
        process.stdout.write('\r' + ' '.repeat(60) + '\r'); // Clear line
        console.log('🔴 Stopped\n');
        this.log('[USER ACTION] Space released - pausing microphone');

        // PAUSE the microphone recording stream so it doesn't pick up assistant's voice
        if (this.recording && this.recording.pause) {
          this.recording.pause();
        }
      }
    }, 50); // Check every 50ms

    // Store interval for cleanup
    this.spaceReleaseInterval = checkSpaceRelease;
  }

  /**
   * Show audio level indicator
   */
  _showAudioLevel(level) {
    const barLength = 20;
    const filledLength = Math.floor((level / 100) * barLength);
    const bar = '▓'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    // Use \r to overwrite the same line
    process.stdout.write(`\r  ${bar} ${level}%`);
  }


  /**
   * Initialize speaker for audio output
   */
  _initializeSpeaker() {
    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000
    });

    // Hook into speaker's internal audio process if it exists
    if (this.speaker._audio && this.speaker._audio.stderr) {
      this.speaker._audio.stderr.on('data', () => {
        // Silently consume stderr to suppress warnings
      });
    }

    this.speaker.on('error', (error) => {
      this.log('[SPEAKER ERROR] ' + error.message);
    });

    // Also try to suppress after pipe event
    this.speaker.once('pipe', () => {
      if (this.speaker._audio && this.speaker._audio.stderr) {
        this.speaker._audio.stderr.removeAllListeners('data');
        this.speaker._audio.stderr.on('data', () => {});
      }
    });
  }

  /**
   * Setup event handlers for Realtime API
   */
  _setupEventHandlers() {
    // Log ALL events for debugging
    const originalOn = this.client.on.bind(this.client);
    this.client.on = (eventName, handler) => {
      return originalOn(eventName, (...args) => {
        if (!eventName.includes('audio.delta')) { // Don't log every audio chunk
          this.log(`[EVENT] ${eventName}`);
        }
        return handler(...args);
      });
    };

    // Connection events
    this.client.on('connected', () => {
      this.log('[CONNECTION] WebSocket connected');
      console.log('🔗 Connected');
    });

    this.client.on('disconnected', () => {
      this.log('[CONNECTION] WebSocket disconnected');
      this.connected = false;
      console.log('🔌 Disconnected');
    });

    this.client.on('error', (event) => {
      this.log('[ERROR] Realtime API error: ' + JSON.stringify(event));
      console.error('❌ API Error:', event);
    });

    // Conversation events
    this.client.on('conversation.updated', (event) => {
      const { item, delta } = event;

      // Handle audio output delta
      if (delta?.audio) {
        this._handleAudioOutput(delta.audio);
      }

      // Handle text transcript
      if (item?.formatted?.transcript) {
        this._handleTranscript(item);
      }
    });

    // Response events
    this.client.on('conversation.item.completed', (event) => {
      const { item } = event;

      if (item.role === 'assistant') {
        // Resume mic after agent finishes speaking
        if (this.autoPaused) {
          this.autoPaused = false;
          this.log('[ASSISTANT] Completed response item');
        }
      }
    });

    // Input audio buffer events
    this.client.on('input_audio_buffer.speech_started', (event) => {
      this.log('[VAD] Speech detected - user speaking');
    });

    this.client.on('input_audio_buffer.speech_stopped', (event) => {
      this.log('[VAD] Speech stopped - silence detected');

      // Only allow response if we actually sent audio
      if (!this.hasAudioBuffer) {
        this.log('[BLOCK] No audio buffer - blocking auto-response');
        // Cancel any pending response - the API shouldn't respond to silence
        return;
      }
    });

    // Response audio events
    this.client.on('response.audio.delta', (event) => {
      // Auto-pause mic when agent starts speaking
      if (!this.autoPaused) {
        this.autoPaused = true;
        this.log('[ASSISTANT] Started speaking');
      }
    });

    this.client.on('response.audio.done', (event) => {
      this.log('[ASSISTANT] Finished speaking');
      this.hasAudioBuffer = false; // Reset for next turn
    });

    // Token usage events
    this.client.on('response.done', (event) => {
      const { response } = event;

      if (response?.usage) {
        this._trackTokenUsage(response.usage);
      }
    });
  }

  /**
   * Handle audio output from assistant
   */
  _handleAudioOutput(audioData) {
    if (!this.speaker || !audioData) {
      return;
    }

    try {
      // Convert Int16Array to Buffer
      const buffer = Buffer.from(audioData.buffer);

      // Write to speaker
      this.speaker.write(buffer);
    } catch (error) {
      console.error('❌ Error playing audio:', error.message);
    }
  }

  /**
   * Handle transcript from conversation
   */
  _handleTranscript(item) {
    const role = item.role === 'user' ? '👤 You' : '🤖 Assistant';
    const transcript = item.formatted.transcript || item.formatted.text;

    if (transcript && transcript.trim()) {
      console.log(`${role}: ${transcript}`);
    }
  }

  /**
   * Track token usage and cost
   */
  _trackTokenUsage(usage) {
    this.responseCount++;

    // Update token counts
    const inputDetails = usage.input_token_details || {};
    const outputDetails = usage.output_token_details || {};

    this.tokenUsage.input_text += inputDetails.text_tokens || 0;
    this.tokenUsage.input_audio += inputDetails.audio_tokens || 0;
    this.tokenUsage.output_text += outputDetails.text_tokens || 0;
    this.tokenUsage.output_audio += outputDetails.audio_tokens || 0;
    this.tokenUsage.total += usage.total_tokens || 0;

    // Calculate cost (approximate pricing as of 2024)
    // Input: $0.006 per 1k tokens, Output: $0.024 per 1k tokens
    const inputCost = ((this.tokenUsage.input_text + this.tokenUsage.input_audio) / 1000) * 0.006;
    const outputCost = ((this.tokenUsage.output_text + this.tokenUsage.output_audio) / 1000) * 0.024;
    this.costUSD = inputCost + outputCost;

    // Log every 5 responses
    if (this.responseCount % 5 === 0) {
      console.log('\n📊 Token Usage Summary:');
      console.log(`   Responses: ${this.responseCount}`);
      console.log(`   Input: ${this.tokenUsage.input_text + this.tokenUsage.input_audio} (text: ${this.tokenUsage.input_text}, audio: ${this.tokenUsage.input_audio})`);
      console.log(`   Output: ${this.tokenUsage.output_text + this.tokenUsage.output_audio} (text: ${this.tokenUsage.output_text}, audio: ${this.tokenUsage.output_audio})`);
      console.log(`   Total: ${this.tokenUsage.total}`);
      console.log(`   Cost: $${this.costUSD.toFixed(4)} USD\n`);
    }
  }

  /**
   * Get current token usage and cost
   */
  getUsage() {
    return {
      responses: this.responseCount,
      tokens: this.tokenUsage,
      cost: this.costUSD
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    console.log('🛑 Shutting down...');

    // Clear intervals
    if (this.spaceReleaseInterval) {
      clearInterval(this.spaceReleaseInterval);
    }

    // Stop microphone
    this.stopMicrophone();

    // Disconnect client
    if (this.client && this.connected) {
      await this.client.disconnect();
    }

    // Close speaker
    if (this.speaker) {
      this.speaker.end();
    }

    // Restore terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    // Print final usage
    const usage = this.getUsage();
    console.log('\n📊 Final Usage:');
    console.log(`   Responses: ${usage.responses}`);
    console.log(`   Total Tokens: ${usage.tokens.total}`);
    console.log(`   Total Cost: $${usage.cost.toFixed(4)} USD\n`);

    console.log('✅ Shutdown complete\n');
  }
}
