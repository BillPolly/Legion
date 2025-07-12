import { CommandResult, LLMCLIConfig } from '../types';
import { SessionState } from '../runtime/session/types';
import { ContextProvider } from '../runtime/context/types';

export interface PluginMetadata {
  // Plugin identification
  name: string;
  version: string;
  description: string;
  
  // Optional metadata
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  
  // Dependencies on other plugins
  dependencies?: string[];
  
  // Plugin configuration schema
  configSchema?: Record<string, ConfigSchemaItem>;
}

export interface ConfigSchemaItem {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  default?: any;
  required?: boolean;
  description?: string;
  enum?: any[];
}

export interface PluginContext {
  // Access to framework functionality
  framework: PluginFrameworkAPI;
  
  // Plugin-specific configuration
  pluginConfig?: Record<string, any>;
  
  // Plugin data directory for persistence
  dataDir?: string;
  
  // Logger for the plugin
  logger?: PluginLogger;
}

export interface PluginFrameworkAPI {
  // Configuration access
  getConfig(): LLMCLIConfig;
  getSession(): SessionState;
  
  // Command management
  registerCommand(name: string, command: any): void;
  unregisterCommand(name: string): void;
  
  // Context provider management
  addContextProvider(provider: ContextProvider): void;
  removeContextProvider(name: string): void;
  
  // Plugin communication
  getPlugin?(name: string): Plugin | undefined;
  callPlugin?(name: string, method: string, ...args: any[]): Promise<any>;
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface Plugin {
  // Plugin metadata
  metadata: PluginMetadata;
  
  // Lifecycle methods
  initialize(context: PluginContext): Promise<void>;
  cleanup?(context: PluginContext): Promise<void>;
  
  // Hook methods
  onCommand?(command: string, result: CommandResult, context: PluginContext): Promise<void>;
  onError?(error: Error, context: PluginContext): Promise<void>;
  onSessionStart?(session: SessionState, context: PluginContext): Promise<void>;
  onSessionEnd?(session: SessionState, context: PluginContext): Promise<void>;
  
  // Plugin API methods (can be called by other plugins)
  [key: string]: any;
}

export interface PluginManager {
  // Plugin loading
  loadPlugin(plugin: Plugin, config?: Record<string, any>): Promise<void>;
  loadPluginFromPath(path: string, config?: Record<string, any>): Promise<void>;
  
  // Plugin management
  unloadPlugin(name: string): Promise<void>;
  getPlugin(name: string): Plugin | undefined;
  listPlugins(): PluginMetadata[];
  isLoaded(name: string): boolean;
  
  // Plugin execution
  executeHook(hookName: string, ...args: any[]): Promise<void>;
  
  // Configuration
  getPluginConfig(name: string): Record<string, any> | undefined;
  setPluginConfig(name: string, config: Record<string, any>): void;
}