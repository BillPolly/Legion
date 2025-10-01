/**
 * Unit tests for InputHandler
 * Tests interactive input handling, command history, and readline integration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InputHandler } from '../../src/handlers/InputHandler.js';
import readline from 'readline';

describe('InputHandler Unit Tests', () => {
  let inputHandler;
  let mockCallback;

  beforeEach(() => {
    mockCallback = jest.fn();
    inputHandler = new InputHandler({
      prompt: 'legion> ',
      historySize: 100
    });
  });

  afterEach(() => {
    if (inputHandler) {
      inputHandler.close();
    }
  });

  test('should create InputHandler with default options', () => {
    const handler = new InputHandler();
    expect(handler).toBeDefined();
    expect(handler.prompt).toBe('> ');
    expect(handler.historySize).toBe(1000);
    handler.close();
  });

  test('should create InputHandler with custom options', () => {
    expect(inputHandler.prompt).toBe('legion> ');
    expect(inputHandler.historySize).toBe(100);
  });

  test('should have readline interface', () => {
    expect(inputHandler.rl).toBeDefined();
    expect(inputHandler.rl.close).toBeDefined();
  });

  test('should initialize with empty command history', () => {
    const history = inputHandler.getHistory();
    expect(history).toEqual([]);
  });

  test('should add command to history', () => {
    inputHandler.addToHistory('test command');
    const history = inputHandler.getHistory();
    expect(history).toEqual(['test command']);
  });

  test('should not add empty commands to history', () => {
    inputHandler.addToHistory('');
    inputHandler.addToHistory('   ');
    const history = inputHandler.getHistory();
    expect(history).toEqual([]);
  });

  test('should not add duplicate consecutive commands to history', () => {
    inputHandler.addToHistory('test command');
    inputHandler.addToHistory('test command');
    const history = inputHandler.getHistory();
    expect(history).toEqual(['test command']);
  });

  test('should allow duplicate non-consecutive commands in history', () => {
    inputHandler.addToHistory('command1');
    inputHandler.addToHistory('command2');
    inputHandler.addToHistory('command1');
    const history = inputHandler.getHistory();
    expect(history).toEqual(['command1', 'command2', 'command1']);
  });

  test('should respect historySize limit', () => {
    const handler = new InputHandler({ historySize: 3 });
    handler.addToHistory('cmd1');
    handler.addToHistory('cmd2');
    handler.addToHistory('cmd3');
    handler.addToHistory('cmd4');

    const history = handler.getHistory();
    expect(history.length).toBe(3);
    expect(history).toEqual(['cmd2', 'cmd3', 'cmd4']);

    handler.close();
  });

  test('should clear history', () => {
    inputHandler.addToHistory('command1');
    inputHandler.addToHistory('command2');
    inputHandler.clearHistory();

    const history = inputHandler.getHistory();
    expect(history).toEqual([]);
  });

  test('should start prompt', () => {
    const started = inputHandler.start(mockCallback);
    expect(started).toBe(true);
    expect(inputHandler.isActive).toBe(true);
  });

  test('should not start if already active', () => {
    inputHandler.start(mockCallback);
    const started = inputHandler.start(mockCallback);
    expect(started).toBe(false);
  });

  test('should stop prompt', () => {
    inputHandler.start(mockCallback);
    inputHandler.stop();
    expect(inputHandler.isActive).toBe(false);
  });

  test('should close readline interface', () => {
    const closeSpy = jest.spyOn(inputHandler.rl, 'close');
    inputHandler.close();
    expect(closeSpy).toHaveBeenCalled();
  });

  test('should validate non-empty input', () => {
    expect(inputHandler.validateInput('test')).toBe(true);
    expect(inputHandler.validateInput('   test   ')).toBe(true);
  });

  test('should reject empty input', () => {
    expect(inputHandler.validateInput('')).toBe(false);
    expect(inputHandler.validateInput('   ')).toBe(false);
    expect(inputHandler.validateInput(null)).toBe(false);
    expect(inputHandler.validateInput(undefined)).toBe(false);
  });

  test('should trim input', () => {
    const trimmed = inputHandler.trimInput('  test command  ');
    expect(trimmed).toBe('test command');
  });

  test('should set custom prompt', () => {
    inputHandler.setPrompt('new> ');
    expect(inputHandler.prompt).toBe('new> ');
  });

  test('should throw error if prompt is not a string', () => {
    expect(() => inputHandler.setPrompt(123)).toThrow('Prompt must be a string');
  });
});
