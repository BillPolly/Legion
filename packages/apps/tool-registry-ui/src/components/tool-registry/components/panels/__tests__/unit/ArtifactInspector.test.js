/**
 * ArtifactInspector Unit Tests
 * Tests artifact display and context tracking functionality
 */

import { jest } from '@jest/globals';
import { ArtifactInspector } from '../../ArtifactInspector.js';

describe('ArtifactInspector Unit Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '600px';
    dom.style.height = '400px';
    document.body.appendChild(dom);

    // Create mock umbilical
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

  describe('Model Tests', () => {
    test('should initialize with empty artifact state', () => {
      expect(component.model.getState('artifacts')).toEqual([]);
      expect(component.model.getState('selectedArtifact')).toBeNull();
      expect(component.model.getState('viewMode')).toBe('list');
      expect(component.model.getState('filterType')).toBe('all');
    });

    test('should add artifacts to collection', () => {
      const artifact = {
        id: 'test-artifact-1',
        name: 'test.txt',
        type: 'file',
        size: 1024,
        createdAt: new Date().toISOString(),
        executionId: 'exec-123',
        taskId: 'task-456'
      };

      component.model.addArtifact(artifact);
      
      const artifacts = component.model.getState('artifacts');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toEqual(artifact);
    });

    test('should update existing artifacts', () => {
      const artifact = {
        id: 'test-artifact-1',
        name: 'test.txt',
        type: 'file',
        size: 1024
      };

      component.model.addArtifact(artifact);
      
      const updatedArtifact = {
        ...artifact,
        size: 2048,
        modified: true
      };

      component.model.updateArtifact('test-artifact-1', updatedArtifact);
      
      const artifacts = component.model.getState('artifacts');
      expect(artifacts[0].size).toBe(2048);
      expect(artifacts[0].modified).toBe(true);
    });

    test('should remove artifacts from collection', () => {
      const artifact1 = { id: 'artifact-1', name: 'file1.txt' };
      const artifact2 = { id: 'artifact-2', name: 'file2.txt' };

      component.model.addArtifact(artifact1);
      component.model.addArtifact(artifact2);
      
      expect(component.model.getState('artifacts')).toHaveLength(2);

      component.model.removeArtifact('artifact-1');
      
      const artifacts = component.model.getState('artifacts');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].id).toBe('artifact-2');
    });

    test('should filter artifacts by type', () => {
      const fileArtifact = { id: 'file-1', type: 'file', name: 'test.txt' };
      const imageArtifact = { id: 'image-1', type: 'image', name: 'test.png' };
      const dataArtifact = { id: 'data-1', type: 'data', name: 'test.json' };

      component.model.addArtifact(fileArtifact);
      component.model.addArtifact(imageArtifact);
      component.model.addArtifact(dataArtifact);

      component.model.setFilterType('file');
      const filteredArtifacts = component.model.getFilteredArtifacts();
      
      expect(filteredArtifacts).toHaveLength(1);
      expect(filteredArtifacts[0].type).toBe('file');
    });

    test('should track artifact context and relationships', () => {
      const context = {
        executionId: 'exec-123',
        taskId: 'task-456',
        planId: 'plan-789',
        timestamp: new Date().toISOString()
      };

      component.model.setContext(context);
      
      expect(component.model.getState('context')).toEqual(context);

      const artifact = {
        id: 'context-artifact',
        name: 'output.txt',
        context: context
      };

      component.model.addArtifact(artifact);
      
      const contextArtifacts = component.model.getArtifactsByContext('exec-123');
      expect(contextArtifacts).toHaveLength(1);
      expect(contextArtifacts[0].id).toBe('context-artifact');
    });
  });

  describe('View Tests', () => {
    test('should render artifact list view', () => {
      const artifacts = [
        { id: 'artifact-1', name: 'file1.txt', type: 'file', size: 1024 },
        { id: 'artifact-2', name: 'image1.png', type: 'image', size: 2048 }
      ];

      artifacts.forEach(artifact => component.model.addArtifact(artifact));
      component.view.updateArtifactList(artifacts);

      const listItems = component.view.container.querySelectorAll('.artifact-item');
      expect(listItems).toHaveLength(2);
      expect(listItems[0].textContent).toContain('file1.txt');
      expect(listItems[1].textContent).toContain('image1.png');
    });

    test('should render artifact details view', () => {
      const artifact = {
        id: 'detail-artifact',
        name: 'detailed-file.txt',
        type: 'file',
        size: 4096,
        createdAt: new Date().toISOString(),
        content: 'File content here...'
      };

      component.view.showArtifactDetails(artifact);

      const detailsPanel = component.view.container.querySelector('.artifact-details');
      expect(detailsPanel).toBeTruthy();
      expect(detailsPanel.textContent).toContain('detailed-file.txt');
      expect(detailsPanel.textContent).toContain('4 KB');
    });

    test('should handle different artifact types', () => {
      const imageArtifact = {
        id: 'image-artifact',
        name: 'test.png',
        type: 'image',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      };

      component.view.showArtifactDetails(imageArtifact);

      const imagePreview = component.view.container.querySelector('.artifact-preview img');
      expect(imagePreview).toBeTruthy();
      expect(imagePreview.src).toContain('data:image/png');
    });

    test('should show context information', () => {
      const context = {
        executionId: 'exec-123',
        taskId: 'task-456',
        planId: 'plan-789'
      };

      component.view.updateContextDisplay(context);

      const contextPanel = component.view.container.querySelector('.context-info');
      expect(contextPanel).toBeTruthy();
      expect(contextPanel.textContent).toContain('exec-123');
      expect(contextPanel.textContent).toContain('task-456');
    });

    test('should handle view mode switching', () => {
      component.view.setViewMode('grid');
      
      const gridView = component.view.container.querySelector('.artifacts-grid');
      const listView = component.view.container.querySelector('.artifacts-list');
      
      expect(gridView.style.display).not.toBe('none');
      expect(listView.style.display).toBe('none');

      component.view.setViewMode('list');
      
      expect(gridView.style.display).toBe('none');
      expect(listView.style.display).not.toBe('none');
    });
  });

  describe('ViewModel Tests', () => {
    test('should select artifacts and update view', () => {
      const artifact = {
        id: 'selectable-artifact',
        name: 'select-me.txt',
        type: 'file'
      };

      component.model.addArtifact(artifact);
      
      const selectResult = component.api.selectArtifact('selectable-artifact');
      expect(selectResult.success).toBe(true);
      expect(component.api.getSelectedArtifact()).toEqual(artifact);
    });

    test('should download artifacts', () => {
      const artifact = {
        id: 'download-artifact',
        name: 'download-me.txt',
        type: 'file',
        content: 'File content to download',
        url: 'blob:mock-url'
      };

      // Mock URL and DOM functions
      global.URL = { createObjectURL: jest.fn(() => 'mock-url'), revokeObjectURL: jest.fn() };
      const mockLink = { click: jest.fn(), download: '', href: '' };
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink;
        return document.createElement(tagName);
      });

      component.model.addArtifact(artifact);
      
      const downloadResult = component.api.downloadArtifact('download-artifact');
      expect(downloadResult.success).toBe(true);
      expect(mockLink.click).toHaveBeenCalled();

      // Cleanup mocks
      document.createElement.mockRestore();
    });

    test('should export artifact metadata', () => {
      const artifacts = [
        { id: 'export-1', name: 'file1.txt', type: 'file', size: 1024 },
        { id: 'export-2', name: 'file2.txt', type: 'file', size: 2048 }
      ];

      artifacts.forEach(artifact => component.model.addArtifact(artifact));

      // Mock export functionality
      global.URL = { createObjectURL: jest.fn(() => 'mock-url'), revokeObjectURL: jest.fn() };
      const mockLink = { click: jest.fn(), download: '', href: '' };
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink;
        return document.createElement(tagName);
      });

      const exportResult = component.api.exportArtifacts();
      expect(exportResult.success).toBe(true);
      expect(mockLink.click).toHaveBeenCalled();

      // Cleanup mocks
      document.createElement.mockRestore();
    });

    test('should clear all artifacts', () => {
      const artifacts = [
        { id: 'clear-1', name: 'file1.txt' },
        { id: 'clear-2', name: 'file2.txt' }
      ];

      artifacts.forEach(artifact => component.model.addArtifact(artifact));
      expect(component.api.getArtifacts()).toHaveLength(2);

      const clearResult = component.api.clearArtifacts();
      expect(clearResult.success).toBe(true);
      expect(component.api.getArtifacts()).toHaveLength(0);
    });

    test('should validate artifacts', () => {
      const validArtifact = {
        id: 'valid-artifact',
        name: 'valid.txt',
        type: 'file'
      };

      const invalidArtifact = {
        id: '',
        name: '',
        type: 'unknown'
      };

      const addValidResult = component.api.addArtifact(validArtifact);
      expect(addValidResult.success).toBe(true);

      const addInvalidResult = component.api.addArtifact(invalidArtifact);
      expect(addInvalidResult.success).toBe(false);
      expect(addInvalidResult.error).toContain('Invalid artifact');
    });
  });

  describe('Integration Tests', () => {
    test('should handle artifact lifecycle events', () => {
      const artifact = {
        id: 'lifecycle-artifact',
        name: 'lifecycle.txt',
        type: 'file'
      };

      // Add artifact
      component.api.addArtifact(artifact);
      expect(component.api.getArtifacts()).toHaveLength(1);

      // Update artifact
      const updateResult = component.api.updateArtifact('lifecycle-artifact', { modified: true });
      expect(updateResult.success).toBe(true);
      expect(component.api.getArtifacts()[0].modified).toBe(true);

      // Remove artifact
      const removeResult = component.api.removeArtifact('lifecycle-artifact');
      expect(removeResult.success).toBe(true);
      expect(component.api.getArtifacts()).toHaveLength(0);
    });

    test('should maintain context consistency', () => {
      const context = {
        executionId: 'exec-context-test',
        taskId: 'task-context-test'
      };

      component.api.setContext(context);
      
      const artifact = {
        id: 'context-artifact',
        name: 'context.txt',
        type: 'file'
      };

      component.api.addArtifact(artifact);
      
      const contextArtifactsResult = component.api.getArtifactsByContext('exec-context-test');
      expect(contextArtifactsResult.success).toBe(true);
      const contextArtifacts = contextArtifactsResult.data;
      expect(contextArtifacts).toHaveLength(1);
      expect(contextArtifacts[0].context.executionId).toBe('exec-context-test');
    });
  });
});