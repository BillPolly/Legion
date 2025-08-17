/**
 * Unit tests for PlannerAdapter
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PlannerAdapter } from '../../PlannerAdapter.js';

describe('PlannerAdapter', () => {
  let adapter;
  let mockRealPlanner;

  beforeEach(() => {
    mockRealPlanner = {
      makePlan: jest.fn()
    };
    
    adapter = new PlannerAdapter(mockRealPlanner);
  });

  describe('makePlan', () => {
    it('should return BT directly when planner succeeds', async () => {
      const mockBT = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'test_tool' }
        ]
      };
      
      mockRealPlanner.makePlan.mockResolvedValue({
        success: true,
        data: {
          plan: mockBT,
          attempts: 1,
          nodeCount: 2
        },
        error: null
      });
      
      const result = await adapter.makePlan('Test task', ['tool1'], {});
      
      expect(result).toBe(mockBT);
      expect(mockRealPlanner.makePlan).toHaveBeenCalledWith('Test task', ['tool1'], {});
    });
    
    it('should handle data being the BT directly', async () => {
      const mockBT = {
        type: 'action',
        tool: 'test_tool'
      };
      
      mockRealPlanner.makePlan.mockResolvedValue({
        success: true,
        data: mockBT,
        error: null
      });
      
      const result = await adapter.makePlan('Test task', ['tool1']);
      
      expect(result).toBe(mockBT);
    });
    
    it('should throw error when planner fails', async () => {
      mockRealPlanner.makePlan.mockResolvedValue({
        success: false,
        data: null,
        error: 'Planning failed: No tools available'
      });
      
      await expect(adapter.makePlan('Test task', [])).rejects.toThrow('Planning failed: No tools available');
    });
    
    it('should throw error when no BT is generated', async () => {
      mockRealPlanner.makePlan.mockResolvedValue({
        success: true,
        data: null,
        error: null
      });
      
      await expect(adapter.makePlan('Test task', ['tool1'])).rejects.toThrow('No behavior tree generated');
    });
    
    it('should throw generic error when planner fails without message', async () => {
      mockRealPlanner.makePlan.mockResolvedValue({
        success: false,
        data: null,
        error: null
      });
      
      await expect(adapter.makePlan('Test task', ['tool1'])).rejects.toThrow('Plan generation failed');
    });
    
    it('should pass through all parameters to real planner', async () => {
      mockRealPlanner.makePlan.mockResolvedValue({
        success: true,
        data: { plan: { type: 'action' } }
      });
      
      const tools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ];
      
      const options = {
        context: { key: 'value' },
        maxRetries: 3
      };
      
      await adapter.makePlan('Complex task', tools, options);
      
      expect(mockRealPlanner.makePlan).toHaveBeenCalledWith(
        'Complex task',
        tools,
        options
      );
    });
  });
});