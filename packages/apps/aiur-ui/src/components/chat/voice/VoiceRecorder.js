/**
 * VoiceRecorder - Handles browser audio recording using MediaRecorder API
 * 
 * Features:
 * - Records audio from microphone
 * - Converts to base64 for transmission
 * - Handles permission requests
 * - Provides visual feedback
 */
export class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.recordingStartTime = null;
    
    // Event handlers
    this.onDataAvailable = null;
    this.onError = null;
    this.onStart = null;
    this.onStop = null;
    
    // Configuration
    this.config = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    };
    
    // Check for alternative mime types if webm/opus not supported
    if (!MediaRecorder.isTypeSupported(this.config.mimeType)) {
      const alternatives = [
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      
      for (const mimeType of alternatives) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          this.config.mimeType = mimeType;
          break;
        }
      }
    }
  }
  
  /**
   * Initialize and request microphone permission
   */
  async initialize() {
    try {
      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      return true;
    } catch (error) {
      console.error('Failed to get microphone access:', error);
      if (this.onError) {
        this.onError({
          type: 'permission',
          message: 'Microphone access denied',
          error
        });
      }
      return false;
    }
  }
  
  /**
   * Start recording
   */
  async start() {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }
    
    // Initialize if not already done
    if (!this.stream) {
      const initialized = await this.initialize();
      if (!initialized) return;
    }
    
    try {
      // Reset chunks
      this.audioChunks = [];
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, this.config);
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        // Create blob from chunks
        const audioBlob = new Blob(this.audioChunks, { type: this.config.mimeType });
        
        // Convert to base64
        const base64 = await this.blobToBase64(audioBlob);
        
        // Calculate duration
        const duration = Date.now() - this.recordingStartTime;
        
        // Trigger callback
        if (this.onDataAvailable) {
          this.onDataAvailable({
            audio: base64,
            blob: audioBlob,
            mimeType: this.config.mimeType,
            duration: duration,
            format: this.getFormatFromMimeType(this.config.mimeType)
          });
        }
        
        if (this.onStop) {
          this.onStop();
        }
      };
      
      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        if (this.onError) {
          this.onError({
            type: 'recording',
            message: 'Recording failed',
            error
          });
        }
      };
      
      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      if (this.onStart) {
        this.onStart();
      }
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      if (this.onError) {
        this.onError({
          type: 'start',
          message: 'Failed to start recording',
          error
        });
      }
    }
  }
  
  /**
   * Stop recording
   */
  stop() {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('Not recording');
      return;
    }
    
    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      if (this.onError) {
        this.onError({
          type: 'stop',
          message: 'Failed to stop recording',
          error
        });
      }
    }
  }
  
  /**
   * Convert blob to base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove data URL prefix to get just base64
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * Get format from mime type
   */
  getFormatFromMimeType(mimeType) {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mp4')) return 'mp4';
    return 'webm'; // default
  }
  
  /**
   * Get recording state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      hasPermission: !!this.stream,
      mimeType: this.config.mimeType,
      supported: !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    if (this.mediaRecorder && this.isRecording) {
      this.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }
}