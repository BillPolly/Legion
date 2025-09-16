/**
 * Test suite for TaskQueue
 * Tests backpressure management, concurrency control, retries, and event emissions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskQueue } from '../../../src/core/TaskQueue.js';

describe('TaskQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new TaskQueue({
      concurrency: 2,
      timeout: 1000,
      retryLimit: 2,
      retryDelay: 100
    });
  });

  afterEach(async () => {
    // Ensure all tasks are done before cleanup
    queue.pause();
    queue.clear();
    await new Promise(resolve => setImmediate(resolve));
    queue.cleanup();
  });

  describe('Task Addition and Execution', () => {
    it('should add and execute tasks', async () => {
      let executed = false;
      const task = async () => {
        executed = true;
        return 'result';
      };

      const result = await queue.add(task);
      expect(result).toBe('result');
      expect(executed).toBe(true);
    });

    it('should handle task metadata', async () => {
      const task = async () => 'result';
      const metadata = {
        id: 'custom-id',
        priority: 10,
        timeout: 500
      };

      const promise = queue.add(task, metadata);
      expect(queue.getStatus().queue.some(t => t.id === 'custom-id')).toBe(false); // Should be running immediately
      
      const result = await promise;
      expect(result).toBe('result');
    });

    it('should reject non-function tasks', async () => {
      await expect(queue.add('not a function')).rejects.toThrow('Task must be a function');
      await expect(queue.add(123)).rejects.toThrow('Task must be a function');
    });

    it('should handle async tasks', async () => {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'delayed result';
      };

      const result = await queue.add(task);
      expect(result).toBe('delayed result');
    });

    it('should handle task errors', async () => {
      const task = async () => {
        throw new Error('Task failed');
      };

      await expect(queue.add(task)).rejects.toThrow('Task failed');
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limit', async () => {
      let running = 0;
      let maxRunning = 0;

      const createTask = (id) => async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(resolve => setTimeout(resolve, 100));
        running--;
        return id;
      };

      // Add 5 tasks with concurrency of 2
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(queue.add(createTask(i)));
      }

      await Promise.all(promises);
      expect(maxRunning).toBeLessThanOrEqual(2);
    });

    it('should process tasks in priority order', async () => {
      const results = [];
      const createTask = (id) => async () => {
        results.push(id);
        return id;
      };

      // Pause queue to accumulate tasks
      queue.pause();

      // Add tasks with different priorities
      queue.add(createTask('low'), { priority: 1 });
      queue.add(createTask('high'), { priority: 10 });
      queue.add(createTask('medium'), { priority: 5 });
      queue.add(createTask('normal'), { priority: 0 });

      // Resume and wait for completion
      queue.resume();
      await queue.waitForAll();

      // High priority should execute first
      expect(results[0]).toBe('high');
      expect(results[1]).toBe('medium');
    });

    it('should dynamically adjust concurrency', async () => {
      let running = 0;
      let maxRunning = 0;

      const createTask = () => async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(resolve => setTimeout(resolve, 100));
        running--;
      };

      // Start with concurrency of 2
      for (let i = 0; i < 4; i++) {
        queue.add(createTask());
      }

      // Increase concurrency
      queue.setConcurrency(4);

      await queue.waitForAll();
      expect(maxRunning).toBeGreaterThan(2);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed tasks', async () => {
      let attempts = 0;
      const task = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await queue.add(task);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;
      const task = async () => {
        attempts++;
        throw new Error('Persistent failure');
      };

      await expect(queue.add(task)).rejects.toThrow('Persistent failure');
      expect(attempts).toBe(3); // Initial + 2 retries (retryLimit = 2, so maxAttempts = 3)
    });

    it('should apply exponential backoff', async () => {
      const timestamps = [];
      const task = async () => {
        timestamps.push(Date.now());
        if (timestamps.length < 3) {
          throw new Error('Retry me');
        }
        return 'success';
      };

      await queue.add(task);
      
      // Check that delays increase
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should respect custom retry limit', async () => {
      let attempts = 0;
      const task = async () => {
        attempts++;
        throw new Error('Always fails');
      };

      await expect(queue.add(task, { retryLimit: 1 })).rejects.toThrow('Always fails');
      expect(attempts).toBe(2); // Initial + 1 retry (retryLimit = 1, so maxAttempts = 2)
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running tasks', async () => {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'should not reach here';
      };

      await expect(queue.add(task)).rejects.toThrow('Task timeout after 1000ms');
    });

    it('should respect custom timeout', async () => {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return 'completed';
      };

      const result = await queue.add(task, { timeout: 200 });
      expect(result).toBe('completed');
    });

    it('should handle tasks with no timeout', async () => {
      const queueNoTimeout = new TaskQueue({ timeout: 0 });
      
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'completed';
      };

      const result = await queueNoTimeout.add(task);
      expect(result).toBe('completed');
      
      queueNoTimeout.cleanup();
    });
  });

  describe('Queue Control', () => {
    it('should pause and resume processing', async () => {
      const results = [];
      const createTask = (id) => async () => {
        results.push(id);
        return id;
      };

      queue.pause();
      
      // Add tasks while paused
      queue.add(createTask(1));
      queue.add(createTask(2));
      queue.add(createTask(3));

      // Verify no tasks have executed
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(results.length).toBe(0);

      // Resume and wait
      queue.resume();
      await queue.waitForAll();

      expect(results.length).toBe(3);
    });

    it('should drain the queue', async () => {
      let count = 0;
      const task = async () => {
        count++;
        await new Promise(resolve => setTimeout(resolve, 50));
      };

      // Add initial tasks
      queue.add(task);
      queue.add(task);

      // Start draining
      const drainPromise = queue.drain();

      // Should not accept new tasks
      await expect(queue.add(task)).rejects.toThrow('Queue is draining');

      await drainPromise;
      expect(count).toBe(2);
    });

    it('should clear the queue', () => {
      const task = async () => 'result';

      queue.pause();
      // Catch the rejections from cleared tasks
      queue.add(task).catch(() => {});
      queue.add(task).catch(() => {});
      queue.add(task).catch(() => {});

      const cleared = queue.clear();
      expect(cleared).toBe(3);
      expect(queue.getStatus().queue.length).toBe(0);
    });

    it('should cancel specific tasks', async () => {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'completed';
      };

      queue.pause();
      const promise = queue.add(task, { id: 'cancelable' });

      const cancelled = queue.cancel('cancelable');
      expect(cancelled).toBe(true);

      await expect(promise).rejects.toThrow('Task cancelled');
    });
  });

  describe('Event Emissions', () => {
    it('should emit queued event', (done) => {
      queue.once('queued', (event) => {
        expect(event.taskId).toBeDefined();
        expect(event.queueLength).toBeGreaterThan(0);
        done();
      });

      queue.add(async () => 'result');
    });

    it('should emit started event', (done) => {
      queue.once('started', (event) => {
        expect(event.taskId).toBeDefined();
        expect(event.attempts).toBe(1);
        done();
      });

      queue.add(async () => 'result');
    });

    it('should emit completed event', async () => {
      const completedPromise = new Promise(resolve => {
        queue.once('completed', (event) => {
          expect(event.result).toBe('result');
          expect(event.duration).toBeGreaterThan(0);
          resolve();
        });
      });

      // Add a small delay to ensure the task has some execution time
      queue.add(async () => {
        await new Promise(r => setTimeout(r, 10));
        return 'result';
      });
      
      await completedPromise;
    });

    it('should emit failed event', async () => {
      const failedPromise = new Promise(resolve => {
        queue.once('failed', (event) => {
          expect(event.error).toBe('Task error');
          expect(event.attempts).toBe(3);
          resolve();
        });
      });

      queue.add(async () => {
        throw new Error('Task error');
      }).catch(() => {}); // Ignore rejection
      
      await failedPromise;
    });

    it('should emit retrying event', (done) => {
      let retryEmitted = false;
      
      queue.once('retrying', (event) => {
        expect(event.attempts).toBe(1);
        expect(event.maxAttempts).toBe(3); // retryLimit=2 means maxAttempts=3
        retryEmitted = true;
      });

      let attempts = 0;
      queue.add(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Retry me');
        }
        expect(retryEmitted).toBe(true);
        done();
      });
    });

    it('should emit idle event', (done) => {
      queue.once('idle', () => {
        expect(queue.getStatus().running.length).toBe(0);
        expect(queue.getStatus().queue.length).toBe(0);
        done();
      });

      queue.add(async () => 'result');
    });

    it('should emit drained event', (done) => {
      queue.once('drained', () => {
        expect(queue.draining).toBe(true);
        done();
      });

      queue.add(async () => 'result');
      queue.drain();
    });
  });

  describe('Statistics', () => {
    it('should track queue statistics', async () => {
      const successTask = async () => 'success';
      const failTask = async () => {
        throw new Error('fail');
      };

      await queue.add(successTask);
      await queue.add(failTask).catch(() => {});

      const stats = queue.getStats();
      expect(stats.totalAdded).toBe(2);
      expect(stats.totalCompleted).toBe(1);
      expect(stats.totalFailed).toBe(1);
      expect(stats.successRate).toBeCloseTo(50, 0);
    });

    it('should calculate average duration', async () => {
      const task1 = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result1';
      };
      const task2 = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result2';
      };

      await queue.add(task1);
      await queue.add(task2);

      const stats = queue.getStats();
      expect(stats.averageDuration).toBeGreaterThan(50);
      expect(stats.averageDuration).toBeLessThan(150);
    });

    it('should provide detailed status', async () => {
      queue.pause();

      const task = async () => 'result';
      queue.add(task, { id: 'task1', priority: 5 });
      queue.add(task, { id: 'task2', priority: 10 });

      const status = queue.getStatus();
      expect(status.queue.length).toBe(2);
      expect(status.queue[0].id).toBe('task2'); // Higher priority
      expect(status.running.length).toBe(0);
      expect(status.stats.paused).toBe(true);

      queue.resume();
    });
  });

  describe('Wait Operations', () => {
    it('should wait for all tasks', async () => {
      const results = [];
      const createTask = (id) => async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        results.push(id);
        return id;
      };

      queue.add(createTask(1));
      queue.add(createTask(2));
      queue.add(createTask(3));

      await queue.waitForAll();
      expect(results.length).toBe(3);
    });

    it('should wait for specific task', async () => {
      const task1 = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result1';
      };
      const task2 = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result2';
      };

      queue.add(task1, { id: 'task1' });
      queue.add(task2, { id: 'task2' });

      const result = await queue.waitForTask('task2');
      expect(result).toBe('result2');
    });

    it('should handle waiting for failed task', async () => {
      const task = async () => {
        throw new Error('Task failed');
      };

      queue.add(task, { id: 'failing-task' }).catch(() => {});

      await expect(queue.waitForTask('failing-task')).rejects.toThrow('Task failed');
    });

    it('should return immediately for completed task', async () => {
      const task = async () => 'result';
      
      await queue.add(task, { id: 'completed-task' });
      
      const result = await queue.waitForTask('completed-task');
      expect(result).toBe('result');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue operations', async () => {
      await queue.waitForAll(); // Should return immediately
      expect(queue.clear()).toBe(0);
      expect(queue.cancel('non-existent')).toBe(false);
    });

    it('should handle rapid pause/resume', async () => {
      const task = async () => 'result';
      
      queue.pause();
      queue.resume();
      queue.pause();
      queue.resume();

      const result = await queue.add(task);
      expect(result).toBe('result');
    });

    it('should handle concurrent additions', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(queue.add(async () => i));
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      expect(new Set(results).size).toBe(10); // All unique
    });

    it('should cleanup properly', () => {
      queue.add(async () => 'result');
      queue.cleanup();

      expect(queue.queue.length).toBe(0);
      expect(queue.running.size).toBe(0);
      expect(queue.completed.size).toBe(0);
      expect(queue.failed.size).toBe(0);
      expect(queue.stats.totalAdded).toBe(0);
    });
  });
});