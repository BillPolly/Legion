/**
 * Simple UI test to debug what's actually being rendered
 */

import { jest } from '@jest/globals';
import { ToolRegistryBrowser } from '../../src/components/tool-registry/index.js';
import { 
  createTestContainer,
  cleanupTestContainer,
  waitForUpdates
} from '../helpers/domHelpers.js';
import { MockWebSocket, setupMockWebSocket, restoreWebSocket } from '../helpers/mockWebSocket.js';

describe('Simple UI Test', () => {
  let ui;
  let container;
  
  beforeAll(() => {
    setupMockWebSocket();
  });
  
  afterAll(() => {
    restoreWebSocket();
  });
  
  beforeEach(async () => {
    container = createTestContainer();
    
    const umbilical = {
      dom: container,
      websocketUrl: 'ws://localhost:8080/ws',
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
    
    ui = await ToolRegistryBrowser.create(umbilical);
    
    // Wait for initial render and actor connection
    await waitForUpdates();
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  afterEach(() => {
    if (ui && ui.destroy) {
      ui.destroy();
    }
    cleanupTestContainer();
  });
  
  test('should render basic UI structure', async () => {
    console.log('Container HTML:', container.innerHTML.substring(0, 500));
    
    // Check basic structure
    expect(container.className).toContain('tool-registry-app');
    expect(container.querySelector('.app-header-container')).toBeTruthy();
    expect(container.querySelector('.navigation-tabs-wrapper')).toBeTruthy();
    
    // Check tabs
    const tabs = container.querySelectorAll('.navigation-tab');
    console.log('Found tabs:', tabs.length);
    tabs.forEach(tab => {
      console.log('Tab:', tab.id, tab.textContent);
    });
    
    // Check panels
    const panels = container.querySelectorAll('.tab-panel');
    console.log('Found panels:', panels.length);
    panels.forEach(panel => {
      console.log('Panel:', panel.id, panel.className);
    });
    
    // Check if search panel is active
    const activePanel = container.querySelector('.tab-panel.active');
    console.log('Active panel:', activePanel?.id);
    
    // Wait a bit more for tools to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check for tool items
    const toolItems = container.querySelectorAll('.tool-item');
    console.log('Found tool items:', toolItems.length);
    
    // Check for search input
    const searchInput = container.querySelector('#tool-search-input');
    console.log('Search input found:', !!searchInput);
    
    expect(tabs.length).toBeGreaterThan(0);
  });
});