import { MockLLMProvider } from '../../src/core/providers/MockLLMProvider';

// Intent parser for project management commands
function parseProjectIntent(userInput: string): any {
  const input = userInput.toLowerCase();
  
  // Project operations
  if (input.includes('create') && (input.includes('project') || input.includes('new project'))) {
    // Try quoted strings first, then patterns with "called/named", then simple "project Name"
    const quotedMatch = userInput.match(/"([^"]+)"/);
    const calledMatch = userInput.match(/(?:called|named)\s+"?([^"]+)"?/i);
    const projectMatch = userInput.match(/(?:create|new)\s+project\s+(\w+)/i);
    
    const nameMatch = quotedMatch || calledMatch || projectMatch;
    if (nameMatch) {
      const extractedName = nameMatch[1];
      return {
        command: 'create_project',
        parameters: { name: extractedName },
        confidence: 0.9
      };
    }
  }
  
  // Status and reporting (check before general project listing)
  if (input.includes('status') || input.includes('progress report')) {
    return {
      command: 'project_status',
      parameters: {},
      confidence: 0.9
    };
  }
  
  if ((input.includes('list') || input.includes('show')) && input.includes('project')) {
    return {
      command: 'list_projects',
      parameters: {},
      confidence: 0.9
    };
  }
  
  if (input.includes('switch') && input.includes('project')) {
    // Try "switch to project Name" or "switch to Name"
    const nameMatch = userInput.match(/switch\s+to\s+(?:project\s+)?(.+)$/i);
    if (nameMatch) {
      return {
        command: 'switch_project',
        parameters: { name: nameMatch[1].trim() },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('delete') && input.includes('project')) {
    const nameMatch = userInput.match(/project\s+"([^"]+)"/i);
    if (nameMatch) {
      return {
        command: 'delete_project',
        parameters: { name: nameMatch[1] },
        confidence: 0.9
      };
    }
  }
  
  // Task operations
  if (input.includes('add task')) {
    const nameMatch = userInput.match(/add task\s+"([^"]+)"/i);
    if (nameMatch) {
      return {
        command: 'add_task',
        parameters: { title: nameMatch[1] },
        confidence: 0.9
      };
    }
  }
  
  // Task details (check before general task listing)
  if (input.includes('show task details')) {
    return {
      command: 'task_details',
      parameters: { title: 'last' },
      confidence: 0.9
    };
  }
  
  if ((input.includes('show') || input.includes('list')) && input.includes('task')) {
    // Check for filters
    if (input.includes('completed')) {
      return {
        command: 'list_tasks',
        parameters: { filter: 'completed' },
        confidence: 0.9
      };
    }
    if (input.includes('overdue')) {
      return {
        command: 'list_tasks',
        parameters: { filter: 'overdue' },
        confidence: 0.9
      };
    }
    if (input.includes('high priority')) {
      return {
        command: 'list_tasks',
        parameters: { filter: 'high_priority' },
        confidence: 0.9
      };
    }
    if (input.includes('assigned to')) {
      const assigneeMatch = input.match(/assigned to\s+(\w+)/i);
      if (assigneeMatch) {
        return {
          command: 'list_tasks',
          parameters: { assignee: assigneeMatch[1] },
          confidence: 0.9
        };
      }
    }
    return {
      command: 'list_tasks',
      parameters: {},
      confidence: 0.9
    };
  }
  
  if (input.includes('complete task')) {
    const nameMatch = userInput.match(/complete task\s+"([^"]+)"/i);
    if (nameMatch) {
      return {
        command: 'complete_task',
        parameters: { title: nameMatch[1] },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('assign')) {
    const match = userInput.match(/assign\s+"([^"]+)"\s+to\s+(\w+)|assign\s+it\s+to\s+(\w+)/i);
    if (match) {
      return {
        command: 'assign_task',
        parameters: { 
          title: match[1] || 'last', 
          assignee: match[2] || match[3] 
        },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('set priority') || input.includes('set its priority')) {
    const match = userInput.match(/set priority of\s+"([^"]+)"\s+to\s+(\w+)|set its priority to\s+(\w+)/i);
    if (match) {
      return {
        command: 'set_priority',
        parameters: { 
          title: match[1] || 'last', 
          priority: match[2] || match[3] 
        },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('set due date')) {
    const match = userInput.match(/set due date of\s+"([^"]+)"\s+to\s+(\w+)/i);
    if (match) {
      return {
        command: 'set_due_date',
        parameters: { 
          title: match[1], 
          date: match[2] 
        },
        confidence: 0.9
      };
    }
  }
  
  
  // Team management
  if (input.includes('add team member')) {
    const match = userInput.match(/add team member\s+(\w+)\s+(?:with role|as)\s+(\w+)/i);
    if (match) {
      return {
        command: 'add_member',
        parameters: { name: match[1], role: match[2] },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('show team') || input.includes('list team')) {
    return {
      command: 'list_members',
      parameters: {},
      confidence: 0.9
    };
  }
  
  if (input.includes('remove team member')) {
    const match = userInput.match(/remove team member\s+(\w+)/i);
    if (match) {
      return {
        command: 'remove_member',
        parameters: { name: match[1] },
        confidence: 0.9
      };
    }
  }
  
  // Search
  if (input.includes('find') || input.includes('search')) {
    const match = userInput.match(/(?:find|search)\s+tasks?\s+containing\s+"([^"]+)"/i);
    if (match) {
      return {
        command: 'search_tasks',
        parameters: { query: match[1] },
        confidence: 0.9
      };
    }
  }
  
  // Bulk operations
  if (input.includes('complete all tasks')) {
    return {
      command: 'bulk_complete',
      parameters: {},
      confidence: 0.9
    };
  }
  
  if (input.includes('assign all tasks')) {
    const match = input.match(/assign all tasks to\s+(\w+)/i);
    if (match) {
      return {
        command: 'bulk_assign',
        parameters: { assignee: match[1] },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('clear completed')) {
    return {
      command: 'clear_completed',
      parameters: {},
      confidence: 0.9
    };
  }
  
  // Persistence
  if (input.includes('save')) {
    return {
      command: 'save_state',
      parameters: {},
      confidence: 0.9
    };
  }
  
  if (input.includes('load')) {
    return {
      command: 'load_state',
      parameters: {},
      confidence: 0.9
    };
  }
  
  // Help
  if (input === 'help' || input.includes('how do i')) {
    return {
      command: 'help',
      parameters: { topic: input.replace('how do i', '').trim() },
      confidence: 0.9
    };
  }
  
  
  // Default
  return {
    command: 'unknown',
    parameters: {},
    confidence: 0.5
  };
}

export function setupProjectManagerMock(mockProvider: MockLLMProvider) {
  // Override the completeStructured method to parse natural language
  const originalCompleteStructured = mockProvider.completeStructured.bind(mockProvider);
  const originalComplete = mockProvider.complete.bind(mockProvider);
  
  mockProvider.completeStructured = async function<T>(
    prompt: string, 
    schema: any,
    options?: any
  ): Promise<T> {
    // Parse the user input from the prompt
    const userInputMatch = prompt.match(/USER INPUT: (.+?)(?:\n|$)/);
    if (!userInputMatch) {
      return originalCompleteStructured(prompt, schema, options);
    }
    
    const userInput = userInputMatch[1];
    const intent = parseProjectIntent(userInput);
    
    return intent as any as T;
  };
  
  // Override the complete method to return natural language responses
  mockProvider.complete = async function(prompt: string, options?: any): Promise<string> {
    // Check if this is a response generation prompt
    if (prompt.includes('Generate a helpful, natural language response') || 
        prompt.includes('COMMAND EXECUTED') || 
        prompt.includes('EXECUTION RESULT') ||
        prompt.includes('natural language response')) {
      
      // Extract the output from the execution result (handle multiline)
      const outputMatch = prompt.match(/Output:\s*(.+?)(?:\nData:|$)/s);
      if (outputMatch) {
        const output = outputMatch[1].trim();
        // Remove any session context pollution that gets appended
        const cleanOutput = output.replace(/\s*SESSION CONTEXT:[\s\S]*$/i, '').trim();
        return cleanOutput;
      }
      
      // Check for error responses
      const errorMatch = prompt.match(/Status:\s*(?:failed|error)/i);
      if (errorMatch) {
        const errorText = prompt.match(/Output:\s*(.+?)(?:\n|$)/) || prompt.match(/Error:\s*(.+?)(?:\n|$)/);
        if (errorText) {
          return errorText[1];
        }
      }
      
      // Generic response for successful commands
      return 'Command completed successfully.';
    }
    
    return originalComplete(prompt, options);
  };
}