import { LLMCLIFramework } from '../../src/core/framework/LLMCLIFramework';
import { LLMProvider } from '../../src/core/providers/types';
import { CommandResult, CommandArgs } from '../../src/core/types';
import { ContextProvider, ContextData } from '../../src/runtime/context/types';
import { SessionState } from '../../src/runtime/session/types';

// Project and task types
interface Project {
  id: string;
  name: string;
  description?: string;
  created: Date;
  tasks: Task[];
  team: TeamMember[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: Date;
  created: Date;
  completed?: Date;
}

interface TeamMember {
  name: string;
  role: string;
  joined: Date;
}

interface ProjectManagerState {
  projects: Map<string, Project>;
  currentProjectId?: string;
  lastTaskId?: string;
}

// Custom context provider for project state
class ProjectContextProvider implements ContextProvider {
  name = 'project_context';
  description = 'Provides current project and task context';
  
  async getContext(session: SessionState): Promise<ContextData> {
    const state = session.state.get('project_state') as ProjectManagerState;
    if (!state) {
      return { summary: 'No projects created yet' };
    }
    
    const items: string[] = [];
    
    if (state.currentProjectId) {
      const project = state.projects.get(state.currentProjectId);
      if (project) {
        items.push(`Current project: ${project.name}`);
        items.push(`Tasks: ${project.tasks.length} (${project.tasks.filter(t => t.status === 'completed').length} completed)`);
        items.push(`Team size: ${project.team.length}`);
        
        if (state.lastTaskId) {
          const lastTask = project.tasks.find(t => t.id === state.lastTaskId);
          if (lastTask) {
            items.push(`Last task: "${lastTask.title}"`);
          }
        }
      }
    } else {
      items.push(`${state.projects.size} projects available`);
    }
    
    return {
      summary: items.join('\n'),
      details: {
        projectCount: state.projects.size,
        currentProject: state.currentProjectId,
        lastTask: state.lastTaskId
      },
      relevantCommands: state.currentProjectId 
        ? ['add_task', 'list_tasks', 'complete_task']
        : ['create_project', 'list_projects']
    };
  }
}

export class ProjectManagerCLI {
  private framework: LLMCLIFramework;
  private static persistentStorage: Map<string, any> = new Map();

  constructor(options: { llmProvider: LLMProvider }) {
    this.framework = new LLMCLIFramework({
      llmProvider: options.llmProvider,
      commands: {},
      contextProviders: [new ProjectContextProvider()],
      promptTemplate: {
        systemTemplate: `You are a project management assistant. You help users:
- Create and manage projects
- Track tasks and their status
- Manage team members and assignments
- Generate status reports
- Maintain project context

Always acknowledge the current project context when relevant.
Be helpful and suggest next actions when appropriate.`
      }
    });

    this.registerCommands();
  }

  private registerCommands(): void {
    // Project commands
    this.framework.registerCommand('create_project', {
      description: 'Create a new project',
      parameters: [
        { name: 'name', type: 'string', description: 'Project name', required: true },
        { name: 'description', type: 'string', description: 'Project description', required: false }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.createProject(params.name as string, params.description as string, session)
    });

    this.framework.registerCommand('list_projects', {
      description: 'List all projects',
      handler: async (_: CommandArgs, session: SessionState) => 
        this.listProjects(session)
    });

    this.framework.registerCommand('switch_project', {
      description: 'Switch to a different project',
      parameters: [
        { name: 'name', type: 'string', description: 'Project name', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.switchProject(params.name as string, session)
    });

    this.framework.registerCommand('delete_project', {
      description: 'Delete a project',
      parameters: [
        { name: 'name', type: 'string', description: 'Project name', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.deleteProject(params.name as string, session)
    });

    // Task commands
    this.framework.registerCommand('add_task', {
      description: 'Add a task to the current project',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: true },
        { name: 'description', type: 'string', description: 'Task description', required: false }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.addTask(params.title as string, params.description as string, session)
    });

    this.framework.registerCommand('list_tasks', {
      description: 'List tasks in the current project',
      parameters: [
        { name: 'filter', type: 'string', description: 'Filter type', required: false },
        { name: 'assignee', type: 'string', description: 'Filter by assignee', required: false }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.listTasks(params.filter as string, params.assignee as string, session)
    });

    this.framework.registerCommand('complete_task', {
      description: 'Mark a task as complete',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.completeTask(params.title as string, session)
    });

    this.framework.registerCommand('assign_task', {
      description: 'Assign a task to a team member',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: true },
        { name: 'assignee', type: 'string', description: 'Team member name', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.assignTask(params.title as string, params.assignee as string, session)
    });

    this.framework.registerCommand('set_priority', {
      description: 'Set task priority',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: true },
        { name: 'priority', type: 'string', description: 'Priority level', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.setPriority(params.title as string, params.priority as string, session)
    });

    this.framework.registerCommand('set_due_date', {
      description: 'Set task due date',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: true },
        { name: 'date', type: 'string', description: 'Due date', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.setDueDate(params.title as string, params.date as string, session)
    });

    this.framework.registerCommand('task_details', {
      description: 'Show detailed information about a task',
      parameters: [
        { name: 'title', type: 'string', description: 'Task title', required: false }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.taskDetails(params.title as string, session)
    });

    // Team commands
    this.framework.registerCommand('add_member', {
      description: 'Add a team member to the current project',
      parameters: [
        { name: 'name', type: 'string', description: 'Member name', required: true },
        { name: 'role', type: 'string', description: 'Member role', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.addMember(params.name as string, params.role as string, session)
    });

    this.framework.registerCommand('list_members', {
      description: 'List team members',
      handler: async (_: CommandArgs, session: SessionState) => 
        this.listMembers(session)
    });

    this.framework.registerCommand('remove_member', {
      description: 'Remove a team member',
      parameters: [
        { name: 'name', type: 'string', description: 'Member name', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.removeMember(params.name as string, session)
    });

    // Status and reporting
    this.framework.registerCommand('project_status', {
      description: 'Show project status and progress',
      handler: async (_: CommandArgs, session: SessionState) => 
        this.projectStatus(session)
    });

    // Search
    this.framework.registerCommand('search_tasks', {
      description: 'Search tasks by keyword',
      parameters: [
        { name: 'query', type: 'string', description: 'Search query', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.searchTasks(params.query as string, session)
    });

    // Bulk operations
    this.framework.registerCommand('bulk_complete', {
      description: 'Complete all tasks',
      handler: async (_: CommandArgs, session: SessionState) => 
        this.bulkComplete(session)
    });

    this.framework.registerCommand('bulk_assign', {
      description: 'Assign all tasks to a team member',
      parameters: [
        { name: 'assignee', type: 'string', description: 'Team member name', required: true }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.bulkAssign(params.assignee as string, session)
    });

    this.framework.registerCommand('clear_completed', {
      description: 'Clear completed tasks',
      handler: async (_: CommandArgs, session: SessionState) => 
        this.clearCompleted(session)
    });

    // Persistence
    this.framework.registerCommand('save_state', {
      description: 'Save project state',
      handler: async (_: CommandArgs, session: SessionState) => 
        this.saveState(session)
    });

    this.framework.registerCommand('load_state', {
      description: 'Load project state',
      handler: async (_: CommandArgs, session: SessionState) => 
        this.loadState(session)
    });

    // Help
    this.framework.registerCommand('help', {
      description: 'Show help information',
      parameters: [
        { name: 'topic', type: 'string', description: 'Help topic', required: false }
      ],
      handler: async (params: CommandArgs, session: SessionState) => 
        this.showHelp(params.topic as string)
    });
  }

  private getState(session: SessionState): ProjectManagerState {
    let state = session.state.get('project_state') as ProjectManagerState;
    if (!state) {
      state = {
        projects: new Map(),
        currentProjectId: undefined,
        lastTaskId: undefined
      };
      session.state.set('project_state', state);
    }
    return state;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Command implementations
  private async createProject(name: string, description: string | undefined, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    // Check if project already exists
    for (const project of state.projects.values()) {
      if (project.name.toLowerCase() === name.toLowerCase()) {
        return {
          success: false,
          error: `Project "${name}" already exists`
        };
      }
    }
    
    const project: Project = {
      id: this.generateId(),
      name,
      description,
      created: new Date(),
      tasks: [],
      team: []
    };
    
    state.projects.set(project.id, project);
    state.currentProjectId = project.id;
    
    return {
      success: true,
      output: `Project "${name}" created successfully. You are now working in this project.`
    };
  }

  private async listProjects(session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (state.projects.size === 0) {
      return {
        success: true,
        output: 'No projects found. Create one with "Create project <name>"'
      };
    }
    
    const projects = Array.from(state.projects.values());
    const output = projects.map(p => {
      const current = p.id === state.currentProjectId ? ' (current)' : '';
      const taskCount = p.tasks.length;
      const completedCount = p.tasks.filter(t => t.status === 'completed').length;
      return `• ${p.name}${current} - ${completedCount}/${taskCount} tasks completed`;
    }).join('\n');
    
    return {
      success: true,
      output: `Projects:\n${output}`
    };
  }

  private async switchProject(name: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    const project = Array.from(state.projects.values())
      .find(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (!project) {
      return {
        success: false,
        error: `Project "${name}" not found`
      };
    }
    
    state.currentProjectId = project.id;
    
    return {
      success: true,
      output: `Switched to project: ${project.name}`
    };
  }

  private async deleteProject(name: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    const project = Array.from(state.projects.values())
      .find(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (!project) {
      return {
        success: false,
        error: `Project "${name}" not found`
      };
    }
    
    state.projects.delete(project.id);
    
    if (state.currentProjectId === project.id) {
      state.currentProjectId = undefined;
    }
    
    return {
      success: true,
      output: `Project "${name}" deleted successfully`
    };
  }

  private async addTask(title: string, description: string | undefined, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected. Create or switch to a project first.'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    
    const task: Task = {
      id: this.generateId(),
      title,
      description,
      status: 'pending',
      priority: 'medium',
      created: new Date()
    };
    
    project.tasks.push(task);
    state.lastTaskId = task.id;
    
    return {
      success: true,
      output: `Task added to ${project.name}: "${title}"`
    };
  }

  private async listTasks(filter: string | undefined, assignee: string | undefined, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    let tasks = project.tasks;
    
    // Apply filters
    if (filter === 'completed') {
      tasks = tasks.filter(t => t.status === 'completed');
    } else if (filter === 'overdue') {
      const now = new Date();
      tasks = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'completed');
    } else if (filter === 'high_priority') {
      tasks = tasks.filter(t => t.priority === 'high');
    }
    
    if (assignee) {
      tasks = tasks.filter(t => t.assignee?.toLowerCase() === assignee.toLowerCase());
    }
    
    if (tasks.length === 0) {
      return {
        success: true,
        output: 'No tasks found matching the criteria'
      };
    }
    
    const output = tasks.map(t => {
      const status = t.status === 'completed' ? '✓' : '○';
      const priority = t.priority === 'high' ? '!' : t.priority === 'low' ? '↓' : '';
      const assigned = t.assignee ? ` (${t.assignee})` : '';
      const due = t.dueDate ? ` [due ${this.formatDate(t.dueDate)}]` : '';
      return `${status} ${priority} ${t.title}${assigned}${due}`;
    }).join('\n');
    
    return {
      success: true,
      output: `Tasks in ${project.name}:\n${output}`
    };
  }

  private async completeTask(title: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    const task = project.tasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    
    if (!task) {
      return {
        success: false,
        error: `Task "${title}" not found`
      };
    }
    
    task.status = 'completed';
    task.completed = new Date();
    
    return {
      success: true,
      output: `Task "${title}" marked as complete`
    };
  }

  private async assignTask(title: string, assignee: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    
    // Handle "last" or "it" references
    let task: Task | undefined;
    if (title === 'last' || title === 'it') {
      if (state.lastTaskId) {
        task = project.tasks.find(t => t.id === state.lastTaskId);
      }
    } else {
      task = project.tasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    }
    
    if (!task) {
      return {
        success: false,
        error: `Task "${title}" not found`
      };
    }
    
    task.assignee = assignee;
    
    return {
      success: true,
      output: `Task "${task.title}" assigned to ${assignee}`
    };
  }

  private async setPriority(title: string, priority: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    
    // Handle "last" or "it" references
    let task: Task | undefined;
    if (title === 'last' || title === 'it') {
      if (state.lastTaskId) {
        task = project.tasks.find(t => t.id === state.lastTaskId);
      }
    } else {
      task = project.tasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    }
    
    if (!task) {
      return {
        success: false,
        error: `Task "${title}" not found`
      };
    }
    
    if (!['low', 'medium', 'high'].includes(priority.toLowerCase())) {
      return {
        success: false,
        error: 'Priority must be low, medium, or high'
      };
    }
    
    task.priority = priority.toLowerCase() as 'low' | 'medium' | 'high';
    
    return {
      success: true,
      output: `Task "${task.title}" priority set to ${priority}`
    };
  }

  private async setDueDate(title: string, date: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    const task = project.tasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    
    if (!task) {
      return {
        success: false,
        error: `Task "${title}" not found`
      };
    }
    
    // Parse relative dates
    const dueDate = this.parseDate(date);
    task.dueDate = dueDate;
    
    return {
      success: true,
      output: `Task "${title}" due date set to ${this.formatDate(dueDate)}`
    };
  }

  private async taskDetails(title: string | undefined, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    
    let task: Task | undefined;
    if (!title || title === 'last') {
      if (state.lastTaskId) {
        task = project.tasks.find(t => t.id === state.lastTaskId);
      }
    } else {
      task = project.tasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    }
    
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }
    
    const details = [
      `Title: ${task.title}`,
      `Status: ${task.status}`,
      `Priority: ${task.priority}`,
      task.assignee ? `Assigned to: ${task.assignee}` : 'Unassigned',
      task.dueDate ? `Due: ${this.formatDate(task.dueDate)}` : 'No due date',
      `Created: ${this.formatDate(task.created)}`,
      task.completed ? `Completed: ${this.formatDate(task.completed)}` : ''
    ].filter(Boolean).join('\n');
    
    return {
      success: true,
      output: details
    };
  }

  private async addMember(name: string, role: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    
    if (project.team.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      return {
        success: false,
        error: `${name} is already a team member`
      };
    }
    
    project.team.push({
      name,
      role,
      joined: new Date()
    });
    
    return {
      success: true,
      output: `${name} added to the team as ${role}`
    };
  }

  private async listMembers(session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    
    if (project.team.length === 0) {
      return {
        success: true,
        output: 'No team members yet'
      };
    }
    
    const output = project.team.map(m => `• ${m.name} - ${m.role}`).join('\n');
    
    return {
      success: true,
      output: `Team members:\n${output}`
    };
  }

  private async removeMember(name: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    const index = project.team.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
    
    if (index === -1) {
      return {
        success: false,
        error: `${name} is not a team member`
      };
    }
    
    project.team.splice(index, 1);
    
    return {
      success: true,
      output: `${name} removed from the team`
    };
  }

  private async projectStatus(session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(t => t.status === 'completed').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const highPriorityTasks = project.tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
    const overdueTasks = project.tasks.filter(t => {
      return t.dueDate && t.dueDate < new Date() && t.status !== 'completed';
    });
    
    const output = [
      `Project: ${project.name}`,
      `Progress: ${completedTasks}/${totalTasks} tasks (${completionRate}% completion rate)`,
      `Team size: ${project.team.length} members`,
      highPriorityTasks.length > 0 ? `High priority tasks: ${highPriorityTasks.length}` : '',
      overdueTasks.length > 0 ? `Overdue tasks: ${overdueTasks.length}` : '',
      `Created: ${this.formatDate(project.created)}`
    ].filter(Boolean).join('\n');
    
    return {
      success: true,
      output: `Progress Report\n${'-'.repeat(40)}\n${output}`
    };
  }

  private async searchTasks(query: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    const tasks = project.tasks.filter(t => 
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(query.toLowerCase()))
    );
    
    if (tasks.length === 0) {
      return {
        success: true,
        output: `No tasks found containing "${query}"`
      };
    }
    
    const output = tasks.map(t => `• ${t.title}`).join('\n');
    
    return {
      success: true,
      output: `Tasks containing "${query}":\n${output}`
    };
  }

  private async bulkComplete(session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    let completed = 0;
    
    project.tasks.forEach(task => {
      if (task.status !== 'completed') {
        task.status = 'completed';
        task.completed = new Date();
        completed++;
      }
    });
    
    return {
      success: true,
      output: `${completed} tasks completed`
    };
  }

  private async bulkAssign(assignee: string, session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    let assigned = 0;
    
    project.tasks.forEach(task => {
      if (!task.assignee) {
        task.assignee = assignee;
        assigned++;
      }
    });
    
    return {
      success: true,
      output: `${assigned} tasks assigned to ${assignee}`
    };
  }

  private async clearCompleted(session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    if (!state.currentProjectId) {
      return {
        success: false,
        error: 'No project selected'
      };
    }
    
    const project = state.projects.get(state.currentProjectId)!;
    const before = project.tasks.length;
    project.tasks = project.tasks.filter(t => t.status !== 'completed');
    const cleared = before - project.tasks.length;
    
    return {
      success: true,
      output: `${cleared} tasks cleared`
    };
  }

  // Persistence (simplified for example)
  private async saveState(session: SessionState): Promise<CommandResult> {
    const state = this.getState(session);
    
    // Save to static storage for testing purposes
    const serializedState = {
      projects: Array.from(state.projects.entries()).map(([id, project]) => [
        id,
        {
          ...project,
          tasks: project.tasks.map(task => ({
            ...task,
            created: task.created.toISOString(),
            completed: task.completed?.toISOString(),
            dueDate: task.dueDate?.toISOString()
          }))
        }
      ]),
      currentProjectId: state.currentProjectId,
      lastTaskId: state.lastTaskId
    };
    
    ProjectManagerCLI.persistentStorage.set('project_state', serializedState);
    const projectCount = state.projects.size;
    
    return {
      success: true,
      output: `${projectCount} projects saved`
    };
  }

  private async loadState(session: SessionState): Promise<CommandResult> {
    const savedState = ProjectManagerCLI.persistentStorage.get('project_state');
    
    if (!savedState) {
      return {
        success: false,
        error: 'No saved state found'
      };
    }
    
    // Deserialize and restore state
    const restoredState: ProjectManagerState = {
      projects: new Map(savedState.projects.map(([id, project]: [string, any]) => [
        id,
        {
          ...project,
          tasks: project.tasks.map((task: any) => ({
            ...task,
            created: new Date(task.created),
            completed: task.completed ? new Date(task.completed) : undefined,
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined
          }))
        }
      ])),
      currentProjectId: savedState.currentProjectId,
      lastTaskId: savedState.lastTaskId
    };
    
    session.state.set('project_state', restoredState);
    const projectCount = restoredState.projects.size;
    
    return {
      success: true,
      output: `Projects loaded successfully (${projectCount} projects)`
    };
  }

  private async showHelp(topic: string | undefined): Promise<CommandResult> {
    if (topic && topic.includes('create')) {
      return {
        success: true,
        output: `To create a project:
• Create project "Project Name"
• Create project "My App" with description "A web application"

Example: Create project "Website Redesign"`
      };
    }
    
    return {
      success: true,
      output: `Project Manager Commands:

Projects:
• Create project "<name>" - Create a new project
• List projects - Show all projects
• Switch to project <name> - Switch active project
• Delete project "<name>" - Delete a project

Tasks:
• Add task "<title>" - Add a task to current project
• Show tasks - List all tasks
• Complete task "<title>" - Mark task as done
• Assign "<task>" to <person> - Assign task
• Set priority of "<task>" to <level> - Set priority (low/medium/high)
• Set due date of "<task>" to <date> - Set due date

Team:
• Add team member <name> as <role> - Add team member
• Show team - List team members
• Remove team member <name> - Remove member

Status:
• Show project status - View progress report
• Show overdue tasks - List overdue tasks
• Search tasks containing "<query>" - Search tasks

Use "help <topic>" for specific command help.`
    };
  }

  // Utility methods
  private parseDate(dateStr: string): Date {
    const now = new Date();
    const lower = dateStr.toLowerCase();
    
    if (lower === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (lower === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    } else if (lower === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    } else if (lower.includes('next week')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
    
    // Try to parse as date
    return new Date(dateStr);
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays === -1) return 'yesterday';
    
    return date.toLocaleDateString();
  }

  public async process(input: string): Promise<{ response: string }> {
    const result = await this.framework.processInput(input);
    return { response: result.message };
  }
}