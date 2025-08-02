/**
 * Simple actors that inherit from BaseActor
 * These can be used inline in the app for specific purposes
 */
import { BaseActor } from './BaseActor.js';

/**
 * ToolsActor - Manages tools list and tool-related operations
 */
export class ToolsActor extends BaseActor {
  constructor(app) {
    super('ToolsActor');
    this.app = app;
  }

  onToolsList(tools) {
    // Update the tools panel when tools list is received
    if (this.app && this.app.updateToolsList) {
      this.app.updateToolsList(tools);
    }
  }

  // Handle getTools message from UI
  receive(message) {
    if (message.type === 'getTools') {
      // Request tools from bridge
      const bridge = this._space?.getActor('websocket-bridge');
      if (bridge) {
        bridge.receive({
          type: 'listTools',
          payload: {}
        });
      }
      return;
    }
    // Let parent handle all other messages
    super.receive(message);
  }
}

/**
 * TerminalActor - Manages terminal output and command results
 */
export class TerminalActor extends BaseActor {
  constructor(app) {
    super('TerminalActor');
    this.app = app;
  }

  onCommandResult(result, requestId) {
    if (this.app && this.app.displayToolResult) {
      this.app.displayToolResult(result);
    }
  }

  onToolResult(result, requestId) {
    if (this.app && this.app.displayToolResult) {
      this.app.displayToolResult(result);
    }
  }

  onToolError(error, requestId) {
    if (this.app && this.app.displayToolError) {
      this.app.displayToolError(error);
    }
  }

  onError(error, requestId) {
    if (this.app && this.app.displayToolError) {
      this.app.displayToolError(error);
    }
  }
}

/**
 * SessionActor - Manages session state
 */
export class SessionActor extends BaseActor {
  constructor(app) {
    super('SessionActor');
    this.app = app;
  }

  onSessionCreated(sessionId, sessionInfo) {
    if (this.app) {
      this.app.sessionId = sessionId;
      console.log(`${this.name}: Session established - ${sessionId}`);
      // Load initial modules after session is created
      if (this.app.loadInitialModules) {
        this.app.loadInitialModules();
      }
    }
  }
}

/**
 * VariablesActor - Manages variables state
 */
export class VariablesActor extends BaseActor {
  constructor(app) {
    super('VariablesActor');
    this.app = app;
    this.variables = new Map();
  }

  receive(message) {
    switch (message.type) {
      case 'variablesUpdate':
        this.handleVariablesUpdate(message.payload);
        break;
      case 'getVariables':
        this.requestVariables();
        break;
      case 'setVariable':
        this.setVariable(message.payload);
        break;
      default:
        super.receive(message);
    }
  }

  handleVariablesUpdate(variables) {
    this.variables.clear();
    if (Array.isArray(variables)) {
      variables.forEach(v => {
        this.variables.set(v.name, v);
      });
    }
    console.log(`${this.name}: Updated ${this.variables.size} variables`);
    
    // Update UI if needed
    if (this.app && this.app.updateVariablesList) {
      this.app.updateVariablesList(Array.from(this.variables.values()));
    }
  }

  requestVariables() {
    const bridge = this._space?.getActor('websocket-bridge');
    if (bridge && this.app?.sessionId) {
      bridge.receive({
        type: 'getVariables',
        payload: { sessionId: this.app.sessionId }
      });
    }
  }

  setVariable(variable) {
    const bridge = this._space?.getActor('websocket-bridge');
    if (bridge && this.app?.sessionId) {
      bridge.receive({
        type: 'setVariable',
        payload: {
          sessionId: this.app.sessionId,
          ...variable
        }
      });
    }
  }
}

/**
 * Factory function to create a simple actor with custom handlers
 */
export function createSimpleActor(name, handlers = {}) {
  const actor = new BaseActor(name);
  
  // Override the virtual methods with provided handlers
  Object.keys(handlers).forEach(key => {
    if (typeof handlers[key] === 'function') {
      actor[key] = handlers[key].bind(actor);
    }
  });
  
  return actor;
}