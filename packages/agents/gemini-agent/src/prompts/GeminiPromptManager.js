import { ResourceManager } from '@legion/resource-manager';

export class GeminiPromptManager {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.promptCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getCachedPrompt(key, builder) {
    const cached = this.promptCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.value;
    }
    const value = await builder();
    this.promptCache.set(key, { value, timestamp: Date.now() });
    return value;
  }

  async buildSystemPrompt(userMemory = null) {
    const directoryContext = await this.getDirectoryContext();
    const environmentContext = await this.getEnvironmentContext();
    const toolDescriptions = await this.buildToolDescriptions();
    const memorySection = userMemory ? `\n\nUser Memory:\n${userMemory}` : '';

    return `You are Gemini, an interactive CLI agent that helps with software engineering tasks.

## Core Mandates
- Assist with Software Engineering Tasks
- Provide accurate and helpful responses
- Follow best practices and coding standards

## Software Engineering Tasks
- Code analysis and review
- File operations and management
- Development workflow assistance

${directoryContext}
${environmentContext}
${toolDescriptions}${memorySection}`;
  }

  async getDirectoryContext() {
    const workingDir = this.resourceManager.get('env.PWD') || this.resourceManager.get('workingDirectory');
    return `Current Directory Context:\nWorking directory: ${workingDir}`;
  }

  async getEnvironmentContext() {
    const nodeVersion = this.resourceManager.get('env.NODE_VERSION') || 'unknown';
    const platform = this.resourceManager.get('env.PLATFORM') || 'unknown';
    return `Environment Context:\nNode.js: ${nodeVersion}\nPlatform: ${platform}`;
  }

  async buildToolDescriptions() {
    // For now, return basic tool descriptions - this should be integrated with Legion's tool registry
    return `Available Tools:\n- read_file: Read file contents\n- write_file: Write file contents\n- edit_file: Edit file contents\n- list_files: List directory contents\n- shell_command: Execute shell commands\n- grep_search: Search within files`;
  }

  getCompressionPrompt() {
    return `This compression agent summarizes internal chat history to preserve context.

<state_snapshot>
Please analyze the conversation state and extract key information.
</state_snapshot>

<user_goal>
Identify the user's primary objectives and goals.
</user_goal>

<project_context>
Preserve important project and file context.
</project_context>

<completed_actions>
Track what has been accomplished so far.
</completed_actions>

Please summarize the following conversation while preserving key context about files, code changes, and important decisions:`;
  }

  async getToolDescriptions() {
    return await this.buildToolDescriptions();
  }

  async buildCompressionPrompt() {
    return `Please summarize the following conversation while preserving key context about files, code changes, and important decisions:`;
  }
}
