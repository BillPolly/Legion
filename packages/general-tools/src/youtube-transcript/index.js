import { Tool, ToolResult } from '../../../tools/src/index.js';
import { YoutubeTranscript as YTTranscript } from 'youtube-transcript';

class YoutubeTranscript extends Tool {
  constructor() {
    super();
    this.name = 'youtube_transcript';
    this.description = 'Fetches transcripts from YouTube videos';
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'youtube_transcript_get',
        description: 'Get the transcript/captions from a YouTube video',
        parameters: {
          type: 'object',
          properties: {
            videoUrl: {
              type: 'string',
              description: 'The YouTube video URL (e.g., "https://www.youtube.com/watch?v=VIDEO_ID")'
            },
            lang: {
              type: 'string',
              description: 'Language code for the transcript (default: "en" for English)'
            }
          },
          required: ['videoUrl']
        }
      }
    };
  }

  /**
   * Invokes the YouTube transcript fetcher with the given tool call
   */
  async invoke(toolCall) {
    try {
      // Parse the arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['videoUrl']);
      
      // Get the transcript
      const result = await this.getTranscript(args.videoUrl, args.lang || 'en');
      
      // Return ToolResult success
      return ToolResult.success(result);
    } catch (error) {
      // Return ToolResult failure
      return ToolResult.failure(
        error.message || 'Failed to fetch YouTube transcript',
        {
          videoUrl: toolCall.function.arguments ? JSON.parse(toolCall.function.arguments).videoUrl : 'unknown',
          errorType: 'fetch_error'
        }
      );
    }
  }

  /**
   * Extracts video ID from various YouTube URL formats
   */
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // If no pattern matches, assume the input might be just the video ID
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
      return url;
    }
    
    throw new Error('Invalid YouTube URL or video ID');
  }

  /**
   * Fetches transcript from a YouTube video
   */
  async getTranscript(videoUrl, lang = 'en') {
    try {
      console.log(`Fetching transcript for: ${videoUrl}`);
      
      // Extract video ID
      const videoId = this.extractVideoId(videoUrl);
      console.log(`Video ID: ${videoId}`);
      
      // Fetch transcript
      const transcriptData = await YTTranscript.fetchTranscript(videoId, {
        lang: lang
      });
      
      if (!transcriptData || transcriptData.length === 0) {
        throw new Error('No transcript available for this video');
      }
      
      // Format transcript
      const formattedTranscript = transcriptData.map(item => ({
        text: item.text,
        start: item.start,
        duration: item.duration
      }));
      
      // Create full text version
      const fullText = transcriptData.map(item => item.text).join(' ');
      
      // Calculate total duration
      const lastItem = transcriptData[transcriptData.length - 1];
      const totalDuration = lastItem ? lastItem.start + lastItem.duration : 0;
      
      console.log(`Successfully fetched transcript with ${transcriptData.length} segments`);
      
      return {
        success: true,
        videoId: videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        language: lang,
        segments: formattedTranscript,
        fullText: fullText,
        totalDuration: totalDuration,
        segmentCount: transcriptData.length
      };
      
    } catch (error) {
      if (error.message.includes('Could not find transcript')) {
        throw new Error('No transcript available for this video. The video might not have captions enabled.');
      } else if (error.message.includes('Video unavailable')) {
        throw new Error('Video is unavailable. It might be private, deleted, or geo-restricted.');
      }
      throw new Error(`Failed to fetch transcript: ${error.message}`);
    }
  }
}

export default YoutubeTranscript;