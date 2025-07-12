import { SessionState } from '../runtime/session/types';

export interface PromptTemplate {
  // System prompt template
  systemTemplate?: string;
  
  // How to format individual commands
  commandTemplate?: string;
  
  // How to format context
  contextTemplate?: string;
  
  // How to format history
  historyTemplate?: string;
  
  // Custom sections to add
  customSections?: CustomSection[];
}

export interface CustomSection {
  name: string;
  generator: (session: SessionState) => string;
  priority?: number;
}

// Alias for backward compatibility
export type PromptSection = CustomSection;

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PromptTemplateManager {
  /**
   * Merge two templates, with override taking precedence
   */
  mergeTemplates(base?: PromptTemplate, override?: PromptTemplate): PromptTemplate;
  
  /**
   * Render a template with variables
   */
  renderTemplate(template: string, variables: Record<string, any>): string;
  
  /**
   * Process custom sections from a template
   */
  processCustomSections(template: PromptTemplate, session: SessionState): string[];
  
  /**
   * Validate a template structure
   */
  validateTemplate(template: PromptTemplate): TemplateValidationResult;
  
  /**
   * Apply overrides to a base template
   */
  applyOverrides(base: PromptTemplate, overrides: Partial<PromptTemplate>): PromptTemplate;
  
  /**
   * Get built-in template variables
   */
  getBuiltInVariables(session: SessionState): Record<string, any>;
}