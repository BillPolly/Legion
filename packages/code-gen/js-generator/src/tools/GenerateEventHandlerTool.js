/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * GenerateEventHandlerTool - Generate DOM event handlers with modern patterns
 * 
 * Creates JavaScript event handlers with proper event delegation, preventDefault,
 * stopPropagation, and modern addEventListener patterns.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const generateEventHandlerToolInputSchema = {
  type: 'object',
  properties: {
    handlerName: {
      type: 'string',
      description: 'Custom handler function name'
    },
    element: {
      type: 'string',
      description: 'Target element selector or variable name'
    },
    event: {
      type: 'string',
      description: 'Event type (click, change, submit, keydown, etc.)'
    },
    action: {
      type: 'string',
      description: 'Action code to execute when event fires'
    },
    preventDefault: {
      type: 'boolean',
      default: false,
      description: 'Call preventDefault()'
    },
    stopPropagation: {
      type: 'boolean',
      default: false,
      description: 'Call stopPropagation()'
    },
    delegation: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: false
        },
        parent: {
          type: 'string'
        },
        target: {
          type: 'string'
        }
      },
      description: 'Event delegation configuration'
    },
    throttle: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: false
        },
        delay: {
          type: 'number',
          default: 300
        }
      }
    },
    debounce: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: false
        },
        delay: {
          type: 'number',
          default: 500
        }
      }
    },
    validation: {
      type: 'string',
      description: 'Validation code to run before action'
    },
    errorHandling: {
      type: 'boolean',
      default: true,
      description: 'Include try-catch error handling'
    },
    once: {
      type: 'boolean',
      default: false,
      description: 'Remove listener after first execution'
    },
    passive: {
      type: 'boolean',
      default: false,
      description: 'Set passive option for better performance'
    },
    useCapture: {
      type: 'boolean',
      default: false,
      description: 'Use capture phase instead of bubble'
    }
  },
  required: ['event', 'action']
};

// Output schema as plain JSON Schema
const generateEventHandlerToolOutputSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Generated event handler code'
    },
    handlerName: {
      type: 'string',
      description: 'Generated handler function name'
    },
    attachmentCode: {
      type: 'string',
      description: 'Code to attach the event listener'
    },
    components: {
      type: 'object',
      properties: {
        hasPreventDefault: {
          type: 'boolean',
          description: 'Whether preventDefault is used'
        },
        hasStopPropagation: {
          type: 'boolean',
          description: 'Whether stopPropagation is used'
        },
        hasDelegation: {
          type: 'boolean',
          description: 'Whether event delegation is used'
        },
        hasThrottling: {
          type: 'boolean',
          description: 'Whether throttling is applied'
        },
        hasDebouncing: {
          type: 'boolean',
          description: 'Whether debouncing is applied'
        },
        hasValidation: {
          type: 'boolean',
          description: 'Whether validation is included'
        },
        hasErrorHandling: {
          type: 'boolean',
          description: 'Whether error handling is included'
        }
      },
      required: ['hasPreventDefault', 'hasStopPropagation', 'hasDelegation', 'hasThrottling', 'hasDebouncing', 'hasValidation', 'hasErrorHandling'],
      description: 'Analysis of generated components'
    }
  },
  required: ['code', 'handlerName', 'attachmentCode', 'components']
};

export class GenerateEventHandlerTool extends Tool {
  constructor() {
    super({
      name: 'generate_event_handler',
      description: 'Generate DOM event handler with preventDefault and stopPropagation options',
      inputSchema: generateEventHandlerToolInputSchema,
      outputSchema: generateEventHandlerToolOutputSchema
    });
  }

  
  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.inputSchema,
        output: this.outputSchema || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Tool execution result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    // Parse arguments from the tool call
    let args;
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      throw new Error(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(, {
        cause: {
          errorType: 'operation_error'
        }
      }),
        stack: error.stack
      });
    }

    // Execute the tool with parsed arguments
    try {
      const result = await this.execute(args);
      return result;
    } catch (error) {
      throw new Error(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(, {
        cause: {
          errorType: 'operation_error'
        }
      }),
        stack: error.stack
      });
    }
  }

  async execute(args) {
    // Generate handler name
    const handlerName = args.handlerName || 
      this._generateHandlerName(args.event, args.element);
    
    // Build the event handler code
    const codeParts = [];
    
    // Add utility functions if needed
    const utilityFunctions = this._generateUtilityFunctions(args);
    if (utilityFunctions) {
      codeParts.push(utilityFunctions);
    }
    
    // Add JSDoc comment
    const jsdoc = this._generateJSDoc(args, handlerName);
    codeParts.push(jsdoc);
    
    // Build handler function
    const handlerParts = [];
    handlerParts.push(`function ${handlerName}(event) {`);
    
    const bodyParts = [];
    
    // Add event delegation check if needed
    if (args.delegation?.enabled && args.delegation.target) {
      bodyParts.push(`  // Event delegation check`);
      bodyParts.push(`  if (!event.target.matches('${args.delegation.target}')) {`);
      bodyParts.push(`    return;`);
      bodyParts.push(`  }`);
      bodyParts.push('');
    }
    
    // Add validation if provided
    const hasValidation = this._addValidation(bodyParts, args.validation);
    
    // Add preventDefault if requested
    if (args.preventDefault) {
      bodyParts.push('  // Prevent default browser behavior');
      bodyParts.push('  event.preventDefault();');
      bodyParts.push('');
    }
    
    // Add stopPropagation if requested
    if (args.stopPropagation) {
      bodyParts.push('  // Stop event propagation');
      bodyParts.push('  event.stopPropagation();');
      bodyParts.push('');
    }
    
    // Add error handling wrapper if enabled
    if (args.errorHandling) {
      bodyParts.push('  try {');
      bodyParts.push('    // Main event handler logic');
      
      // Add the action code with proper indentation
      const actionLines = args.action.split('\n');
      actionLines.forEach(line => {
        bodyParts.push(`    ${line}`);
      });
      
      bodyParts.push('  } catch (error) {');
      bodyParts.push('    console.error(`Error in ${handlerName}:`, error);');
      bodyParts.push('    // Optionally re-throw or handle error gracefully');
      bodyParts.push('    // throw error;');
      bodyParts.push('  }');
    } else {
      bodyParts.push('  // Main event handler logic');
      const actionLines = args.action.split('\n');
      actionLines.forEach(line => {
        bodyParts.push(`  ${line}`);
      });
    }
    
    // Add once logic if enabled
    if (args.once) {
      bodyParts.push('');
      bodyParts.push('  // Remove listener after first execution');
      const element = args.element || 'event.currentTarget';
      bodyParts.push(`  ${element}.removeEventListener('${args.event}', ${handlerName});`);
    }
    
    handlerParts.push(bodyParts.join('\n'));
    handlerParts.push('}');
    
    codeParts.push(handlerParts.join('\n'));
    
    // Generate attachment code
    const attachmentCode = this._generateAttachmentCode(args, handlerName);
    
    // Build final code
    const finalCode = codeParts.join('\n\n');
    
    // Analyze components
    const components = {
      hasPreventDefault: !!args.preventDefault,
      hasStopPropagation: !!args.stopPropagation,
      hasDelegation: !!args.delegation?.enabled,
      hasThrottling: !!args.throttle?.enabled,
      hasDebouncing: !!args.debounce?.enabled,
      hasValidation: hasValidation,
      hasErrorHandling: !!args.errorHandling
    };
    
    return {
      code: finalCode,
      handlerName,
      attachmentCode,
      components
    };
  }

  _generateHandlerName(event, element) {
    const eventPart = this._toCamelCase(event);
    const elementPart = element 
      ? this._toCamelCase(element.replace(/^[.#]/, '')) 
      : 'element';
    
    return `handle${eventPart.charAt(0).toUpperCase() + eventPart.slice(1)}${elementPart.charAt(0).toUpperCase() + elementPart.slice(1)}`;
  }

  _toCamelCase(str) {
    return str.replace(/[^a-zA-Z0-9]+(.)/g, (match, char) => char.toUpperCase())
              .replace(/[^a-zA-Z0-9]/g, '');
  }

  _generateJSDoc(args, handlerName) {
    const lines = ['/**'];
    
    lines.push(` * Handle ${args.event} event${args.element ? ` on ${args.element}` : ''}`);
    lines.push(' *');
    lines.push(' * @param {Event} event - The DOM event object');
    
    if (args.delegation?.enabled) {
      lines.push(' * @param {Element} event.target - The element that triggered the event');
      lines.push(' * @param {Element} event.currentTarget - The element the listener is attached to');
    }
    
    lines.push(' */');
    
    return lines.join('\\n');
  }

  _generateUtilityFunctions(args) {
    const parts = [];
    
    if (args.throttle?.enabled) {
      parts.push('// Throttle utility function');
      parts.push('const throttle = (func, delay) => {');
      parts.push('  let timeoutId;');
      parts.push('  let lastExecTime = 0;');
      parts.push('  return function (...args) {');
      parts.push('    const currentTime = Date.now();');
      parts.push('    if (currentTime - lastExecTime > delay) {');
      parts.push('      func.apply(this, args);');
      parts.push('      lastExecTime = currentTime;');
      parts.push('    } else {');
      parts.push('      clearTimeout(timeoutId);');
      parts.push('      timeoutId = setTimeout(() => {');
      parts.push('        func.apply(this, args);');
      parts.push('        lastExecTime = Date.now();');
      parts.push('      }, delay - (currentTime - lastExecTime));');
      parts.push('    }');
      parts.push('  };');
      parts.push('};');
      parts.push('');
    }
    
    if (args.debounce?.enabled) {
      parts.push('// Debounce utility function');
      parts.push('const debounce = (func, delay) => {');
      parts.push('  let timeoutId;');
      parts.push('  return function (...args) {');
      parts.push('    clearTimeout(timeoutId);');
      parts.push('    timeoutId = setTimeout(() => func.apply(this, args), delay);');
      parts.push('  };');
      parts.push('};');
      parts.push('');
    }
    
    return parts.join('\\n');
  }

  _addValidation(bodyParts, validation) {
    if (!validation) return false;

    bodyParts.push('    // Event validation');
    const validationLines = validation.split('\\n');
    validationLines.forEach(line => {
      bodyParts.push(`    ${line}`);
    });
    bodyParts.push('');
    
    return true;
  }

  _generateAttachmentCode(args, handlerName) {
    const parts = [];
    
    // Determine the actual handler function (with throttling/debouncing if enabled)
    let actualHandler = handlerName;
    
    if (args.throttle?.enabled) {
      const delay = args.throttle.delay || 300;
      actualHandler = `throttle(${handlerName}, ${delay})`;
    } else if (args.debounce?.enabled) {
      const delay = args.debounce.delay || 300;
      actualHandler = `debounce(${handlerName}, ${delay})`;
    }

    if (args.delegation?.enabled) {
      // Event delegation
      const parent = args.delegation.parent || 'document';
      const target = args.delegation.target || args.element;
      
      parts.push(`${parent}.addEventListener('${args.event}', (event) => {`);
      parts.push(`  if (event.target.matches('${target}')) {`);
      parts.push(`    ${actualHandler}(event);`);
      parts.push('  }');
      parts.push('});');
    } else {
      // Direct event attachment
      const element = args.element || 'document';
      
      // Build options object
      const options = [];
      if (args.once) options.push('once: true');
      if (args.passive) options.push('passive: true');
      if (args.capture) options.push('capture: true');
      
      const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
      
      // Handle different element selection patterns
      if (element.startsWith('#') || element.startsWith('.') || element.includes(' ')) {
        // CSS selector
        parts.push(`const targetElement = document.querySelector('${element}');`);
        parts.push('if (targetElement) {');
        parts.push(`  targetElement.addEventListener('${args.event}', ${actualHandler}${optionsStr});`);
        parts.push('} else {');
        parts.push(`  console.warn('Element not found: ${element}');`);
        parts.push('}');
      } else {
        // Variable name or direct element reference
        parts.push(`${element}.addEventListener('${args.event}', ${actualHandler}${optionsStr});`);
      }
    }
    
    return parts.join('\\n');
  }
}