# OpenAI Realtime API Voice Chat CLI

> Real-time voice conversation with OpenAI GPT-4o using the Realtime API with push-to-talk functionality

A command-line interface for voice conversations with OpenAI's Realtime API, featuring push-to-talk controls, automatic mic pausing, and cost tracking.

## Features

- **Real-time Voice Conversation**: Direct WebSocket connection to OpenAI Realtime API
- **Push-to-Talk Controls**: Shift+Space to pause/resume microphone
- **Auto-Pause**: Automatically pauses mic when assistant speaks
- **Cost Tracking**: Monitors token usage and API costs
- **Low Latency**: Streaming audio input and output for responsive conversations

## Architecture

This implementation uses:
- **[@openai/realtime-api-beta](https://github.com/openai/openai-realtime-api-beta)** - Official OpenAI Realtime API client
- **node-record-lpcm16** - Microphone audio capture (PCM16 @ 24kHz)
- **speaker** - Audio output playback
- **readline** - Keyboard controls (push-to-talk)

### Audio Flow

```
Microphone → node-record-lpcm16 → Int16Array → RealtimeClient → OpenAI API
                                                                      ↓
Speaker ← speaker module ← Int16Array ← RealtimeClient ← WebSocket Events
```

### Key Components

- **RealtimeVoiceCLI** - Main class handling:
  - RealtimeClient connection and session configuration
  - Microphone input streaming
  - Audio output playback
  - Push-to-talk keyboard controls
  - Token usage and cost tracking

## Prerequisites

1. **OpenAI API Key** with Realtime API access (added to monorepo root `.env` file):
   ```env
   OPENAI_API_KEY=sk-...
   ```

2. **System Requirements**:
   - Node.js 18+
   - Microphone access
   - Speaker/headphones
   - **SoX** audio library (for node-record-lpcm16):
     ```bash
     # macOS
     brew install sox

     # Ubuntu/Debian
     sudo apt-get install sox libsox-fmt-all

     # Windows
     # Download from https://sourceforge.net/projects/sox/
     ```

## Installation

From the monorepo root:
```bash
npm install
```

Or install this package specifically:
```bash
cd packages/modules/voice/examples/voice-chat-cli-realtime
npm install
```

## Usage

### Start Voice Chat

```bash
cd packages/modules/voice/examples/voice-chat-cli-realtime
npm start
```

### Controls

- **Shift+Space** - Pause/resume microphone (push-to-talk toggle)
- **Ctrl+C** - Exit and show usage summary

### Example Session

```
╔════════════════════════════════════════╗
║  OpenAI Realtime Voice Chat CLI       ║
╚════════════════════════════════════════╝

🎙️  Initializing OpenAI Realtime Voice CLI...

✅ Realtime client initialized
   Model: gpt-4o-realtime-preview-2024-12-17
   Voice: alloy
   Instructions: You are a helpful, friendly assistant...

🔌 Connecting to OpenAI Realtime API...

✅ Connected to OpenAI Realtime API

🎤 Starting microphone...
   Press Shift+Space to pause/resume
   Press Ctrl+C to exit

🎤 LIVE - Speak now!

💬 Ready for conversation!

Controls:
  Shift+Space - Pause/resume microphone
  Ctrl+C      - Exit

👤 User speaking...
👤 User finished speaking

🤖 Assistant speaking (mic auto-paused)...
🤖 Assistant: Hello! How can I help you today?
🤖 Assistant finished speaking

🎤 Mic resumed (agent done speaking)

⏸️  PAUSED

🎤 LIVE

📊 Token Usage Summary:
   Responses: 5
   Input: 1234 (text: 0, audio: 1234)
   Output: 2345 (text: 234, audio: 2111)
   Total: 3579
   Cost: $0.0234 USD
```

## Configuration

You can customize the CLI by editing `index.js`:

```javascript
const cli = new RealtimeVoiceCLI({
  apiKey: openaiApiKey,

  // System instructions for the assistant
  instructions: 'You are a helpful, friendly assistant. Keep responses concise.',

  // Voice options: alloy, echo, shimmer
  voice: 'alloy',

  // Model (currently only one model available)
  model: 'gpt-4o-realtime-preview-2024-12-17'
});
```

## Cost Information

**OpenAI Realtime API Pricing** (as of 2024):
- Input: ~$0.006 per 1K tokens
- Output: ~$0.024 per 1K tokens
- **Effective Rate**: ~$0.30 per minute of conversation

**Example Costs**:
- 5 minute conversation: ~$1.50
- 30 minute conversation: ~$9.00
- 1 hour conversation: ~$18.00

**Budget Optimization**:
- Use push-to-talk (Shift+Space) to pause mic when not speaking
- Keep responses concise with appropriate system instructions
- For non-time-sensitive use cases, consider using:
  - Whisper transcription (~$0.006/min)
  - ZAI/GPT-4o for chat
  - OpenAI TTS (~$0.015/min)

## Technical Details

### Audio Format

- **Sample Rate**: 24,000 Hz (24kHz)
- **Bit Depth**: 16-bit (PCM16)
- **Channels**: 1 (Mono)
- **Format**: Raw PCM audio (Int16Array)

### RealtimeClient Configuration

```javascript
client.updateSession({
  instructions: '...',
  voice: 'alloy',
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16',
  input_audio_transcription: {
    model: 'whisper-1'
  },
  turn_detection: {
    type: 'server_vad'  // Voice Activity Detection on server
  }
});
```

### Push-to-Talk Implementation

Uses readline in raw mode to capture Shift+Space:
- Tracks shift key press/release state
- Toggles `micPaused` flag on Shift+Space
- Skips audio streaming when paused
- Visual feedback (⏸️ PAUSED / 🎤 LIVE)

### Auto-Pause Feature

Automatically pauses microphone when assistant speaks:
- Triggered by `response.audio.delta` event
- Sets `autoPaused = true`
- Resumes on `conversation.item.completed` event
- Prevents feedback loops and improves conversation flow

## Troubleshooting

### "OPENAI_API_KEY not found"
- Ensure OpenAI API key is in monorepo root `.env` file
- Verify ResourceManager can access the key

### "Cannot find module 'sox'"
- Install SoX audio library:
  ```bash
  brew install sox  # macOS
  ```
- Verify installation: `sox --version`

### "Microphone access denied"
- Grant microphone permissions to Terminal
- macOS: System Preferences → Security & Privacy → Microphone

### "WebSocket connection failed"
- Check internet connectivity
- Verify OpenAI API key is valid and has Realtime API access
- Check for firewall blocking WebSocket connections

### "Audio output not working"
- Verify speaker/headphones are connected and working
- Check system audio settings
- Try different output device

### High latency or choppy audio
- Check network connection stability
- Close bandwidth-heavy applications
- Consider using wired internet connection
- Lower system load (close other applications)

## Comparison with Other Examples

| Feature | voice-chat-cli | voice-chat-cli-realtime |
|---------|----------------|-------------------------|
| Voice Input | File-based (recorded audio files) | Real-time microphone streaming |
| Latency | High (file processing) | Low (~200-500ms) |
| Chat Backend | ZAI (GLM-4.6) | OpenAI GPT-4o Realtime |
| Voice Output | OpenAI TTS | Real-time streaming audio |
| Push-to-Talk | No | Yes (Shift+Space) |
| Cost per minute | ~$0.02-0.05 | ~$0.30 |
| Best for | Testing, cost-sensitive use | Real-time conversations |

## Future Enhancements

- [ ] Add text input fallback mode
- [ ] Support for multiple voices dynamically
- [ ] Session persistence (save/resume conversations)
- [ ] Configurable hotkey for push-to-talk
- [ ] Audio visualization (waveform display)
- [ ] Integration with Legion actor framework
- [ ] Browser-based UI version
- [ ] Multi-turn conversation history export

## References

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime API Beta Client](https://github.com/openai/openai-realtime-api-beta)
- [Python Reference Implementation](https://github.com/disler/big-3-super-agent)

## License

Part of the Legion framework.
