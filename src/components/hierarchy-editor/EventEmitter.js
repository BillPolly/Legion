/**
 * EventEmitter - Simple event emitter implementation
 */

export class EventEmitter {
  constructor() {
    this._events = {};
    this._wildcardListeners = [];
  }
  
  on(event, handler) {
    if (event === '*') {
      this._wildcardListeners.push(handler);
    } else {
      if (!this._events[event]) {
        this._events[event] = [];
      }
      this._events[event].push(handler);
    }
  }
  
  off(event, handler) {
    if (event === '*') {
      const index = this._wildcardListeners.indexOf(handler);
      if (index > -1) {
        this._wildcardListeners.splice(index, 1);
      }
    } else if (this._events[event]) {
      const index = this._events[event].indexOf(handler);
      if (index > -1) {
        this._events[event].splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    // Create event object if data doesn't have stopPropagation
    const eventData = data || {};
    if (!eventData.stopPropagation) {
      eventData.stopPropagation = () => {
        eventData._propagationStopped = true;
      };
    }
    
    // Call specific event handlers
    if (this._events[event]) {
      for (const handler of [...this._events[event]]) {
        handler(eventData);
        if (eventData._propagationStopped) {
          break;
        }
      }
    }
    
    // Call wildcard listeners
    if (!eventData._propagationStopped) {
      for (const handler of [...this._wildcardListeners]) {
        handler(event, eventData);
        if (eventData._propagationStopped) {
          break;
        }
      }
    }
  }
  
  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
  
  removeAllListeners(event) {
    if (event) {
      delete this._events[event];
    } else {
      this._events = {};
      this._wildcardListeners = [];
    }
  }
  
  listenerCount(event) {
    if (event === '*') {
      return this._wildcardListeners.length;
    }
    return this._events[event] ? this._events[event].length : 0;
  }
}