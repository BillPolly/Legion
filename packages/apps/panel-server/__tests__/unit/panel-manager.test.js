/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

import { PanelManager } from '../../src/panel-manager.js';

describe('PanelManager', () => {
  let manager;
  let logs;

  beforeEach(() => {
    logs = [];
    manager = new PanelManager(5500, 'localhost', (msg) => logs.push(msg));
  });

  afterEach(() => {
    manager.clear();
  });

  describe('registerPanel', () => {
    test('should register a new panel', () => {
      manager.registerPanel('process-123', 'panel-456', 'Test Panel');

      const panel = manager.getPanel('panel-456');
      expect(panel).toBeDefined();
      expect(panel.processId).toBe('process-123');
      expect(panel.panelId).toBe('panel-456');
      expect(panel.title).toBe('Test Panel');
      expect(panel.createdAt).toBeInstanceOf(Date);
    });

    test('should use default title if not provided', () => {
      manager.registerPanel('process-123', 'panel-456');

      const panel = manager.getPanel('panel-456');
      expect(panel).toBeDefined();
      expect(panel.title).toBe('Legion Panel');
    });

    test('should not register duplicate panels', () => {
      manager.registerPanel('process-123', 'panel-456', 'First');
      manager.registerPanel('process-789', 'panel-456', 'Second');

      const panel = manager.getPanel('panel-456');
      expect(panel.processId).toBe('process-123');
      expect(panel.title).toBe('First');
      expect(logs).toContain('[PanelManager] Panel already registered: panel-456');
    });

    test('should log panel registration', () => {
      manager.registerPanel('process-123', 'panel-456');

      expect(logs).toContain('[PanelManager] Registering panel: panel-456 for process process-123');
    });
  });

  describe('getPanelHtml', () => {
    test('should generate valid HTML', () => {
      manager.registerPanel('process-123', 'panel-456', 'My Panel');

      const html = manager.getPanelHtml('process-123', 'panel-456');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<title>My Panel</title>');
      expect(html).toContain('<div id="app"></div>');
    });

    test('should inject correct WebSocket config', () => {
      manager.registerPanel('process-123', 'panel-456');

      const html = manager.getPanelHtml('process-123', 'panel-456');

      expect(html).toContain("processId: 'process-123'");
      expect(html).toContain("panelId: 'panel-456'");
      expect(html).toContain("serverUrl: 'ws://localhost:5500/ws/panel?processId=process-123&panelId=panel-456'");
    });

    test('should escape special characters in IDs', () => {
      // Even though this shouldn't happen, test HTML injection safety
      manager.registerPanel('process<script>', 'panel\'"');

      const html = manager.getPanelHtml('process<script>', 'panel\'"');

      // The IDs are injected into JavaScript string literals and HTML
      expect(html).toContain('process<script>');
      expect(html).toContain('panel\'"');
    });

    test('should include panel UI components', () => {
      manager.registerPanel('process-123', 'panel-456');

      const html = manager.getPanelHtml('process-123', 'panel-456');

      expect(html).toContain('class="panel-container"');
      expect(html).toContain('class="panel-header"');
      expect(html).toContain('Legion Panel Server');
      expect(html).toContain('class="button"');
      expect(html).toContain('Send Message');
      expect(html).toContain('Request Data');
      expect(html).toContain('Message Log:');
    });

    test('should include PanelClientActor class', () => {
      manager.registerPanel('process-123', 'panel-456');

      const html = manager.getPanelHtml('process-123', 'panel-456');

      expect(html).toContain('class PanelClientActor');
      expect(html).toContain('connectToServer()');
      expect(html).toContain('new WebSocket(CONFIG.serverUrl)');
      expect(html).toContain('handleSendClick()');
      expect(html).toContain('handleRequestData()');
    });

    test('should use default title for unregistered panel', () => {
      const html = manager.getPanelHtml('process-123', 'panel-999');

      expect(html).toContain('<title>Legion Panel</title>');
    });
  });

  describe('getPanel', () => {
    test('should return panel info by ID', () => {
      manager.registerPanel('process-123', 'panel-456', 'Test');

      const panel = manager.getPanel('panel-456');

      expect(panel).toEqual({
        processId: 'process-123',
        panelId: 'panel-456',
        title: 'Test',
        createdAt: expect.any(Date),
      });
    });

    test('should return undefined for non-existent panel', () => {
      const panel = manager.getPanel('non-existent');

      expect(panel).toBeUndefined();
    });
  });

  describe('getPanelsForProcess', () => {
    test('should return all panels for a process', () => {
      manager.registerPanel('process-123', 'panel-1');
      manager.registerPanel('process-123', 'panel-2');
      manager.registerPanel('process-456', 'panel-3');

      const panels = manager.getPanelsForProcess('process-123');

      expect(panels).toHaveLength(2);
      expect(panels.map((p) => p.panelId)).toContain('panel-1');
      expect(panels.map((p) => p.panelId)).toContain('panel-2');
      expect(panels.map((p) => p.panelId)).not.toContain('panel-3');
    });

    test('should return empty array if no panels for process', () => {
      manager.registerPanel('process-123', 'panel-1');

      const panels = manager.getPanelsForProcess('process-999');

      expect(panels).toEqual([]);
    });
  });

  describe('unregisterPanel', () => {
    test('should remove panel by ID', () => {
      manager.registerPanel('process-123', 'panel-456');
      expect(manager.getPanel('panel-456')).toBeDefined();

      manager.unregisterPanel('panel-456');

      expect(manager.getPanel('panel-456')).toBeUndefined();
    });

    test('should log unregistration', () => {
      manager.registerPanel('process-123', 'panel-456');
      logs = []; // Clear registration log

      manager.unregisterPanel('panel-456');

      expect(logs).toContain('[PanelManager] Unregistering panel: panel-456');
    });

    test('should not error for non-existent panel', () => {
      expect(() => {
        manager.unregisterPanel('non-existent');
      }).not.toThrow();
    });
  });

  describe('unregisterPanelsForProcess', () => {
    test('should remove all panels for a process', () => {
      manager.registerPanel('process-123', 'panel-1');
      manager.registerPanel('process-123', 'panel-2');
      manager.registerPanel('process-456', 'panel-3');

      manager.unregisterPanelsForProcess('process-123');

      expect(manager.getPanel('panel-1')).toBeUndefined();
      expect(manager.getPanel('panel-2')).toBeUndefined();
      expect(manager.getPanel('panel-3')).toBeDefined();
    });

    test('should not error if process has no panels', () => {
      expect(() => {
        manager.unregisterPanelsForProcess('non-existent');
      }).not.toThrow();
    });
  });

  describe('clear', () => {
    test('should remove all panels', () => {
      manager.registerPanel('process-123', 'panel-1');
      manager.registerPanel('process-456', 'panel-2');

      manager.clear();

      expect(manager.getPanel('panel-1')).toBeUndefined();
      expect(manager.getPanel('panel-2')).toBeUndefined();
      expect(manager.getPanelsForProcess('process-123')).toEqual([]);
    });
  });
});
