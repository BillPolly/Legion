/**
 * ArtifactInspector Integration Tests
 * Tests artifact display and context tracking with live execution data
 */

import { jest } from '@jest/globals';
import { ArtifactInspector } from '../../src/components/tool-registry/components/panels/ArtifactInspector.js';

describe('ArtifactInspector Integration Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Create mock umbilical with artifact event handlers
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onArtifactSelect: jest.fn(),
      onArtifactUpdate: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await ArtifactInspector.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Live Artifact Management', () => {
    test('should handle real-time artifact creation during execution', () => {
      const executionContext = {
        executionId: 'live-exec-123',
        taskId: 'artifact-task-1',
        planId: 'plan-456',
        timestamp: new Date().toISOString()
      };

      // Set execution context
      const setContextResult = component.api.setContext(executionContext);
      expect(setContextResult.success).toBe(true);

      // Simulate artifacts being created during execution
      const artifacts = [
        {
          id: 'log-artifact-1',
          name: 'execution.log',
          type: 'log',
          size: 2048,
          content: 'Task started\nProcessing data...\nTask completed successfully'
        },
        {
          id: 'output-artifact-1',
          name: 'result.json',
          type: 'data',
          size: 512,
          content: '{"status": "success", "processed": 150, "errors": 0}'
        },
        {
          id: 'report-artifact-1',
          name: 'execution-report.html',
          type: 'report',
          size: 4096,
          content: '<html><body><h1>Execution Report</h1><p>All tasks completed successfully</p></body></html>'
        }
      ];

      // Add artifacts one by one as they would be created
      artifacts.forEach((artifact, index) => {
        const addResult = component.api.addArtifact(artifact);
        expect(addResult.success).toBe(true);
        
        // Verify artifact has correct context
        const retrievedArtifacts = component.api.getArtifacts();
        expect(retrievedArtifacts[index].context.executionId).toBe('live-exec-123');
        expect(retrievedArtifacts[index].context.taskId).toBe('artifact-task-1');
      });

      // Verify total artifact count and size
      const allArtifacts = component.api.getArtifacts();
      expect(allArtifacts).toHaveLength(3);
      
      const totalSize = allArtifacts.reduce((sum, artifact) => sum + artifact.size, 0);
      expect(totalSize).toBe(6656); // 2048 + 512 + 4096
    });

    test('should track artifacts across multiple tasks in same execution', () => {
      const executionId = 'multi-task-exec-789';
      
      // Task 1 artifacts
      component.api.setContext({ executionId, taskId: 'task-1' });
      
      const task1Artifacts = [
        { id: 'task1-input', name: 'input.txt', type: 'file', size: 1024 },
        { id: 'task1-output', name: 'processed.txt', type: 'file', size: 2048 }
      ];

      task1Artifacts.forEach(artifact => {
        component.api.addArtifact(artifact);
      });

      // Task 2 artifacts
      component.api.setContext({ executionId, taskId: 'task-2' });
      
      const task2Artifacts = [
        { id: 'task2-analysis', name: 'analysis.json', type: 'data', size: 512 },
        { id: 'task2-chart', name: 'chart.png', type: 'image', size: 8192 }
      ];

      task2Artifacts.forEach(artifact => {
        component.api.addArtifact(artifact);
      });

      // Verify context-based filtering
      const executionArtifactsResult = component.api.getArtifactsByContext(executionId);
      expect(executionArtifactsResult.success).toBe(true);
      expect(executionArtifactsResult.data).toHaveLength(4);

      const task1ArtifactsResult = component.api.getArtifactsByContext(executionId, 'task-1');
      expect(task1ArtifactsResult.success).toBe(true);
      expect(task1ArtifactsResult.data).toHaveLength(2);

      const task2ArtifactsResult = component.api.getArtifactsByContext(executionId, 'task-2');
      expect(task2ArtifactsResult.success).toBe(true);
      expect(task2ArtifactsResult.data).toHaveLength(2);
    });

    test('should handle large artifacts and performance', () => {
      const startTime = Date.now();
      
      // Create 100 artifacts to test performance
      const artifacts = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-artifact-${i}`,
        name: `file-${i}.txt`,
        type: i % 4 === 0 ? 'file' : i % 4 === 1 ? 'log' : i % 4 === 2 ? 'data' : 'output',
        size: Math.floor(Math.random() * 10000) + 1000,
        content: `Content for file ${i}`.repeat(100)
      }));

      // Add all artifacts
      artifacts.forEach(artifact => {
        const result = component.api.addArtifact(artifact);
        expect(result.success).toBe(true);
      });

      const addTime = Date.now() - startTime;
      expect(addTime).toBeLessThan(3000); // Should add 100 artifacts in under 3 seconds

      // Test filtering performance
      const filterStartTime = Date.now();
      
      component.api.setFilterType('file');
      const filteredArtifacts = component.api.getFilteredArtifacts();
      
      const filterTime = Date.now() - filterStartTime;
      expect(filterTime).toBeLessThan(100); // Filtering should be fast
      
      expect(filteredArtifacts).toHaveLength(25); // 100/4 = 25 files
    });
  });

  describe('Artifact Type Handling', () => {
    test('should handle different artifact types with appropriate display', () => {
      const artifacts = [
        {
          id: 'text-file',
          name: 'readme.txt',
          type: 'file',
          content: 'This is a text file content\nWith multiple lines\nAnd formatting',
          size: 512
        },
        {
          id: 'json-data',
          name: 'config.json',
          type: 'data',
          content: '{"setting1": "value1", "setting2": 42, "setting3": true}',
          size: 256
        },
        {
          id: 'log-file',
          name: 'system.log',
          type: 'log',
          content: '[2023-08-17 12:00:00] INFO: System started\n[2023-08-17 12:00:01] DEBUG: Loading configuration\n[2023-08-17 12:00:02] INFO: System ready',
          size: 1024
        },
        {
          id: 'image-file',
          name: 'diagram.png',
          type: 'image',
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          size: 2048
        }
      ];

      artifacts.forEach(artifact => {
        const result = component.api.addArtifact(artifact);
        expect(result.success).toBe(true);
      });

      // Test each artifact type displays correctly
      artifacts.forEach(artifact => {
        const selectResult = component.api.selectArtifact(artifact.id);
        expect(selectResult.success).toBe(true);
        expect(selectResult.data.id).toBe(artifact.id);
      });

      // Test type filtering
      component.api.setFilterType('log');
      const logArtifacts = component.api.getFilteredArtifacts();
      expect(logArtifacts).toHaveLength(1);
      expect(logArtifacts[0].type).toBe('log');

      component.api.setFilterType('image');
      const imageArtifacts = component.api.getFilteredArtifacts();
      expect(imageArtifacts).toHaveLength(1);
      expect(imageArtifacts[0].type).toBe('image');
    });

    test('should handle artifact updates and modifications', () => {
      const originalArtifact = {
        id: 'updatable-artifact',
        name: 'original.txt',
        type: 'file',
        content: 'Original content',
        size: 16
      };

      // Add original artifact
      component.api.addArtifact(originalArtifact);

      // Update artifact content
      const updateResult = component.api.updateArtifact('updatable-artifact', {
        content: 'Updated content with more text',
        size: 32,
        modified: true
      });

      expect(updateResult.success).toBe(true);

      // Verify updates
      const artifacts = component.api.getArtifacts();
      const updatedArtifact = artifacts.find(a => a.id === 'updatable-artifact');
      
      expect(updatedArtifact.content).toBe('Updated content with more text');
      expect(updatedArtifact.size).toBe(32);
      expect(updatedArtifact.modified).toBe(true);
      expect(updatedArtifact.updatedAt).toBeDefined();
    });
  });

  describe('Search and Filtering', () => {
    test('should search artifacts by name and description', () => {
      const artifacts = [
        {
          id: 'search-1',
          name: 'important-data.json',
          type: 'data',
          description: 'Contains critical business metrics'
        },
        {
          id: 'search-2',
          name: 'temp-log.txt',
          type: 'log',
          description: 'Temporary logging information'
        },
        {
          id: 'search-3',
          name: 'user-report.pdf',
          type: 'report',
          description: 'User activity summary report'
        }
      ];

      artifacts.forEach(artifact => component.api.addArtifact(artifact));

      // Search by name
      component.api.setSearchQuery('data');
      let filteredArtifacts = component.api.getFilteredArtifacts();
      expect(filteredArtifacts).toHaveLength(1);
      expect(filteredArtifacts[0].name).toBe('important-data.json');

      // Search by description and name
      component.api.setSearchQuery('report');
      filteredArtifacts = component.api.getFilteredArtifacts();
      expect(filteredArtifacts).toHaveLength(1); // user-report.pdf (matches both name and description)

      // Search case insensitive
      component.api.setSearchQuery('TEMP');
      filteredArtifacts = component.api.getFilteredArtifacts();
      expect(filteredArtifacts).toHaveLength(1);
      expect(filteredArtifacts[0].name).toBe('temp-log.txt');

      // Clear search
      component.api.setSearchQuery('');
      filteredArtifacts = component.api.getFilteredArtifacts();
      expect(filteredArtifacts).toHaveLength(3);
    });

    test('should combine filtering and searching', () => {
      const artifacts = [
        { id: 'file-1', name: 'data-file.txt', type: 'file' },
        { id: 'file-2', name: 'config-file.txt', type: 'file' },
        { id: 'log-1', name: 'data-log.txt', type: 'log' },
        { id: 'log-2', name: 'error-log.txt', type: 'log' }
      ];

      artifacts.forEach(artifact => component.api.addArtifact(artifact));

      // Filter by type and search
      component.api.setFilterType('file');
      component.api.setSearchQuery('data');
      
      const filtered = component.api.getFilteredArtifacts();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('file-1');
      expect(filtered[0].type).toBe('file');
      expect(filtered[0].name).toContain('data');
    });
  });

  describe('Import/Export Operations', () => {
    test('should export artifact metadata', () => {
      const artifacts = [
        {
          id: 'export-1',
          name: 'export-test-1.txt',
          type: 'file',
          size: 1024,
          content: 'Content to export'
        },
        {
          id: 'export-2',
          name: 'export-test-2.json',
          type: 'data',
          size: 512,
          content: '{"key": "value"}'
        }
      ];

      artifacts.forEach(artifact => component.api.addArtifact(artifact));

      // Mock URL and DOM for export
      global.URL = {
        createObjectURL: jest.fn(() => 'mock-export-url'),
        revokeObjectURL: jest.fn()
      };

      const mockLink = {
        click: jest.fn(),
        download: '',
        href: ''
      };

      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink;
        return document.createElement(tagName);
      });

      const exportResult = component.api.exportArtifacts();
      expect(exportResult.success).toBe(true);
      expect(exportResult.data.exported).toBe(2);
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();

      // Cleanup
      document.createElement.mockRestore();
    });

    test('should download individual artifacts', () => {
      const artifact = {
        id: 'download-test',
        name: 'download-me.txt',
        type: 'file',
        content: 'This content will be downloaded',
        size: 256
      };

      component.api.addArtifact(artifact);

      // Mock download functionality
      global.URL = {
        createObjectURL: jest.fn(() => 'mock-download-url'),
        revokeObjectURL: jest.fn()
      };

      const mockLink = {
        click: jest.fn(),
        download: '',
        href: ''
      };

      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink;
        return document.createElement(tagName);
      });

      const downloadResult = component.api.downloadArtifact('download-test');
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.data.downloaded).toBe(true);
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toBe('download-me.txt');

      // Cleanup
      document.createElement.mockRestore();
    });
  });

  describe('View Mode Integration', () => {
    test('should handle view mode changes with artifacts', () => {
      const artifacts = [
        { id: 'view-1', name: 'file1.txt', type: 'file', size: 1024 },
        { id: 'view-2', name: 'file2.txt', type: 'file', size: 2048 },
        { id: 'view-3', name: 'image.png', type: 'image', size: 4096 }
      ];

      artifacts.forEach(artifact => component.api.addArtifact(artifact));

      // Test switching to grid view
      const gridResult = component.api.setViewMode('grid');
      expect(gridResult.success).toBe(true);
      expect(component.api.getViewMode()).toBe('grid');

      // Test switching to details view
      const detailsResult = component.api.setViewMode('details');
      expect(detailsResult.success).toBe(true);
      expect(component.api.getViewMode()).toBe('details');

      // Test invalid view mode
      const invalidResult = component.api.setViewMode('invalid');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Invalid view mode');
    });

    test('should integrate with artifact selection for details view', () => {
      const artifact = {
        id: 'detail-view-test',
        name: 'detailed-file.txt',
        type: 'file',
        size: 1024,
        content: 'Detailed content for viewing',
        description: 'A test file for detail view'
      };

      component.api.addArtifact(artifact);

      // Select artifact for details
      const selectResult = component.api.selectArtifact('detail-view-test');
      expect(selectResult.success).toBe(true);
      expect(component.api.getSelectedArtifact()).toEqual(artifact);

      // Verify callbacks
      expect(mockUmbilical.onArtifactSelect).toHaveBeenCalledWith(artifact);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid artifact operations gracefully', () => {
      // Test adding invalid artifact
      const invalidArtifact = { name: 'no-id.txt' }; // Missing required id
      const addResult = component.api.addArtifact(invalidArtifact);
      expect(addResult.success).toBe(false);
      expect(addResult.error).toContain('Invalid artifact');

      // Test selecting non-existent artifact
      const selectResult = component.api.selectArtifact('non-existent');
      expect(selectResult.success).toBe(false);
      expect(selectResult.error).toContain('not found');

      // Test updating non-existent artifact
      const updateResult = component.api.updateArtifact('non-existent', { size: 1024 });
      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('not found');

      // Test removing non-existent artifact
      const removeResult = component.api.removeArtifact('non-existent');
      expect(removeResult.success).toBe(false);
      expect(removeResult.error).toContain('not found');
    });

    test('should handle context changes and cleanup', () => {
      // Add artifacts with context
      component.api.setContext({ executionId: 'context-test-1', taskId: 'task-1' });
      
      const artifacts = [
        { id: 'context-1', name: 'file1.txt', type: 'file' },
        { id: 'context-2', name: 'file2.txt', type: 'file' }
      ];

      artifacts.forEach(artifact => component.api.addArtifact(artifact));

      // Change context
      component.api.setContext({ executionId: 'context-test-2', taskId: 'task-2' });

      // Add more artifacts
      component.api.addArtifact({ id: 'context-3', name: 'file3.txt', type: 'file' });

      // Verify context-based filtering works
      const context1Result = component.api.getArtifactsByContext('context-test-1');
      expect(context1Result.success).toBe(true);
      expect(context1Result.data).toHaveLength(2);

      const context2Result = component.api.getArtifactsByContext('context-test-2');
      expect(context2Result.success).toBe(true);
      expect(context2Result.data).toHaveLength(1);
    });

    test('should handle component reset and cleanup', () => {
      // Add some artifacts
      const artifacts = [
        { id: 'reset-1', name: 'file1.txt', type: 'file' },
        { id: 'reset-2', name: 'file2.txt', type: 'file' }
      ];

      artifacts.forEach(artifact => component.api.addArtifact(artifact));
      component.api.selectArtifact('reset-1');

      expect(component.api.getArtifacts()).toHaveLength(2);
      expect(component.api.getSelectedArtifact()).toBeTruthy();

      // Reset component
      const resetResult = component.api.reset();
      expect(resetResult.success).toBe(true);

      // Verify reset state
      expect(component.api.getArtifacts()).toHaveLength(0);
      expect(component.api.getSelectedArtifact()).toBeNull();
      expect(component.api.getViewMode()).toBe('list');
      expect(component.api.getFilterType()).toBe('all');
    });
  });

  describe('Callback Integration', () => {
    test('should trigger umbilical callbacks for artifact operations', () => {
      const artifact = {
        id: 'callback-test',
        name: 'callback-file.txt',
        type: 'file',
        size: 1024
      };

      // Test add callback
      component.api.addArtifact(artifact);
      expect(mockUmbilical.onArtifactUpdate).toHaveBeenCalledWith({
        action: 'add',
        artifact: expect.objectContaining({ id: 'callback-test' })
      });

      // Test update callback
      component.api.updateArtifact('callback-test', { size: 2048 });
      expect(mockUmbilical.onArtifactUpdate).toHaveBeenCalledWith({
        action: 'update',
        artifactId: 'callback-test',
        updates: { size: 2048 }
      });

      // Test remove callback
      component.api.removeArtifact('callback-test');
      expect(mockUmbilical.onArtifactUpdate).toHaveBeenCalledWith({
        action: 'remove',
        artifactId: 'callback-test'
      });

      // Test clear callback
      component.api.clearArtifacts();
      expect(mockUmbilical.onArtifactUpdate).toHaveBeenCalledWith({
        action: 'clear'
      });
    });
  });
});