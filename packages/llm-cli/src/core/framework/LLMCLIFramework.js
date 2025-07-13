import { SessionManager } from '../../runtime/session/SessionManager.js';
import { DefaultIntentRecognizer } from '../../processing/intent/recognizer/DefaultIntentRecognizer.js';
import { DefaultCommandExecutor } from '../../processing/execution/executor/DefaultCommandExecutor.js';
import { DefaultResponseGenerator } from '../../processing/response/generator/DefaultResponseGenerator.js';
import { DefaultPromptBuilder } from '../../prompt/builder/DefaultPromptBuilder.js';
import { ContextManager } from '../../runtime/context/ContextManager.js';
import { DefaultCommandValidator } from '../../processing/execution/validator/DefaultCommandValidator.js';
import { PluginManager } from '../../extensions/plugins/PluginManager.js';
import { DefaultChatCommand } from '../../extensions/commands/DefaultChatCommand.js';

export class LLMCLIFramework {
  constructor(config) {
    this.validateConfig(config);
    this.config = { ...config };
    
    // Initialize core components
    this.sessionManager = new SessionManager();
    this.intentRecognizer = config.intentRecognizer || new DefaultIntentRecognizer();
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

  async processInput(input) {
    try {
      // Validate input
      if (!input || input.trim() === '') {
        return {
          success: false,
          message: 'Empty input provided',
          executionId: this.generateExecutionId(),
          timestamp: new Date().toISOString(),
          command: 'unknown'
        };
      }

      const session = this.getSession();
      const executionId = this.generateExecutionId();
      const timestamp = new Date().toISOString();
      
      // Recognize intent
      let intent;
      try {
        intent = await this.intentRecognizer.recognizeIntent(input, this.config, session);
      } catch (error) {
        return {
          success: false,
          message: `Failed to parse intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          executionId,
          timestamp,
          command: 'unknown'
        };
      }

      // Check if command exists
      const commandDef = this.config.commands[intent.command];
      if (!commandDef) {
        return {
          success: false,
          message: `Unknown command: ${intent.command}`,
          executionId,
          timestamp,
          command: intent.command,
          suggestions: this.suggestSimilarCommands(intent.command)
        };
      }

      // Create execution context
      const executionContext = {
        command: intent.command,
        parameters: intent.parameters,
        originalIntent: input,
        startTime: Date.now()
      };

      // Execute command
      let commandResult;
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
        timestamp,
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
        timestamp: new Date().toISOString(),
        command: 'unknown'
      };
    }
  }

  registerCommand(name, command) {
    if (!name || name.trim() === '') {
      throw new Error('Command name cannot be empty');
    }

    this.validateCommandDefinition(command);
    this.config.commands[name] = command;
  }

  unregisterCommand(name) {
    const commandNames = Object.keys(this.config.commands);
    
    if (commandNames.length === 1 && commandNames[0] === name) {
      throw new Error('Cannot remove last command');
    }

    delete this.config.commands[name];
  }

  listCommands() {
    return Object.keys(this.config.commands).sort();
  }

  getSession() {
    return this.sessionManager.getState();
  }

  clearSession() {
    const session = this.getSession();
    session.history = [];
    session.state.clear();
    session.lastActivityTime = new Date();
  }

  exportSession() {
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

  importSession(sessionData) {
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

  getCommandInfo(name) {
    return this.config.commands[name];
  }

  setSystemPrompt(prompt) {
    this.config.systemPrompt = prompt;
  }

  addContextProvider(provider) {
    const session = this.getSession();
    
    // Check if provider already exists
    const existingIndex = session.contextProviders.findIndex(p => p.name === provider.name);
    if (existingIndex === -1) {
      session.contextProviders.push(provider);
    }
  }

  removeContextProvider(providerName) {
    const session = this.getSession();
    session.contextProviders = session.contextProviders.filter(p => p.name !== providerName);
  }

  updateConfig(newConfig) {
    this.validateConfig(newConfig);
    this.config = { ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }

  // Plugin management
  async loadPlugin(plugin, config) {
    await this.pluginManager.loadPlugin(plugin, config);
  }

  async loadPluginFromPath(path, config) {
    await this.pluginManager.loadPluginFromPath(path, config);
  }

  async unloadPlugin(name) {
    await this.pluginManager.unloadPlugin(name);
  }

  getPlugin(name) {
    return this.pluginManager.getPlugin(name);
  }

  listPlugins() {
    return this.pluginManager.listPlugins().map(p => p.name);
  }

  getPluginManager() {
    return this.pluginManager;
  }

  validateConfig(config) {
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

  validateCommandDefinition(command) {
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

  validateSessionData(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('Invalid session data: object is required');
    }

    if (!sessionData.sessionId || typeof sessionData.sessionId !== 'string') {
      throw new Error('Invalid session data: sessionId is required');
    }
  }

  updateSessionHistory(session, entry) {
    session.history.push(entry);
    session.lastActivityTime = new Date();
    
    // Keep history within reasonable limits
    const maxHistory = 100;
    if (session.history.length > maxHistory) {
      session.history = session.history.slice(-maxHistory);
    }
  }

  suggestSimilarCommands(command) {
    const availableCommands = Object.keys(this.config.commands);
    const suggestions = [];

    // Simple similarity check based on string distance
    for (const cmd of availableCommands) {
      if (this.calculateSimilarity(command, cmd) > 0.5) {
        suggestions.push(cmd);
      }
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

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

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}