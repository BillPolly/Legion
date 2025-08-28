/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { BuildScripts } from '../../../src/build/BuildScripts.js';

describe('Build Scripts', () => {
  let buildScripts;
  
  beforeEach(() => {
    buildScripts = new BuildScripts();
    jest.clearAllMocks();
  });

  describe('Script Management', () => {
    test('should register build scripts', () => {
      const scriptName = 'build:extension';
      const scriptFunc = async () => ({ success: true });
      
      buildScripts.registerScript(scriptName, scriptFunc);
      
      expect(buildScripts.hasScript(scriptName)).toBe(true);
      expect(buildScripts.getScriptNames()).toContain(scriptName);
    });

    test('should validate script names', () => {
      expect(() => {
        buildScripts.registerScript('', () => {});
      }).toThrow('Script name is required');

      expect(() => {
        buildScripts.registerScript('invalid script name', () => {});
      }).toThrow('Invalid script name format');
    });

    test('should prevent duplicate script registration', () => {
      const scriptName = 'build:test';
      buildScripts.registerScript(scriptName, () => {});
      
      expect(() => {
        buildScripts.registerScript(scriptName, () => {});
      }).toThrow(`Script already exists: ${scriptName}`);
    });
  });

  describe('Build Pipeline', () => {
    test('should execute build pipeline in correct order', async () => {
      const executionOrder = [];
      
      buildScripts.registerScript('build:clean', async () => {
        executionOrder.push('clean');
        return { success: true };
      });
      
      buildScripts.registerScript('build:compile', async () => {
        executionOrder.push('compile');
        return { success: true };
      });
      
      buildScripts.registerScript('build:package', async () => {
        executionOrder.push('package');
        return { success: true };
      });
      
      const pipeline = ['build:clean', 'build:compile', 'build:package'];
      const result = await buildScripts.runPipeline(pipeline);
      
      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['clean', 'compile', 'package']);
    });

    test('should stop pipeline on failure', async () => {
      buildScripts.registerScript('build:step1', async () => {
        return { success: true };
      });
      
      buildScripts.registerScript('build:step2', async () => {
        throw new Error('Build failed');
      });
      
      buildScripts.registerScript('build:step3', async () => {
        return { success: true };
      });
      
      const pipeline = ['build:step1', 'build:step2', 'build:step3'];
      
      await expect(buildScripts.runPipeline(pipeline)).rejects.toThrow('Pipeline failed at step build:step2');
    });

    test('should continue pipeline on failure when configured', async () => {
      buildScripts.registerScript('build:step1', async () => {
        return { success: true };
      });
      
      buildScripts.registerScript('build:step2', async () => {
        throw new Error('Non-critical error');
      });
      
      buildScripts.registerScript('build:step3', async () => {
        return { success: true };
      });
      
      const pipeline = ['build:step1', 'build:step2', 'build:step3'];
      const result = await buildScripts.runPipeline(pipeline, { continueOnError: true });
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.completed).toContain('build:step1');
      expect(result.completed).toContain('build:step3');
    });
  });

  describe('Pre-built Scripts', () => {
    test('should have clean script', async () => {
      expect(buildScripts.hasScript('clean')).toBe(true);
      
      const result = await buildScripts.runScript('clean', { outputDir: '/tmp/build' });
      expect(result.success).toBe(true);
    });

    test('should have build script', async () => {
      expect(buildScripts.hasScript('build')).toBe(true);
      
      const result = await buildScripts.runScript('build', {
        sourceDir: '/src',
        outputDir: '/build'
      });
      expect(result.success).toBe(true);
    });

    test('should have test script', async () => {
      expect(buildScripts.hasScript('test')).toBe(true);
      
      const result = await buildScripts.runScript('test');
      expect(result.success).toBe(true);
    });

    test('should have package script', async () => {
      expect(buildScripts.hasScript('package')).toBe(true);
      
      const result = await buildScripts.runScript('package', {
        inputDir: '/build',
        outputFile: '/dist/extension.zip'
      });
      expect(result.success).toBe(true);
    });

    test('should have deploy script', async () => {
      expect(buildScripts.hasScript('deploy')).toBe(true);
      
      const result = await buildScripts.runScript('deploy', {
        packagePath: '/dist/extension.zip',
        environment: 'staging'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Script Configuration', () => {
    test('should load configuration from file', () => {
      const config = {
        scripts: {
          'custom:build': {
            command: 'npm run build',
            description: 'Custom build script'
          }
        },
        pipelines: {
          'full-build': ['clean', 'build', 'test', 'package']
        }
      };
      
      buildScripts.loadConfiguration(config);
      
      expect(buildScripts.hasScript('custom:build')).toBe(true);
      expect(buildScripts.hasPipeline('full-build')).toBe(true);
    });

    test('should validate configuration', () => {
      const invalidConfig = {
        scripts: {
          '': {
            command: 'test'
          }
        }
      };
      
      expect(() => {
        buildScripts.loadConfiguration(invalidConfig);
      }).toThrow('Invalid script configuration');
    });

    test('should merge configurations', () => {
      const config1 = {
        scripts: {
          'script1': { command: 'cmd1' }
        }
      };
      
      const config2 = {
        scripts: {
          'script2': { command: 'cmd2' }
        }
      };
      
      buildScripts.loadConfiguration(config1);
      buildScripts.loadConfiguration(config2);
      
      expect(buildScripts.hasScript('script1')).toBe(true);
      expect(buildScripts.hasScript('script2')).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    test('should substitute environment variables in commands', async () => {
      process.env.BUILD_OUTPUT = '/custom/output';
      
      buildScripts.registerScript('test:env', async (options) => {
        const outputDir = buildScripts.resolveEnvironmentVariables('${BUILD_OUTPUT}/dist');
        return { success: true, outputDir };
      });
      
      const result = await buildScripts.runScript('test:env');
      expect(result.outputDir).toBe('/custom/output/dist');
      
      delete process.env.BUILD_OUTPUT;
    });

    test('should provide default values for missing variables', async () => {
      const resolved = buildScripts.resolveEnvironmentVariables('${MISSING_VAR:default-value}');
      expect(resolved).toBe('default-value');
    });

    test('should handle nested variable substitution', async () => {
      process.env.BASE_PATH = '/home/user';
      process.env.PROJECT_NAME = 'cerebrate';
      
      const resolved = buildScripts.resolveEnvironmentVariables('${BASE_PATH}/${PROJECT_NAME}/build');
      expect(resolved).toBe('/home/user/cerebrate/build');
      
      delete process.env.BASE_PATH;
      delete process.env.PROJECT_NAME;
    });
  });

  describe('Parallel Execution', () => {
    test('should run scripts in parallel when specified', async () => {
      const startTimes = {};
      const endTimes = {};
      
      buildScripts.registerScript('parallel:1', async () => {
        startTimes.script1 = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        endTimes.script1 = Date.now();
        return { success: true };
      });
      
      buildScripts.registerScript('parallel:2', async () => {
        startTimes.script2 = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        endTimes.script2 = Date.now();
        return { success: true };
      });
      
      const result = await buildScripts.runParallel(['parallel:1', 'parallel:2']);
      
      expect(result.success).toBe(true);
      expect(Math.abs(startTimes.script1 - startTimes.script2)).toBeLessThan(10);
    });

    test('should handle parallel execution failures', async () => {
      buildScripts.registerScript('parallel:success', async () => {
        return { success: true };
      });
      
      buildScripts.registerScript('parallel:fail', async () => {
        throw new Error('Parallel script failed');
      });
      
      const result = await buildScripts.runParallel(['parallel:success', 'parallel:fail']);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Script Hooks', () => {
    test('should support before and after hooks', async () => {
      const executionOrder = [];
      
      buildScripts.registerHook('before:build:main', async () => {
        executionOrder.push('before');
      });
      
      buildScripts.registerHook('after:build:main', async () => {
        executionOrder.push('after');
      });
      
      buildScripts.registerScript('build:main', async () => {
        executionOrder.push('main');
        return { success: true };
      });
      
      await buildScripts.runScript('build:main');
      
      expect(executionOrder).toEqual(['before', 'main', 'after']);
    });

    test('should skip main script if before hook fails', async () => {
      const executionOrder = [];
      
      buildScripts.registerHook('before:test:main', async () => {
        executionOrder.push('before');
        throw new Error('Before hook failed');
      });
      
      buildScripts.registerScript('test:main', async () => {
        executionOrder.push('main');
        return { success: true };
      });
      
      await expect(buildScripts.runScript('test:main')).rejects.toThrow('Before hook failed');
      expect(executionOrder).toEqual(['before']);
    });
  });

  describe('Progress Reporting', () => {
    test('should report progress during pipeline execution', async () => {
      const progressEvents = [];
      
      buildScripts.onProgress((event) => {
        progressEvents.push(event);
      });
      
      buildScripts.registerScript('progress:1', async () => {
        return { success: true };
      });
      
      buildScripts.registerScript('progress:2', async () => {
        return { success: true };
      });
      
      await buildScripts.runPipeline(['progress:1', 'progress:2']);
      
      expect(progressEvents).toHaveLength(4); // start + end for each script
      expect(progressEvents[0]).toMatchObject({
        type: 'script-start',
        script: 'progress:1'
      });
      expect(progressEvents[1]).toMatchObject({
        type: 'script-end',
        script: 'progress:1'
      });
    });
  });

  describe('Error Recovery', () => {
    test('should support retry mechanism', async () => {
      let attempts = 0;
      
      buildScripts.registerScript('flaky:script', async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, attempts };
      });
      
      const result = await buildScripts.runScript('flaky:script', {}, { retry: 3 });
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    test('should fail after max retries', async () => {
      buildScripts.registerScript('always:fail', async () => {
        throw new Error('Always fails');
      });
      
      await expect(buildScripts.runScript('always:fail', {}, { retry: 2 }))
        .rejects.toThrow('Script failed after 2 retries');
    });
  });

  describe('Performance Monitoring', () => {
    test('should measure script execution time', async () => {
      buildScripts.registerScript('timed:script', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
      });
      
      const result = await buildScripts.runScript('timed:script');
      
      expect(result.executionTime).toBeGreaterThan(90);
      expect(result.executionTime).toBeLessThan(200);
    });

    test('should generate performance report', async () => {
      buildScripts.registerScript('perf:1', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true };
      });
      
      buildScripts.registerScript('perf:2', async () => {
        await new Promise(resolve => setTimeout(resolve, 25));
        return { success: true };
      });
      
      await buildScripts.runScript('perf:1');
      await buildScripts.runScript('perf:2');
      
      const report = buildScripts.getPerformanceReport();
      
      expect(report.scripts).toHaveLength(2);
      expect(report.totalExecutionTime).toBeGreaterThan(70);
    });
  });
});