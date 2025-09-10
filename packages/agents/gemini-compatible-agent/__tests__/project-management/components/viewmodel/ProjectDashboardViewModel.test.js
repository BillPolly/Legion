/**
 * @jest-environment jsdom
 */

/**
 * ProjectDashboardViewModel Tests  
 * Unit tests for project dashboard MVVM ViewModel layer
 */

import { ProjectDashboardViewModel } from '../../../../src/project-management/components/viewmodel/ProjectDashboardViewModel.js';
import { ProjectDashboardModel } from '../../../../src/project-management/components/model/ProjectDashboardModel.js';

describe('ProjectDashboardViewModel', () => {
  let viewModel;
  let mockModel;
  let mockView;
  let mockProjectManager;

  beforeEach(() => {
    // Mock model
    mockModel = {
      projectData: { id: 'test-001', name: 'Test Project', phase: 'requirements' },
      deliverables: [],
      phases: [],
      addChangeListener: () => {},
      removeChangeListener: () => {},
      loadProject: async () => ({ success: true }),
      updateDeliverable: () => ({ success: true }),
      getPhaseStatus: () => ({ currentPhase: 'requirements' }),
      getDeliverablesSummary: () => ({ total: 0, completed: 0 }),
      destroy: () => {}
    };

    // Mock view  
    mockView = {
      render: () => {},
      updateDeliverable: () => {},
      updateProjectHeader: () => {},
      bindEvents: () => {},
      setTheme: () => {},
      showLoading: () => {},
      showError: () => {},
      destroy: () => {}
    };

    // Mock project manager
    mockProjectManager = {
      currentProject: 'test-001',
      generateProjectSummary: async () => ({ projectId: 'test-001' })
    };

    viewModel = new ProjectDashboardViewModel(mockModel, mockView, {
      projectManager: mockProjectManager
    });
  });

  describe('constructor', () => {
    test('should create ViewModel with proper initialization', () => {
      expect(viewModel.model).toBe(mockModel);
      expect(viewModel.view).toBe(mockView);
      expect(viewModel.config.projectManager).toBe(mockProjectManager);
      expect(viewModel.isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    test('should initialize ViewModel and bind model events', async () => {
      const result = await viewModel.initialize();
      
      expect(result.success).toBe(true);
      expect(viewModel.isInitialized).toBe(true);
    });
  });

  describe('loadProject', () => {
    test('should load project and trigger view render', async () => {
      let viewRenderCalled = false;
      mockView.render = () => { viewRenderCalled = true; };

      const result = await viewModel.loadProject('test-001');
      
      expect(result.success).toBe(true);
      expect(viewRenderCalled).toBe(true);
    });

    test('should handle load errors', async () => {
      mockModel.loadProject = async () => ({ success: false, error: 'Not found' });
      let errorShown = false;
      mockView.showError = () => { errorShown = true; };

      const result = await viewModel.loadProject('non-existent');
      
      expect(result.success).toBe(false);
      expect(errorShown).toBe(true);
    });
  });

  describe('handleModelChange', () => {
    test('should handle project data changes', () => {
      let viewUpdateCalled = false;
      mockView.updateProjectHeader = () => { viewUpdateCalled = true; };

      const changeData = {
        type: 'project_updated',
        current: { name: 'Updated Project' }
      };

      viewModel.handleModelChange(changeData);
      expect(viewUpdateCalled).toBe(true);
    });

    test('should handle deliverable updates', () => {
      let viewUpdateCalled = false;
      mockView.updateDeliverable = () => { viewUpdateCalled = true; };

      const changeData = {
        type: 'deliverable_updated',
        deliverableId: 'del-001',
        updates: { completion: 100 }
      };

      viewModel.handleModelChange(changeData);
      expect(viewUpdateCalled).toBe(true);
    });
  });

  describe('handlePhaseClick', () => {
    test('should handle phase click events', () => {
      const callbacks = [];
      viewModel.onPhaseClick = (phase) => callbacks.push(phase);

      viewModel.handlePhaseClick('domain');
      expect(callbacks).toContain('domain');
    });
  });

  describe('handleDeliverableClick', () => {
    test('should handle deliverable click events', () => {
      const callbacks = [];
      viewModel.onDeliverableClick = (deliverable) => callbacks.push(deliverable);

      const deliverable = { id: 'del-001', name: 'Test' };
      viewModel.handleDeliverableClick(deliverable);
      expect(callbacks).toContain(deliverable);
    });
  });

  describe('refreshData', () => {
    test('should refresh project data from model', async () => {
      // Need to set a current project first
      viewModel.currentProjectId = 'test-project';
      
      let viewRenderCalled = false;
      let modelRefreshCalled = false;
      
      mockView.render = () => { viewRenderCalled = true; };
      mockModel.refreshData = () => { 
        modelRefreshCalled = true; 
        return Promise.resolve(); 
      };

      const result = await viewModel.refreshData();
      
      expect(result.success).toBe(true);
      expect(viewRenderCalled).toBe(true);
      expect(modelRefreshCalled).toBe(true);
    });
  });

  describe('setTheme', () => {
    test('should update view theme', () => {
      let themeSet = false;
      mockView.setTheme = () => { themeSet = true; };

      viewModel.setTheme('dark');
      expect(themeSet).toBe(true);
      expect(viewModel.config.theme).toBe('dark');
    });
  });

  describe('getState', () => {
    test('should return current ViewModel state', () => {
      const state = viewModel.getState();
      
      expect(state.isInitialized).toBe(false);
      expect(state.projectId).toBe(null);
      expect(state.modelState).toBeDefined();
      expect(state.viewState).toBeDefined();
    });
  });

  describe('destroy', () => {
    test('should clean up ViewModel resources', () => {
      let modelDestroyed = false;
      let viewDestroyed = false;
      
      mockModel.destroy = () => { modelDestroyed = true; };
      mockView.destroy = () => { viewDestroyed = true; };

      viewModel.destroy();

      expect(modelDestroyed).toBe(true);
      expect(viewDestroyed).toBe(true);
      expect(viewModel.isInitialized).toBe(false);
    });
  });
});