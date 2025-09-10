/**
 * Simple tests for ForceParametersPanel component
 * 
 * Testing core functionality without complex DOM manipulation
 */

import { jest } from '@jest/globals';
import { ForceParametersPanel } from '../../../../src/renderers/diagram/components/ForceParametersPanel.js';

describe('ForceParametersPanel - Simple Functionality', () => {
  let panel;
  let onParameterChangeMock;
  let mockContainer;
  
  // Set up minimal DOM mocking
  beforeAll(() => {
    global.document = {
      createElement: () => ({
        className: '',
        innerHTML: '',
        style: {},
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild: () => {},
        addEventListener: () => {},
        removeChild: () => {}
      }),
      head: { appendChild: () => {} },
      getElementById: () => null
    };
  });
  
  beforeEach(() => {
    mockContainer = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      contains: jest.fn(() => true)
    };
    
    onParameterChangeMock = jest.fn();
  });
  
  afterEach(() => {
    if (panel) {
      panel.destroy();
      panel = null;
    }
    jest.clearAllMocks();
  });
  
  describe('Default Values', () => {
    test('should provide correct default values', () => {
      panel = new ForceParametersPanel({
        container: mockContainer,
        onParameterChange: onParameterChangeMock
      });
      
      const defaults = panel._getDefaultValues();
      
      expect(defaults.alphaMin).toBe(0.001);
      expect(defaults.alphaDecay).toBe(0.0228);
      expect(defaults.velocityDecay).toBe(0.4);
      expect(defaults.chargeStrength).toBe(-300);
      expect(defaults.linkDistance).toBe(100);
      expect(defaults.stabilizationEnabled).toBe(true);
      expect(defaults.stabilizationThreshold).toBe(0.01);
    });
  });
  
  describe('Value Management', () => {
    beforeEach(() => {
      panel = new ForceParametersPanel({
        container: mockContainer,
        onParameterChange: onParameterChangeMock
      });
    });
    
    test('should get current values', () => {
      const values = panel.getValues();
      
      expect(values).toEqual(panel.currentValues);
      expect(values).not.toBe(panel.currentValues); // Should be a copy
    });
    
    test('should update values', () => {
      const newValues = {
        alphaDecay: 0.05,
        linkDistance: 200,
        stabilizationEnabled: false
      };
      
      panel.updateValues(newValues);
      
      expect(panel.currentValues.alphaDecay).toBe(0.05);
      expect(panel.currentValues.linkDistance).toBe(200);
      expect(panel.currentValues.stabilizationEnabled).toBe(false);
    });
    
    test('should reset to defaults', () => {
      // Change some values
      panel.currentValues.alphaMin = 0.005;
      panel.currentValues.chargeStrength = -500;
      
      panel.resetToDefaults();
      
      expect(panel.currentValues.alphaMin).toBe(0.001);
      expect(panel.currentValues.chargeStrength).toBe(-300);
      expect(onParameterChangeMock).toHaveBeenCalledWith('reset', expect.any(Object));
    });
  });
  
  describe('Configuration Conversion', () => {
    beforeEach(() => {
      panel = new ForceParametersPanel({
        container: mockContainer,
        onParameterChange: onParameterChangeMock
      });
    });
    
    test('should convert to ForceDirectedLayout config format', () => {
      const config = panel.toForceDirectedConfig();
      
      expect(config).toHaveProperty('alphaMin');
      expect(config).toHaveProperty('alphaDecay');
      expect(config).toHaveProperty('alphaTarget');
      expect(config).toHaveProperty('velocityDecay');
      
      expect(config).toHaveProperty('forces');
      expect(config.forces).toHaveProperty('charge');
      expect(config.forces).toHaveProperty('link');
      expect(config.forces).toHaveProperty('center');
      expect(config.forces).toHaveProperty('collide');
      
      expect(config).toHaveProperty('linkDistance');
      expect(config).toHaveProperty('chargeDistance');
      expect(config).toHaveProperty('collisionRadius');
      
      expect(config).toHaveProperty('stabilization');
      expect(config.stabilization).toHaveProperty('enabled');
      expect(config.stabilization).toHaveProperty('threshold');
      expect(config.stabilization).toHaveProperty('checkInterval');
    });
    
    test('should map UI values to correct config properties', () => {
      panel.updateValues({
        chargeStrength: -400,
        linkStrength: 1.5,
        centerStrength: 0.2,
        stabilizationEnabled: false,
        stabilizationThreshold: 0.05
      });
      
      const config = panel.toForceDirectedConfig();
      
      expect(config.forces.charge).toBe(-400);
      expect(config.forces.link).toBe(1.5);
      expect(config.forces.center).toBe(0.2);
      expect(config.stabilization.enabled).toBe(false);
      expect(config.stabilization.threshold).toBe(0.05);
    });
    
    test('should handle all stabilization parameters', () => {
      panel.updateValues({
        stabilizationEnabled: true,
        stabilizationThreshold: 0.02,
        stabilizationCheckInterval: 15,
        stabilizationMinIterations: 100,
        stabilizationMaxIterations: 2000
      });
      
      const config = panel.toForceDirectedConfig();
      
      expect(config.stabilization.enabled).toBe(true);
      expect(config.stabilization.threshold).toBe(0.02);
      expect(config.stabilization.checkInterval).toBe(15);
      expect(config.stabilization.minIterations).toBe(100);
      expect(config.stabilization.maxIterations).toBe(2000);
    });
  });
  
  describe('Parameter Change Handling', () => {
    beforeEach(() => {
      panel = new ForceParametersPanel({
        container: mockContainer,
        onParameterChange: onParameterChangeMock
      });
    });
    
    test('should call onParameterChange when parameter changes', () => {
      panel._onParameterChange('alphaMin', 0.002);
      
      expect(onParameterChangeMock).toHaveBeenCalledWith('alphaMin', 0.002, panel.currentValues);
    });
    
    test('should call onParameterChange on reset', () => {
      panel.resetToDefaults();
      
      expect(onParameterChangeMock).toHaveBeenCalledWith('reset', expect.any(Object));
    });
  });
  
  describe('Initial Values', () => {
    test('should use provided initial values', () => {
      const initialValues = {
        alphaMin: 0.002,
        chargeStrength: -500
      };
      
      panel = new ForceParametersPanel({
        container: mockContainer,
        initialValues,
        onParameterChange: onParameterChangeMock
      });
      
      expect(panel.currentValues.alphaMin).toBe(0.002);
      expect(panel.currentValues.chargeStrength).toBe(-500);
    });
    
    test('should use default values for unspecified parameters', () => {
      panel = new ForceParametersPanel({
        container: mockContainer,
        onParameterChange: onParameterChangeMock
      });
      
      const defaults = panel._getDefaultValues();
      
      expect(panel.currentValues.alphaDecay).toBe(defaults.alphaDecay);
      expect(panel.currentValues.velocityDecay).toBe(defaults.velocityDecay);
      expect(panel.currentValues.stabilizationEnabled).toBe(defaults.stabilizationEnabled);
    });
  });
  
  describe('Cleanup', () => {
    test('should destroy properly', () => {
      panel = new ForceParametersPanel({
        container: mockContainer,
        onParameterChange: onParameterChangeMock
      });
      
      // Add some controls and sections for testing
      panel.controls.set('test', {});
      panel.sections.set('test', {});
      
      panel.destroy();
      
      expect(panel.controls.size).toBe(0);
      expect(panel.sections.size).toBe(0);
    });
  });
});