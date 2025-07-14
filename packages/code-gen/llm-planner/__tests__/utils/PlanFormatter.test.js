/**
 * Tests for PlanFormatter utility
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanFormatter } from '../../src/utils/PlanFormatter.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';

describe('PlanFormatter', () => {
  let formatter;
  let samplePlan;

  beforeEach(() => {
    formatter = new PlanFormatter();
    
    // Create a sample plan
    samplePlan = new Plan({
      id: 'plan-123',
      name: 'Create Todo Application',
      version: '1.0.0',
      metadata: {
        createdAt: '2024-01-15T10:00:00Z',
        createdBy: 'CodePlanner',
        estimatedDuration: '2 hours',
        complexity: 'medium'
      },
      context: {
        projectType: 'fullstack',
        technologies: ['html', 'css', 'javascript', 'nodejs', 'express'],
        constraints: ['accessible', 'responsive']
      },
      steps: [
        {
          id: 'step-1',
          name: 'Initialize project structure',
          description: 'Set up the basic project structure',
          type: 'setup',
          dependencies: [],
          actions: [
            { type: 'create-directory', path: 'todo-app' },
            { type: 'create-file', path: 'todo-app/package.json', content: '{}' }
          ],
          estimatedDuration: 5
        },
        {
          id: 'step-2',
          name: 'Create frontend files',
          description: 'Create HTML, CSS, and JavaScript files',
          type: 'implementation',
          dependencies: ['step-1'],
          actions: [
            { type: 'create-file', path: 'todo-app/index.html' },
            { type: 'create-file', path: 'todo-app/style.css' },
            { type: 'create-file', path: 'todo-app/script.js' }
          ],
          estimatedDuration: 30
        }
      ],
      executionOrder: ['step-1', 'step-2'],
      successCriteria: ['All files created', 'Application runs without errors']
    });
  });

  describe('Format as Markdown', () => {
    test('should format plan as markdown', () => {
      const markdown = formatter.toMarkdown(samplePlan);

      expect(markdown).toContain('# Create Todo Application');
      expect(markdown).toContain('## Overview');
      expect(markdown).toContain('## Steps');
      expect(markdown).toContain('### 1. Initialize project structure');
      expect(markdown).toContain('### 2. Create frontend files');
      expect(markdown).toContain('## Success Criteria');
    });

    test('should include metadata in markdown', () => {
      const markdown = formatter.toMarkdown(samplePlan);

      expect(markdown).toContain('**Version:** 1.0.0');
      expect(markdown).toContain('**Complexity:** medium');
      expect(markdown).toContain('**Estimated Duration:** 2 hours');
    });

    test('should format dependencies', () => {
      const markdown = formatter.toMarkdown(samplePlan);

      expect(markdown).toContain('**Dependencies:** step-1');
    });

    test('should format actions as list', () => {
      const markdown = formatter.toMarkdown(samplePlan);

      expect(markdown).toContain('- Create directory: todo-app');
      expect(markdown).toContain('- Create file: todo-app/package.json');
    });

    test('should handle empty plan', () => {
      const emptyPlan = new Plan({ name: 'Empty Plan' });
      const markdown = formatter.toMarkdown(emptyPlan);

      expect(markdown).toContain('# Empty Plan');
      expect(markdown).toContain('No steps defined');
    });
  });

  describe('Format as JSON', () => {
    test('should format plan as pretty JSON', () => {
      const json = formatter.toJSON(samplePlan);

      expect(json).toBe(JSON.stringify(samplePlan.toJSON(), null, 2));
    });

    test('should format with custom indentation', () => {
      const json = formatter.toJSON(samplePlan, { indent: 4 });

      expect(json).toContain('    '); // 4 spaces
    });

    test('should format compact JSON', () => {
      const json = formatter.toJSON(samplePlan, { compact: true });

      expect(json).not.toContain('\n');
      expect(json).toBe(JSON.stringify(samplePlan.toJSON()));
    });
  });

  describe('Format as Text', () => {
    test('should format plan as plain text', () => {
      const text = formatter.toText(samplePlan);

      expect(text).toContain('CREATE TODO APPLICATION');
      expect(text).toContain('Step 1: Initialize project structure');
      expect(text).toContain('Step 2: Create frontend files');
      expect(text).toContain('Success Criteria:');
    });

    test('should include summary statistics', () => {
      const text = formatter.toText(samplePlan);

      expect(text).toContain('Total Steps: 2');
      expect(text).toContain('Total Duration: 35 minutes');
    });

    test('should format as tree structure', () => {
      const text = formatter.toText(samplePlan, { style: 'tree' });

      expect(text).toContain('├─ Step 1:');
      expect(text).toContain('└─ Step 2:');
      expect(text).toContain('   └─ Depends on: step-1');
    });
  });

  describe('Format as HTML', () => {
    test('should format plan as HTML', () => {
      const html = formatter.toHTML(samplePlan);

      expect(html).toContain('<h1>Create Todo Application</h1>');
      expect(html).toContain('<div class="plan-step"');
      expect(html).toContain('<h3>1. Initialize project structure</h3>');
      expect(html).toContain('<ul class="actions">');
    });

    test('should include CSS classes for styling', () => {
      const html = formatter.toHTML(samplePlan);

      expect(html).toContain('class="plan-container"');
      expect(html).toContain('class="plan-metadata"');
      expect(html).toContain('class="plan-steps"');
      expect(html).toContain('class="success-criteria"');
    });

    test('should escape HTML in content', () => {
      const planWithHtml = new Plan({
        name: 'Test <script>alert("xss")</script> Plan',
        steps: [{
          id: '1',
          name: 'Step with <b>HTML</b>',
          actions: []
        }]
      });

      const html = formatter.toHTML(planWithHtml);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<b>HTML</b>');
      expect(html).toContain('&lt;b&gt;HTML&lt;/b&gt;');
    });
  });

  describe('Format as Mermaid Diagram', () => {
    test('should format plan as mermaid flowchart', () => {
      const mermaid = formatter.toMermaid(samplePlan);

      expect(mermaid).toContain('graph TD');
      expect(mermaid).toContain('step-1["Initialize project structure"]');
      expect(mermaid).toContain('step-2["Create frontend files"]');
      expect(mermaid).toContain('step-1 --> step-2');
    });

    test('should handle complex dependencies', () => {
      const complexPlan = new Plan({
        name: 'Complex Plan',
        steps: [
          { id: 'a', name: 'Step A', dependencies: [] },
          { id: 'b', name: 'Step B', dependencies: [] },
          { id: 'c', name: 'Step C', dependencies: ['a', 'b'] },
          { id: 'd', name: 'Step D', dependencies: ['c'] }
        ]
      });

      const mermaid = formatter.toMermaid(complexPlan);

      expect(mermaid).toContain('a --> c');
      expect(mermaid).toContain('b --> c');
      expect(mermaid).toContain('c --> d');
    });

    test('should style nodes by type', () => {
      const mermaid = formatter.toMermaid(samplePlan);

      expect(mermaid).toContain('class step-1 setup');
      expect(mermaid).toContain('class step-2 implementation');
    });
  });

  describe('Format as YAML', () => {
    test('should format plan as YAML', () => {
      const yaml = formatter.toYAML(samplePlan);

      expect(yaml).toContain('name: Create Todo Application');
      expect(yaml).toContain('steps:');
      expect(yaml).toContain('id: step-1');
      expect(yaml).toContain('name: Initialize project structure');
    });

    test('should handle arrays and objects', () => {
      const yaml = formatter.toYAML(samplePlan);

      expect(yaml).toContain('technologies:');
      expect(yaml).toContain('  - html');
      expect(yaml).toContain('  - css');
      expect(yaml).toContain('constraints:');
      expect(yaml).toContain('  - accessible');
    });
  });

  describe('Format Options', () => {
    test('should support custom formatters', () => {
      formatter.registerFormatter('custom', (plan) => {
        return `CUSTOM: ${plan.name}`;
      });

      const result = formatter.format(samplePlan, 'custom');

      expect(result).toBe('CUSTOM: Create Todo Application');
    });

    test('should throw error for unknown format', () => {
      expect(() => {
        formatter.format(samplePlan, 'unknown');
      }).toThrow('Unknown format: unknown');
    });

    test('should list available formats', () => {
      const formats = formatter.getAvailableFormats();

      expect(formats).toContain('markdown');
      expect(formats).toContain('json');
      expect(formats).toContain('text');
      expect(formats).toContain('html');
      expect(formats).toContain('mermaid');
      expect(formats).toContain('yaml');
    });
  });

  describe('Step Formatting', () => {
    test('should format individual step', () => {
      const step = new PlanStep(samplePlan.steps[0]);
      const formatted = formatter.formatStep(step);

      expect(formatted).toContain('Initialize project structure');
      expect(formatted).toContain('Type: setup');
      expect(formatted).toContain('Duration: 5 minutes');
    });

    test('should format step with options', () => {
      const step = new PlanStep(samplePlan.steps[0]);
      const formatted = formatter.formatStep(step, { 
        includeActions: true,
        format: 'compact'
      });

      expect(formatted).toContain('2 actions');
      expect(formatted.split('\n').length).toBeLessThan(2);
    });
  });

  describe('Summary Generation', () => {
    test('should generate plan summary', () => {
      const summary = formatter.generateSummary(samplePlan);

      expect(summary).toContain('Create Todo Application');
      expect(summary).toContain('2 steps');
      expect(summary).toContain('35 minutes');
      expect(summary).toContain('fullstack');
    });

    test('should generate execution timeline', () => {
      const timeline = formatter.generateTimeline(samplePlan);

      expect(timeline).toContain('0:00 - 0:05');
      expect(timeline).toContain('Initialize project structure');
      expect(timeline).toContain('0:05 - 0:35');
      expect(timeline).toContain('Create frontend files');
    });
  });

  describe('Export Features', () => {
    test('should export to file format', () => {
      const exported = formatter.exportToFile(samplePlan, {
        format: 'markdown',
        filename: 'plan.md'
      });

      expect(exported.filename).toBe('plan.md');
      expect(exported.content).toContain('# Create Todo Application');
      expect(exported.mimeType).toBe('text/markdown');
    });

    test('should support multiple export formats', () => {
      const formats = ['markdown', 'json', 'html', 'yaml'];
      
      formats.forEach(format => {
        const exported = formatter.exportToFile(samplePlan, { format });
        expect(exported.content).toBeTruthy();
        expect(exported.mimeType).toBeTruthy();
      });
    });
  });
});