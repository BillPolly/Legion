import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Simple Plan Execution Test', () => {
  let planData;
  let workspaceDir;
  
  beforeAll(async () => {
    // Load the generated plan
    const planPath = path.join(__dirname, 'node-addition-api-plan.json');
    const planContent = await fs.readFile(planPath, 'utf8');
    planData = JSON.parse(planContent);
    
    // Create test workspace
    workspaceDir = `/tmp/legion-plan-execution-test/${Date.now()}`;
    await fs.mkdir(workspaceDir, { recursive: true });
    console.log(`Created workspace: ${workspaceDir}`);
  });
  
  afterAll(async () => {
    // Clean up workspace
    if (workspaceDir) {
      try {
        await fs.rm(workspaceDir, { recursive: true, force: true });
        console.log('Cleaned up workspace');
      } catch (error) {
        console.error('Failed to clean workspace:', error.message);
      }
    }
  });
  
  describe('Plan Structure', () => {
    test('should have valid plan for execution', () => {
      expect(planData).toBeDefined();
      expect(planData.id).toBeTruthy();
      expect(planData.name).toBe('Create Addition API Server');
      expect(planData.steps).toBeInstanceOf(Array);
      expect(planData.steps.length).toBe(5);
    });
    
    test('all steps should have executable actions', () => {
      planData.steps.forEach((step, index) => {
        console.log(`Step ${index + 1}: ${step.name}`);
        expect(step.actions).toBeInstanceOf(Array);
        expect(step.actions.length).toBeGreaterThan(0);
        
        step.actions.forEach(action => {
          console.log(`  - Action: ${action.type}`);
          expect(action.type).toBeTruthy();
          expect(action.parameters).toBeDefined();
        });
      });
    });
  });
  
  describe('Manual Execution Simulation', () => {
    test('should be able to create package.json', async () => {
      const step1 = planData.steps[0];
      expect(step1.name).toBe('Initialize Node.js project');
      
      const action = step1.actions[0];
      expect(action.type).toBe('file_write');
      expect(action.parameters.filepath).toBe('package.json');
      expect(action.parameters.content).toBeTruthy();
      
      // Simulate file write
      const filePath = path.join(workspaceDir, action.parameters.filepath);
      await fs.writeFile(filePath, action.parameters.content);
      
      // Verify file was created
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
      
      // Verify content is valid JSON
      const content = await fs.readFile(filePath, 'utf8');
      const packageJson = JSON.parse(content);
      expect(packageJson.name).toBe('addition-api-server');
      expect(packageJson.dependencies.express).toBeTruthy();
    });
    
    test('should be able to create server.js', async () => {
      const step2 = planData.steps[1];
      expect(step2.name).toBe('Create server with addition endpoint');
      
      const action = step2.actions[0];
      expect(action.type).toBe('file_write');
      expect(action.parameters.filepath).toBe('server.js');
      
      // Simulate file write
      const filePath = path.join(workspaceDir, action.parameters.filepath);
      await fs.writeFile(filePath, action.parameters.content);
      
      // Verify file was created
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
      
      // Verify content contains expected code
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toContain('express');
      expect(content).toContain('/api/add');
      expect(content).toContain('const result = a + b');
    });
    
    test('should have npm install command', () => {
      const step3 = planData.steps[2];
      expect(step3.name).toBe('Install dependencies');
      
      const action = step3.actions[0];
      expect(action.type).toBe('command_executor');
      expect(action.parameters.command).toBe('npm install');
    });
    
    test('should create all expected files', async () => {
      // Get all file_write actions
      const fileWriteActions = [];
      planData.steps.forEach(step => {
        step.actions.forEach(action => {
          if (action.type === 'file_write') {
            fileWriteActions.push({
              stepName: step.name,
              filepath: action.parameters.filepath,
              content: action.parameters.content
            });
          }
        });
      });
      
      console.log('\nFile write actions found:');
      fileWriteActions.forEach(action => {
        console.log(`  - ${action.filepath} (from ${action.stepName})`);
      });
      
      expect(fileWriteActions.length).toBe(4); // package.json, server.js, test-api.js, README.md
      
      // Verify expected files
      const expectedFiles = ['package.json', 'server.js', 'test-api.js', 'README.md'];
      const foundFiles = fileWriteActions.map(a => a.filepath);
      
      expectedFiles.forEach(file => {
        expect(foundFiles).toContain(file);
      });
    });
  });
  
  describe('Execution Order', () => {
    test('should have valid execution order', () => {
      expect(planData.executionOrder).toEqual([
        'step-1',
        'step-2', 
        'step-3',
        'step-4',
        'step-5'
      ]);
      
      // Verify dependencies are respected
      const stepMap = {};
      planData.steps.forEach(step => {
        stepMap[step.id] = step;
      });
      
      planData.executionOrder.forEach((stepId, index) => {
        const step = stepMap[stepId];
        
        // Check all dependencies come before this step
        step.dependencies.forEach(depId => {
          const depIndex = planData.executionOrder.indexOf(depId);
          expect(depIndex).toBeGreaterThanOrEqual(0);
          expect(depIndex).toBeLessThan(index);
        });
      });
    });
  });
  
  describe('Plan Metadata', () => {
    test('should have estimated duration', () => {
      const totalDuration = planData.steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
      expect(totalDuration).toBe(15);
      expect(planData.metadata.estimatedDuration).toBe(15);
    });
    
    test('should have success criteria', () => {
      expect(planData.successCriteria).toBeInstanceOf(Array);
      expect(planData.successCriteria.length).toBe(5);
      expect(planData.successCriteria).toContain('Node.js project initialized with package.json');
      expect(planData.successCriteria).toContain('Addition endpoint correctly adds two numbers');
    });
  });
});