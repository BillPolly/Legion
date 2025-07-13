import { jest } from '@jest/globals';
import ResourceStatus, { RESOURCE_STATUS, STATUS_TRANSITIONS } from '../../../src/base/ResourceStatus.js';

describe('ResourceStatus', () => {
  let resourceStatus;

  beforeEach(() => {
    resourceStatus = new ResourceStatus();
  });

  describe('constructor', () => {
    it('should initialize with STOPPED status by default', () => {
      expect(resourceStatus.status).toBe(RESOURCE_STATUS.STOPPED);
      expect(resourceStatus.statusHistory).toHaveLength(1);
      expect(resourceStatus.statusHistory[0]).toMatchObject({
        status: RESOURCE_STATUS.STOPPED,
        reason: 'Initial status'
      });
    });

    it('should initialize with custom status', () => {
      const customStatus = new ResourceStatus(RESOURCE_STATUS.RUNNING);
      expect(customStatus.status).toBe(RESOURCE_STATUS.RUNNING);
      expect(customStatus.statusHistory[0].status).toBe(RESOURCE_STATUS.RUNNING);
    });

    it('should initialize with empty listeners map', () => {
      expect(resourceStatus.listeners).toBeInstanceOf(Map);
      expect(resourceStatus.listeners.size).toBe(0);
    });
  });

  describe('RESOURCE_STATUS constants', () => {
    it('should have all required status values', () => {
      expect(RESOURCE_STATUS).toEqual({
        STOPPED: 'stopped',
        STARTING: 'starting',
        RUNNING: 'running',
        STOPPING: 'stopping',
        ERROR: 'error',
        UNHEALTHY: 'unhealthy',
        READY: 'ready'
      });
    });
  });

  describe('STATUS_TRANSITIONS', () => {
    it('should define valid transitions for each status', () => {
      expect(STATUS_TRANSITIONS[RESOURCE_STATUS.STOPPED]).toEqual([RESOURCE_STATUS.STARTING]);
      expect(STATUS_TRANSITIONS[RESOURCE_STATUS.STARTING]).toContain(RESOURCE_STATUS.RUNNING);
      expect(STATUS_TRANSITIONS[RESOURCE_STATUS.RUNNING]).toContain(RESOURCE_STATUS.STOPPING);
    });
  });

  describe('changeStatus', () => {
    it('should successfully change status for valid transition', () => {
      const result = resourceStatus.changeStatus(RESOURCE_STATUS.STARTING, 'Starting resource');
      expect(result).toBe(true);
      expect(resourceStatus.status).toBe(RESOURCE_STATUS.STARTING);
      expect(resourceStatus.statusHistory).toHaveLength(2);
      expect(resourceStatus.statusHistory[1]).toMatchObject({
        status: RESOURCE_STATUS.STARTING,
        reason: 'Starting resource',
        previousStatus: RESOURCE_STATUS.STOPPED
      });
    });

    it('should reject invalid status value', () => {
      expect(() => {
        resourceStatus.changeStatus('invalid-status');
      }).toThrow('Invalid status: invalid-status');
    });

    it('should reject invalid transition and return false', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      expect(result).toBe(false);
      expect(resourceStatus.status).toBe(RESOURCE_STATUS.STOPPED);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should allow transition to same status', () => {
      const result = resourceStatus.changeStatus(RESOURCE_STATUS.STOPPED, 'Still stopped');
      expect(result).toBe(true);
      expect(resourceStatus.statusHistory).toHaveLength(2);
    });

    it('should handle complex transition chains', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      resourceStatus.changeStatus(RESOURCE_STATUS.READY);
      resourceStatus.changeStatus(RESOURCE_STATUS.UNHEALTHY);
      resourceStatus.changeStatus(RESOURCE_STATUS.ERROR);
      expect(resourceStatus.status).toBe(RESOURCE_STATUS.ERROR);
      expect(resourceStatus.statusHistory).toHaveLength(6);
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transitions', () => {
      expect(resourceStatus.isValidTransition(RESOURCE_STATUS.STOPPED, RESOURCE_STATUS.STARTING)).toBe(true);
      expect(resourceStatus.isValidTransition(RESOURCE_STATUS.STARTING, RESOURCE_STATUS.RUNNING)).toBe(true);
      expect(resourceStatus.isValidTransition(RESOURCE_STATUS.RUNNING, RESOURCE_STATUS.STOPPING)).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(resourceStatus.isValidTransition(RESOURCE_STATUS.STOPPED, RESOURCE_STATUS.RUNNING)).toBe(false);
      expect(resourceStatus.isValidTransition(RESOURCE_STATUS.STOPPED, RESOURCE_STATUS.STOPPING)).toBe(false);
    });

    it('should return true for same status transition', () => {
      expect(resourceStatus.isValidTransition(RESOURCE_STATUS.RUNNING, RESOURCE_STATUS.RUNNING)).toBe(true);
    });

    it('should handle undefined transition rules', () => {
      const customTransitions = { ...STATUS_TRANSITIONS };
      delete customTransitions[RESOURCE_STATUS.STOPPED];
      expect(resourceStatus.isValidTransition(RESOURCE_STATUS.STOPPED, RESOURCE_STATUS.STARTING)).toBe(true);
    });
  });

  describe('isHealthy', () => {
    it('should return true for healthy states', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      expect(resourceStatus.isHealthy()).toBe(true);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      expect(resourceStatus.isHealthy()).toBe(true);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.READY);
      expect(resourceStatus.isHealthy()).toBe(true);
    });

    it('should return false for unhealthy states', () => {
      expect(resourceStatus.isHealthy()).toBe(false); // STOPPED
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.ERROR);
      expect(resourceStatus.isHealthy()).toBe(false);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      resourceStatus.changeStatus(RESOURCE_STATUS.UNHEALTHY);
      expect(resourceStatus.isHealthy()).toBe(false);
    });
  });

  describe('isOperational', () => {
    it('should return true for operational states', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      expect(resourceStatus.isOperational()).toBe(true);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.READY);
      expect(resourceStatus.isOperational()).toBe(true);
    });

    it('should return false for non-operational states', () => {
      expect(resourceStatus.isOperational()).toBe(false); // STOPPED
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      expect(resourceStatus.isOperational()).toBe(false);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.ERROR);
      expect(resourceStatus.isOperational()).toBe(false);
    });
  });

  describe('hasError', () => {
    it('should return true for error states', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.ERROR);
      expect(resourceStatus.hasError()).toBe(true);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      resourceStatus.changeStatus(RESOURCE_STATUS.UNHEALTHY);
      expect(resourceStatus.hasError()).toBe(true);
    });

    it('should return false for non-error states', () => {
      expect(resourceStatus.hasError()).toBe(false);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      expect(resourceStatus.hasError()).toBe(false);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      expect(resourceStatus.hasError()).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should return limited history', () => {
      // Add multiple status changes
      for (let i = 0; i < 15; i++) {
        resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
        resourceStatus.changeStatus(RESOURCE_STATUS.STOPPED);
      }
      
      const history = resourceStatus.getHistory(5);
      expect(history).toHaveLength(5);
      expect(history[0].status).toBeDefined();
    });

    it('should return all history if less than limit', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      
      const history = resourceStatus.getHistory(10);
      expect(history).toHaveLength(3); // Initial + 2 changes
    });

    it('should default to 10 entries', () => {
      for (let i = 0; i < 20; i++) {
        resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
        resourceStatus.changeStatus(RESOURCE_STATUS.STOPPED);
      }
      
      const history = resourceStatus.getHistory();
      expect(history).toHaveLength(10);
    });
  });

  describe('getTimeInCurrentStatus', () => {
    it('should calculate time correctly', async () => {
      const beforeTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 50));
      const timeInStatus = resourceStatus.getTimeInCurrentStatus();
      expect(timeInStatus).toBeGreaterThanOrEqual(50);
      expect(timeInStatus).toBeLessThan(100);
    });

    it('should reset time after status change', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      const timeInStatus = resourceStatus.getTimeInCurrentStatus();
      expect(timeInStatus).toBeLessThan(10);
    });
  });

  describe('listeners', () => {
    it('should add and notify listeners', () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      
      resourceStatus.addListener('listener1', mockCallback1);
      resourceStatus.addListener('listener2', mockCallback2);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING, 'Test reason');
      
      expect(mockCallback1).toHaveBeenCalledWith(
        RESOURCE_STATUS.STOPPED,
        RESOURCE_STATUS.STARTING,
        'Test reason'
      );
      expect(mockCallback2).toHaveBeenCalledWith(
        RESOURCE_STATUS.STOPPED,
        RESOURCE_STATUS.STARTING,
        'Test reason'
      );
    });

    it('should remove listeners', () => {
      const mockCallback = jest.fn();
      
      resourceStatus.addListener('testListener', mockCallback);
      resourceStatus.removeListener('testListener');
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodCallback = jest.fn();
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      resourceStatus.addListener('errorListener', errorCallback);
      resourceStatus.addListener('goodListener', goodCallback);
      
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      
      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getSummary', () => {
    it('should return complete summary', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      
      const summary = resourceStatus.getSummary();
      
      expect(summary).toMatchObject({
        current: RESOURCE_STATUS.RUNNING,
        isHealthy: true,
        isOperational: true,
        hasError: false,
        changeCount: 2
      });
      expect(summary.since).toBeInstanceOf(Date);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset to STOPPED status', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      resourceStatus.changeStatus(RESOURCE_STATUS.STOPPING);
      
      resourceStatus.reset('Manual reset');
      
      expect(resourceStatus.status).toBe(RESOURCE_STATUS.STOPPED);
      const history = resourceStatus.getHistory();
      expect(history[history.length - 1].reason).toBe('Manual reset');
    });

    it('should use default reason if not provided', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.reset();
      
      const history = resourceStatus.getHistory();
      expect(history[history.length - 1].reason).toBe('Status reset');
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation', () => {
      resourceStatus.changeStatus(RESOURCE_STATUS.STARTING);
      resourceStatus.changeStatus(RESOURCE_STATUS.RUNNING);
      
      const json = resourceStatus.toJSON();
      
      expect(json).toHaveProperty('current', RESOURCE_STATUS.RUNNING);
      expect(json).toHaveProperty('history');
      expect(json).toHaveProperty('summary');
      expect(json.history).toBeInstanceOf(Array);
      expect(json.summary).toMatchObject({
        current: RESOURCE_STATUS.RUNNING,
        isHealthy: true
      });
    });
  });
});