/**
 * PlanToMarkdownTool - Convert plan JSON to readable markdown documentation
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class PlanToMarkdownTool extends Tool {
  constructor() {
    super({
      name: 'plan_to_markdown',
      description: 'Convert plan JSON to readable markdown documentation with analysis and visualization',
      inputSchema: z.object({
        plan: z.any().describe('The plan object to convert to markdown'),
        format: z.enum(['detailed', 'summary', 'execution-guide']).optional().default('detailed').describe('Markdown format style'),
        includeAnalysis: z.boolean().optional().default(true).describe('Include complexity and dependency analysis'),
        outputPath: z.string().optional().describe('Optional file path to write markdown (relative to current directory)')
      })
    });
  }
  
  async execute(params) {
    try {
      // Validate parameters
      if (params.plan === null) {
        return {
          success: false,
          error: 'Plan cannot be null'
        };
      }

      if (!params.plan) {
        return {
          success: false,
          error: 'Plan parameter is required'
        };
      }

      if (typeof params.plan !== 'object') {
        return {
          success: false,
          error: 'Plan must be an object'
        };
      }

      const plan = params.plan;
      const includeAnalysis = params.includeAnalysis !== false;
      const outputPath = params.outputPath;

      // Validate and normalize format
      const validFormats = ['detailed', 'summary', 'execution-guide'];
      let format = params.format || 'detailed';
      if (!validFormats.includes(format)) {
        format = 'detailed';
      }

      // Generate markdown based on format
      let markdown = '';
      let sections = [];

      switch (format) {
        case 'summary':
          markdown = this._generateSummaryMarkdown(plan);
          sections = ['overview', 'steps'];
          break;
        case 'execution-guide':
          markdown = this._generateExecutionGuideMarkdown(plan);
          sections = ['overview', 'prerequisites', 'execution-steps'];
          break;
        case 'detailed':
        default:
          markdown = this._generateDetailedMarkdown(plan, includeAnalysis);
          sections = ['overview', 'metadata', 'steps', 'dependencies'];
          if (includeAnalysis) {
            sections.push('analysis', 'complexity');
          }
          break;
      }

      // Calculate document statistics
      const stats = this._calculateDocumentStats(markdown);

      // Write to file if outputPath provided
      if (outputPath) {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          
          // Ensure directory exists
          const dir = path.dirname(outputPath);
          await fs.mkdir(dir, { recursive: true });
          
          // Write markdown file
          await fs.writeFile(outputPath, markdown, 'utf8');
          stats.writtenToFile = outputPath;
        } catch (writeError) {
          return {
            success: false,
            error: `Failed to write markdown file: ${writeError.message}`
          };
        }
      }

      return {
        success: true,
        markdown,
        sections,
        stats,
        format
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  _generateDetailedMarkdown(plan, includeAnalysis) {
    const sections = [];

    // Title and overview
    sections.push(`# ${plan.name || plan.id || 'Execution Plan'}`);
    sections.push('');

    if (plan.description) {
      sections.push(plan.description);
      sections.push('');
    }

    // Metadata section
    if (plan.metadata || plan.version) {
      sections.push('## Plan Information');
      sections.push('');
      
      if (plan.id) sections.push(`- **Plan ID**: ${plan.id}`);
      if (plan.version) sections.push(`- **Version**: ${plan.version}`);
      if (plan.metadata?.createdAt) sections.push(`- **Created**: ${plan.metadata.createdAt}`);
      if (plan.metadata?.createdBy) sections.push(`- **Created By**: ${plan.metadata.createdBy}`);
      if (plan.metadata?.complexity) sections.push(`- **Complexity**: ${plan.metadata.complexity}`);
      if (plan.metadata?.profile) sections.push(`- **Profile**: ${plan.metadata.profile}`);
      
      sections.push('');
    }

    // Required modules
    if (plan.metadata?.requiredModules) {
      sections.push('## Required Modules');
      sections.push('');
      plan.metadata.requiredModules.forEach(module => {
        sections.push(`- \`${module}\``);
      });
      sections.push('');
    }

    // Steps section
    if (plan.steps && plan.steps.length > 0) {
      sections.push('## Execution Steps');
      sections.push('');
      this._addStepsToMarkdown(sections, plan.steps, 0);
    }

    // Dependencies analysis
    if (includeAnalysis) {
      this._addDependencyAnalysis(sections, plan);
      this._addComplexityAnalysis(sections, plan);
    }

    // Success criteria
    if (plan.successCriteria) {
      sections.push('## Success Criteria');
      sections.push('');
      plan.successCriteria.forEach((criteria, index) => {
        sections.push(`${index + 1}. **${criteria.description}**`);
        if (criteria.condition) {
          sections.push(`   - Condition: \`${criteria.condition}\``);
        }
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  _generateSummaryMarkdown(plan) {
    const sections = [];

    sections.push(`# ${plan.name || plan.id || 'Plan Summary'}`);
    sections.push('');

    if (plan.description) {
      sections.push(plan.description);
      sections.push('');
    }

    // Quick stats
    const stepCount = this._countSteps(plan.steps || []);
    const actionCount = this._countActions(plan.steps || []);
    
    sections.push('## Quick Overview');
    sections.push('');
    sections.push(`- **Total Steps**: ${stepCount}`);
    sections.push(`- **Total Actions**: ${actionCount}`);
    if (plan.metadata?.requiredModules) {
      sections.push(`- **Required Modules**: ${plan.metadata.requiredModules.join(', ')}`);
    }
    sections.push('');

    // Steps list
    sections.push('## Steps');
    sections.push('');
    this._addStepsList(sections, plan.steps || [], 0);

    return sections.join('\n');
  }

  _generateExecutionGuideMarkdown(plan) {
    const sections = [];

    sections.push(`# ${plan.name || plan.id || 'Execution Guide'}`);
    sections.push('');

    if (plan.description) {
      sections.push(plan.description);
      sections.push('');
    }

    // Prerequisites
    sections.push('## Prerequisites');
    sections.push('');
    if (plan.metadata?.requiredModules) {
      sections.push('**Required Modules:**');
      plan.metadata.requiredModules.forEach(module => {
        sections.push(`- ${module}`);
      });
      sections.push('');
    }

    // Execution order
    if (plan.executionOrder) {
      sections.push('**Execution Order:**');
      plan.executionOrder.forEach((stepId, index) => {
        const step = this._findStepById(stepId, plan.steps || []);
        const stepName = step ? step.name || step.id : stepId;
        sections.push(`${index + 1}. ${stepName}`);
      });
      sections.push('');
    }

    // Detailed steps
    sections.push('## Execution Steps');
    sections.push('');
    this._addExecutionSteps(sections, plan.steps || [], 0);

    return sections.join('\n');
  }

  _addStepsToMarkdown(sections, steps, depth) {
    steps.forEach(step => {
      const indent = '  '.repeat(depth);
      const prefix = depth === 0 ? '###' : '####';
      
      sections.push(`${prefix} ${step.name || step.id}`);
      sections.push('');

      if (step.description) {
        sections.push(`  ${step.description}`);
        sections.push('');
      }

      // Step metadata
      const metadata = [];
      if (step.type) metadata.push(`**Type**: ${step.type}`);
      if (step.status) metadata.push(`**Status**: ${step.status}`);
      if (step.estimatedDuration) metadata.push(`**Estimated Duration**: ${step.estimatedDuration}ms`);
      if (step.dependencies && step.dependencies.length > 0) {
        metadata.push(`**Dependencies**: ${step.dependencies.join(', ')}`);
      }

      if (metadata.length > 0) {
        sections.push(`  ${metadata.join(' | ')}`);
        sections.push('');
      }

      // Step inputs and outputs
      if (step.inputs && step.inputs.length > 0) {
        sections.push(`  **Inputs**: ${step.inputs.join(', ')}`);
        sections.push('');
      }
      if (step.outputs && step.outputs.length > 0) {
        sections.push(`  **Outputs**: ${step.outputs.join(', ')}`);
        sections.push('');
      }

      // Actions
      if (step.actions && step.actions.length > 0) {
        sections.push('  **Actions:**');
        step.actions.forEach(action => {
          sections.push(`  - **${action.type}**: ${action.description || action.id || 'No description'}`);
          
          // Action inputs and outputs
          if (action.inputs && action.inputs.length > 0) {
            sections.push(`    - **Inputs**: ${action.inputs.join(', ')}`);
          }
          if (action.outputs && action.outputs.length > 0) {
            sections.push(`    - **Outputs**: ${action.outputs.join(', ')}`);
          }
          
          // Action parameters
          if (action.parameters) {
            const paramKeys = Object.keys(action.parameters);
            if (paramKeys.length > 0) {
              sections.push(`    - **Parameters**: ${paramKeys.join(', ')}`);
            }
          }
        });
        sections.push('');
      }

      // Nested steps
      if (step.steps && step.steps.length > 0) {
        this._addStepsToMarkdown(sections, step.steps, depth + 1);
      }
    });
  }

  _addStepsList(sections, steps, depth) {
    steps.forEach(step => {
      const indent = '  '.repeat(depth);
      sections.push(`${indent}- **${step.name || step.id}**`);
      if (step.description) {
        sections.push(`${indent}  ${step.description}`);
      }
      if (step.steps && step.steps.length > 0) {
        this._addStepsList(sections, step.steps, depth + 1);
      }
    });
  }

  _addExecutionSteps(sections, steps, depth) {
    steps.forEach((step, index) => {
      const stepNumber = depth === 0 ? `${index + 1}.` : `-`;
      sections.push(`${stepNumber} **${step.name || step.id}**`);
      sections.push('');

      if (step.description) {
        sections.push(`   ${step.description}`);
        sections.push('');
      }

      if (step.actions && step.actions.length > 0) {
        sections.push('   **Actions to perform:**');
        step.actions.forEach(action => {
          sections.push(`   - ${action.type}: ${action.description || 'Execute action'}`);
        });
        sections.push('');
      }

      if (step.steps && step.steps.length > 0) {
        sections.push('   **Sub-steps:**');
        this._addExecutionSteps(sections, step.steps, depth + 1);
      }
    });
  }

  _addDependencyAnalysis(sections, plan) {
    const dependencies = this._extractDependencies(plan.steps || []);
    
    if (dependencies.length > 0) {
      sections.push('## Dependencies');
      sections.push('');
      sections.push('```mermaid');
      sections.push('graph TD');
      
      // Add all steps
      const allSteps = this._getAllSteps(plan.steps || []);
      allSteps.forEach(step => {
        const stepId = step.id.replace(/[^a-zA-Z0-9]/g, '_');
        sections.push(`  ${stepId}["${step.name || step.id}"]`);
      });
      
      // Add dependencies
      dependencies.forEach(dep => {
        const fromId = dep.from.replace(/[^a-zA-Z0-9]/g, '_');
        const toId = dep.to.replace(/[^a-zA-Z0-9]/g, '_');
        sections.push(`  ${fromId} --> ${toId}`);
      });
      
      sections.push('```');
      sections.push('');
    }
  }

  _addComplexityAnalysis(sections, plan) {
    const stepCount = this._countSteps(plan.steps || []);
    const actionCount = this._countActions(plan.steps || []);
    const dependencyCount = this._countDependencies(plan.steps || []);
    const maxDepth = this._calculateMaxDepth(plan.steps || []);

    sections.push('## Complexity Analysis');
    sections.push('');
    sections.push('| Metric | Value |');
    sections.push('|--------|-------|');
    sections.push(`| Total Steps | ${stepCount} |`);
    sections.push(`| Total Actions | ${actionCount} |`);
    sections.push(`| Dependencies | ${dependencyCount} |`);
    sections.push(`| Max Depth | ${maxDepth} |`);
    sections.push(`| Complexity Score | ${stepCount + actionCount + dependencyCount} |`);
    sections.push('');
  }

  _extractDependencies(steps) {
    const dependencies = [];
    
    const extractFromSteps = (stepList) => {
      stepList.forEach(step => {
        if (step.dependencies) {
          step.dependencies.forEach(dep => {
            dependencies.push({ from: dep, to: step.id });
          });
        }
        if (step.steps) {
          extractFromSteps(step.steps);
        }
      });
    };
    
    extractFromSteps(steps);
    return dependencies;
  }

  _getAllSteps(steps) {
    const allSteps = [];
    steps.forEach(step => {
      allSteps.push(step);
      if (step.steps) {
        allSteps.push(...this._getAllSteps(step.steps));
      }
    });
    return allSteps;
  }

  _countSteps(steps) {
    let count = 0;
    steps.forEach(step => {
      count++;
      if (step.steps) {
        count += this._countSteps(step.steps);
      }
    });
    return count;
  }

  _countActions(steps) {
    let count = 0;
    steps.forEach(step => {
      if (step.actions) {
        count += step.actions.length;
      }
      if (step.steps) {
        count += this._countActions(step.steps);
      }
    });
    return count;
  }

  _countDependencies(steps) {
    let count = 0;
    steps.forEach(step => {
      if (step.dependencies) {
        count += step.dependencies.length;
      }
      if (step.steps) {
        count += this._countDependencies(step.steps);
      }
    });
    return count;
  }

  _calculateMaxDepth(steps, currentDepth = 1) {
    let maxDepth = currentDepth;
    steps.forEach(step => {
      if (step.steps && step.steps.length > 0) {
        const stepDepth = this._calculateMaxDepth(step.steps, currentDepth + 1);
        maxDepth = Math.max(maxDepth, stepDepth);
      }
    });
    return maxDepth;
  }

  _findStepById(stepId, steps) {
    for (const step of steps) {
      if (step.id === stepId) {
        return step;
      }
      if (step.steps) {
        const found = this._findStepById(stepId, step.steps);
        if (found) return found;
      }
    }
    return null;
  }

  _calculateDocumentStats(markdown) {
    const lines = markdown.split('\n');
    const words = markdown.split(/\s+/).filter(word => word.length > 0);
    const characters = markdown.length;
    
    return {
      lines: lines.length,
      words: words.length,
      characters,
      size: `${Math.round(characters / 1024 * 100) / 100} KB`
    };
  }
}