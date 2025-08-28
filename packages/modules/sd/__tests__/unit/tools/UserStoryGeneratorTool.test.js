/**
 * Unit tests for UserStoryGeneratorTool
 */

import { jest } from '@jest/globals';

describe('UserStoryGeneratorTool', () => {
  let UserStoryGeneratorTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/requirements/UserStoryGeneratorTool.js');
    UserStoryGeneratorTool = module.UserStoryGeneratorTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn()
      },
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ 
          id: 'story-artifact-123'
        })
      }
    };

    tool = new UserStoryGeneratorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create UserStoryGeneratorTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('generate_user_stories');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
      expect(tool.designDatabase).toBe(mockDependencies.designDatabase);
    });
  });

  describe('execute', () => {
    it('should generate user stories from functional requirements', async () => {
      const result = await tool.execute({
        parsedRequirements: {
          functional: [
            { id: 'FR001', description: 'User authentication system', priority: 'high' },
            { id: 'FR002', description: 'Password reset functionality', priority: 'medium' }
          ]
        },
        projectId: 'proj-123'
      });

      expect(result).toHaveProperty('userStories');
      expect(result.userStories).toHaveLength(2);
      expect(result).toHaveProperty('count', 2);
      
      expect(result.userStories[0]).toHaveProperty('id', 'US-001');
      expect(result.userStories[0]).toHaveProperty('title', 'User authentication system');
      expect(result.userStories[0]).toHaveProperty('requirementId', 'FR001');
      expect(result.userStories[0]).toHaveProperty('priority', 'high');
      
      expect(result.userStories[1]).toHaveProperty('id', 'US-002');
      expect(result.userStories[1]).toHaveProperty('requirementId', 'FR002');
    });

    it('should handle empty functional requirements', async () => {
      const result = await tool.execute({
        parsedRequirements: {
          functional: []
        }
      });

      expect(result.userStories).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should use default priority when not specified', async () => {
      const result = await tool.execute({
        parsedRequirements: {
          functional: [
            { id: 'FR003', description: 'Test feature' }
          ]
        }
      });

      expect(result.userStories[0].priority).toBe('medium');
    });

    it('should handle long descriptions', async () => {
      const longDescription = 'A'.repeat(100);
      const result = await tool.execute({
        parsedRequirements: {
          functional: [
            { id: 'FR004', description: longDescription }
          ]
        }
      });

      expect(result.userStories[0].title).toHaveLength(50);
    });

    it('should emit progress events', async () => {
      tool.emit = jest.fn();
      
      await tool.execute({
        parsedRequirements: {
          functional: [
            { id: 'FR005', description: 'Test' }
          ]
        }
      });

      expect(tool.emit).toHaveBeenCalledWith('progress', 
        expect.objectContaining({ 
          percentage: 0,
          status: 'Generating user stories...'
        })
      );
      expect(tool.emit).toHaveBeenCalledWith('progress',
        expect.objectContaining({ 
          percentage: 100,
          status: 'User stories generated'
        })
      );
    });
  });
});