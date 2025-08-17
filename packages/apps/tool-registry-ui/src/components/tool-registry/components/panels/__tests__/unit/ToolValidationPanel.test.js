/**
 * Unit tests for ToolValidationPanel Component
 * Tests tool availability display and validation results
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the UmbilicalUtils
jest.mock('/legion/frontend-components/src/umbilical/index.js', () => ({
  UmbilicalUtils: {
    validateCapabilities: jest.fn((umbilical, requirements) => {
      return true;
    }),
    createRequirements: () => ({
      add: jest.fn(),
      validate: jest.fn()
    })
  }
}));

describe('ToolValidationPanel', () => {
  let mockUmbilical;
  let mockContainer;
  let component;

  beforeEach(() => {
    // Create mock DOM container
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    // Create mock umbilical
    mockUmbilical = {
      dom: mockContainer,
      toolRegistryActor: {
        searchTools: jest.fn(),
        getToolDetails: jest.fn(),
        validateTool: jest.fn()
      },
      onToolSelect: jest.fn(),
      onValidationComplete: jest.fn(),
      onToolMissing: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    document.body.removeChild(mockContainer);
    jest.clearAllMocks();
  });

  describe('Tool Availability Display', () => {
    it('should display required tools', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const requiredTools = [
        { name: 'npm', version: '>=8.0.0' },
        { name: 'git', version: '>=2.0.0' },
        { name: 'docker', version: 'latest' }
      ];

      component.setRequiredTools(requiredTools);
      
      const toolsList = mockContainer.querySelector('.required-tools-list');
      expect(toolsList).toBeTruthy();
      expect(toolsList.textContent).toContain('npm');
      expect(toolsList.textContent).toContain('git');
      expect(toolsList.textContent).toContain('docker');
    });

    it('should show tool availability status', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const toolStatus = {
        npm: { available: true, version: '8.5.0' },
        git: { available: true, version: '2.34.0' },
        docker: { available: false }
      };

      component.setToolStatus(toolStatus);
      
      const npmStatus = mockContainer.querySelector('[data-tool="npm"] .tool-status');
      expect(npmStatus.classList.contains('available')).toBe(true);
      
      const dockerStatus = mockContainer.querySelector('[data-tool="docker"] .tool-status');
      expect(dockerStatus.classList.contains('unavailable')).toBe(true);
    });

    it('should display discovered tools', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const discoveredTools = [
        { id: 'tool1', name: 'Express Server', category: 'server' },
        { id: 'tool2', name: 'MongoDB Client', category: 'database' },
        { id: 'tool3', name: 'JWT Auth', category: 'auth' }
      ];

      component.setDiscoveredTools(discoveredTools);
      
      const toolsGrid = mockContainer.querySelector('.discovered-tools-grid');
      expect(toolsGrid).toBeTruthy();
      
      const toolCards = toolsGrid.querySelectorAll('.tool-card');
      expect(toolCards.length).toBe(3);
    });

    it('should group tools by category', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const tools = [
        { id: '1', name: 'Tool A', category: 'database' },
        { id: '2', name: 'Tool B', category: 'database' },
        { id: '3', name: 'Tool C', category: 'api' }
      ];

      component.setDiscoveredTools(tools);
      const grouped = component.getToolsByCategory();
      
      expect(grouped.database).toHaveLength(2);
      expect(grouped.api).toHaveLength(1);
    });

    it('should filter tools by search term', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const tools = [
        { id: '1', name: 'Database Manager', category: 'database' },
        { id: '2', name: 'API Gateway', category: 'api' },
        { id: '3', name: 'Database Backup', category: 'database' }
      ];

      component.setDiscoveredTools(tools);
      component.filterTools('database');
      
      const visibleTools = mockContainer.querySelectorAll('.tool-card:not(.hidden)');
      expect(visibleTools.length).toBe(2);
    });

    it('should show tool compatibility', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const compatibility = {
        tool1: { compatible: true, confidence: 0.95 },
        tool2: { compatible: false, reason: 'Missing dependency: Redis' },
        tool3: { compatible: true, confidence: 0.8 }
      };

      component.setToolCompatibility(compatibility);
      
      const tool1Card = mockContainer.querySelector('[data-tool-id="tool1"]');
      expect(tool1Card.classList.contains('compatible')).toBe(true);
      
      const tool2Card = mockContainer.querySelector('[data-tool-id="tool2"]');
      expect(tool2Card.classList.contains('incompatible')).toBe(true);
    });
  });

  describe('Validation Results', () => {
    it('should display validation summary', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const validation = {
        valid: true,
        feasible: true,
        toolsAvailable: 8,
        toolsRequired: 10,
        missingTools: ['tool1', 'tool2']
      };

      component.setValidationResult(validation);
      
      const summary = mockContainer.querySelector('.validation-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toContain('8 of 10');
    });

    it('should show feasibility score', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const feasibility = {
        score: 0.85,
        breakdown: {
          toolAvailability: 0.9,
          taskComplexity: 0.8,
          dependencyResolution: 0.85
        }
      };

      component.setFeasibilityScore(feasibility);
      
      const scoreDisplay = mockContainer.querySelector('.feasibility-score');
      expect(scoreDisplay.textContent).toContain('85%');
      
      const breakdown = mockContainer.querySelector('.feasibility-breakdown');
      expect(breakdown).toBeTruthy();
    });

    it('should list missing tools', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const missingTools = [
        { name: 'Redis', type: 'required', alternatives: ['Memcached'] },
        { name: 'Kubernetes', type: 'optional', alternatives: ['Docker Swarm'] }
      ];

      component.setMissingTools(missingTools);
      
      const missingList = mockContainer.querySelector('.missing-tools-list');
      expect(missingList).toBeTruthy();
      expect(missingList.textContent).toContain('Redis');
      expect(missingList.textContent).toContain('Kubernetes');
      
      const alternatives = mockContainer.querySelector('.alternatives');
      expect(alternatives.textContent).toContain('Memcached');
    });

    it('should show tool conflicts', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const conflicts = [
        {
          tools: ['tool1', 'tool2'],
          reason: 'Version incompatibility',
          resolution: 'Update tool1 to version 2.0'
        }
      ];

      component.setToolConflicts(conflicts);
      
      const conflictsList = mockContainer.querySelector('.conflicts-list');
      expect(conflictsList).toBeTruthy();
      expect(conflictsList.textContent).toContain('Version incompatibility');
    });

    it('should display task-tool mapping', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const mapping = {
        'task1': ['npm', 'git'],
        'task2': ['docker', 'kubectl'],
        'task3': ['python', 'pip']
      };

      component.setTaskToolMapping(mapping);
      
      const mappingTable = mockContainer.querySelector('.task-tool-mapping');
      expect(mappingTable).toBeTruthy();
      
      const task1Tools = mockContainer.querySelector('[data-task="task1"] .tools');
      expect(task1Tools.textContent).toContain('npm');
      expect(task1Tools.textContent).toContain('git');
    });

    it('should show validation warnings', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const warnings = [
        'Tool version may be outdated',
        'Alternative tool recommended for better performance'
      ];

      component.setValidationWarnings(warnings);
      
      const warningsList = mockContainer.querySelector('.validation-warnings');
      expect(warningsList).toBeTruthy();
      expect(warningsList.children.length).toBe(2);
    });

    it('should show validation errors', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const errors = [
        'Critical tool missing: Node.js',
        'Incompatible tool versions detected'
      ];

      component.setValidationErrors(errors);
      
      const errorsList = mockContainer.querySelector('.validation-errors');
      expect(errorsList).toBeTruthy();
      expect(errorsList.classList.contains('error')).toBe(true);
    });
  });

  describe('UI Interactions', () => {
    it('should handle tool selection', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const tools = [
        { id: 'tool1', name: 'Tool A' }
      ];
      component.setDiscoveredTools(tools);
      
      const toolCard = mockContainer.querySelector('[data-tool-id="tool1"]');
      toolCard.click();
      
      expect(toolCard.classList.contains('selected')).toBe(true);
      expect(mockUmbilical.onToolSelect).toHaveBeenCalledWith('tool1');
    });

    it('should handle refresh validation', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      mockUmbilical.toolRegistryActor.searchTools.mockResolvedValue([]);
      
      const refreshButton = mockContainer.querySelector('.refresh-validation-button');
      await refreshButton.click();
      
      expect(mockUmbilical.toolRegistryActor.searchTools).toHaveBeenCalled();
    });

    it('should expand/collapse sections', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const sectionHeader = mockContainer.querySelector('.section-header');
      sectionHeader.click();
      
      const section = sectionHeader.parentElement;
      expect(section.classList.contains('collapsed')).toBe(true);
      
      sectionHeader.click();
      expect(section.classList.contains('collapsed')).toBe(false);
    });

    it('should show tool details on hover', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const tools = [
        { id: 'tool1', name: 'Tool A', description: 'A helpful tool' }
      ];
      component.setDiscoveredTools(tools);
      
      const toolCard = mockContainer.querySelector('[data-tool-id="tool1"]');
      toolCard.dispatchEvent(new MouseEvent('mouseenter'));
      
      const tooltip = mockContainer.querySelector('.tool-tooltip');
      expect(tooltip).toBeTruthy();
      expect(tooltip.textContent).toContain('A helpful tool');
    });

    it('should handle category filter', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      const categoryFilter = mockContainer.querySelector('.category-filter');
      categoryFilter.value = 'database';
      categoryFilter.dispatchEvent(new Event('change'));
      
      const visibleTools = mockContainer.querySelectorAll('.tool-card[data-category="database"]:not(.hidden)');
      const hiddenTools = mockContainer.querySelectorAll('.tool-card:not([data-category="database"]).hidden');
      
      expect(visibleTools.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Updates', () => {
    it('should update when new tools are discovered', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      component.setDiscoveredTools([{ id: '1', name: 'Tool 1' }]);
      expect(mockContainer.querySelectorAll('.tool-card').length).toBe(1);
      
      component.addDiscoveredTool({ id: '2', name: 'Tool 2' });
      expect(mockContainer.querySelectorAll('.tool-card').length).toBe(2);
    });

    it('should update feasibility in real-time', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      component.setFeasibilityScore({ score: 0.5 });
      let scoreDisplay = mockContainer.querySelector('.feasibility-score');
      expect(scoreDisplay.textContent).toContain('50%');
      
      component.updateFeasibilityScore(0.75);
      scoreDisplay = mockContainer.querySelector('.feasibility-score');
      expect(scoreDisplay.textContent).toContain('75%');
    });

    it('should highlight newly available tools', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      component.markToolAvailable('tool1');
      
      const toolCard = mockContainer.querySelector('[data-tool-id="tool1"]');
      expect(toolCard.classList.contains('newly-available')).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should expose API through onMount', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      expect(mockUmbilical.onMount).toHaveBeenCalledWith(
        expect.objectContaining({
          setRequiredTools: expect.any(Function),
          setDiscoveredTools: expect.any(Function),
          setValidationResult: expect.any(Function),
          setFeasibilityScore: expect.any(Function),
          refreshValidation: expect.any(Function),
          getSelectedTools: expect.any(Function)
        })
      );
    });

    it('should clean up on destroy', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      component.destroy();
      
      expect(mockUmbilical.onDestroy).toHaveBeenCalled();
      expect(mockContainer.innerHTML).toBe('');
    });

    it('should integrate with tool registry actor', async () => {
      const { ToolValidationPanel } = await import('../../ToolValidationPanel.js');
      component = await ToolValidationPanel.create(mockUmbilical);

      mockUmbilical.toolRegistryActor.searchTools.mockResolvedValue([
        { id: 'tool1', name: 'Found Tool' }
      ]);
      
      await component.searchToolsForTask('Build API');
      
      expect(mockUmbilical.toolRegistryActor.searchTools).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'Build API' })
      );
    });
  });
});