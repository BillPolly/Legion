/**
 * LogCaptureActor - Frontend actor for capturing and transmitting logs
 * 
 * This actor integrates with the existing ActorSpace system to:
 * - Capture console logs and errors via ConsoleHook and ErrorCapture
 * - Batch logs efficiently to minimize network overhead
 * - Send log batches to the backend LogCaptureAgent via WebSocket
 * - Handle connection failures gracefully
 */

import { Actor } from '../../../../shared/actors/src/Actor.js';
import { ConsoleHook } from './ConsoleHook.js';
import { ErrorCapture } from './ErrorCapture.js';

export class LogCaptureActor extends Actor {
  constructor(config = {}) {
    super();
    
    this.config = {
      batchSize: config.batchSize || 50,
      batchInterval: config.batchInterval || 3000, // 3 seconds
      maxBufferSize: config.maxBufferSize || 1000,
      enableConsoleCapture: config.enableConsoleCapture !== false,
      enableErrorCapture: config.enableErrorCapture !== false,
      enablePerformanceCapture: config.enablePerformanceCapture !== false,
      ...config
    };
    
    this.remoteActor = null;
    this.logBuffer = [];
    this.batchTimer = null;
    this.isConnected = false;
    
    // Initialize capture systems
    if (this.config.enableConsoleCapture) {
      this.consoleHook = new ConsoleHook({
        captureStackTrace: true,
        filterSensitive: true
      });
    }
    
    if (this.config.enableErrorCapture) {
      this.errorCapture = new ErrorCapture({
        captureUnhandledErrors: true,
        capturePromiseRejections: true,
        captureResourceErrors: true,
        captureNetworkErrors: true
      });
    }
    
    // Bind methods
    this.handleLogEntry = this.handleLogEntry.bind(this);
    this.handleErrorEntry = this.handleErrorEntry.bind(this);
    this.sendBatch = this.sendBatch.bind(this);
  }
  
  /**
   * Initialize the log capture actor
   */
  async initialize() {
    console.log('LogCaptureActor: Initializing log capture...');
    
    try {
      // Install console hooks
      if (this.consoleHook) {
        this.consoleHook.addListener(this.handleLogEntry);
        this.consoleHook.install();
      }
      
      // Install error capture
      if (this.errorCapture) {
        this.errorCapture.addListener(this.handleErrorEntry);
        this.errorCapture.install();
      }
      
      // Install performance monitoring
      if (this.config.enablePerformanceCapture) {
        this.installPerformanceCapture();
      }
      
      // Start batch timer
      this.startBatchTimer();
      
      // Send initial metadata
      this.sendMetadata();
      
      console.log('LogCaptureActor: Successfully initialized');
      
    } catch (error) {
      console.error('LogCaptureActor: Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Handle incoming messages from remote actor
   */
  async receive(payload) {
    try {
      switch (payload.type) {
        case 'log_capture_config':
          await this.handleConfigUpdate(payload.config);
          return { success: true, message: 'Configuration updated' };
          
        case 'log_capture_flush':
          await this.flushLogs();
          return { success: true, message: 'Logs flushed' };
          
        case 'log_capture_status':
          return await this.getStatus();
          
        case 'log_capture_clear':
          this.clearBuffers();
          return { success: true, message: 'Buffers cleared' };
          
        default:
          console.warn('LogCaptureActor: Unknown message type:', payload.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('LogCaptureActor: Error handling message:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Set remote actor reference
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.isConnected = !!remoteActor;
    console.log('LogCaptureActor: Remote actor connection:', this.isConnected ? 'established' : 'lost');
  }
  
  /**
   * Handle console log entries
   */
  handleLogEntry(logEntry) {
    this.addToBuffer({
      type: 'console_log',
      ...logEntry
    });
  }
  
  /**
   * Handle error entries
   */
  handleErrorEntry(errorEntry) {
    this.addToBuffer({
      type: 'frontend_error',
      ...errorEntry
    });
  }
  
  /**
   * Add entry to buffer with overflow protection
   */
  addToBuffer(entry) {
    // Add correlation ID and metadata
    entry.correlationId = this.generateCorrelationId();
    entry.capturedAt = Date.now();
    entry.page = {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer
    };
    
    this.logBuffer.push(entry);
    
    // Prevent buffer overflow
    if (this.logBuffer.length > this.config.maxBufferSize) {
      // Remove oldest entries (FIFO)
      this.logBuffer.splice(0, this.logBuffer.length - this.config.maxBufferSize);
      console.warn('LogCaptureActor: Buffer overflow, dropped oldest entries');
    }
    
    // Send immediately if buffer is full
    if (this.logBuffer.length >= this.config.batchSize) {
      this.sendBatch();
    }
  }
  
  /**
   * Start the batch timer for periodic log transmission
   */
  startBatchTimer() {
    this.stopBatchTimer();
    
    this.batchTimer = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.sendBatch();
      }
    }, this.config.batchInterval);
  }
  
  /**
   * Stop the batch timer
   */
  stopBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }
  
  /**
   * Send current log batch to remote actor
   */
  async sendBatch() {
    if (!this.isConnected || this.logBuffer.length === 0) {
      return;
    }
    
    try {
      const batch = {
        type: 'log_batch',
        timestamp: Date.now(),
        sessionId: this.getSessionId(),
        entries: [...this.logBuffer],
        metadata: {
          batchSize: this.logBuffer.length,
          url: window.location.href,
          userAgent: navigator.userAgent,
          performance: this.getPerformanceSnapshot()
        }
      };
      
      // Clear buffer before sending (in case of async issues)
      this.logBuffer = [];
      
      // Send to remote actor
      await this.sendToRemote(batch);
      
      console.debug(`LogCaptureActor: Sent batch with ${batch.entries.length} entries`);
      
    } catch (error) {
      console.error('LogCaptureActor: Failed to send batch:', error);
      
      // On failure, we could implement retry logic or store failed batches
      // For now, just log the error
    }
  }
  
  /**
   * Send metadata about the current page and session
   */
  async sendMetadata() {
    if (!this.isConnected) {
      return;
    }
    
    try {
      const metadata = {
        type: 'session_metadata',
        timestamp: Date.now(),
        sessionId: this.getSessionId(),
        page: {
          url: window.location.href,
          title: document.title,
          referrer: document.referrer,
          loadTime: performance.timing ? (performance.timing.loadEventEnd - performance.timing.navigationStart) : null
        },
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        },
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        config: this.config
      };
      
      await this.sendToRemote(metadata);
      
    } catch (error) {
      console.error('LogCaptureActor: Failed to send metadata:', error);
    }
  }
  
  /**
   * Install performance monitoring
   */
  installPerformanceCapture() {
    // Navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (performance.timing) {
          this.addToBuffer({
            type: 'performance_timing',
            navigation: {
              loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
              domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
              firstPaint: performance.getEntriesByType?.('paint')?.[0]?.startTime || null
            }
          });
        }
      }, 100);
    });
    
    // Resource timing (sample only)
    if (performance.getEntriesByType) {
      setInterval(() => {
        const resources = performance.getEntriesByType('resource').slice(-10); // Last 10
        if (resources.length > 0) {
          this.addToBuffer({
            type: 'performance_resources',
            resources: resources.map(r => ({
              name: r.name,
              duration: r.duration,
              transferSize: r.transferSize,
              type: r.initiatorType
            }))
          });
        }
      }, 30000); // Every 30 seconds
    }
  }
  
  /**
   * Get current performance snapshot
   */
  getPerformanceSnapshot() {
    if (!performance) return null;
    
    return {
      now: performance.now(),
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      } : null
    };
  }
  
  /**
   * Generate correlation ID for tracking related events
   */
  generateCorrelationId() {
    return 'log_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  
  /**
   * Get session ID
   */
  getSessionId() {
    let sessionId = window.sessionStorage?.getItem('legion-session-id');
    
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      window.sessionStorage?.setItem('legion-session-id', sessionId);
    }
    
    return sessionId;
  }
  
  /**
   * Send message to remote actor
   */
  async sendToRemote(message) {
    if (this.remoteActor && this.remoteActor.receive) {
      return await this.remoteActor.receive(message);
    } else {
      throw new Error('No remote actor available');
    }
  }
  
  /**
   * Handle configuration updates
   */
  async handleConfigUpdate(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart batch timer with new interval
    if (newConfig.batchInterval) {
      this.startBatchTimer();
    }
    
    console.log('LogCaptureActor: Configuration updated:', newConfig);
  }
  
  /**
   * Flush all pending logs immediately
   */
  async flushLogs() {
    if (this.logBuffer.length > 0) {
      await this.sendBatch();
    }
  }
  
  /**
   * Get current actor status
   */
  async getStatus() {
    return {
      connected: this.isConnected,
      bufferSize: this.logBuffer.length,
      config: this.config,
      sessionId: this.getSessionId(),
      stats: {
        console: this.consoleHook?.getStats() || null,
        errors: this.errorCapture?.getStats() || null
      }
    };
  }
  
  /**
   * Clear all buffers
   */
  clearBuffers() {
    this.logBuffer = [];
    this.consoleHook?.clearBuffer();
    this.errorCapture?.clearBuffer();
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    console.log('LogCaptureActor: Cleaning up...');
    
    // Stop batch timer
    this.stopBatchTimer();
    
    // Flush remaining logs
    if (this.logBuffer.length > 0) {
      this.sendBatch().catch(console.error);
    }
    
    // Uninstall hooks
    this.consoleHook?.uninstall();
    this.errorCapture?.uninstall();
    
    // Clear references
    this.remoteActor = null;
    this.isConnected = false;
  }
}