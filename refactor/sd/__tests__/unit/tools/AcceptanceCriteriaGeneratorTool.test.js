/**
 * Unit tests for AcceptanceCriteriaGeneratorTool
 */

import { jest } from '@jest/globals';

describe('AcceptanceCriteriaGeneratorTool', () => {
  let AcceptanceCriteriaGeneratorTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/requirements/AcceptanceCriteriaGeneratorTool.js');
    AcceptanceCriteriaGeneratorTool = module.AcceptanceCriteriaGeneratorTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn()
      }
    };

    tool = new AcceptanceCriteriaGeneratorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create AcceptanceCriteriaGeneratorTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('generate_acceptance_criteria');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should generate acceptance criteria for user stories', async () => {
      const userStories = [
        {
          id: 'US-001',
          title: 'User Login',
          story: 'As a user, I want to login'
        },
        {
          id: 'US-002',
          title: 'User Logout',
          story: 'As a user, I want to logout'
        }
      ];

      const result = await tool.execute({ userStories });

      expect(result).toHaveProperty('acceptanceCriteria');
      expect(result.acceptanceCriteria).toHaveProperty('US-001');
      expect(result.acceptanceCriteria).toHaveProperty('US-002');
      
      expect(result.acceptanceCriteria['US-001']).toContain('Given the user is authenticated');
      expect(result.acceptanceCriteria['US-001']).toContain('When they perform the action described in US-001');
      expect(result.acceptanceCriteria['US-001']).toContain('Then the expected outcome should occur');
    });

    it('should handle empty user stories', async () => {
      const result = await tool.execute({ userStories: [] });

      expect(result.acceptanceCriteria).toEqual({});
    });

    it('should generate criteria for each story', async () => {
      const userStories = [
        { id: 'US-003', title: 'Feature 1' },
        { id: 'US-004', title: 'Feature 2' },
        { id: 'US-005', title: 'Feature 3' }
      ];

      const result = await tool.execute({ userStories });

      expect(Object.keys(result.acceptanceCriteria)).toHaveLength(3);
      expect(result.acceptanceCriteria).toHaveProperty('US-003');
      expect(result.acceptanceCriteria).toHaveProperty('US-004');
      expect(result.acceptanceCriteria).toHaveProperty('US-005');
    });

    it('should create standard acceptance criteria format', async () => {
      const userStories = [
        { id: 'US-006', title: 'Test Feature' }
      ];

      const result = await tool.execute({ userStories });

      expect(result.acceptanceCriteria['US-006']).toHaveLength(3);
      expect(result.acceptanceCriteria['US-006'][0]).toMatch(/^Given/);
      expect(result.acceptanceCriteria['US-006'][1]).toMatch(/^When/);
      expect(result.acceptanceCriteria['US-006'][2]).toMatch(/^Then/);
    });

    it('should emit progress events', async () => {
      tool.emit = jest.fn();
      
      await tool.execute({
        userStories: [
          { id: 'US-007', title: 'Test' }
        ]
      });

      expect(tool.emit).toHaveBeenCalledWith('progress', 
        expect.objectContaining({ 
          percentage: 0,
          status: 'Generating acceptance criteria...'
        })
      );
      expect(tool.emit).toHaveBeenCalledWith('progress',
        expect.objectContaining({ 
          percentage: 100,
          status: 'Acceptance criteria generated'
        })
      );
    });

    it('should handle story with special characters in ID', async () => {
      const userStories = [
        { id: 'US-008-SPECIAL', title: 'Special Story' }
      ];

      const result = await tool.execute({ userStories });

      expect(result.acceptanceCriteria).toHaveProperty('US-008-SPECIAL');
      expect(result.acceptanceCriteria['US-008-SPECIAL'][1]).toContain('US-008-SPECIAL');
    });
  });
});