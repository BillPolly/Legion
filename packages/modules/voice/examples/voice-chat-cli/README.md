# Voice Chat CLI Example

A simple voice-enabled chatbot CLI demonstrating the Legion Voice Module with ZAI (GLM-4.6) for conversational AI.

## Features

- **Text Chat**: Interactive text-based conversation with ZAI chatbot
- **Voice Transcription**: Transcribe audio files using OpenAI Whisper
- **Text-to-Speech**: Generate speech responses using OpenAI TTS
- **Conversation History**: Maintains context across multiple turns
- **Simple CLI Interface**: Readline-based command interface

## Architecture

This example demonstrates how to combine:
- **@legion/voice** - Voice transcription and TTS
- **@legion/llm-client** with ZAI provider - Conversational AI
- **@legion/resource-manager** - Centralized configuration

## Prerequisites

1. **API Keys** (in monorepo root `.env` file):
   ```env
   ZAI_API_KEY=your-zai-api-key
   ZAI_BASE_URL=https://api.z.ai/api/paas/v4
   ZAI_MODEL=glm-4.6
   OPENAI_API_KEY=your-openai-api-key
   ```

2. **Audio file** (for voice input):
   - Any format: mp3, wav, webm, etc.
   - Place in a directory you can reference

## Installation

From the monorepo root:
```bash
npm install
```

## Usage

### Start the CLI

```bash
cd packages/modules/voice/examples/voice-chat-cli
npm start
```

### Commands

- **Text message**: Just type your message and press Enter
  ```
  💬 You: Hello, how are you?
  ```

- **/voice <file>**: Transcribe audio file and send to chatbot
  ```
  💬 You: /voice /path/to/audio.mp3
  ```

- **/clear**: Clear conversation history
  ```
  💬 You: /clear
  ```

- **/history**: Show full conversation history
  ```
  💬 You: /history
  ```

- **/help**: Show available commands
  ```
  💬 You: /help
  ```

- **/exit**: Exit the program
  ```
  💬 You: /exit
  ```

## Example Session

```
🎙️  Voice Chat CLI
==================
Initializing...

✅ Initialized with zai (glm-4.6)
✅ Voice transcription and TTS ready

Commands:
  /voice <file>  - Transcribe audio file and chat
  /clear         - Clear conversation history
  /history       - Show conversation history
  /help          - Show this help
  /exit          - Exit program
  <text>         - Send text message

💬 You: Hello! What's the capital of France?

🤖 Assistant is thinking...

🤖 Assistant: The capital of France is Paris. It's known for iconic landmarks like the Eiffel Tower and the Louvre Museum.

💬 You: /voice recording.mp3

🎙️  Transcribing audio...
📝 Transcription: "What's the weather like in Paris today?"

🤖 Assistant is thinking...

🤖 Assistant: I don't have access to real-time weather data, but you can check current Paris weather on weather.com or your weather app!

🔊 Generating speech...
✅ Audio saved to: /tmp/voice-chat-1234567890.mp3
   (Play with: afplay /tmp/voice-chat-1234567890.mp3)

💬 You: /exit

Goodbye! 👋
```

## Testing

### Run All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

## Cost Estimate

Per voice interaction:
- Whisper transcription: ~$0.006 per minute
- ZAI chatbot: Very low cost (GLM-4.6)
- OpenAI TTS: ~$0.015 per minute

**Total per interaction**: ~$0.02 - $0.05

## Architecture

### VoiceChatBot Class

Manages conversation state and LLM interactions:
- Maintains message history (configurable max length)
- Handles request/response with ZAI
- Provides history management methods

### CLI Interface

Simple readline-based interface:
- Text input for messages
- Commands for voice and history management
- Integration with VoiceModule for transcription/TTS

### ZAI Provider

OpenAI-compatible provider for ZAI:
- Configured for GLM-4.6 model
- Supports chat completion with history
- Extends standard LLMClient architecture

## File Structure

```
voice-chat-cli/
├── index.js                        # Main CLI entry point
├── package.json                    # Package configuration
├── README.md                       # This file
├── src/
│   └── VoiceChatBot.js            # Chatbot class
└── __tests__/
    ├── unit/
    │   └── VoiceChatBot.test.js   # Unit tests with mocks
    └── integration/
        └── voice-chat.integration.test.js  # Real API tests
```

## Future Enhancements

- **Browser-based mic input**: Real-time voice recording
- **Streaming responses**: Show chatbot response as it's generated
- **Multiple voice options**: Different voices for responses
- **Local TTS**: Use local models to save costs
- **Conversation export**: Save conversations to file

## Troubleshooting

### "API key is required for ZAI provider"
- Check that ZAI_API_KEY is set in monorepo root `.env` file
- Verify ResourceManager is loading the .env correctly

### "No response content received from ZAI"
- Check ZAI account has sufficient credits
- Verify ZAI_BASE_URL is correct
- Check network connectivity

### "Failed to read audio file"
- Verify audio file path is correct
- Check file format is supported (mp3, wav, webm, etc.)
- Ensure file exists and is readable

### Tests failing
- Ensure all API keys are set in `.env`
- Check that accounts have sufficient credits
- Run tests with longer timeouts if needed

## License

Part of the Legion framework.
