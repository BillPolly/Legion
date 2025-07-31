/**
 * EventTestModule - Module wrapper for EventTestTool
 * 
 * Demonstrates module-level event forwarding and the complete event propagation chain:
 * Tool → Module → External listeners
 */

import { Module } from '../../src/module/Module.js';
import { EventTestTool } from './EventTestTool.js';

export class EventTestModule extends Module {
  // No external dependencies needed for this test module
  static dependencies = [];

  constructor({} = {}) {
    super();
    this.name = 'EventTestModule';
    this.description = 'Module for comprehensive event system testing';
    
    // Initialize the event test tool
    this.eventTestTool = new EventTestTool();
    
    // Register the tool (this sets up event forwarding)
    this.registerTool(this.eventTestTool);
  }

  /**
   * Get all tools provided by this module
   * @returns {Array} Array of tools
   */
  getTools() {
    return [this.eventTestTool];
  }

  /**
   * Get the event test tool specifically
   * @returns {EventTestTool} The event test tool
   */
  getEventTestTool() {
    return this.eventTestTool;
  }

  /**
   * Convenience method to execute event test scenarios
   * @param {Object} params - Test parameters
   * @returns {Promise<Object>} Test results
   */
  async runEventTest(params = {}) {
    return await this.eventTestTool.execute(params);
  }
}

export default EventTestModule;