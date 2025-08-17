/**
 * Unit tests for GoalInputInterface Component
 * Tests goal input validation and context configuration
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the UmbilicalUtils
jest.mock('/legion/frontend-components/src/umbilical/index.js', () => ({
  UmbilicalUtils: {
    validateCapabilities: jest.fn((umbilical, requirements) => {
      return true;
    }),
    createRequirements: () => ({
      add: jest.fn(),
      validate: jest.fn()
    })
  }
}));

describe('GoalInputInterface', () => {
  let mockUmbilical;
  let mockContainer;
  let component;

  beforeEach(() => {
    // Create mock DOM container
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    // Create mock umbilical
    mockUmbilical = {
      dom: mockContainer,
      onGoalChange: jest.fn(),
      onContextChange: jest.fn(),
      onSubmit: jest.fn(),
      onValidation: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    document.body.removeChild(mockContainer);
    jest.clearAllMocks();
  });

  describe('Goal Input Validation', () => {
    it('should validate empty goal', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const validation = component.validateGoal('');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Goal cannot be empty');
    });

    it('should validate goal length', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const shortGoal = 'Hi';
      const validation = component.validateGoal(shortGoal);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Goal must be at least 10 characters');
    });

    it('should validate valid goal', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const validGoal = 'Build a REST API service with authentication';
      const validation = component.validateGoal(validGoal);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect technical jargon and suggest clarification', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const technicalGoal = 'Implement CRUD operations for the user model';
      const validation = component.validateGoal(technicalGoal);
      expect(validation.valid).toBe(true);
      expect(validation.suggestions).toContain('Consider adding more context about the technology stack');
    });

    it('should validate goal complexity', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const complexGoal = 'Build a complete e-commerce platform with user management, product catalog, shopping cart, payment processing, order management, inventory tracking, shipping integration, customer support system, analytics dashboard, and mobile apps';
      const analysis = component.analyzeComplexity(complexGoal);
      expect(analysis.complexity).toBe('HIGH');
      expect(analysis.suggestions).toContain('Consider breaking this down into smaller milestones');
    });
  });

  describe('Context Configuration', () => {
    it('should initialize with default context', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const context = component.getContext();
      expect(context.constraints).toEqual([]);
      expect(context.preferences).toEqual({});
      expect(context.availableTools).toEqual([]);
      expect(context.environment).toBe('development');
    });

    it('should add technology constraints', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.addConstraint('technology', 'Node.js');
      component.addConstraint('technology', 'PostgreSQL');
      
      const context = component.getContext();
      expect(context.constraints).toContainEqual({
        type: 'technology',
        value: 'Node.js'
      });
      expect(context.constraints).toContainEqual({
        type: 'technology',
        value: 'PostgreSQL'
      });
    });

    it('should add time constraints', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.addConstraint('deadline', '2024-12-31');
      
      const context = component.getContext();
      expect(context.constraints).toContainEqual({
        type: 'deadline',
        value: '2024-12-31'
      });
    });

    it('should set preferences', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.setPreference('testingFramework', 'Jest');
      component.setPreference('codeStyle', 'ESLint');
      
      const context = component.getContext();
      expect(context.preferences.testingFramework).toBe('Jest');
      expect(context.preferences.codeStyle).toBe('ESLint');
    });

    it('should validate constraints', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const validation = component.validateConstraint('deadline', 'invalid-date');
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Invalid date format');
    });

    it('should set available tools', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const tools = ['npm', 'git', 'docker'];
      component.setAvailableTools(tools);
      
      const context = component.getContext();
      expect(context.availableTools).toEqual(tools);
    });

    it('should set environment', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.setEnvironment('production');
      
      const context = component.getContext();
      expect(context.environment).toBe('production');
    });

    it('should clear context', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.addConstraint('technology', 'React');
      component.setPreference('theme', 'dark');
      component.clearContext();
      
      const context = component.getContext();
      expect(context.constraints).toEqual([]);
      expect(context.preferences).toEqual({});
    });
  });

  describe('UI Rendering', () => {
    it('should render goal input textarea', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const textarea = mockContainer.querySelector('.goal-input-textarea');
      expect(textarea).toBeTruthy();
      expect(textarea.placeholder).toContain('Describe your goal');
    });

    it('should render validation feedback', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const feedback = mockContainer.querySelector('.validation-feedback');
      expect(feedback).toBeTruthy();
    });

    it('should render context configuration panel', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const contextPanel = mockContainer.querySelector('.context-configuration');
      expect(contextPanel).toBeTruthy();
    });

    it('should render constraints list', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.addConstraint('technology', 'Python');
      
      const constraintsList = mockContainer.querySelector('.constraints-list');
      expect(constraintsList).toBeTruthy();
      expect(constraintsList.textContent).toContain('Python');
    });

    it('should render submit button', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const submitButton = mockContainer.querySelector('.submit-goal-button');
      expect(submitButton).toBeTruthy();
      expect(submitButton.textContent).toBe('Create Plan');
    });

    it('should show character count', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const charCount = mockContainer.querySelector('.character-count');
      expect(charCount).toBeTruthy();
      expect(charCount.textContent).toBe('0 / 500');
    });
  });

  describe('User Interactions', () => {
    it('should handle goal input changes', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const textarea = mockContainer.querySelector('.goal-input-textarea');
      textarea.value = 'Create a todo list application';
      textarea.dispatchEvent(new Event('input'));

      expect(component.getGoal()).toBe('Create a todo list application');
      expect(mockUmbilical.onGoalChange).toHaveBeenCalledWith('Create a todo list application');
    });

    it('should update character count on input', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const textarea = mockContainer.querySelector('.goal-input-textarea');
      const charCount = mockContainer.querySelector('.character-count');
      
      textarea.value = 'Build an API';
      textarea.dispatchEvent(new Event('input'));
      
      expect(charCount.textContent).toBe('12 / 500');
    });

    it('should show validation errors in real-time', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const textarea = mockContainer.querySelector('.goal-input-textarea');
      const feedback = mockContainer.querySelector('.validation-feedback');
      
      textarea.value = 'Hi';
      textarea.dispatchEvent(new Event('input'));
      
      expect(feedback.classList.contains('error')).toBe(true);
      expect(feedback.textContent).toContain('at least 10 characters');
    });

    it('should handle constraint addition', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const constraintInput = mockContainer.querySelector('.constraint-input');
      const addButton = mockContainer.querySelector('.add-constraint-button');
      
      constraintInput.value = 'React';
      addButton.click();
      
      const constraintsList = mockContainer.querySelector('.constraints-list');
      expect(constraintsList.textContent).toContain('React');
      expect(mockUmbilical.onContextChange).toHaveBeenCalled();
    });

    it('should handle constraint removal', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.addConstraint('technology', 'Vue.js');
      
      const removeButton = mockContainer.querySelector('.remove-constraint');
      removeButton.click();
      
      const context = component.getContext();
      expect(context.constraints).toHaveLength(0);
    });

    it('should handle form submission', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.setGoal('Build a REST API with authentication');
      component.addConstraint('technology', 'Express.js');
      
      const submitButton = mockContainer.querySelector('.submit-goal-button');
      submitButton.click();
      
      expect(mockUmbilical.onSubmit).toHaveBeenCalledWith({
        goal: 'Build a REST API with authentication',
        context: expect.objectContaining({
          constraints: expect.arrayContaining([
            { type: 'technology', value: 'Express.js' }
          ])
        })
      });
    });

    it('should disable submit for invalid goal', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.setGoal('Hi');
      
      const submitButton = mockContainer.querySelector('.submit-goal-button');
      expect(submitButton.disabled).toBe(true);
    });

    it('should enable submit for valid goal', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.setGoal('Build a complete web application');
      
      const submitButton = mockContainer.querySelector('.submit-goal-button');
      expect(submitButton.disabled).toBe(false);
    });
  });

  describe('Advanced Features', () => {
    it('should support goal templates', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const templates = component.getGoalTemplates();
      expect(templates).toContainEqual(expect.objectContaining({
        name: 'REST API',
        template: expect.stringContaining('REST API')
      }));
    });

    it('should apply goal template', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.applyTemplate('REST API');
      
      const goal = component.getGoal();
      expect(goal).toContain('REST API');
      expect(goal).toContain('endpoints');
    });

    it('should suggest improvements for vague goals', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      const suggestions = component.getSuggestions('Make a website');
      expect(suggestions).toContainEqual(expect.stringContaining('specific features'));
      expect(suggestions).toContainEqual(expect.stringContaining('target audience'));
    });

    it('should auto-detect technologies from goal', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.setGoal('Build a React application with Redux state management');
      const detectedTech = component.detectTechnologies();
      
      expect(detectedTech).toContain('React');
      expect(detectedTech).toContain('Redux');
    });

    it('should estimate complexity from goal', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.setGoal('Create a simple calculator app');
      const estimate = component.estimateComplexity();
      
      expect(estimate.level).toBe('LOW');
      expect(estimate.estimatedTasks).toBeLessThan(10);
    });
  });

  describe('Integration', () => {
    it('should expose API through onMount', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      expect(mockUmbilical.onMount).toHaveBeenCalledWith(
        expect.objectContaining({
          getGoal: expect.any(Function),
          setGoal: expect.any(Function),
          validateGoal: expect.any(Function),
          getContext: expect.any(Function),
          addConstraint: expect.any(Function),
          submit: expect.any(Function)
        })
      );
    });

    it('should clean up on destroy', async () => {
      const { GoalInputInterface } = await import('../../GoalInputInterface.js');
      component = await GoalInputInterface.create(mockUmbilical);

      component.destroy();
      
      expect(mockUmbilical.onDestroy).toHaveBeenCalled();
      expect(mockContainer.innerHTML).toBe('');
    });
  });
});