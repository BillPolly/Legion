/**
 * Unit tests for YouTube Transcript Tool
 */

import { jest } from '@jest/globals';
import YoutubeTranscript from '../../src/youtube-transcript/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

describe('YoutubeTranscript', () => {
  let youtubeTranscript;

  beforeEach(() => {
    youtubeTranscript = new YoutubeTranscript();
    jest.clearAllMocks();
    
    // Mock the getTranscript method directly to avoid ES6 module mocking issues
    youtubeTranscript.getTranscript = jest.fn();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(youtubeTranscript.name).toBe('youtube_transcript');
      expect(youtubeTranscript.description).toContain('Fetches transcripts from YouTube videos');
    });
  });

  describe('getToolDescription', () => {
    test('should return correct tool description format', () => {
      const description = youtubeTranscript.getToolDescription();
      
      expect(description.type).toBe('function');
      expect(description.function.name).toBe('youtube_transcript_get');
      expect(description.function.parameters.required).toContain('videoUrl');
    });
  });

  describe('invoke method', () => {
    test('should handle valid YouTube URL', async () => {
      const mockResult = {
        success: true,
        videoId: 'dQw4w9WgXcQ',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        language: 'en',
        segments: [
          { text: 'Hello world', start: 0, duration: 2 },
          { text: 'This is a test', start: 2, duration: 3 }
        ],
        fullText: 'Hello world This is a test',
        totalDuration: 5,
        segmentCount: 2
      };
      
      youtubeTranscript.getTranscript.mockResolvedValue(mockResult);

      const toolCall = createMockToolCall('youtube_transcript_get', { 
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' 
      });
      const result = await youtubeTranscript.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.segments).toHaveLength(2);
      expect(result.data.segments[0].text).toBe('Hello world');
    });

    test('should handle transcript fetch failure', async () => {
      youtubeTranscript.getTranscript.mockRejectedValue(
        new Error('Video not found')
      );

      const toolCall = createMockToolCall('youtube_transcript_get', { 
        videoUrl: 'https://www.youtube.com/watch?v=invalid' 
      });
      const result = await youtubeTranscript.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Video not found');
    });

    test('should handle missing URL parameter', async () => {
      const toolCall = createMockToolCall('youtube_transcript_get', {});
      const result = await youtubeTranscript.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('videoUrl');
    });
  });
});
