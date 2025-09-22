import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonitoringStrategy from '../../../../src/strategies/coding/MonitoringStrategy.js';

describe('MonitoringStrategy', () => {
  let monitoringStrategy;
  let mockProject;

  beforeEach(() => {
    monitoringStrategy = new MonitoringStrategy();
    
    // Mock project structure with phases and tasks
    mockProject = {
      projectId: 'test-project-123',
      phases: [
        {
          id: 'setup',
          name: 'Setup',
          status: 'completed',
          tasks: ['task-1', 'task-2'],
          startedAt: '2024-01-01T10:00:00Z',
          completedAt: '2024-01-01T10:15:00Z'
        },
        {
          id: 'core',
          name: 'Core',
          status: 'active',
          tasks: ['task-3', 'task-4', 'task-5'],
          startedAt: '2024-01-01T10:15:00Z',
          completedAt: null
        },
        {
          id: 'features',
          name: 'Features',
          status: 'pending',
          tasks: ['task-6'],
          startedAt: null,
          completedAt: null
        }
      ],
      tasks: [
        {
          id: 'task-1',
          type: 'generate',
          status: 'completed',
          description: 'Create package.json',
          startedAt: '2024-01-01T10:00:00Z',
          completedAt: '2024-01-01T10:05:00Z'
        },
        {
          id: 'task-2',
          type: 'generate',
          status: 'completed',
          description: 'Setup project structure',
          startedAt: '2024-01-01T10:05:00Z',
          completedAt: '2024-01-01T10:15:00Z'
        },
        {
          id: 'task-3',
          type: 'generate',
          status: 'completed',
          description: 'Generate server code',
          startedAt: '2024-01-01T10:15:00Z',
          completedAt: '2024-01-01T10:30:00Z'
        },
        {
          id: 'task-4',
          type: 'test',
          status: 'running',
          description: 'Run unit tests',
          startedAt: '2024-01-01T10:30:00Z',
          completedAt: null
        },
        {
          id: 'task-5',
          type: 'validate',
          status: 'pending',
          description: 'Validate endpoints',
          startedAt: null,
          completedAt: null
        },
        {
          id: 'task-6',
          type: 'generate',
          status: 'pending',
          description: 'Add authentication',
          startedAt: null,
          completedAt: null
        }
      ],
      createdAt: '2024-01-01T10:00:00Z'
    };
  });

  describe('Initialization', () => {
    it('should create a ProgressTracker instance', () => {
      expect(tracker).toBeInstanceOf(ProgressTracker);
    });

    it('should initialize with empty metrics', () => {
      const metrics = monitoringStrategy.getMetrics();
      expect(metrics).toEqual({
        overall: 0,
        byPhase: {},
        tasks: {
          total: 0,
          completed: 0,
          running: 0,
          pending: 0,
          failed: 0
        },
        timing: {
          estimatedCompletion: null,
          averageTaskDuration: null,
          totalElapsed: null
        },
        bottlenecks: []
      });
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate overall progress percentage', () => {
      const progress = monitoringStrategy.calculateProgress(mockProject);
      
      // 3 of 6 tasks completed = 50%
      expect(progress.overall).toBe(50);
    });

    it('should calculate progress by phase', () => {
      const progress = monitoringStrategy.calculateProgress(mockProject);
      
      expect(progress.byPhase).toEqual({
        setup: 100,    // 2/2 tasks completed
        core: 33.33,   // 1/3 tasks completed (task-3 done, task-4 running, task-5 pending)
        features: 0    // 0/1 tasks completed
      });
    });

    it('should handle empty project', () => {
      const emptyProject = {
        projectId: 'empty',
        phases: [],
        tasks: []
      };
      
      const progress = monitoringStrategy.calculateProgress(emptyProject);
      expect(progress.overall).toBe(0);
      expect(progress.byPhase).toEqual({});
    });

    it('should handle project with no tasks', () => {
      const noTasksProject = {
        projectId: 'no-tasks',
        phases: [
          { id: 'setup', name: 'Setup', status: 'pending', tasks: [] }
        ],
        tasks: []
      };
      
      const progress = monitoringStrategy.calculateProgress(noTasksProject);
      expect(progress.overall).toBe(0);
      expect(progress.byPhase).toEqual({ setup: 0 });
    });
  });

  describe('Task Status Tracking', () => {
    it('should count tasks by status', () => {
      const taskStats = monitoringStrategy.getTaskStats(mockProject);
      
      expect(taskStats).toEqual({
        total: 6,
        completed: 3,
        running: 1,
        pending: 2,
        failed: 0
      });
    });

    it('should track task status changes', () => {
      monitoringStrategy.updateProject(mockProject);
      
      // Simulate task completion
      mockProject.tasks[3].status = 'completed';
      mockProject.tasks[3].completedAt = '2024-01-01T10:45:00Z';
      
      monitoringStrategy.updateProject(mockProject);
      const taskStats = monitoringStrategy.getTaskStats(mockProject);
      
      expect(taskStats.completed).toBe(4);
      expect(taskStats.running).toBe(0);
    });

    it('should handle failed tasks', () => {
      mockProject.tasks[3].status = 'failed';
      mockProject.tasks[3].lastError = 'Unit test failure';
      
      const taskStats = monitoringStrategy.getTaskStats(mockProject);
      expect(taskStats.failed).toBe(1);
      expect(taskStats.running).toBe(0);
    });
  });

  describe('Time Tracking', () => {
    it('should calculate average task duration', () => {
      const timing = monitoringStrategy.calculateTiming(mockProject);
      
      // Task 1: 5 minutes, Task 2: 10 minutes, Task 3: 15 minutes
      // Average: (5 + 10 + 15) / 3 = 10 minutes
      expect(timing.averageTaskDuration).toBe(10 * 60 * 1000); // 10 minutes in milliseconds
    });

    it('should calculate total elapsed time', () => {
      const timing = monitoringStrategy.calculateTiming(mockProject);
      
      // From project start to latest completion: 30 minutes
      expect(timing.totalElapsed).toBe(30 * 60 * 1000); // 30 minutes in milliseconds
    });

    it('should estimate completion time', () => {
      // 3 tasks remaining, 10 minutes average = 30 minutes from now
      const now = new Date('2024-01-01T10:30:00Z').getTime();
      const timing = monitoringStrategy.calculateTiming(mockProject, now);
      const expected = now + (3 * 10 * 60 * 1000);
      
      expect(timing.estimatedCompletion).toBe(expected);
    });

    it('should handle project with no completed tasks', () => {
      const pendingProject = {
        ...mockProject,
        tasks: mockProject.tasks.map(task => ({
          ...task,
          status: 'pending',
          completedAt: null
        }))
      };
      
      const timing = monitoringStrategy.calculateTiming(pendingProject);
      expect(timing.averageTaskDuration).toBeNull();
      expect(timing.estimatedCompletion).toBeNull();
    });
  });

  describe('Bottleneck Detection', () => {
    it('should identify slow-running tasks as bottlenecks', () => {
      // Set current time to simulate long-running task
      const mockNow = new Date('2024-01-01T11:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);
      
      const bottlenecks = monitoringStrategy.identifyBottlenecks(mockProject);
      
      // Task-4 has been running for 30 minutes, should be flagged
      expect(bottlenecks).toContainEqual({
        taskId: 'task-4',
        type: 'slow_task',
        description: 'Run unit tests',
        duration: 30 * 60 * 1000, // 30 minutes
        impact: 'high'
      });
      
      jest.restoreAllMocks();
    });

    it('should identify blocked phases as bottlenecks', () => {
      // Mock a phase with all tasks pending (blocked)
      const blockedProject = {
        ...mockProject,
        phases: [
          ...mockProject.phases,
          {
            id: 'blocked-phase',
            name: 'Blocked Phase',
            status: 'pending',
            tasks: ['blocked-task-1', 'blocked-task-2'],
            startedAt: null,
            completedAt: null
          }
        ],
        tasks: [
          ...mockProject.tasks,
          {
            id: 'blocked-task-1',
            type: 'generate',
            status: 'pending',
            description: 'Blocked task 1',
            dependencies: ['missing-dependency']
          }
        ]
      };
      
      const bottlenecks = monitoringStrategy.identifyBottlenecks(blockedProject);
      
      expect(bottlenecks).toContainEqual(
        expect.objectContaining({
          taskId: 'blocked-task-1',
          type: 'blocked_dependency',
          impact: 'high'
        })
      );
    });

    it('should return empty array when no bottlenecks exist', () => {
      // Create project with all tasks completing quickly
      const fastProject = {
        ...mockProject,
        tasks: mockProject.tasks.map(task => ({
          ...task,
          status: 'completed',
          startedAt: '2024-01-01T10:00:00Z',
          completedAt: '2024-01-01T10:01:00Z' // 1 minute tasks
        }))
      };
      
      const bottlenecks = monitoringStrategy.identifyBottlenecks(fastProject);
      expect(bottlenecks).toEqual([]);
    });
  });

  describe('Status Reporting', () => {
    it('should generate comprehensive status report', () => {
      const report = monitoringStrategy.generateReport(mockProject);
      
      expect(report).toMatchObject({
        projectId: 'test-project-123',
        timestamp: expect.any(Number),
        progress: {
          overall: 50,
          byPhase: {
            setup: 100,
            core: 33.33,
            features: 0
          }
        },
        tasks: {
          total: 6,
          completed: 3,
          running: 1,
          pending: 2,
          failed: 0
        },
        timing: {
          averageTaskDuration: expect.any(Number),
          totalElapsed: expect.any(Number),
          estimatedCompletion: expect.any(Number)
        },
        bottlenecks: expect.any(Array),
        phases: expect.any(Array)
      });
    });

    it('should include phase details in report', () => {
      const report = monitoringStrategy.generateReport(mockProject);
      
      expect(report.phases).toHaveLength(3);
      expect(report.phases[0]).toMatchObject({
        id: 'setup',
        name: 'Setup',
        status: 'completed',
        progress: 100,
        taskCount: 2
      });
    });

    it('should mark report as completed when project is done', () => {
      const completedProject = {
        ...mockProject,
        status: 'completed',
        phases: mockProject.phases.map(phase => ({
          ...phase,
          status: 'completed'
        })),
        tasks: mockProject.tasks.map(task => ({
          ...task,
          status: 'completed',
          completedAt: '2024-01-01T11:00:00Z'
        }))
      };
      
      const report = monitoringStrategy.generateReport(completedProject);
      expect(report.progress.overall).toBe(100);
      expect(report.status).toBe('completed');
    });
  });

  describe('Update and Monitoring', () => {
    it('should track progress updates over time', () => {
      // Initial update
      monitoringStrategy.updateProject(mockProject);
      const initialMetrics = monitoringStrategy.getMetrics();
      
      // Complete another task
      mockProject.tasks[4].status = 'completed';
      mockProject.tasks[4].completedAt = '2024-01-01T10:45:00Z';
      
      monitoringStrategy.updateProject(mockProject);
      const updatedMetrics = monitoringStrategy.getMetrics();
      
      expect(updatedMetrics.overall).toBeGreaterThan(initialMetrics.overall);
      expect(updatedMetrics.tasks.completed).toBe(4);
    });

    it('should maintain history of progress updates', () => {
      monitoringStrategy.updateProject(mockProject);
      
      // Make changes
      mockProject.tasks[3].status = 'completed';
      mockProject.tasks[3].completedAt = '2024-01-01T10:45:00Z';
      
      monitoringStrategy.updateProject(mockProject);
      
      const history = monitoringStrategy.getProgressHistory();
      expect(history).toHaveLength(2);
      expect(history[0].overall).toBeLessThan(history[1].overall);
    });

    it('should handle real-time updates', () => {
      const callback = jest.fn();
      monitoringStrategy.onProgressUpdate(callback);
      
      monitoringStrategy.updateProject(mockProject);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          overall: 50,
          byPhase: expect.any(Object)
        })
      );
    });
  });

  describe('Resource Usage Tracking', () => {
    it('should track task resource consumption', () => {
      const resourceData = {
        memory: 512,
        cpu: 45,
        duration: 15000
      };
      
      monitoringStrategy.recordResourceUsage('task-3', resourceData);
      const usage = monitoringStrategy.getResourceUsage();
      
      expect(usage.byTask['task-3']).toEqual(resourceData);
      expect(usage.total.memory).toBe(512);
      expect(usage.average.cpu).toBe(45);
    });

    it('should identify resource-intensive tasks', () => {
      monitoringStrategy.recordResourceUsage('task-1', { memory: 100, cpu: 20, duration: 5000 });
      monitoringStrategy.recordResourceUsage('task-2', { memory: 800, cpu: 90, duration: 25000 });
      monitoringStrategy.recordResourceUsage('task-3', { memory: 200, cpu: 30, duration: 8000 });
      
      const intensive = monitoringStrategy.getResourceIntensiveTasks();
      
      expect(intensive).toContainEqual(
        expect.objectContaining({
          taskId: 'task-2',
          reason: 'high_memory',
          value: 800
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed project data gracefully', () => {
      const malformedProject = {
        projectId: 'malformed',
        phases: null,
        tasks: undefined
      };
      
      expect(() => {
        monitoringStrategy.calculateProgress(malformedProject);
      }).not.toThrow();
      
      const progress = monitoringStrategy.calculateProgress(malformedProject);
      expect(progress.overall).toBe(0);
    });

    it('should handle tasks without timing data', () => {
      const noTimingProject = {
        ...mockProject,
        tasks: mockProject.tasks.map(task => ({
          ...task,
          startedAt: null,
          completedAt: null
        }))
      };
      
      const timing = monitoringStrategy.calculateTiming(noTimingProject);
      expect(timing.averageTaskDuration).toBeNull();
      expect(timing.totalElapsed).toBeNull();
    });

    it('should validate project data structure', () => {
      expect(() => {
        monitoringStrategy.updateProject(null);
      }).toThrow('Project data is required');
      
      expect(() => {
        monitoringStrategy.updateProject({});
      }).toThrow('Project must have a projectId');
    });
  });
});