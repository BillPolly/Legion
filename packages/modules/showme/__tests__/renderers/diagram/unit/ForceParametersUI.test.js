/**
 * Unit tests for ForceParametersPanel component
 * Tests interactive force parameter controls
 */

import { jest } from '@jest/globals';
import { ForceParametersPanel } from '../../../../src/renderers/diagram/components/ForceParametersPanel.js';

// Mock DOM environment
const createMockContainer = () => {
  const container = {
    innerHTML: '',
    className: '',
    offsetWidth: 400,
    appendChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn()
    }
  };
  
  // Mock document methods
  global.document = {
    createElement: jest.fn((tagName) => {
      const element = {
        tagName: tagName.toUpperCase(),
        innerHTML: '',
        textContent: '',
        className: '',
        type: '',
        name: '',
        value: '',
        checked: false,
        min: '',
        max: '',
        step: '',
        disabled: false,
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          toggle: jest.fn(),
          contains: jest.fn()
        },
        setAttribute: jest.fn(),
        getAttribute: jest.fn()
      };
      
      if (tagName === 'select') {
        element.appendChild = jest.fn();
      }
      
      return element;
    }),
    getElementById: jest.fn(() => null),
    head: {
      appendChild: jest.fn()
    }
  };
  
  // Mock Option constructor
  global.Option = jest.fn((text, value) => ({
    text,
    value,
    selected: false
  }));
  
  // Mock window
  global.window = {
    addEventListener: jest.fn()
  };
  
  // Mock performance
  global.performance = {
    now: jest.fn(() => Date.now())
  };
  
  return container;
};

describe('ForceParametersPanel', () => {
  let ui;
  let container;
  let mockLayout;
  let onParameterChange;
  let onPresetLoad;

  beforeEach(() => {
    container = createMockContainer();
    onParameterChange = jest.fn();
    onPresetLoad = jest.fn();
    
    mockLayout = {
      config: {
        chargeStrength: -300,
        forces: {
          link: 1,
          center: 0.1,
          collide: 30
        },
        alphaDecay: 0.0228,
        velocityDecay: 0.4,
        iterations: 300,
        bounds: {
          width: 1000,
          height: 600,
          padding: 50
        },
        adaptiveLayout: true
      }
    };
  });

  afterEach(() => {
    if (ui) {
      ui.destroy();
      ui = null;
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create UI instance with default config', () => {
      ui = new ForceParametersPanel({ container });
      
      expect(ui).toBeDefined();
      expect(ui.config.container).toBe(container);
      expect(ui.config.theme).toBe('light');
      expect(ui.config.collapsible).toBe(true);
      expect(ui.config.showPresets).toBe(true);
    });

    test('should accept custom configuration', () => {
      ui = new ForceParametersPanel({
        container,
        layout: mockLayout,
        onParameterChange,
        onPresetLoad,
        theme: 'dark',
        collapsible: false,
        showPresets: false,
        compact: true
      });

      expect(ui.config.layout).toBe(mockLayout);
      expect(ui.config.onParameterChange).toBe(onParameterChange);
      expect(ui.config.onPresetLoad).toBe(onPresetLoad);
      expect(ui.config.theme).toBe('dark');
      expect(ui.config.collapsible).toBe(false);
      expect(ui.config.showPresets).toBe(false);
      expect(ui.config.compact).toBe(true);
    });

    test('should throw error without container', () => {
      ui = new ForceParametersPanel();
      
      expect(() => ui.initialize()).toThrow('ForceParametersPanel requires a container element');
    });

    test('should initialize successfully with container', () => {
      ui = new ForceParametersPanel({ container });
      
      expect(() => ui.initialize()).not.toThrow();
      expect(container.innerHTML).toBe('');
      expect(container.className).toContain('force-params-ui');
    });
  });

  describe('Parameter Management', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({
        container,
        onParameterChange
      });
      ui.initialize();
    });

    test('should have default parameters', () => {
      expect(ui.parameters.chargeStrength).toBe(-300);
      expect(ui.parameters.linkStrength).toBe(1);
      expect(ui.parameters.centerStrength).toBe(0.1);
      expect(ui.parameters.collisionRadius).toBe(30);
      expect(ui.parameters.alphaDecay).toBe(0.0228);
      expect(ui.parameters.velocityDecay).toBe(0.4);
      expect(ui.parameters.iterations).toBe(300);
      expect(ui.parameters.useBarnesHut).toBe(false);
      expect(ui.parameters.stabilizationEnabled).toBe(false);
    });

    test('should handle parameter changes', () => {
      ui._handleParameterChange('chargeStrength', -500);
      
      expect(ui.parameters.chargeStrength).toBe(-500);
      expect(onParameterChange).toHaveBeenCalledWith(
        expect.any(Object), 
        'chargeStrength', 
        -500
      );
    });

    test('should update dependent controls', () => {
      const dependentElements = [
        { 
          classList: { toggle: jest.fn() },
          querySelector: jest.fn(() => ({ disabled: false }))
        }
      ];
      
      container.querySelectorAll = jest.fn(() => dependentElements);
      
      ui._updateDependentControls('useBarnesHut', true);
      
      expect(dependentElements[0].classList.toggle).toHaveBeenCalledWith('disabled', false);
    });

    test('should build correct layout config', () => {
      ui.parameters.chargeStrength = -400;
      ui.parameters.linkStrength = 1.5;
      ui.parameters.useBarnesHut = true;
      
      const config = ui._buildLayoutConfig();
      
      expect(config.chargeStrength).toBe(-400);
      expect(config.forces.link).toBe(1.5);
      expect(config.enhancedForces.useBarnesHut).toBe(true);
    });

    test('should format values correctly', () => {
      expect(ui._formatValue(42)).toBe('42');
      expect(ui._formatValue(3.14159)).toBe('3.142');
      expect(ui._formatValue('2.5')).toBe('2.500');
    });
  });

  describe('Presets', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({
        container,
        onPresetLoad
      });
      ui.initialize();
    });

    test('should have built-in presets', () => {
      expect(ui.presets).toBeDefined();
      expect(ui.presets['Default']).toBeDefined();
      expect(ui.presets['Dense Graph']).toBeDefined();
      expect(ui.presets['Sparse Graph']).toBeDefined();
      expect(ui.presets['Large Graph']).toBeDefined();
    });

    test('should validate preset structure', () => {
      Object.values(ui.presets).forEach(preset => {
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.parameters).toBeDefined();
        expect(typeof preset.parameters).toBe('object');
        
        // Check required parameters exist
        expect(preset.parameters.chargeStrength).toBeDefined();
        expect(preset.parameters.linkStrength).toBeDefined();
        expect(preset.parameters.alphaDecay).toBeDefined();
      });
    });

    test('should load preset correctly', () => {
      const presetName = 'Dense Graph';
      const preset = ui.presets[presetName];
      
      ui.loadPreset(presetName);
      
      expect(ui.parameters.chargeStrength).toBe(preset.parameters.chargeStrength);
      expect(ui.parameters.linkStrength).toBe(preset.parameters.linkStrength);
      expect(ui.parameters.useBarnesHut).toBe(preset.parameters.useBarnesHut);
      
      expect(onPresetLoad).toHaveBeenCalledWith(
        presetName,
        preset,
        expect.any(Object)
      );
    });

    test('should ignore invalid preset', () => {
      const originalParams = { ...ui.parameters };
      
      ui.loadPreset('NonExistent');
      
      expect(ui.parameters).toEqual(originalParams);
      expect(onPresetLoad).not.toHaveBeenCalled();
    });

    test('should reset to default preset', () => {
      // Change some parameters
      ui.parameters.chargeStrength = -1000;
      ui.parameters.linkStrength = 5;
      
      ui.reset();
      
      const defaultPreset = ui.presets['Default'];
      expect(ui.parameters.chargeStrength).toBe(defaultPreset.parameters.chargeStrength);
      expect(ui.parameters.linkStrength).toBe(defaultPreset.parameters.linkStrength);
    });
  });

  describe('Section Management', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({ container });
      ui.initialize();
    });

    test('should set active section', () => {
      const mockSection = {
        tab: { classList: { toggle: jest.fn() } },
        content: { classList: { toggle: jest.fn() } }
      };
      
      ui.sections.set('forces', mockSection);
      ui.sections.set('simulation', mockSection);
      
      ui.setActiveSection('simulation');
      
      expect(ui.activeSection).toBe('simulation');
    });

    test('should ignore setting same active section', () => {
      const initialSection = ui.activeSection;
      
      ui.setActiveSection(initialSection);
      
      expect(ui.activeSection).toBe(initialSection);
    });
  });

  describe('UI State Management', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({
        container,
        collapsible: true
      });
      ui.initialize();
      
      ui.contentElement = {
        classList: { toggle: jest.fn() }
      };
      ui.toggleButton = {
        textContent: '−'
      };
    });

    test('should toggle collapse/expand', () => {
      expect(ui.isCollapsed).toBe(false);
      
      ui.toggle();
      
      expect(ui.isCollapsed).toBe(true);
      expect(ui.toggleButton.textContent).toBe('+');
      expect(ui.contentElement.classList.toggle).toHaveBeenCalledWith('collapsed', true);
    });

    test('should toggle back to expanded', () => {
      ui.isCollapsed = true;
      ui.toggleButton.textContent = '+';
      
      ui.toggle();
      
      expect(ui.isCollapsed).toBe(false);
      expect(ui.toggleButton.textContent).toBe('−');
      expect(ui.contentElement.classList.toggle).toHaveBeenCalledWith('collapsed', false);
    });
  });

  describe('Parameter Updates', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({ container });
      ui.initialize();
      
      // Mock controls
      ui.controls.set('chargeStrength', {
        input: { value: -300 },
        group: { querySelector: jest.fn(() => ({ textContent: '' })) },
        config: { type: 'range' }
      });
      
      ui.controls.set('useBarnesHut', {
        input: { checked: false },
        group: { querySelector: jest.fn() },
        config: { type: 'checkbox' }
      });
    });

    test('should update parameters programmatically', () => {
      const newParams = {
        chargeStrength: -600,
        linkStrength: 2.5,
        useBarnesHut: true
      };
      
      ui.updateParameters(newParams);
      
      expect(ui.parameters.chargeStrength).toBe(-600);
      expect(ui.parameters.linkStrength).toBe(2.5);
      expect(ui.parameters.useBarnesHut).toBe(true);
      
      // Check UI updates
      expect(ui.controls.get('chargeStrength').input.value).toBe(-600);
      expect(ui.controls.get('useBarnesHut').input.checked).toBe(true);
    });

    test('should ignore unknown parameters', () => {
      const originalParams = { ...ui.parameters };
      
      ui.updateParameters({
        unknownParam: 'value',
        chargeStrength: -500
      });
      
      expect(ui.parameters.chargeStrength).toBe(-500);
      expect(ui.parameters.unknownParam).toBeUndefined();
    });
  });

  describe('Layout Integration', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({
        container,
        layout: mockLayout
      });
      ui.initialize();
    });

    test('should load initial parameters from layout', () => {
      expect(ui.parameters.chargeStrength).toBe(mockLayout.config.chargeStrength);
      expect(ui.parameters.linkStrength).toBe(mockLayout.config.forces.link);
      expect(ui.parameters.centerStrength).toBe(mockLayout.config.forces.center);
      expect(ui.parameters.alphaDecay).toBe(mockLayout.config.alphaDecay);
    });

    test('should handle missing layout config sections', () => {
      const minimalLayout = {
        config: {
          chargeStrength: -200
        }
      };
      
      ui = new ForceParametersPanel({
        container,
        layout: minimalLayout
      });
      ui.initialize();
      
      expect(ui.parameters.chargeStrength).toBe(-200);
      expect(ui.parameters.linkStrength).toBe(1); // default value
    });

    test('should get current layout config', () => {
      const config = ui.getLayoutConfig();
      
      expect(config).toEqual(expect.objectContaining({
        chargeStrength: expect.any(Number),
        forces: expect.objectContaining({
          link: expect.any(Number),
          center: expect.any(Number),
          collide: expect.any(Number)
        }),
        bounds: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
          padding: expect.any(Number)
        })
      }));
    });
  });

  describe('Responsive Behavior', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({
        container,
        responsive: true
      });
      ui.initialize();
    });

    test('should handle window resize', () => {
      // Mock small container
      container.offsetWidth = 350;
      
      ui._handleResize();
      
      expect(ui.config.compact).toBe(true);
      expect(container.classList.toggle).toHaveBeenCalledWith('compact', true);
    });

    test('should handle large container', () => {
      // Mock large container
      container.offsetWidth = 500;
      ui.config.compact = true; // Start compact
      
      ui._handleResize();
      
      expect(ui.config.compact).toBe(false);
      expect(container.classList.toggle).toHaveBeenCalledWith('compact', false);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({ container });
      ui.initialize();
    });

    test('should destroy cleanly', () => {
      ui.animationId = 123;
      global.cancelAnimationFrame = jest.fn();
      
      ui.destroy();
      
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(123);
      expect(container.innerHTML).toBe('');
      expect(ui.controls.size).toBe(0);
      expect(ui.sections.size).toBe(0);
    });

    test('should handle destroy without animation', () => {
      ui.animationId = null;
      global.cancelAnimationFrame = jest.fn();
      
      ui.destroy();
      
      expect(global.cancelAnimationFrame).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing container gracefully', () => {
      ui = new ForceParametersPanel();
      
      expect(() => ui.initialize()).toThrow();
    });

    test('should handle invalid preset gracefully', () => {
      ui = new ForceParametersPanel({ container });
      ui.initialize();
      
      const originalParams = { ...ui.parameters };
      ui.loadPreset(null);
      
      expect(ui.parameters).toEqual(originalParams);
    });

    test('should handle parameter change without callback', () => {
      ui = new ForceParametersPanel({ container });
      ui.initialize();
      
      expect(() => ui._handleParameterChange('chargeStrength', -400)).not.toThrow();
      expect(ui.parameters.chargeStrength).toBe(-400);
    });
  });

  describe('Preset Validation', () => {
    beforeEach(() => {
      ui = new ForceParametersPanel({ container });
      ui.initialize();
    });

    test('should validate Dense Graph preset parameters', () => {
      const preset = ui.presets['Dense Graph'];
      
      expect(preset.parameters.chargeStrength).toBe(-150);
      expect(preset.parameters.linkStrength).toBe(0.5);
      expect(preset.parameters.useBarnesHut).toBe(true);
      expect(preset.parameters.stabilizationEnabled).toBe(true);
      expect(preset.parameters.iterations).toBe(500);
    });

    test('should validate Large Graph preset parameters', () => {
      const preset = ui.presets['Large Graph'];
      
      expect(preset.parameters.chargeStrength).toBe(-100);
      expect(preset.parameters.useBarnesHut).toBe(true);
      expect(preset.parameters.barnesHutTheta).toBe(1.2);
      expect(preset.parameters.boundsWidth).toBe(1500);
      expect(preset.parameters.boundsHeight).toBe(1000);
    });

    test('should validate Tight Clustering preset parameters', () => {
      const preset = ui.presets['Tight Clustering'];
      
      expect(preset.parameters.linkStrength).toBe(3);
      expect(preset.parameters.centerStrength).toBe(0.3);
      expect(preset.parameters.boundsWidth).toBe(600);
      expect(preset.parameters.adaptiveLayout).toBe(false);
    });
  });
});