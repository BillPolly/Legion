/**
 * CodeEditor JSDOM Test
 *
 * Verifies that CodeEditor can be imported and used in JSDOM environment
 * with the CodeMirror bundle mock.
 */

import { describe, test, expect } from '@jest/globals';
import { CodeEditor } from '../../../src/components/code-editor/index.js';

describe('CodeEditor JSDOM Integration', () => {
  test('should import CodeEditor successfully', () => {
    expect(CodeEditor).toBeDefined();
    expect(CodeEditor.create).toBeDefined();
    expect(typeof CodeEditor.create).toBe('function');
  });

  test('should support introspection mode', () => {
    let requirements = null;
    CodeEditor.create({
      describe: (reqs) => {
        requirements = reqs;
      }
    });

    expect(requirements).not.toBeNull();
    const allReqs = requirements.getAll();
    expect(allReqs.dom).toBeDefined();
    expect(allReqs.content).toBeDefined();
    expect(allReqs.language).toBeDefined();
  });

  test('should support validation mode', () => {
    const container = document.createElement('div');

    const result = CodeEditor.create({
      validate: {
        dom: container,
        content: 'const x = 42;',
        language: 'javascript'
      }
    });

    expect(result.valid).toBe(true);
    expect(result.hasDOM).toBe(true);
    expect(result.hasValidContent).toBe(true);
    expect(result.hasValidLanguage).toBe(true);
  });

  test('should create instance with minimal config in JSDOM', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const instance = CodeEditor.create({
      dom: container,
      content: 'console.log("Hello from CodeEditor in JSDOM!");',
      language: 'javascript'
    });

    expect(instance).toBeDefined();
    expect(instance.getContent).toBeDefined();
    expect(instance.setContent).toBeDefined();
    expect(instance.destroy).toBeDefined();

    // Verify content
    expect(instance.getContent()).toBe('console.log("Hello from CodeEditor in JSDOM!");');

    // Cleanup
    instance.destroy();
    document.body.removeChild(container);
  });

  test('should import from barrel export', async () => {
    const { CodeEditor: BarrelCodeEditor } = await import('../../../src/index.js');

    expect(BarrelCodeEditor).toBeDefined();
    expect(BarrelCodeEditor).toBe(CodeEditor);
  });
});
