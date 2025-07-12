import { LLMCLIConfig, CommandDefinition, CommandResult } from '../types';
import { SessionState, HistoryEntry } from '../../runtime/session/types';
import { ContextProvider } from '../../runtime/context/types';
import { GeneratedResponse } from '../../processing/response/types';
import { Intent } from '../../processing/intent/types';
import { SessionManager } from '../../runtime/session/SessionManager';
import { DefaultIntentRecognizer } from '../../processing/intent/recognizer/DefaultIntentRecognizer';
import { DefaultCommandExecutor } from '../../processing/execution/executor/DefaultCommandExecutor';
import { DefaultResponseGenerator } from '../../processing/response/generator/DefaultResponseGenerator';
import { DefaultPromptBuilder } from '../../prompt/builder/DefaultPromptBuilder';
import { ContextManager } from '../../runtime/context/ContextManager';
import { DefaultCommandValidator } from '../../processing/execution/validator/DefaultCommandValidator';
import { PluginManager } from '../../extensions/plugins/PluginManager';
import { Plugin } from '../../extensions/plugins/types';
import { DefaultChatCommand } from '../../extensions/commands/DefaultChatCommand';

export class LLMCLIFramework {
  private config: LLMCLIConfig;
  private sessionManager: SessionManager;
  private intentRecognizer: DefaultIntentRecognizer;
  private commandExecutor: DefaultCommandExecutor;
  private responseGenerator: DefaultResponseGenerator;
  private promptBuilder: DefaultPromptBuilder;
  private contextManager: ContextManager;
  private commandValidator: DefaultCommandValidator;
  private pluginManager: PluginManager;

  constructor(config: LLMCLIConfig) {
    this.validateConfig(config);
    this.config = { ...config };
    
    // Initialize core components
    this.sessionManager = new SessionManager();
    this.intentRecognizer = new DefaultIntentRecognizer();
    this.commandValidator = new DefaultCommandValidator();
    this.commandExecutor = new DefaultCommandExecutor(this.commandValidator);
    this.responseGenerator = new DefaultResponseGenerator();
    this.promptBuilder = new DefaultPromptBuilder();
    this.contextManager = new ContextManager();
    this.pluginManager = new PluginManager(this);
    
    // Register default chat command if not disabled
    if (!config.disableDefaultChat && !config.commands['chat']) {
      const defaultChatCommand = new DefaultChatCommand();
      this.config.commands['chat'] = defaultChatCommand.getCommandDefinition(config.llmProvider);
    }
  }

  async processInput(input: string): Promise<GeneratedResponse> {
    try {
      // Validate input
      if (!input || input.trim() === '') {
        return {
          success: false,
          message: 'Empty input provided',
          executionId: this.generateExecutionId(),
          timestamp: new Date(),
          command: 'unknown'
        };
      }

      const session = this.getSession();
      const executionId = this.generateExecutionId();
      
      // Recognize intent
      let intent: Intent;
      try {
        intent = await this.intentRecognizer.recognizeIntent(input, this.config, session);
      } catch (error) {
        return {
          success: false,
          message: `Failed to parse intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          executionId,
          timestamp: new Date(),
          command: 'unknown'
        };
      }

      // Check if command exists
      console.log('[Framework] Looking for command:', intent.command);
      console.log('[Framework] Commands available:', Object.keys(this.config.commands));
      const commandDef = this.config.commands[intent.command];
      if (!commandDef) {
        console.log('[Framework] Command not found:', intent.command);
        return {
          success: false,
          message: `Unknown command: ${intent.command}`,
          executionId,
          timestamp: new Date(),
          command: intent.command,
          suggestions: this.suggestSimilarCommands(intent.command)
        };
      }
      console.log('[Framework] Command found, executing...');

      // Create execution context
      const executionContext = {
        command: intent.command,
        parameters: intent.parameters,
        originalIntent: intent,
        session,
        executionId,
        startTime: new Date()
      };

      // Execute command
      let commandResult: CommandResult;
      try {
        commandResult = await this.commandExecutor.executeCommand(intent, commandDef, session);
      } catch (error) {
        commandResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Command execution failed'
        };
      }

      // Execute plugin hooks
      await this.pluginManager.executeHook('onCommand', intent.command, commandResult);

      // Generate response
      const response = await this.responseGenerator.generateResponse(executionContext, commandResult, this.config);

      // Update session history
      this.updateSessionHistory(session, {
        id: executionId,
        timestamp: new Date(),
        input,
        intent,
        result: commandResult
      });

      return response;
      
    } catch (error) {
      // Execute error hook
      if (error instanceof Error) {
        await this.pluginManager.executeHook('onError', error);
      }
      
      return {
        success: false,
        message: `Framework error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionId: this.generateExecutionId(),
        timestamp: new Date(),
        command: 'unknown'
      };
    }
  }

  registerCommand(name: string, command: CommandDefinition): void {
    if (!name || name.trim() === '') {
      throw new Error('Command name cannot be empty');
    }

    this.validateCommandDefinition(command);
    this.config.commands[name] = command;
  }

  unregisterCommand(name: string): void {
    const commandNames = Object.keys(this.config.commands);
    
    if (commandNames.length === 1 && commandNames[0] === name) {
      throw new Error('Cannot remove last command');
    }

    delete this.config.commands[name];
  }

  listCommands(): string[] {
    return Object.keys(this.config.commands).sort();
  }

  getSession(): SessionState {
    return this.sessionManager.getState();
  }

  clearSession(): void {
    const session = this.getSession();
    session.history = [];
    session.state.clear();
    session.lastActivityTime = new Date();
  }

  exportSession(): any {
    const session = this.getSession();
    return {
      sessionId: session.sessionId,
      state: Object.fromEntries(session.state),
      history: session.history,
      contextProviders: session.contextProviders.map(p => ({ name: p.name, description: p.description })),
      startTime: session.startTime,
      lastActivityTime: session.lastActivityTime
    };
  }

  importSession(sessionData: any): void {
    this.validateSessionData(sessionData);
    
    const session = this.getSession();
    session.sessionId = sessionData.sessionId;
    
    // Handle state - it could be an object or already a Map
    if (sessionData.state instanceof Map) {
      session.state = new Map(sessionData.state);
    } else {
      session.state = new Map(Object.entries(sessionData.state || {}));
    }
    
    session.history = sessionData.history || [];
    session.startTime = new Date(sessionData.startTime);
    session.lastActivityTime = new Date(sessionData.lastActivityTime);
  }

  getCommandInfo(name: string): CommandDefinition | undefined {
    return this.config.commands[name];
  }

  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
  }

  addContextProvider(provider: ContextProvider): void {
    const session = this.getSession();
    
    // Check if provider already exists
    const existingIndex = session.contextProviders.findIndex(p => p.name === provider.name);
    if (existingIndex === -1) {
      session.contextProviders.push(provider);
    }
  }

  removeContextProvider(providerName: string): void {
    const session = this.getSession();
    session.contextProviders = session.contextProviders.filter(p => p.name !== providerName);
  }

  updateConfig(newConfig: LLMCLIConfig): void {
    this.validateConfig(newConfig);
    this.config = { ...newConfig };
  }

  getConfig(): LLMCLIConfig {
    return { ...this.config };
  }

  // Plugin management
  async loadPlugin(plugin: Plugin, config?: Record<string, any>): Promise<void> {
    await this.pluginManager.loadPlugin(plugin, config);
  }

  async loadPluginFromPath(path: string, config?: Record<string, any>): Promise<void> {
    await this.pluginManager.loadPluginFromPath(path, config);
  }

  async unloadPlugin(name: string): Promise<void> {
    await this.pluginManager.unloadPlugin(name);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.pluginManager.getPlugin(name);
  }

  listPlugins(): string[] {
    return this.pluginManager.listPlugins().map(p => p.name);
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  private validateConfig(config: LLMCLIConfig): void {
    if (!config) {
      throw new Error('Invalid configuration: config is required');
    }

    if (!config.llmProvider) {
      throw new Error('Invalid configuration: llmProvider is required');
    }

    if (!config.commands || typeof config.commands !== 'object') {
      throw new Error('Invalid configuration: commands object is required');
    }
  }

  private validateCommandDefinition(command: CommandDefinition): void {
    if (!command) {
      throw new Error('Invalid command definition: command is required');
    }

    if (typeof command.handler !== 'function') {
      throw new Error('Invalid command definition: handler must be a function');
    }

    if (!command.description || typeof command.description !== 'string') {
      throw new Error('Invalid command definition: description is required');
    }
  }

  private validateSessionData(sessionData: any): void {
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('Invalid session data: object is required');
    }

    if (!sessionData.sessionId || typeof sessionData.sessionId !== 'string') {
      throw new Error('Invalid session data: sessionId is required');
    }
  }

  private updateSessionHistory(session: SessionState, entry: HistoryEntry): void {
    session.history.push(entry);
    session.lastActivityTime = new Date();
    
    // Keep history within reasonable limits
    const maxHistory = 100;
    if (session.history.length > maxHistory) {
      session.history = session.history.slice(-maxHistory);
    }
  }

  private suggestSimilarCommands(command: string): string[] {
    const availableCommands = Object.keys(this.config.commands);
    const suggestions: string[] = [];

    // Simple similarity check based on string distance
    for (const cmd of availableCommands) {
      if (this.calculateSimilarity(command, cmd) > 0.5) {
        suggestions.push(cmd);
      }
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}