import { DeploymentStatus, isValidTransition, getValidTransitions } from '../../../src/models/DeploymentStatus.js';

describe('DeploymentStatus', () => {
  describe('Status Enum', () => {
    test('should have all expected statuses', () => {
      expect(DeploymentStatus.PENDING).toBe('PENDING');
      expect(DeploymentStatus.DEPLOYING).toBe('DEPLOYING');
      expect(DeploymentStatus.RUNNING).toBe('RUNNING');
      expect(DeploymentStatus.UPDATING).toBe('UPDATING');
      expect(DeploymentStatus.STOPPING).toBe('STOPPING');
      expect(DeploymentStatus.STOPPED).toBe('STOPPED');
      expect(DeploymentStatus.FAILED).toBe('FAILED');
      expect(DeploymentStatus.REMOVED).toBe('REMOVED');
    });

    test('should be frozen', () => {
      expect(() => {
        DeploymentStatus.NEW_STATUS = 'NEW';
      }).toThrow();
    });
  });

  describe('Status Transitions', () => {
    test('should validate valid transitions from PENDING', () => {
      expect(isValidTransition(DeploymentStatus.PENDING, DeploymentStatus.DEPLOYING)).toBe(true);
      expect(isValidTransition(DeploymentStatus.PENDING, DeploymentStatus.FAILED)).toBe(true);
      expect(isValidTransition(DeploymentStatus.PENDING, DeploymentStatus.REMOVED)).toBe(true);
      
      expect(isValidTransition(DeploymentStatus.PENDING, DeploymentStatus.RUNNING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.PENDING, DeploymentStatus.STOPPED)).toBe(false);
    });

    test('should validate valid transitions from DEPLOYING', () => {
      expect(isValidTransition(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING)).toBe(true);
      expect(isValidTransition(DeploymentStatus.DEPLOYING, DeploymentStatus.FAILED)).toBe(true);
      
      expect(isValidTransition(DeploymentStatus.DEPLOYING, DeploymentStatus.PENDING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.DEPLOYING, DeploymentStatus.STOPPED)).toBe(false);
    });

    test('should validate valid transitions from RUNNING', () => {
      expect(isValidTransition(DeploymentStatus.RUNNING, DeploymentStatus.UPDATING)).toBe(true);
      expect(isValidTransition(DeploymentStatus.RUNNING, DeploymentStatus.STOPPING)).toBe(true);
      expect(isValidTransition(DeploymentStatus.RUNNING, DeploymentStatus.FAILED)).toBe(true);
      
      expect(isValidTransition(DeploymentStatus.RUNNING, DeploymentStatus.PENDING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.RUNNING, DeploymentStatus.DEPLOYING)).toBe(false);
    });

    test('should validate valid transitions from UPDATING', () => {
      expect(isValidTransition(DeploymentStatus.UPDATING, DeploymentStatus.RUNNING)).toBe(true);
      expect(isValidTransition(DeploymentStatus.UPDATING, DeploymentStatus.FAILED)).toBe(true);
      
      expect(isValidTransition(DeploymentStatus.UPDATING, DeploymentStatus.PENDING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.UPDATING, DeploymentStatus.STOPPED)).toBe(false);
    });

    test('should validate valid transitions from STOPPING', () => {
      expect(isValidTransition(DeploymentStatus.STOPPING, DeploymentStatus.STOPPED)).toBe(true);
      expect(isValidTransition(DeploymentStatus.STOPPING, DeploymentStatus.FAILED)).toBe(true);
      
      expect(isValidTransition(DeploymentStatus.STOPPING, DeploymentStatus.RUNNING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.STOPPING, DeploymentStatus.PENDING)).toBe(false);
    });

    test('should validate valid transitions from STOPPED', () => {
      expect(isValidTransition(DeploymentStatus.STOPPED, DeploymentStatus.DEPLOYING)).toBe(true);
      expect(isValidTransition(DeploymentStatus.STOPPED, DeploymentStatus.REMOVED)).toBe(true);
      
      expect(isValidTransition(DeploymentStatus.STOPPED, DeploymentStatus.RUNNING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.STOPPED, DeploymentStatus.UPDATING)).toBe(false);
    });

    test('should validate valid transitions from FAILED', () => {
      expect(isValidTransition(DeploymentStatus.FAILED, DeploymentStatus.DEPLOYING)).toBe(true);
      expect(isValidTransition(DeploymentStatus.FAILED, DeploymentStatus.REMOVED)).toBe(true);
      
      expect(isValidTransition(DeploymentStatus.FAILED, DeploymentStatus.RUNNING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.FAILED, DeploymentStatus.UPDATING)).toBe(false);
    });

    test('should not allow transitions from REMOVED', () => {
      expect(isValidTransition(DeploymentStatus.REMOVED, DeploymentStatus.PENDING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.REMOVED, DeploymentStatus.DEPLOYING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.REMOVED, DeploymentStatus.RUNNING)).toBe(false);
      expect(isValidTransition(DeploymentStatus.REMOVED, DeploymentStatus.FAILED)).toBe(false);
    });
  });

  describe('Get Valid Transitions', () => {
    test('should return valid transitions for each status', () => {
      const pendingTransitions = getValidTransitions(DeploymentStatus.PENDING);
      expect(pendingTransitions).toContain(DeploymentStatus.DEPLOYING);
      expect(pendingTransitions).toContain(DeploymentStatus.FAILED);
      expect(pendingTransitions).toContain(DeploymentStatus.REMOVED);
      expect(pendingTransitions).toHaveLength(3);

      const runningTransitions = getValidTransitions(DeploymentStatus.RUNNING);
      expect(runningTransitions).toContain(DeploymentStatus.UPDATING);
      expect(runningTransitions).toContain(DeploymentStatus.STOPPING);
      expect(runningTransitions).toContain(DeploymentStatus.FAILED);
      expect(runningTransitions).toHaveLength(3);

      const removedTransitions = getValidTransitions(DeploymentStatus.REMOVED);
      expect(removedTransitions).toHaveLength(0);
    });

    test('should return empty array for invalid status', () => {
      const transitions = getValidTransitions('INVALID_STATUS');
      expect(transitions).toEqual([]);
    });
  });

  describe('Status Helpers', () => {
    test('should identify terminal states', () => {
      const isTerminal = (status) => {
        const transitions = getValidTransitions(status);
        return transitions.length === 0 || 
               (transitions.length === 1 && transitions[0] === DeploymentStatus.REMOVED);
      };

      expect(isTerminal(DeploymentStatus.REMOVED)).toBe(true);
      expect(isTerminal(DeploymentStatus.PENDING)).toBe(false);
      expect(isTerminal(DeploymentStatus.RUNNING)).toBe(false);
    });

    test('should identify active states', () => {
      const isActive = (status) => {
        return [
          DeploymentStatus.DEPLOYING,
          DeploymentStatus.RUNNING,
          DeploymentStatus.UPDATING,
          DeploymentStatus.STOPPING
        ].includes(status);
      };

      expect(isActive(DeploymentStatus.RUNNING)).toBe(true);
      expect(isActive(DeploymentStatus.UPDATING)).toBe(true);
      expect(isActive(DeploymentStatus.PENDING)).toBe(false);
      expect(isActive(DeploymentStatus.STOPPED)).toBe(false);
    });
  });
});