/**
 * EventStream - Event emission and monitoring
 */

export default class EventStream {
  constructor() {
    this.listeners = new Map();
    this.events = [];
  }
  
  emit(event) {
    const eventData = {
      type: event.type,
      timestamp: Date.now(),
      data: event.data,
      metadata: {
        projectId: this.projectId,
        phase: this.currentPhase,
        taskId: event.taskId
      }
    };
    
    // Store event
    this.events.push(eventData);
    
    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(eventData);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  getEvents() {
    return this.events;
  }
}