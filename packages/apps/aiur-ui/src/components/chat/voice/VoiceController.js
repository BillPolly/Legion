/**
 * VoiceController - Manages TTS playback and audio queue
 * 
 * Features:
 * - Audio playback queue management
 * - Auto-play mode support
 * - Interruption handling
 * - Volume control
 * - Playback state management
 */
export class VoiceController {
  constructor() {
    this.audioQueue = [];
    this.currentAudio = null;
    this.isPlaying = false;
    this.autoPlayEnabled = false;
    this.volume = 1.0;
    
    // Event handlers
    this.onPlaybackStart = null;
    this.onPlaybackEnd = null;
    this.onError = null;
    
    // Currently playing message ID
    this.currentMessageId = null;
    
    // Audio context for better control (optional)
    this.audioContext = null;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not available, using basic audio playback');
    }
  }
  
  /**
   * Set auto-play mode
   */
  setAutoPlay(enabled) {
    this.autoPlayEnabled = enabled;
  }
  
  /**
   * Add audio to queue or play immediately
   */
  async play(audioData, messageId, options = {}) {
    const audioItem = {
      data: audioData,
      messageId,
      priority: options.priority || 'normal',
      voice: options.voice,
      format: options.format || 'mp3'
    };
    
    // High priority items (like manual clicks) bypass queue
    if (options.priority === 'high' || !this.isPlaying) {
      // Stop current playback if high priority
      if (options.priority === 'high' && this.isPlaying) {
        this.stop();
      }
      
      await this.playAudio(audioItem);
    } else {
      // Add to queue
      this.audioQueue.push(audioItem);
    }
  }
  
  /**
   * Play audio data
   */
  async playAudio(audioItem) {
    try {
      this.isPlaying = true;
      this.currentMessageId = audioItem.messageId;
      
      // Notify start
      if (this.onPlaybackStart) {
        this.onPlaybackStart(audioItem.messageId);
      }
      
      // Create audio element
      const audio = new Audio();
      this.currentAudio = audio;
      
      // Convert base64 to blob URL
      const audioBlob = this.base64ToBlob(audioItem.data, audioItem.format);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audio.src = audioUrl;
      audio.volume = this.volume;
      
      // Set up event handlers
      audio.onended = () => {
        this.handleAudioEnded(audioUrl);
      };
      
      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        if (this.onError) {
          this.onError({
            type: 'playback',
            message: 'Failed to play audio',
            messageId: audioItem.messageId,
            error
          });
        }
        this.handleAudioEnded(audioUrl);
      };
      
      // Resume audio context if needed (for autoplay policy)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Play audio
      await audio.play();
      
    } catch (error) {
      console.error('Failed to play audio:', error);
      
      if (this.onError) {
        this.onError({
          type: 'playback',
          message: 'Failed to play audio',
          messageId: audioItem.messageId,
          error
        });
      }
      
      this.isPlaying = false;
      this.processQueue();
    }
  }
  
  /**
   * Handle audio ended
   */
  handleAudioEnded(audioUrl) {
    // Clean up
    URL.revokeObjectURL(audioUrl);
    this.currentAudio = null;
    this.isPlaying = false;
    
    // Notify end
    if (this.onPlaybackEnd) {
      this.onPlaybackEnd(this.currentMessageId);
    }
    
    this.currentMessageId = null;
    
    // Process queue
    this.processQueue();
  }
  
  /**
   * Process audio queue
   */
  async processQueue() {
    if (this.audioQueue.length > 0 && !this.isPlaying) {
      const nextAudio = this.audioQueue.shift();
      await this.playAudio(nextAudio);
    }
  }
  
  /**
   * Stop current playback
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      
      // Trigger ended event manually
      if (this.currentAudio.src) {
        const audioUrl = this.currentAudio.src;
        URL.revokeObjectURL(audioUrl);
      }
      
      this.currentAudio = null;
      this.isPlaying = false;
      
      if (this.onPlaybackEnd && this.currentMessageId) {
        this.onPlaybackEnd(this.currentMessageId);
      }
      
      this.currentMessageId = null;
    }
  }
  
  /**
   * Pause/resume playback
   */
  togglePause() {
    if (this.currentAudio) {
      if (this.currentAudio.paused) {
        this.currentAudio.play();
      } else {
        this.currentAudio.pause();
      }
    }
  }
  
  /**
   * Clear audio queue
   */
  clearQueue() {
    this.audioQueue = [];
  }
  
  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }
  
  /**
   * Convert base64 to blob
   */
  base64ToBlob(base64, format = 'mp3') {
    const mimeType = this.getMimeType(format);
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
  
  /**
   * Get MIME type from format
   */
  getMimeType(format) {
    const mimeTypes = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'opus': 'audio/opus'
    };
    
    return mimeTypes[format] || 'audio/mpeg';
  }
  
  /**
   * Get playback state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      autoPlayEnabled: this.autoPlayEnabled,
      queueLength: this.audioQueue.length,
      currentMessageId: this.currentMessageId,
      volume: this.volume
    };
  }
  
  /**
   * Should auto-play this message?
   */
  shouldAutoPlay(message) {
    if (!this.autoPlayEnabled) return false;
    
    // Only auto-play assistant messages
    if (message.role !== 'assistant') return false;
    
    // Skip if message contains code blocks
    if (message.content.includes('```')) return false;
    
    // Skip very long messages (over 500 chars)
    if (message.content.length > 500) return false;
    
    return true;
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    this.clearQueue();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.onPlaybackStart = null;
    this.onPlaybackEnd = null;
    this.onError = null;
  }
}