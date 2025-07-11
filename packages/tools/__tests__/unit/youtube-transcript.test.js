/**
 * Unit tests for YouTube Transcript Tool
 */

import { jest } from '@jest/globals';
import YoutubeTranscript from '../../src/youtube-transcript/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

// Mock youtube-transcript module
const mockYoutubeTranscript = {
  YoutubeTranscript: {
    fetchTranscript: jest.fn()
  }
};

jest.unstable_mockModule('youtube-transcript', () => mockYoutubeTranscript);

describe('YoutubeTranscript', () => {
  let youtubeTranscript;

  beforeEach(() => {
    youtubeTranscript = new YoutubeTranscript();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(youtubeTranscript.name).toBe('youtube_transcript');
      expect(youtubeTranscript.description).toContain('YouTube transcript');
    });
  });

  describe('getToolDescription', () => {
    test('should return correct tool description format', () => {
      const description = youtubeTranscript.getToolDescription();
      
      expect(description.type).toBe('function');
      expect(description.function.name).toBe('youtube_transcript_get');
      expect(description.function.parameters.required).toContain('url');
    });
  });

  describe('invoke method', () => {
    test('should handle valid YouTube URL', async () => {
      const mockTranscript = [
        { text: 'Hello world', start: 0, duration: 2 },
        { text: 'This is a test', start: 2, duration: 3 }
      ];
      
      mockYoutubeTranscript.YoutubeTranscript.fetchTranscript.mockResolvedValue(mockTranscript);

      const toolCall = createMockToolCall('youtube_transcript_get', { 
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' 
      });
      const result = await youtubeTranscript.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.transcript).toHaveLength(2);
      expect(result.data.transcript[0].text).toBe('Hello world');
    });

    test('should handle transcript fetch failure', async () => {
      mockYoutubeTranscript.YoutubeTranscript.fetchTranscript.mockRejectedValue(
        new Error('Video not found')
      );

      const toolCall = createMockToolCall('youtube_transcript_get', { 
        url: 'https://www.youtube.com/watch?v=invalid' 
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
      expect(result.error).toContain('url');
    });
  });
});
