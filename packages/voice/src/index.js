/**
 * Voice Module - Speech-to-text and text-to-speech services for Legion
 * 
 * This module provides voice capabilities through a provider architecture,
 * currently supporting OpenAI's Whisper (STT) and TTS models.
 */

export { VoiceModule as default } from './VoiceModule.js';
export { VoiceModule } from './VoiceModule.js';
export { VoiceProvider } from './providers/VoiceProvider.js';
export { OpenAIVoiceProvider } from './providers/OpenAIVoiceProvider.js';
export { TranscribeAudioTool } from './tools/TranscribeAudioTool.js';
export { GenerateVoiceTool } from './tools/GenerateVoiceTool.js';