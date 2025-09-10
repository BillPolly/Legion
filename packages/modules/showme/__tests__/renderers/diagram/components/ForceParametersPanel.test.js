/**
 * Tests for ForceParametersPanel component
 * 
 * Testing:
 * - Panel creation and structure
 * - Parameter controls functionality
 * - Event handling
 * - Value conversion
 * - UI interactions
 */

import { jest } from '@jest/globals';
import { ForceParametersPanel } from '../../../../src/renderers/diagram/components/ForceParametersPanel.js';

// Mock DOM environment for testing
Object.defineProperty(global, 'document', {
  value: {
    createElement: jest.fn(() => ({
      className: '',
      innerHTML: '',
      style: {},
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      appendChild: jest.fn(),
      addEventListener: jest.fn(),
      removeChild: jest.fn(),
      click: jest.fn(),
      dispatchEvent: jest.fn()
    })),
    head: {
      appendChild: jest.fn()
    },
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn()
    },
    getElementById: jest.fn()
  }
});

Object.defineProperty(global, 'window', {
  value: {
    Event: class MockEvent {
      constructor(type) {
        this.type = type;
      }
    }
  }
});

describe('ForceParametersPanel', () => {
  let container;
  let panel;
  let onParameterChangeMock;
  
  beforeEach(() => {
    // Create a mock container for the panel
    container = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      contains: jest.fn(() => true)
    };
    
    // Create mock for parameter change callback
    onParameterChangeMock = jest.fn();
  });
  
  afterEach(() => {
    // Clean up
    if (panel) {
      panel.destroy();
      panel = null;
    }
    
    onParameterChangeMock.mockClear();
    jest.clearAllMocks();
  });
  
  describe('Panel Creation', () => {
    it('should create panel with default configuration', () => {
      panel = new ForceParametersPanel({\n        container,\n        onParameterChange: onParameterChangeMock\n      });\n      \n      expect(panel.element).toBeTruthy();\n      expect(panel.element.className).toContain('force-parameters-panel');\n      expect(container.contains(panel.element)).toBe(true);\n    });\n    \n    it('should create panel with custom theme', () => {\n      panel = new ForceParametersPanel({\n        container,\n        theme: 'dark',\n        onParameterChange: onParameterChangeMock\n      });\n      \n      expect(panel.element.className).toContain('force-parameters-panel--dark');\n    });\n    \n    it('should create panel in collapsed state by default', () => {\n      panel = new ForceParametersPanel({\n        container,\n        onParameterChange: onParameterChangeMock\n      });\n      \n      const content = panel.element.querySelector('.force-parameters-panel__content');\n      expect(content.style.display).toBe('none');\n    });\n    \n    it('should create panel in expanded state when specified', () => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n      \n      const content = panel.element.querySelector('.force-parameters-panel__content');\n      expect(content.style.display).toBe('block');\n    });\n  });\n  \n  describe('Panel Structure', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should have header with title and toggle button', () => {\n      const header = panel.element.querySelector('.force-parameters-panel__header');\n      const title = panel.element.querySelector('.force-parameters-panel__title');\n      const toggle = panel.element.querySelector('.force-parameters-panel__toggle');\n      \n      expect(header).toBeTruthy();\n      expect(title).toBeTruthy();\n      expect(title.textContent).toBe('Force Parameters');\n      expect(toggle).toBeTruthy();\n    });\n    \n    it('should have all parameter sections', () => {\n      const sections = panel.element.querySelectorAll('.force-parameters-section');\n      expect(sections.length).toBe(5); // simulation, forces, layout, collision, stabilization\n      \n      const sectionTitles = Array.from(sections).map(section => \n        section.querySelector('.force-parameters-section__title').textContent\n      );\n      \n      expect(sectionTitles).toEqual([\n        'Simulation',\n        'Force Strengths', \n        'Layout Configuration',\n        'Collision Settings',\n        'Stabilization'\n      ]);\n    });\n    \n    it('should have action buttons', () => {\n      const resetButton = panel.element.querySelector('.force-parameters-panel__reset');\n      const applyButton = panel.element.querySelector('.force-parameters-panel__apply');\n      \n      expect(resetButton).toBeTruthy();\n      expect(resetButton.textContent).toBe('Reset to Defaults');\n      expect(applyButton).toBeTruthy();\n      expect(applyButton.textContent).toBe('Apply Changes');\n    });\n  });\n  \n  describe('Parameter Controls', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should create number input controls with correct attributes', () => {\n      const alphaMinControl = panel.controls.get('alphaMin');\n      \n      expect(alphaMinControl).toBeTruthy();\n      expect(alphaMinControl.type).toBe('number');\n      expect(alphaMinControl.value).toBe('0.001');\n      expect(alphaMinControl.min).toBe('0.0001');\n      expect(alphaMinControl.max).toBe('0.01');\n      expect(alphaMinControl.step).toBe('0.0001');\n    });\n    \n    it('should create checkbox controls for boolean parameters', () => {\n      const stabilizationControl = panel.controls.get('stabilizationEnabled');\n      \n      expect(stabilizationControl).toBeTruthy();\n      expect(stabilizationControl.type).toBe('checkbox');\n      expect(stabilizationControl.checked).toBe(true); // Default value\n    });\n    \n    it('should have controls for all expected parameters', () => {\n      const expectedParams = [\n        'alphaMin', 'alphaDecay', 'alphaTarget', 'velocityDecay',\n        'chargeStrength', 'linkStrength', 'centerStrength',\n        'linkDistance', 'chargeDistance',\n        'collisionRadius', 'collisionStrength', 'collisionIterations',\n        'stabilizationEnabled', 'stabilizationThreshold', 'stabilizationCheckInterval',\n        'stabilizationMinIterations', 'stabilizationMaxIterations'\n      ];\n      \n      expectedParams.forEach(param => {\n        expect(panel.controls.has(param)).toBe(true);\n      });\n    });\n  });\n  \n  describe('Event Handling', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should call onParameterChange when number input changes', () => {\n      const alphaMinControl = panel.controls.get('alphaMin');\n      \n      // Simulate input change\n      alphaMinControl.value = '0.002';\n      alphaMinControl.dispatchEvent(new dom.window.Event('input'));\n      \n      expect(onParameterChangeMock).toHaveBeenCalledWith('alphaMin', 0.002, expect.any(Object));\n    });\n    \n    it('should call onParameterChange when checkbox changes', () => {\n      const stabilizationControl = panel.controls.get('stabilizationEnabled');\n      \n      // Simulate checkbox change\n      stabilizationControl.checked = false;\n      stabilizationControl.dispatchEvent(new dom.window.Event('change'));\n      \n      expect(onParameterChangeMock).toHaveBeenCalledWith('stabilizationEnabled', false, expect.any(Object));\n    });\n    \n    it('should update currentValues when parameter changes', () => {\n      const initialAlphaMin = panel.currentValues.alphaMin;\n      const alphaMinControl = panel.controls.get('alphaMin');\n      \n      alphaMinControl.value = '0.005';\n      alphaMinControl.dispatchEvent(new dom.window.Event('input'));\n      \n      expect(panel.currentValues.alphaMin).toBe(0.005);\n      expect(panel.currentValues.alphaMin).not.toBe(initialAlphaMin);\n    });\n  });\n  \n  describe('Panel Toggle Functionality', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: true,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should toggle panel content visibility', () => {\n      const toggle = panel.element.querySelector('.force-parameters-panel__toggle');\n      const content = panel.element.querySelector('.force-parameters-panel__content');\n      const icon = panel.element.querySelector('.force-parameters-panel__toggle-icon');\n      \n      // Initially collapsed\n      expect(content.style.display).toBe('none');\n      expect(icon.textContent).toBe('▶');\n      \n      // Click to expand\n      toggle.click();\n      expect(content.style.display).toBe('block');\n      expect(icon.textContent).toBe('▼');\n      \n      // Click to collapse\n      toggle.click();\n      expect(content.style.display).toBe('none');\n      expect(icon.textContent).toBe('▶');\n    });\n  });\n  \n  describe('Section Toggle Functionality', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should toggle section content visibility', () => {\n      const section = panel.sections.get('simulation');\n      const toggle = section.querySelector('.force-parameters-section__toggle');\n      const content = section.querySelector('.force-parameters-section__content');\n      \n      // Initially expanded\n      expect(content.style.display).toBe('');\n      expect(toggle.textContent).toBe('▼');\n      \n      // Click to collapse\n      toggle.click();\n      expect(content.style.display).toBe('none');\n      expect(toggle.textContent).toBe('▶');\n      \n      // Click to expand\n      toggle.click();\n      expect(content.style.display).toBe('block');\n      expect(toggle.textContent).toBe('▼');\n    });\n  });\n  \n  describe('Reset Functionality', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should reset all parameters to defaults', () => {\n      // Change some values\n      const alphaMinControl = panel.controls.get('alphaMin');\n      alphaMinControl.value = '0.005';\n      alphaMinControl.dispatchEvent(new dom.window.Event('input'));\n      \n      const chargeControl = panel.controls.get('chargeStrength');\n      chargeControl.value = '-500';\n      chargeControl.dispatchEvent(new dom.window.Event('input'));\n      \n      // Reset\n      panel.resetToDefaults();\n      \n      // Check values are back to defaults\n      expect(panel.currentValues.alphaMin).toBe(0.001);\n      expect(panel.currentValues.chargeStrength).toBe(-300);\n      expect(alphaMinControl.value).toBe('0.001');\n      expect(chargeControl.value).toBe('-300');\n      \n      expect(onParameterChangeMock).toHaveBeenCalledWith('reset', expect.any(Object));\n    });\n  });\n  \n  describe('Apply Functionality', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should call onParameterChange with apply action', () => {\n      const applyButton = panel.element.querySelector('.force-parameters-panel__apply');\n      \n      applyButton.click();\n      \n      expect(onParameterChangeMock).toHaveBeenCalledWith('apply', panel.currentValues);\n    });\n  });\n  \n  describe('Value Management', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        initialValues: {\n          alphaMin: 0.002,\n          chargeStrength: -500\n        },\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should use initial values when provided', () => {\n      expect(panel.currentValues.alphaMin).toBe(0.002);\n      expect(panel.currentValues.chargeStrength).toBe(-500);\n      \n      const alphaMinControl = panel.controls.get('alphaMin');\n      const chargeControl = panel.controls.get('chargeStrength');\n      \n      expect(alphaMinControl.value).toBe('0.002');\n      expect(chargeControl.value).toBe('-500');\n    });\n    \n    it('should update values programmatically', () => {\n      panel.updateValues({\n        alphaDecay: 0.05,\n        linkDistance: 200\n      });\n      \n      expect(panel.currentValues.alphaDecay).toBe(0.05);\n      expect(panel.currentValues.linkDistance).toBe(200);\n      \n      const alphaDecayControl = panel.controls.get('alphaDecay');\n      const linkDistanceControl = panel.controls.get('linkDistance');\n      \n      expect(alphaDecayControl.value).toBe('0.05');\n      expect(linkDistanceControl.value).toBe('200');\n    });\n    \n    it('should return current values', () => {\n      const values = panel.getValues();\n      \n      expect(values).toEqual(panel.currentValues);\n      expect(values).not.toBe(panel.currentValues); // Should be a copy\n    });\n  });\n  \n  describe('ForceDirected Config Conversion', () => {\n    beforeEach(() => {\n      panel = new ForceParametersPanel({\n        container,\n        collapsed: false,\n        onParameterChange: onParameterChangeMock\n      });\n    });\n    \n    it('should convert to ForceDirectedLayout config format', () => {\n      const config = panel.toForceDirectedConfig();\n      \n      expect(config).toHaveProperty('alphaMin');\n      expect(config).toHaveProperty('alphaDecay');\n      expect(config).toHaveProperty('forces');\n      expect(config).toHaveProperty('stabilization');\n      \n      expect(config.forces).toHaveProperty('charge');\n      expect(config.forces).toHaveProperty('link');\n      expect(config.forces).toHaveProperty('center');\n      expect(config.forces).toHaveProperty('collide');\n      \n      expect(config.stabilization).toHaveProperty('enabled');\n      expect(config.stabilization).toHaveProperty('threshold');\n      expect(config.stabilization).toHaveProperty('checkInterval');\n    });\n    \n    it('should map UI values to correct config properties', () => {\n      // Update some values\n      panel.updateValues({\n        chargeStrength: -400,\n        linkStrength: 1.5,\n        stabilizationEnabled: false,\n        stabilizationThreshold: 0.05\n      });\n      \n      const config = panel.toForceDirectedConfig();\n      \n      expect(config.forces.charge).toBe(-400);\n      expect(config.forces.link).toBe(1.5);\n      expect(config.stabilization.enabled).toBe(false);\n      expect(config.stabilization.threshold).toBe(0.05);\n    });\n  });\n  \n  describe('Cleanup', () => {\n    it('should clean up properly when destroyed', () => {\n      panel = new ForceParametersPanel({\n        container,\n        onParameterChange: onParameterChangeMock\n      });\n      \n      const element = panel.element;\n      expect(container.contains(element)).toBe(true);\n      \n      panel.destroy();\n      \n      expect(container.contains(element)).toBe(false);\n      expect(panel.controls.size).toBe(0);\n      expect(panel.sections.size).toBe(0);\n    });\n  });\n});