/**
 * Component Editor MVVM Integration Test
 * Tests proper Model-View-ViewModel pattern with bidirectional sync
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ComponentEditorViewModel } from '../../src/editor/ComponentEditorViewModel.js';

describe('Component Editor MVVM Integration', () => {
  let editor;

  beforeEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    editor = new ComponentEditorViewModel();
    editor.initialize(document.body);
  });

  test('should sync DSL → Model → JSON view', async () => {
    // Edit DSL view
    const dslView = editor.views.dsl;
    dslView.value = `
      Counter :: state =>
        div.counter [
          h2 { state.count }
          button @click="state.count = state.count + 1" { "+" }
        ]
    `;

    // Trigger change
    await editor.syncFromDSL();

    // Model should be updated
    expect(editor.model.name).toBe('Counter');
    expect(editor.model.parameter).toBe('state');

    // JSON view should be synced
    const json = JSON.parse(editor.views.json.value);
    expect(json.name).toBe('Counter');
  });

  test('should sync CNL → Model → JSON view', async () => {
    const cnlView = editor.views.cnl;
    cnlView.value = `
Define Counter with state:
  With methods:
    When increment is called:
      Set state count to state count + 1
  A container containing:
    A heading showing the count
    `;

    await editor.syncFromCNL();

    // Model updated
    expect(editor.model.name).toBe('Counter');
    expect(editor.model.methods).toBeDefined();
    expect(editor.model.methods.increment).toBeDefined();

    // JSON view synced
    const json = JSON.parse(editor.views.json.value);
    expect(json.methods.increment).toBeDefined();
  });

  test('should sync JSON → Model', async () => {
    const jsonView = editor.views.json;
    jsonView.value = JSON.stringify({
      name: 'Counter',
      entity: 'state',
      structure: {
        root: { element: 'div', class: 'counter' }
      },
      bindings: [],
      events: [],
      methods: {}
    }, null, 2);

    await editor.syncFromJSON();

    // Model updated
    expect(editor.model.name).toBe('Counter');
    expect(editor.model.entity).toBe('state');
  });
});
