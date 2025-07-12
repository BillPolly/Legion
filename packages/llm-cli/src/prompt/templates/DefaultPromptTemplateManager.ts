import { PromptTemplateManager, PromptTemplate, CustomSection, TemplateValidationResult } from '../types';
import { SessionState } from '../../runtime/session/types';

export class DefaultPromptTemplateManager implements PromptTemplateManager {
  mergeTemplates(base?: PromptTemplate, override?: PromptTemplate): PromptTemplate {
    if (!base && !override) {
      return {};
    }
    
    if (!base) {
      return { ...override };
    }
    
    if (!override) {
      return { ...base };
    }
    
    return {
      systemTemplate: override.systemTemplate || base.systemTemplate,
      commandTemplate: override.commandTemplate || base.commandTemplate,
      contextTemplate: override.contextTemplate || base.contextTemplate,
      historyTemplate: override.historyTemplate || base.historyTemplate,
      customSections: override.customSections || base.customSections
    };
  }

  renderTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    
    // Replace simple variables like {{name}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(variables, key.trim());
      return value !== undefined ? String(value) : match;
    });
    
    return result;
  }

  processCustomSections(template: PromptTemplate, session: SessionState): string[] {
    if (!template.customSections) {
      return [];
    }
    
    // Sort by priority (highest first)
    const sortedSections = [...template.customSections].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });
    
    return sortedSections.map(section => section.generator(session));
  }

  validateTemplate(template: PromptTemplate): TemplateValidationResult {
    const errors: string[] = [];
    
    // Check for valid template syntax
    if (template.systemTemplate && !this.isValidTemplateSyntax(template.systemTemplate)) {
      errors.push('Invalid template syntax in systemTemplate');
    }
    
    if (template.commandTemplate && !this.isValidTemplateSyntax(template.commandTemplate)) {
      errors.push('Invalid template syntax in commandTemplate');
    }
    
    if (template.contextTemplate && !this.isValidTemplateSyntax(template.contextTemplate)) {
      errors.push('Invalid template syntax in contextTemplate');
    }
    
    if (template.historyTemplate && !this.isValidTemplateSyntax(template.historyTemplate)) {
      errors.push('Invalid template syntax in historyTemplate');
    }
    
    // Check for required variables
    if (template.systemTemplate && !template.systemTemplate.includes('{{basePrompt}}')) {
      errors.push('systemTemplate must contain {{basePrompt}} variable');
    }
    
    // Validate custom sections
    if (template.customSections) {
      template.customSections.forEach((section, index) => {
        if (!section.name || section.name.trim() === '') {
          errors.push('Custom section must have a name');
        }
        
        if (typeof section.generator !== 'function') {
          errors.push(`Custom section ${section.name || index} must have a generator function`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  applyOverrides(base: PromptTemplate, overrides: Partial<PromptTemplate>): PromptTemplate {
    return {
      ...base,
      ...overrides
    };
  }

  getBuiltInVariables(session: SessionState): Record<string, any> {
    return {
      sessionId: session.sessionId,
      timestamp: session.lastActivityTime.toISOString(),
      stateSize: session.state.size,
      historyLength: session.history.length,
      startTime: session.startTime.toISOString(),
      contextProviderCount: session.contextProviders.length
    };
  }

  private isValidTemplateSyntax(template: string): boolean {
    // Check for matching braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    
    return openBraces === closeBraces;
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}