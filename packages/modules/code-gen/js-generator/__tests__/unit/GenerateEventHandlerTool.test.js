/**
 * Tests for GenerateEventHandlerTool
 */

import { describe, test, expect } from '@jest/globals';
import { GenerateEventHandlerTool } from '../../src/tools/GenerateEventHandlerTool.js';

describe('GenerateEventHandlerTool', () => {
  let tool;

  beforeEach(() => {
    tool = new GenerateEventHandlerTool();
  });

  test('should have correct tool name and description', () => {
    expect(tool.name).toBe('generate_event_handler');
    expect(tool.description).toBe('Generate DOM event handler with preventDefault and stopPropagation options');
  });

  test('should generate basic click handler', async () => {
    const args = {
      event: 'click',
      action: 'console.log("Button clicked");'
    };

    const result = await tool.execute(args);
    
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('handlerName');
    expect(result).toHaveProperty('attachmentCode');
    expect(result).toHaveProperty('components');
    
    expect(result.code).toContain('function handleClickElement(event)');
    expect(result.code).toContain('console.log("Button clicked");');
    expect(result.handlerName).toBe('handleClickElement');
  });

  test('should generate handler with preventDefault', async () => {
    const args = {
      event: 'submit',
      action: 'submitForm();',
      preventDefault: true
    };

    const result = await tool.execute(args);
    
    expect(result.code).toContain('event.preventDefault();');
    expect(result.components.hasPreventDefault).toBe(true);
  });

  test('should generate handler with stopPropagation', async () => {
    const args = {
      event: 'click',
      action: 'handleClick();',
      stopPropagation: true
    };

    const result = await tool.execute(args);
    
    expect(result.code).toContain('event.stopPropagation();');
    expect(result.components.hasStopPropagation).toBe(true);
  });

  test('should generate handler with error handling', async () => {
    const args = {
      event: 'click',
      action: 'riskyOperation();',
      errorHandling: true
    };

    const result = await tool.execute(args);
    
    expect(result.code).toContain('try {');
    expect(result.code).toContain('} catch (error) {');
    expect(result.components.hasErrorHandling).toBe(true);
  });

  test('should generate handler with throttling', async () => {
    const args = {
      event: 'scroll',
      action: 'handleScroll();',
      throttle: {
        enabled: true,
        delay: 100
      }
    };

    const result = await tool.execute(args);
    
    expect(result.code).toContain('const throttle = (func, delay)');
    expect(result.components.hasThrottling).toBe(true);
  });

  test('should generate handler with debouncing', async () => {
    const args = {
      event: 'input',
      action: 'searchQuery();',
      debounce: {
        enabled: true,
        delay: 300
      }
    };

    const result = await tool.execute(args);
    
    expect(result.code).toContain('const debounce = (func, delay)');
    expect(result.components.hasDebouncing).toBe(true);
  });

  test('should generate handler with event delegation', async () => {
    const args = {
      event: 'click',
      action: 'handleButtonClick();',
      delegation: {
        enabled: true,
        parent: 'document',
        target: '.btn'
      }
    };

    const result = await tool.execute(args);
    
    expect(result.code).toContain("if (!event.target.matches('.btn'))");
    expect(result.components.hasDelegation).toBe(true);
  });

  test('should invoke tool correctly through invoke method', async () => {
    const toolCall = {
      function: {
        arguments: JSON.stringify({
          event: 'click',
          action: 'console.log("test");'
        })
      }
    };

    const result = await tool.invoke(toolCall);
    
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('handlerName');
    expect(result).toHaveProperty('attachmentCode');
    expect(result).toHaveProperty('components');
  });

  test('should handle invalid arguments gracefully', async () => {
    const toolCall = {
      function: {
        arguments: '{"invalid": true}' // Missing required 'event' and 'action'
      }
    };

    await expect(tool.invoke(toolCall)).rejects.toThrow();
  });
});