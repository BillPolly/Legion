/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/**
 * PanelManager - Manages panel registrations and redirects to panel client
 *
 * Responsibilities:
 * - Track active panels
 * - Redirect panel requests to proper panel client with URL parameters
 */

export class PanelManager {
  constructor(serverPort = 5500, serverHost = 'localhost', log = console.log) {
    this.panels = new Map();
    this.serverPort = serverPort;
    this.serverHost = serverHost;
    this.log = log;
  }

  /**
   * Register a new panel
   */
  registerPanel(processId, panelId, title = 'Legion Panel') {
    if (this.panels.has(panelId)) {
      this.log(`[PanelManager] Panel already registered: ${panelId}`);
      return;
    }

    this.log(`[PanelManager] Registering panel: ${panelId} for process ${processId}`);

    const panelInfo = {
      processId,
      panelId,
      title,
      createdAt: new Date(),
    };
    this.panels.set(panelId, panelInfo);
  }

  /**
   * Get panel URL with proper parameters
   * Returns the URL path to the panel client HTML with query parameters
   */
  getPanelUrl(processId, panelId) {
    return `/legion/panel-client/src/panel-client.html?processId=${processId}&panelId=${panelId}`;
  }

  /**
   * Get panel info by ID
   */
  getPanel(panelId) {
    return this.panels.get(panelId);
  }

  /**
   * Get all panels for a process
   */
  getPanelsForProcess(processId) {
    return Array.from(this.panels.values()).filter(
      (p) => p.processId === processId
    );
  }

  /**
   * Remove panel registration
   */
  unregisterPanel(panelId) {
    if (this.panels.has(panelId)) {
      this.log(`[PanelManager] Unregistering panel: ${panelId}`);
      this.panels.delete(panelId);
    }
  }

  /**
   * Remove all panels for a process
   */
  unregisterPanelsForProcess(processId) {
    const panels = this.getPanelsForProcess(processId);
    panels.forEach((p) => this.unregisterPanel(p.panelId));
  }

  /**
   * Clear all panel registrations
   */
  clear() {
    this.panels.clear();
  }
}
