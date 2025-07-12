import { MockLLMProvider } from '../../src/core/providers/MockLLMProvider';

// Simple intent parser for calculator tests
function parseCalculatorIntent(userInput: string): any {
  const input = userInput.toLowerCase();
  
  // Handle mathematical expressions with parentheses FIRST (highest priority)
  const complexMathMatch = input.match(/\((.+?)\)/);
  if (complexMathMatch && (input.includes('*') || input.includes('-') || input.includes('+'))) {
    // Extract everything after "calculate" or the whole expression if no "calculate"
    let expression = input.replace(/.*?calculate\s*/i, '').trim();
    if (expression === input.trim()) {
      // No "calculate" found, look for the mathematical expression
      const mathExpr = input.match(/[\d\s+\-*/()]+/);
      if (mathExpr) {
        expression = mathExpr[0].trim();
      }
    }
    return {
      command: 'calculate',
      parameters: { expression },
      confidence: 0.9
    };
  }
  
  // Check for invalid expressions first (like "plus plus")
  if (input.includes('plus plus') || input.includes('++ ') || input.match(/\b(plus|minus|times|divide)\s+\1\b/)) {
    return {
      command: 'calculate',
      parameters: { expression: input.replace(/calculate\s*/i, '').trim() },
      confidence: 0.9
    };
  }
  
  // Basic arithmetic - improved patterns
  if (input.includes('plus') || input.includes('+') || input.includes('add') || input.includes('sum')) {
    const numbers = input.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      return {
        command: 'calculate',
        parameters: { expression: `${numbers[0]} + ${numbers[1]}` },
        confidence: 0.9
      };
    }
  }
  
  // Handle "add X and Y" pattern
  const addAndMatch = input.match(/add\s+(\d+)\s+and\s+(\d+)/i);
  if (addAndMatch) {
    return {
      command: 'calculate',
      parameters: { expression: `${addAndMatch[1]} + ${addAndMatch[2]}` },
      confidence: 0.9
    };
  }
  
  // Handle "sum of X and Y" pattern
  const sumOfMatch = input.match(/sum\s+of\s+(\d+)\s+and\s+(\d+)/i);
  if (sumOfMatch) {
    return {
      command: 'calculate',
      parameters: { expression: `${sumOfMatch[1]} + ${sumOfMatch[2]}` },
      confidence: 0.9
    };
  }
  
  // Handle "what do you get when you add X to Y" pattern
  const longAddMatch = input.match(/what.*add\s+(\d+)\s+to\s+(\d+)/i);
  if (longAddMatch) {
    return {
      command: 'calculate',
      parameters: { expression: `${longAddMatch[2]} + ${longAddMatch[1]}` },
      confidence: 0.9
    };
  }
  
  // Handle "X plus Y equals?" pattern
  const equalsMatch = input.match(/(\d+)\s+plus\s+(\d+)\s+equals/i);
  if (equalsMatch) {
    return {
      command: 'calculate',
      parameters: { expression: `${equalsMatch[1]} + ${equalsMatch[2]}` },
      confidence: 0.9
    };
  }
  
  if (input.includes('minus') || input.includes('-') || input.includes('subtract')) {
    const numbers = input.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      return {
        command: 'calculate',
        parameters: { expression: `${numbers[0]} - ${numbers[1]}` },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('times') || input.includes('*') || input.includes('multipl')) {
    const numbers = input.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      return {
        command: 'calculate',
        parameters: { expression: `${numbers[0]} * ${numbers[1]}` },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('divide') || input.includes('/') || input.includes('over')) {
    const numbers = input.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      return {
        command: 'calculate',
        parameters: { expression: `${numbers[0]} / ${numbers[1]}` },
        confidence: 0.9
      };
    }
  }
  
  // Square root
  if (input.includes('square root') || input.includes('sqrt')) {
    const number = input.match(/\d+/);
    if (number) {
      return {
        command: 'calculate',
        parameters: { expression: `sqrt(${number[0]})` },
        confidence: 0.9
      };
    }
  }
  
  // Powers
  if (input.includes('power') || input.includes('^')) {
    const numbers = input.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      return {
        command: 'calculate',
        parameters: { expression: `${numbers[0]} ^ ${numbers[1]}` },
        confidence: 0.9
      };
    }
  }
  
  // Percentages
  if (input.includes('%') && input.includes('of')) {
    const matches = input.match(/(\d+)%?\s*of\s*(\d+)/);
    if (matches) {
      return {
        command: 'calculate',
        parameters: { expression: `${matches[1]}% of ${matches[2]}` },
        confidence: 0.9
      };
    }
  }
  
  // Statistics patterns (before "calculate")
  if (input.includes('standard deviation') || input.includes('stddev')) {
    const numbers = input.match(/\d+/g);
    if (numbers) {
      return {
        command: 'statistics',
        parameters: { 
          numbers: numbers.map(n => parseInt(n)),
          operation: 'stddev'
        },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('average') || input.includes('mean')) {
    const numbers = input.match(/\d+/g);
    if (numbers) {
      return {
        command: 'statistics',
        parameters: { 
          numbers: numbers.map(n => parseInt(n)),
          operation: 'mean'
        },
        confidence: 0.9
      };
    }
  }
  
  if (input.includes('median')) {
    const numbers = input.match(/\d+/g);
    if (numbers) {
      return {
        command: 'statistics',
        parameters: { 
          numbers: numbers.map(n => parseInt(n)),
          operation: 'median'
        },
        confidence: 0.9
      };
    }
  }
  
  // Simple "calculate" expressions (lower priority)
  if (input.includes('calculate')) {
    const expression = input.replace(/calculate\s*/i, '').trim();
    return {
      command: 'calculate',
      parameters: { expression },
      confidence: 0.9
    };
  }
  
  // Store variable
  if (input.includes('store') && input.includes('as')) {
    const matches = input.match(/store\s+(\d+)\s+as\s+(\w+)/i);
    if (matches) {
      return {
        command: 'store',
        parameters: { value: parseInt(matches[1]), name: matches[2] },
        confidence: 0.9
      };
    }
  }
  
  // List variables
  if (input.includes('show') && (input.includes('variable') || input.includes('all variables'))) {
    return {
      command: 'list_variables',
      parameters: {},
      confidence: 0.9
    };
  }
  
  // Clear memory
  if (input.includes('clear') && input.includes('memory')) {
    return {
      command: 'clear_memory',
      parameters: {},
      confidence: 0.9
    };
  }
  
  // Unit conversion
  if (input.includes('convert')) {
    const matches = input.match(/convert\s+(\d+)\s+(\w+)\s+to\s+(\w+)/i);
    if (matches) {
      return {
        command: 'convert',
        parameters: { 
          value: parseFloat(matches[1]), 
          from_unit: matches[2],
          to_unit: matches[3]
        },
        confidence: 0.9
      };
    }
  }
  
  
  // Help
  if (input === 'help') {
    return {
      command: 'help',
      parameters: {},
      confidence: 0.9
    };
  }
  
  // History
  if (input.includes('history')) {
    return {
      command: 'history',
      parameters: { limit: 10 },
      confidence: 0.9
    };
  }
  
  // Contextual references
  if (input.includes('that') || input.includes('it') || input.includes('result')) {
    if (input.includes('multiply') || input.includes('times')) {
      const number = input.match(/\d+/);
      if (number) {
        return {
          command: 'calculate',
          parameters: { expression: `that * ${number[0]}` },
          confidence: 0.9
        };
      }
    }
  }
  
  // Variable references with calculations (e.g., "what is x plus 8")
  const varCalcMatch = input.match(/what is (\w+)\s+(plus|minus|times|divided by|\+|\-|\*|\/)\s+(\d+)/i);
  if (varCalcMatch && !input.match(/^\d/)) {
    const variable = varCalcMatch[1];
    const operator = varCalcMatch[2];
    const number = varCalcMatch[3];
    
    let op = operator;
    if (operator === 'plus') op = '+';
    else if (operator === 'minus') op = '-';
    else if (operator === 'times') op = '*';
    else if (operator === 'divided by') op = '/';
    
    return {
      command: 'calculate',
      parameters: { expression: `${variable} ${op} ${number}` },
      confidence: 0.9
    };
  }
  
  // Variable references
  const varMatch = input.match(/what is (\w+)(?:\?)?/i);
  if (varMatch && !input.match(/\d/)) {
    return {
      command: 'recall',
      parameters: { name: varMatch[1] },
      confidence: 0.9
    };
  }
  
  // Just numbers and operators
  const simpleExpr = input.match(/^[\d\s+\-*/()]+$/);
  if (simpleExpr) {
    return {
      command: 'calculate',
      parameters: { expression: input.trim() },
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

export function setupCalculatorMock(mockProvider: MockLLMProvider) {
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
    const intent = parseCalculatorIntent(userInput);
    
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
        return output;
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