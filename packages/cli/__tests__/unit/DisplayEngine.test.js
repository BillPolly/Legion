/**
 * Unit tests for DisplayEngine
 * Tests unified rendering interface for terminal and browser
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DisplayEngine } from '../../src/display/DisplayEngine.js';
import { ShowMeController } from '@legion/showme';
import { OutputHandler } from '../../src/handlers/OutputHandler.js';
import { ResourceManager } from '@legion/resource-manager';

describe('DisplayEngine Unit Tests', () => {
  let displayEngine;
  let showme;
  let outputHandler;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();

    const port = 8000 + Math.floor(Math.random() * 500);
    showme = new ShowMeController({ port });
    await showme.initialize();
    await showme.start();

    outputHandler = new OutputHandler({ useColors: false });

    displayEngine = new DisplayEngine(showme, outputHandler, resourceManager);
  });

  afterEach(async () => {
    if (showme && showme.isRunning) {
      await showme.stop();
    }
  });

  test('should create DisplayEngine with required dependencies', () => {
    expect(displayEngine).toBeDefined();
    expect(displayEngine.showme).toBe(showme);
    expect(displayEngine.outputHandler).toBe(outputHandler);
    expect(displayEngine.resourceManager).toBe(resourceManager);
  });

  test('should fail without ShowMeController', () => {
    expect(() => new DisplayEngine(null, outputHandler, resourceManager))
      .toThrow('ShowMeController is required');
  });

  test('should fail without OutputHandler', () => {
    expect(() => new DisplayEngine(showme, null, resourceManager))
      .toThrow('OutputHandler is required');
  });

  test('should fail without ResourceManager', () => {
    expect(() => new DisplayEngine(showme, outputHandler, null))
      .toThrow('ResourceManager is required');
  });

  test('should have default auto mode', () => {
    expect(displayEngine.mode).toBe('auto');
  });

  test('should set display mode', () => {
    displayEngine.setMode('terminal');
    expect(displayEngine.getMode()).toBe('terminal');

    displayEngine.setMode('browser');
    expect(displayEngine.getMode()).toBe('browser');
  });

  test('should reject invalid mode', () => {
    expect(() => displayEngine.setMode('invalid'))
      .toThrow('Invalid mode');
  });

  test('shouldUseTerminal() returns true for table format', () => {
    const handle = { id: 'test', resourceType: 'data' };
    expect(displayEngine.shouldUseTerminal(handle, 'table')).toBe(true);
  });

  test('shouldUseTerminal() returns true for json format', () => {
    const handle = { id: 'test', resourceType: 'data' };
    expect(displayEngine.shouldUseTerminal(handle, 'json')).toBe(true);
  });

  test('shouldUseTerminal() returns true for tree format', () => {
    const handle = { id: 'test', resourceType: 'data' };
    expect(displayEngine.shouldUseTerminal(handle, 'tree')).toBe(true);
  });

  test('shouldUseTerminal() returns true for summary format', () => {
    const handle = { id: 'test', resourceType: 'data' };
    expect(displayEngine.shouldUseTerminal(handle, 'summary')).toBe(true);
  });

  test('shouldUseTerminal() returns false for browser format', () => {
    const handle = { id: 'test', resourceType: 'data' };
    expect(displayEngine.shouldUseTerminal(handle, 'browser')).toBe(false);
  });

  test('shouldUseTerminal() returns false for strategy in auto mode', () => {
    const handle = { id: 'test', resourceType: 'strategy' };
    expect(displayEngine.shouldUseTerminal(handle, 'auto')).toBe(false);
  });

  test('extractHandleData() extracts basic properties', () => {
    const handle = {
      id: 'test-123',
      resourceType: 'file',
      title: 'Test File'
    };

    const data = displayEngine.extractHandleData(handle);
    expect(data.id).toBe('test-123');
    expect(data.resourceType).toBe('file');
    expect(data.title).toBe('Test File');
  });

  test('extractHandleData() calls toURI if available', () => {
    const handle = {
      id: 'test',
      toURI: () => 'legion://local/test'
    };

    const data = displayEngine.extractHandleData(handle);
    expect(data.uri).toBe('legion://local/test');
  });

  test('renderTable() returns success result', () => {
    const handle = { id: 'test', type: 'data', value: 123 };
    const result = displayEngine.renderTable(handle);

    expect(result.success).toBe(true);
    expect(result.format).toBe('table');
    expect(result.rendered).toBe('terminal');
  });

  test('renderJSON() returns success result', () => {
    const handle = { id: 'test', type: 'data', value: 123 };
    const result = displayEngine.renderJSON(handle);

    expect(result.success).toBe(true);
    expect(result.format).toBe('json');
    expect(result.rendered).toBe('terminal');
  });

  test('renderTree() returns success result', () => {
    const handle = { id: 'test', type: 'data', nested: { key: 'value' } };
    const result = displayEngine.renderTree(handle);

    expect(result.success).toBe(true);
    expect(result.format).toBe('tree');
    expect(result.rendered).toBe('terminal');
  });

  test('renderSummary() returns success result', () => {
    const handle = { id: 'test', resourceType: 'data', title: 'Test' };
    const result = displayEngine.renderSummary(handle);

    expect(result.success).toBe(true);
    expect(result.format).toBe('summary');
    expect(result.rendered).toBe('terminal');
  });

  test('render() with table format uses terminal', async () => {
    const handle = { id: 'test', type: 'data' };
    const result = await displayEngine.render(handle, { format: 'table' });

    expect(result.rendered).toBe('terminal');
    expect(result.format).toBe('table');
  });

  test('render() with json format uses terminal', async () => {
    const handle = { id: 'test', type: 'data' };
    const result = await displayEngine.render(handle, { format: 'json' });

    expect(result.rendered).toBe('terminal');
    expect(result.format).toBe('json');
  });
});
