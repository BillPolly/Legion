# Voice Module

A Legion module providing speech-to-text and text-to-speech capabilities through a provider architecture.

## Features

- **Speech-to-Text (STT)**: Convert audio to text using OpenAI Whisper
- **Text-to-Speech (TTS)**: Generate natural-sounding speech from text
- **Provider Architecture**: Easily extensible to support multiple providers
- **Multiple Formats**: Support for various audio formats (mp3, wav, webm, etc.)
- **Language Support**: Auto-detection and 99+ language support

## Installation

The module is part of the Legion monorepo and is automatically available when using the ModuleLoader.

## Configuration

The module requires an OpenAI API key in your `.env` file:

```env
OPENAI_API_KEY=your-api-key-here
```

## Usage

### Loading the Module

```javascript
import { ModuleLoader } from '@legion/module-loader';

const moduleLoader = new ModuleLoader();
await moduleLoader.initialize();

const voiceModule = await moduleLoader.loadModule('/path/to/packages/voice');
```

### Speech-to-Text (Transcription)

```javascript
// Transcribe audio from base64 data
const result = await voiceModule.transcribeAudio({
  audio: 'base64-encoded-audio-data',
  format: 'webm',
  language: 'en' // Optional, auto-detects if not specified
});

console.log(result.text); // Transcribed text

// Transcribe audio from file
const result = await voiceModule.transcribeAudio({
  audio: '/path/to/audio.mp3',
  format: 'mp3'
});
```

### Text-to-Speech (Voice Generation)

```javascript
// Generate speech from text
const result = await voiceModule.generateVoice({
  text: 'Hello, this is a test of the voice generation system.',
  voice: 'nova',      // Options: alloy, echo, fable, onyx, nova, shimmer
  model: 'tts-1-hd',  // Options: tts-1 (faster), tts-1-hd (higher quality)
  speed: 1.0,         // 0.25 to 4.0
  format: 'mp3'       // Options: mp3, opus, aac, flac
});

console.log(result.audio); // Base64 encoded audio

// Save to file
const result = await voiceModule.generateVoice({
  text: 'Save this speech to a file.',
  outputPath: '/path/to/output.mp3'
});
```

## Available Voices

- **alloy**: Neutral and balanced
- **echo**: Male, warm and conversational
- **fable**: British accent, neutral
- **onyx**: Male, deep and authoritative
- **nova**: Female, energetic and friendly
- **shimmer**: Female, soft and gentle

## Tools

### transcribe_audio

Converts audio to text using speech recognition.

**Parameters:**
- `audio` (string, required): Base64 encoded audio or file path
- `format` (string): Audio format (default: 'webm')
- `language` (string): Language code for better accuracy
- `prompt` (string): Context to guide transcription

### generate_voice

Converts text to speech audio.

**Parameters:**
- `text` (string, required): Text to convert (max 4096 chars)
- `voice` (string): Voice selection (default: 'alloy')
- `model` (string): TTS model (default: 'tts-1')
- `speed` (number): Speech speed 0.25-4.0 (default: 1.0)
- `format` (string): Output format (default: 'mp3')
- `outputPath` (string): Optional file path to save audio

## Provider Architecture

The module uses a provider pattern for easy extensibility:

```javascript
// Base provider interface
class VoiceProvider {
  async transcribe(audioData, options) { }
  async synthesize(text, options) { }
  async getVoices() { }
  getCapabilities() { }
}
```

Currently supports:
- OpenAI (Whisper + TTS)

Future providers can be added:
- Google Cloud Speech-to-Text / Text-to-Speech
- Azure Cognitive Services
- Amazon Polly / Transcribe
- Browser Web Speech API

## Events

Tools emit progress and status events:

```javascript
tool.on('progress', (data) => {
  console.log(`${data.percentage}% - ${data.status}`);
});

tool.on('info', (data) => {
  console.log(`Info: ${data.message}`);
});

tool.on('error', (data) => {
  console.error(`Error: ${data.message}`);
});
```

## Testing

```bash
npm test
```

## License

MIT