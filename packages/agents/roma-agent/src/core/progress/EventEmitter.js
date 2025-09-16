/**
 * EventEmitter - Handles event emission for task progress
 * Single responsibility: Event emission and notification
 */

import { Logger } from '../../utils/Logger.js';
import {
  ID_RANDOM_SUFFIX_LENGTH,
  ID_STRING_RADIX,
  ID_SUBSTRING_START
} from '../constants/SystemConstants.js';

export class EventEmitter {
  constructor(options = {}) {
    this.logger = options.logger || new Logger('EventEmitter');
  }

  /**
   * Emit an event to observers
   * @param {string} taskId - Task ID
   * @param {Object} event - Event data
   * @param {Map} observers - Observer map
   */
  emit(taskId, event, observers) {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    const enrichedEvent = this.enrichEvent(taskId, event);
    const patterns = this.getMatchingPatterns(taskId, observers);
    
    for (const pattern of patterns) {
      const patternObservers = observers.get(pattern);
      if (patternObservers) {
        for (const subscription of patternObservers) {
          this.notifyObserver(subscription, enrichedEvent);
        }
      }
    }
    
    return enrichedEvent;
  }

  /**
   * Enrich event with metadata
   * @private
   */
  enrichEvent(taskId, event) {
    return {
      ...event,
      taskId,
      timestamp: event.timestamp || Date.now(),
      id: this.generateEventId()
    };
  }

  /**
   * Get patterns that match a task ID
   * @private
   */
  getMatchingPatterns(taskId, observers) {
    const patterns = [];
    
    // Exact match
    if (observers.has(taskId)) {
      patterns.push(taskId);
    }
    
    // Wildcard match
    if (observers.has('*')) {
      patterns.push('*');
    }
    
    // Prefix matches
    for (const pattern of observers.keys()) {
      if (pattern.endsWith('*') && pattern !== '*') {
        const prefix = pattern.slice(0, -1);
        if (taskId.startsWith(prefix)) {
          patterns.push(pattern);
        }
      }
    }
    
    return patterns;
  }

  /**
   * Notify a single observer
   * @private
   */
  notifyObserver(subscription, event) {
    const { observer, options } = subscription;
    
    // Apply filters if specified
    if (options.filter && !this.passesFilter(event, options.filter)) {
      return;
    }
    
    try {
      observer(event);
    } catch (error) {
      this.logger.error('Observer notification failed', {
        error: error.message,
        stack: error.stack,
        taskId: event.taskId,
        eventType: event.type
      });
      
      // Re-throw if configured to fail on observer errors
      if (options.failOnError) {
        throw error;
      }
    }
  }

  /**
   * Check if event passes filter
   * @private
   */
  passesFilter(event, filter) {
    if (filter.status && event.status !== filter.status) {
      return false;
    }
    
    if (filter.minProgress && event.progress < filter.minProgress) {
      return false;
    }
    
    if (filter.maxProgress && event.progress > filter.maxProgress) {
      return false;
    }
    
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }
    
    if (filter.custom && typeof filter.custom === 'function') {
      return filter.custom(event);
    }
    
    return true;
  }

  /**
   * Create task-specific emitter
   */
  createTaskEmitter(taskId, observers) {
    const self = this;
    
    return {
      emit: (event) => self.emit(taskId, event, observers),
      
      progress: (percent, message) => self.emit(taskId, {
        status: 'progress',
        progress: percent,
        message
      }, observers),
      
      started: (details = {}) => self.emit(taskId, {
        status: 'started',
        ...details
      }, observers),
      
      completed: (result, details = {}) => self.emit(taskId, {
        status: 'completed',
        result,
        success: true,
        ...details
      }, observers),
      
      failed: (error, details = {}) => self.emit(taskId, {
        status: 'failed',
        error: error.message || error,
        errorStack: error.stack,
        success: false,
        ...details
      }, observers),
      
      custom: (type, data) => self.emit(taskId, {
        status: 'custom',
        type,
        ...data
      }, observers)
    };
  }

  /**
   * Generate unique event ID
   * @private
   */
  generateEventId() {
    return `evt-${Date.now()}-${Math.random().toString(ID_STRING_RADIX).substr(ID_SUBSTRING_START, ID_RANDOM_SUFFIX_LENGTH)}`;
  }
}