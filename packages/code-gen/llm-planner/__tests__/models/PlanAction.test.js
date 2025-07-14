/**
 * Tests for PlanAction model
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanAction } from '../../src/models/PlanAction.js';

describe('PlanAction', () => {
  describe('File System Actions', () => {
    test('should create create-directory action', () => {
      const action = new PlanAction({
        type: 'create-directory',
        path: '/project/src',
        recursive: true
      });

      expect(action.type).toBe('create-directory');
      expect(action.path).toBe('/project/src');
      expect(action.recursive).toBe(true);
      expect(action.id).toBeDefined();
      expect(action.status).toBe('pending');
    });

    test('should create create-file action', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/project/index.html',
        content: '<!DOCTYPE html>\n<html>\n</html>',
        encoding: 'utf8'
      });

      expect(action.type).toBe('create-file');
      expect(action.path).toBe('/project/index.html');
      expect(action.content).toContain('<!DOCTYPE html>');
      expect(action.encoding).toBe('utf8');
    });

    test('should create update-file action', () => {
      const action = new PlanAction({
        type: 'update-file',
        path: '/project/style.css',
        content: 'body { margin: 0; }',
        backup: true
      });

      expect(action.type).toBe('update-file');
      expect(action.backup).toBe(true);
    });

    test('should create delete-file action', () => {
      const action = new PlanAction({
        type: 'delete-file',
        path: '/project/temp.txt',
        force: true
      });

      expect(action.type).toBe('delete-file');
      expect(action.force).toBe(true);
    });

    test('should create copy-file action', () => {
      const action = new PlanAction({
        type: 'copy-file',
        source: '/project/template.html',
        destination: '/project/index.html',
        overwrite: false
      });

      expect(action.type).toBe('copy-file');
      expect(action.source).toBe('/project/template.html');
      expect(action.destination).toBe('/project/index.html');
      expect(action.overwrite).toBe(false);
    });
  });

  describe('Command Actions', () => {
    test('should create run-command action', () => {
      const action = new PlanAction({
        type: 'run-command',
        command: 'npm install',
        cwd: '/project',
        env: { NODE_ENV: 'development' },
        timeout: 60000
      });

      expect(action.type).toBe('run-command');
      expect(action.command).toBe('npm install');
      expect(action.cwd).toBe('/project');
      expect(action.env.NODE_ENV).toBe('development');
      expect(action.timeout).toBe(60000);
    });

    test('should create run-script action', () => {
      const action = new PlanAction({
        type: 'run-script',
        script: 'build',
        packageManager: 'npm',
        cwd: '/project'
      });

      expect(action.type).toBe('run-script');
      expect(action.script).toBe('build');
      expect(action.packageManager).toBe('npm');
    });
  });

  describe('Validation Actions', () => {
    test('should create validate-syntax action', () => {
      const action = new PlanAction({
        type: 'validate-syntax',
        files: ['*.js'],
        language: 'javascript',
        fix: true
      });

      expect(action.type).toBe('validate-syntax');
      expect(action.files).toEqual(['*.js']);
      expect(action.language).toBe('javascript');
      expect(action.fix).toBe(true);
    });

    test('should create run-tests action', () => {
      const action = new PlanAction({
        type: 'run-tests',
        testCommand: 'npm test',
        coverage: true,
        watch: false
      });

      expect(action.type).toBe('run-tests');
      expect(action.testCommand).toBe('npm test');
      expect(action.coverage).toBe(true);
      expect(action.watch).toBe(false);
    });
  });

  describe('Core Functionality', () => {
    test('should generate ID if not provided', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js'
      });

      expect(action.id).toBeDefined();
      expect(action.id).toMatch(/^action-[a-z0-9-]+$/);
    });

    test('should set default status', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js'
      });

      expect(action.status).toBe('pending');
    });

    test('should validate action type', () => {
      expect(() => {
        new PlanAction({
          type: 'invalid-action'
        });
      }).toThrow('Invalid action type: invalid-action');
    });

    test('should require type field', () => {
      expect(() => {
        new PlanAction({});
      }).toThrow('Action type is required');
    });

    test('should validate required fields for create-file', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js'
      });

      const validation = action.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('create-file action requires content');
    });

    test('should validate required fields for run-command', () => {
      const action = new PlanAction({
        type: 'run-command'
      });

      const validation = action.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('run-command action requires command');
    });

    test('should update status', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      action.updateStatus('in-progress');
      expect(action.status).toBe('in-progress');

      action.updateStatus('completed');
      expect(action.status).toBe('completed');
    });

    test('should record execution result', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      action.recordResult({
        success: true,
        output: 'File created successfully',
        duration: 100
      });

      expect(action.result).toBeDefined();
      expect(action.result.success).toBe(true);
      expect(action.result.duration).toBe(100);
      expect(action.status).toBe('completed');
    });

    test('should record failure result', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      action.recordResult({
        success: false,
        error: 'Permission denied'
      });

      expect(action.result.success).toBe(false);
      expect(action.result.error).toBe('Permission denied');
      expect(action.status).toBe('failed');
    });

    test('should estimate duration based on action type', () => {
      const fileAction = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'small content'
      });

      const commandAction = new PlanAction({
        type: 'run-command',
        command: 'echo test'
      });

      const npmInstallAction = new PlanAction({
        type: 'run-command',
        command: 'npm install'
      });

      expect(fileAction.estimateDuration()).toBe(100);
      expect(commandAction.estimateDuration()).toBe(5000);
      expect(npmInstallAction.estimateDuration()).toBe(30000);
    });

    test('should clone action', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      const cloned = action.clone();

      expect(cloned).not.toBe(action);
      expect(cloned.id).not.toBe(action.id);
      expect(cloned.type).toBe(action.type);
      expect(cloned.path).toBe(action.path);
      expect(cloned.status).toBe('pending');
    });

    test('should export to JSON', () => {
      const action = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      const json = action.toJSON();

      expect(json).toMatchObject({
        id: action.id,
        type: 'create-file',
        path: '/test.js',
        content: 'test',
        status: 'pending'
      });
    });

    test('should create from JSON', () => {
      const json = {
        id: 'action-123',
        type: 'create-file',
        path: '/test.js',
        content: 'test',
        status: 'completed'
      };

      const action = PlanAction.fromJSON(json);

      expect(action).toBeInstanceOf(PlanAction);
      expect(action.id).toBe('action-123');
      expect(action.status).toBe('completed');
    });

    test('should check if action is retryable', () => {
      const fileAction = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      const testAction = new PlanAction({
        type: 'run-tests',
        testCommand: 'npm test'
      });

      expect(fileAction.isRetryable()).toBe(true);
      expect(testAction.isRetryable()).toBe(false);
    });

    test('should get action category', () => {
      const fileAction = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      const commandAction = new PlanAction({
        type: 'run-command',
        command: 'npm install'
      });

      const validationAction = new PlanAction({
        type: 'validate-syntax',
        files: ['*.js']
      });

      expect(fileAction.getCategory()).toBe('file-system');
      expect(commandAction.getCategory()).toBe('command');
      expect(validationAction.getCategory()).toBe('validation');
    });

    test('should check if action has side effects', () => {
      const createAction = new PlanAction({
        type: 'create-file',
        path: '/test.js',
        content: 'test'
      });

      const validateAction = new PlanAction({
        type: 'validate-syntax',
        files: ['*.js']
      });

      expect(createAction.hasSideEffects()).toBe(true);
      expect(validateAction.hasSideEffects()).toBe(false);
    });
  });

  describe('Action Templates', () => {
    test('should create action from template', () => {
      const action = PlanAction.fromTemplate('create-index-html', {
        path: '/project',
        title: 'My App'
      });

      expect(action.type).toBe('create-file');
      expect(action.path).toBe('/project/index.html');
      expect(action.content).toContain('<title>My App</title>');
    });

    test('should create npm init action', () => {
      const action = PlanAction.createNpmInit('/project', {
        name: 'my-project',
        version: '1.0.0'
      });

      expect(action.type).toBe('create-file');
      expect(action.path).toBe('/project/package.json');
      const content = JSON.parse(action.content);
      expect(content.name).toBe('my-project');
      expect(content.version).toBe('1.0.0');
    });

    test('should create git init action', () => {
      const action = PlanAction.createGitInit('/project');

      expect(action.type).toBe('run-command');
      expect(action.command).toBe('git init');
      expect(action.cwd).toBe('/project');
    });

    test('should create eslint config action', () => {
      const action = PlanAction.createEslintConfig('/project', {
        env: 'node',
        extends: ['eslint:recommended']
      });

      expect(action.type).toBe('create-file');
      expect(action.path).toBe('/project/.eslintrc.json');
      const config = JSON.parse(action.content);
      expect(config.env.node).toBe(true);
    });
  });
});