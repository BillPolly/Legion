import { ProjectManagerCLI } from '../project-manager';
import { MockLLMProvider } from '../../../src/core/providers/MockLLMProvider';
import { setupProjectManagerMock } from '../test-helpers';

describe('ProjectManagerCLI', () => {
  let cli: ProjectManagerCLI;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    setupProjectManagerMock(mockProvider);
    cli = new ProjectManagerCLI({ llmProvider: mockProvider });
  });

  describe('project operations', () => {
    it('should create a new project', async () => {
      const result = await cli.process('Create a new project called "Website Redesign"');
      expect(result.response).toContain('created');
      expect(result.response).toContain('Website Redesign');
    });

    it('should list all projects', async () => {
      await cli.process('Create project "Project A"');
      await cli.process('Create project "Project B"');
      
      const result = await cli.process('Show all projects');
      expect(result.response).toContain('Project A');
      expect(result.response).toContain('Project B');
    });

    it('should switch between projects', async () => {
      await cli.process('Create project "Alpha"');
      await cli.process('Create project "Beta"');
      
      const result = await cli.process('Switch to project Beta');
      expect(result.response).toContain('Switched to project: Beta');
    });

    it('should delete a project', async () => {
      await cli.process('Create project "Temporary"');
      const result = await cli.process('Delete project "Temporary"');
      expect(result.response).toContain('deleted');
      
      const list = await cli.process('List projects');
      expect(list.response).not.toContain('Temporary');
    });
  });

  describe('task management', () => {
    beforeEach(async () => {
      await cli.process('Create project "Test Project"');
    });

    it('should add tasks to current project', async () => {
      const result = await cli.process('Add task "Design homepage"');
      expect(result.response).toContain('Task added');
      expect(result.response).toContain('Design homepage');
    });

    it('should list tasks in current project', async () => {
      await cli.process('Add task "Task 1"');
      await cli.process('Add task "Task 2"');
      
      const result = await cli.process('Show tasks');
      expect(result.response).toContain('Task 1');
      expect(result.response).toContain('Task 2');
    });

    it('should mark tasks as complete', async () => {
      await cli.process('Add task "Complete documentation"');
      const result = await cli.process('Complete task "Complete documentation"');
      expect(result.response).toContain('marked as complete');
    });

    it('should assign tasks to team members', async () => {
      await cli.process('Add task "Review code"');
      const result = await cli.process('Assign "Review code" to Alice');
      expect(result.response).toContain('assigned to Alice');
    });

    it('should set task priorities', async () => {
      await cli.process('Add task "Fix critical bug"');
      const result = await cli.process('Set priority of "Fix critical bug" to high');
      expect(result.response).toContain('priority set to high');
    });

    it('should set due dates', async () => {
      await cli.process('Add task "Submit report"');
      const result = await cli.process('Set due date of "Submit report" to tomorrow');
      expect(result.response).toContain('due date set');
    });
  });

  describe('status and reporting', () => {
    beforeEach(async () => {
      await cli.process('Create project "Status Test"');
      await cli.process('Add task "Task A"');
      await cli.process('Add task "Task B"');
      await cli.process('Complete task "Task A"');
    });

    it('should show project status', async () => {
      const result = await cli.process('Show project status');
      expect(result.response).toContain('Status Test');
      expect(result.response).toContain('Progress: 1/2');
      expect(result.response).toContain('50%');
    });

    it('should show overdue tasks', async () => {
      await cli.process('Add task "Overdue task"');
      await cli.process('Set due date of "Overdue task" to yesterday');
      
      const result = await cli.process('Show overdue tasks');
      expect(result.response).toContain('Overdue task');
    });

    it('should show tasks by assignee', async () => {
      await cli.process('Add task "Bob\'s task"');
      await cli.process('Assign "Bob\'s task" to Bob');
      
      const result = await cli.process('Show tasks assigned to Bob');
      expect(result.response).toContain("Bob's task");
    });

    it('should generate progress report', async () => {
      const result = await cli.process('Generate progress report');
      expect(result.response).toContain('Progress Report');
      expect(result.response).toContain('completion rate');
    });
  });

  describe('team management', () => {
    beforeEach(async () => {
      await cli.process('Create project "Team Project"');
    });

    it('should add team members', async () => {
      const result = await cli.process('Add team member Alice with role developer');
      expect(result.response).toContain('Alice added');
      expect(result.response).toContain('developer');
    });

    it('should list team members', async () => {
      await cli.process('Add team member Bob as designer');
      await cli.process('Add team member Carol as manager');
      
      const result = await cli.process('Show team');
      expect(result.response).toContain('Bob');
      expect(result.response).toContain('Carol');
      expect(result.response).toContain('designer');
      expect(result.response).toContain('manager');
    });

    it('should remove team members', async () => {
      await cli.process('Add team member Dave as tester');
      await cli.process('Remove team member Dave');
      
      const result = await cli.process('Show team');
      expect(result.response).not.toContain('Dave');
    });
  });

  describe('context awareness', () => {
    it('should remember current project context', async () => {
      await cli.process('Create project "Context Test"');
      const result = await cli.process('Add task "Test task"');
      expect(result.response).toContain('Context Test');
    });

    it('should handle ambiguous references', async () => {
      await cli.process('Create project "My Project"');
      await cli.process('Add task "First task"');
      
      // "it" should refer to the last created task
      const result = await cli.process('Assign it to Alice');
      expect(result.response).toContain('First task');
      expect(result.response).toContain('assigned to Alice');
    });

    it('should maintain task context', async () => {
      await cli.process('Create project "Test"');
      await cli.process('Add task "Important task"');
      await cli.process('Set its priority to high');
      
      const result = await cli.process('Show task details');
      expect(result.response).toContain('Important task');
      expect(result.response).toContain('Priority: high');
    });
  });

  describe('search and filtering', () => {
    beforeEach(async () => {
      await cli.process('Create project "Search Test"');
      await cli.process('Add task "Backend API development"');
      await cli.process('Add task "Frontend UI design"');
      await cli.process('Add task "Database optimization"');
    });

    it('should search tasks by keyword', async () => {
      const result = await cli.process('Find tasks containing "end"');
      expect(result.response).toContain('Backend');
      expect(result.response).toContain('Frontend');
      expect(result.response).not.toContain('Database');
    });

    it('should filter tasks by status', async () => {
      await cli.process('Complete task "Frontend UI design"');
      
      const result = await cli.process('Show completed tasks');
      expect(result.response).toContain('Frontend UI design');
      expect(result.response).not.toContain('Backend API');
    });

    it('should filter by priority', async () => {
      await cli.process('Set priority of "Backend API development" to high');
      
      const result = await cli.process('Show high priority tasks');
      expect(result.response).toContain('Backend API development');
      expect(result.response).not.toContain('Frontend UI');
    });
  });

  describe('bulk operations', () => {
    beforeEach(async () => {
      await cli.process('Create project "Bulk Test"');
      await cli.process('Add task "Task 1"');
      await cli.process('Add task "Task 2"');
      await cli.process('Add task "Task 3"');
    });

    it('should complete multiple tasks', async () => {
      const result = await cli.process('Complete all tasks');
      expect(result.response).toContain('3 tasks completed');
    });

    it('should assign multiple tasks', async () => {
      const result = await cli.process('Assign all tasks to Bob');
      expect(result.response).toContain('3 tasks assigned');
    });

    it('should clear completed tasks', async () => {
      await cli.process('Complete task "Task 1"');
      await cli.process('Complete task "Task 2"');
      
      const result = await cli.process('Clear completed tasks');
      expect(result.response).toContain('2 tasks cleared');
      
      const list = await cli.process('Show tasks');
      expect(list.response).toContain('Task 3');
      expect(list.response).not.toContain('Task 1');
    });
  });

  describe('persistence', () => {
    it('should save and restore project state', async () => {
      await cli.process('Create project "Persistent"');
      await cli.process('Add task "Remember me"');
      
      // Simulate saving
      const saveResult = await cli.process('Save projects');
      expect(saveResult.response).toContain('saved');
      
      // Create new instance
      const newCli = new ProjectManagerCLI({ llmProvider: mockProvider });
      
      // Load state
      const loadResult = await newCli.process('Load projects');
      expect(loadResult.response).toContain('loaded');
      
      // Verify data persisted
      const list = await newCli.process('Show projects');
      expect(list.response).toContain('Persistent');
    });
  });

  describe('help and documentation', () => {
    it('should provide contextual help', async () => {
      const result = await cli.process('help');
      // The help command should be processed and return available commands
      expect(result.response).toBeDefined();
    });

    it('should explain specific commands', async () => {
      const result = await cli.process('How do I create a project?');
      // Should provide help information
      expect(result.response).toBeDefined();
    });
  });
});