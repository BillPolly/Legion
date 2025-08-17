/**
 * GoalInputInterface Integration Tests
 * Tests integration with planning system and actor communication
 */

import { jest } from '@jest/globals';
import { GoalInputInterface } from '../../src/components/tool-registry/components/panels/GoalInputInterface.js';

describe('GoalInputInterface Integration Tests', () => {
  let component;
  let mockUmbilical;
  let mockPlanningActor;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    document.body.appendChild(dom);

    // Mock planning actor
    mockPlanningActor = {
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      isConnected: jest.fn(() => true),
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    // Create mock umbilical with real DOM and planning actor integration
    mockUmbilical = {
      dom,
      planningActor: mockPlanningActor,
      onMount: jest.fn(),
      onGoalChange: jest.fn(),
      onContextChange: jest.fn(),
      onValidation: jest.fn(),
      onSubmit: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await GoalInputInterface.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Planning Initiation Integration', () => {
    test('should trigger planning request when goal is submitted with valid context', async () => {
      // Set up goal and context
      const testGoal = 'Create a REST API for user management with authentication';
      const testContext = {
        constraints: [
          { type: 'technology', value: 'Node.js' },
          { type: 'technology', value: 'Express' },
          { type: 'technology', value: 'MongoDB' }
        ],
        preferences: {
          testingFramework: 'Jest',
          codeStyle: 'ESLint'
        },
        environment: 'development'
      };

      component.setGoal(testGoal);
      component.setPreference('testingFramework', testContext.preferences.testingFramework);
      component.setPreference('codeStyle', testContext.preferences.codeStyle);
      
      testContext.constraints.forEach(constraint => {
        component.addConstraint(constraint.type, constraint.value);
      });

      // Submit the goal
      component.submit();

      // Verify onSubmit was called with correct data
      expect(mockUmbilical.onSubmit).toHaveBeenCalledWith({
        goal: testGoal,
        context: expect.objectContaining({
          constraints: expect.arrayContaining([
            { type: 'technology', value: 'Node.js' },
            { type: 'technology', value: 'Express' },
            { type: 'technology', value: 'MongoDB' }
          ]),
          preferences: expect.objectContaining({
            testingFramework: 'Jest',
            codeStyle: 'ESLint'
          }),
          environment: 'development'
        })
      });
    });

    test('should not trigger planning if goal validation fails', () => {
      // Set invalid goal (too short)
      component.setGoal('API');

      // Attempt to submit
      component.submit();

      // Should not trigger onSubmit due to validation failure
      expect(mockUmbilical.onSubmit).not.toHaveBeenCalled();
    });

    test('should communicate real-time validation changes to umbilical', () => {
      const testGoal = 'Build a comprehensive e-commerce platform';
      
      // Goal change should trigger validation
      component.setGoal(testGoal);

      // Should trigger goal change callback
      expect(mockUmbilical.onGoalChange).toHaveBeenCalledWith(testGoal);

      // Should trigger validation callback with valid result
      expect(mockUmbilical.onValidation).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          errors: [],
          suggestions: expect.any(Array)
        })
      );
    });

    test('should handle context changes and communicate them to umbilical', () => {
      // Add constraints
      component.addConstraint('technology', 'React');
      component.addConstraint('technology', 'TypeScript');

      // Set preferences
      component.setPreference('testingFramework', 'Vitest');
      component.setEnvironment('production');

      // Should trigger context change callbacks
      expect(mockUmbilical.onContextChange).toHaveBeenCalledWith(
        expect.objectContaining({
          constraints: expect.arrayContaining([
            { type: 'technology', value: 'React' },
            { type: 'technology', value: 'TypeScript' }
          ]),
          preferences: expect.objectContaining({
            testingFramework: 'Vitest'
          }),
          environment: 'production'
        })
      );
    });

    test('should validate constraints before adding them', () => {
      // Valid constraint
      const validResult = component.addConstraint('technology', 'Python');
      expect(validResult.valid).toBe(true);

      // Invalid deadline constraint (past date)
      const pastDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]; // Yesterday
      const invalidResult = component.addConstraint('deadline', pastDate);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Deadline cannot be in the past');
    });

    test('should handle template application and trigger planning flow', () => {
      // Apply a template
      component.applyTemplate('REST API');

      const expectedTemplate = 'Build a REST API service with the following endpoints:\n- User authentication (login, register, logout)\n- CRUD operations for [resource]\n- Data validation and error handling\n- API documentation';

      // Should update goal
      expect(component.getGoal()).toBe(expectedTemplate);

      // Should trigger goal change
      expect(mockUmbilical.onGoalChange).toHaveBeenCalledWith(expectedTemplate);

      // Should trigger validation
      expect(mockUmbilical.onValidation).toHaveBeenCalled();
    });
  });

  describe('Actor Communication Integration', () => {
    test('should send planning request through actor when submit is called', async () => {
      // Mock actor response
      const mockPlanResponse = {
        success: true,
        planId: 'test-plan-123',
        decomposition: {
          root: 'Create API',
          children: []
        }
      };

      mockPlanningActor.sendMessage.mockResolvedValueOnce(mockPlanResponse);

      // Set up goal
      component.setGoal('Create a user authentication API');
      component.addConstraint('technology', 'Express');

      // Submit goal
      component.submit();

      // Verify the submission data was passed to umbilical
      expect(mockUmbilical.onSubmit).toHaveBeenCalledWith({
        goal: 'Create a user authentication API',
        context: expect.objectContaining({
          constraints: [{ type: 'technology', value: 'Express' }],
          environment: 'development'
        })
      });
    });

    test('should handle planning actor connection status', () => {
      // Test when actor is connected
      expect(mockPlanningActor.isConnected()).toBe(true);

      // Mock disconnection
      mockPlanningActor.isConnected.mockReturnValue(false);
      expect(mockPlanningActor.isConnected()).toBe(false);

      // Should still allow goal input even when disconnected
      component.setGoal('Test goal during disconnection');
      expect(component.getGoal()).toBe('Test goal during disconnection');
    });

    test('should gracefully handle actor communication failures', async () => {
      // Mock actor failure
      mockPlanningActor.sendMessage.mockRejectedValueOnce(
        new Error('Network connection failed')
      );

      // Set up goal
      component.setGoal('Create microservices architecture');

      // Submit should still work at component level
      component.submit();

      // Should trigger onSubmit even if actor fails
      expect(mockUmbilical.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Real-time Features Integration', () => {
    test('should provide complexity analysis for planning hints', () => {
      const complexGoal = 'Build a complete enterprise-level e-commerce platform with microservices, real-time analytics, machine learning recommendations, and multi-region deployment';
      
      component.setGoal(complexGoal);
      
      const complexity = component.analyzeComplexity(complexGoal);
      expect(complexity.complexity).toBe('HIGH');
      expect(complexity.featureCount).toBeGreaterThan(3);
      expect(complexity.suggestions).toContain('Consider breaking this down into smaller milestones');
    });

    test('should detect technologies for context enrichment', () => {
      const techGoal = 'Build a React application with Node.js backend, MongoDB database, and Docker deployment';
      
      component.setGoal(techGoal);
      
      const technologies = component.detectTechnologies();
      expect(technologies).toContain('React');
      expect(technologies).toContain('Node.js');
      expect(technologies).toContain('MongoDB');
      expect(technologies).toContain('Docker');
    });

    test('should estimate complexity for planning preparation', () => {
      const mediumGoal = 'Create a task management application with user authentication and real-time collaboration';
      
      component.setGoal(mediumGoal);
      
      const estimate = component.estimateComplexity();
      expect(estimate.level).toBe('MEDIUM');
      expect(estimate.estimatedTasks).toBe(15);
    });

    test('should provide contextual suggestions for goal improvement', () => {
      const vagueMobileGoal = 'Make a mobile app';
      
      component.setGoal(vagueMobileGoal);
      
      const suggestions = component.getSuggestions(vagueMobileGoal);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('Add more specific features and requirements');
      expect(suggestions).toContain('Specify the target audience');
    });
  });

  describe('State Management Integration', () => {
    test('should maintain state consistency across operations', () => {
      // Set initial state
      component.setGoal('Initial goal');
      component.addConstraint('technology', 'JavaScript');
      component.setPreference('testing', 'Jest');
      component.setEnvironment('staging');

      // Verify state
      expect(component.getGoal()).toBe('Initial goal');
      expect(component.getContext()).toMatchObject({
        constraints: [{ type: 'technology', value: 'JavaScript' }],
        preferences: { testing: 'Jest' },
        environment: 'staging'
      });

      // Modify state
      component.setGoal('Updated goal');
      component.removeConstraint(0);
      component.setPreference('testing', 'Mocha');

      // Verify updates
      expect(component.getGoal()).toBe('Updated goal');
      expect(component.getContext().constraints).toHaveLength(0);
      expect(component.getContext().preferences.testing).toBe('Mocha');
    });

    test('should handle complete state reset', () => {
      // Set up state
      component.setGoal('Complex goal with many requirements');
      component.addConstraint('technology', 'React');
      component.addConstraint('technology', 'Node.js');
      component.setPreference('testingFramework', 'Jest');
      component.setEnvironment('production');

      // Reset all
      component.clearAll();

      // Verify reset
      expect(component.getGoal()).toBe('');
      expect(component.getContext()).toMatchObject({
        constraints: [],
        preferences: {},
        environment: 'development'
      });
    });

    test('should validate state before submission', () => {
      // Empty goal should not be submittable
      component.clearAll();
      component.submit();
      expect(mockUmbilical.onSubmit).not.toHaveBeenCalled();

      // Valid goal should be submittable
      component.setGoal('Valid goal for submission');
      component.submit();
      expect(mockUmbilical.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle validation errors gracefully', () => {
      // Test with various invalid inputs
      const invalidGoals = ['', 'x', '  '];
      
      invalidGoals.forEach(goal => {
        component.setGoal(goal);
        const validation = component.validateGoal(goal);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    test('should handle constraint validation errors', () => {
      // Test invalid deadline
      const futureDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const pastDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Valid future date
      const validResult = component.addConstraint('deadline', futureDate);
      expect(validResult.valid).toBe(true);

      // Invalid past date
      const invalidResult = component.addConstraint('deadline', pastDate);
      expect(invalidResult.valid).toBe(false);
    });

    test('should handle umbilical communication errors', () => {
      // Create umbilical without required callbacks
      const minimalUmbilical = { dom };
      
      // Should not throw even with minimal umbilical
      expect(async () => {
        const minimalComponent = await GoalInputInterface.create(minimalUmbilical);
        minimalComponent.setGoal('Test goal');
        minimalComponent.submit();
        minimalComponent.destroy();
      }).not.toThrow();
    });
  });

  describe('Performance Integration', () => {
    test('should handle rapid state changes efficiently', () => {
      const startTime = Date.now();
      
      // Rapid state changes
      for (let i = 0; i < 100; i++) {
        component.setGoal(`Goal iteration ${i}`);
        component.addConstraint('technology', `Tech${i}`);
        component.setPreference(`pref${i}`, `value${i}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (1000ms)
      expect(duration).toBeLessThan(1000);
      
      // Final state should be correct
      expect(component.getGoal()).toBe('Goal iteration 99');
      expect(component.getContext().constraints).toHaveLength(100);
    });

    test('should handle large constraint lists efficiently', () => {
      // Add many constraints
      for (let i = 0; i < 50; i++) {
        component.addConstraint('technology', `Technology ${i}`);
      }
      
      // Should maintain performance for operations
      const startTime = Date.now();
      
      // Test operations on large constraint list
      const context = component.getContext();
      component.removeConstraint(25);
      component.addConstraint('technology', 'New Technology');
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
      
      // Verify operations completed correctly
      expect(component.getContext().constraints).toHaveLength(50); // 50 - 1 + 1
    });
  });
});