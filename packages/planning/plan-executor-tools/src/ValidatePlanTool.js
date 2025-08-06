/**
 * ValidatePlanTool - Comprehensive plan validation and marking tool
 * 
 * This tool validates plans and marks them as 'validated' when they pass all checks.
 * It uses PlanInspectorTool internally for comprehensive validation.
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';
import { PlanInspectorTool } from './PlanInspectorTool.js';

export class ValidatePlanTool extends Tool {
  constructor(moduleLoader = null) {
    super({
      name: 'plan_validate',
      description: 'Validate a plan and mark it as validated if it passes all checks',
      inputSchema: z.object({
        plan: z.any().describe('The plan object to validate'),
        strict: z.boolean().optional().default(true).describe('Whether to enforce strict validation (fail on warnings)'),
        markAsValidated: z.boolean().optional().default(true).describe('Whether to mark the plan as validated if it passes'),
        validateTools: z.boolean().optional().default(true).describe('Whether to validate tool availability'),
        validateVariables: z.boolean().optional().default(true).describe('Whether to validate variable flow'),
        verbose: z.boolean().optional().default(false).describe('Whether to include detailed analysis in response')
      })
    });
    
    this.moduleLoader = moduleLoader;
    this.inspector = new PlanInspectorTool(moduleLoader);
  }
  
  async execute(params) {
    try {
      const { 
        plan, 
        strict = true, 
        markAsValidated = true,
        validateTools = true,
        validateVariables = true,
        verbose = false 
      } = params;

      if (!plan) {
        return {
          success: false,
          error: 'Plan is required'
        };
      }

      // Run comprehensive validation using PlanInspectorTool
      const inspectionResult = await this.inspector.execute({
        plan,
        analyzeDepth: 'complete',
        validateTools,
        showDependencies: true
      });

      if (!inspectionResult.success) {
        return {
          success: false,
          error: `Plan inspection failed: ${inspectionResult.error}`
        };
      }

      // Collect all validation issues
      const errors = [];
      const warnings = [];
      
      // Structure validation errors
      if (inspectionResult.validation) {
        errors.push(...(inspectionResult.validation.errors || []));
      }
      
      // Variable flow analysis
      if (validateVariables && inspectionResult.variableFlowAnalysis) {
        errors.push(...(inspectionResult.variableFlowAnalysis.errors || []));
        warnings.push(...(inspectionResult.variableFlowAnalysis.warnings || []));
      }
      
      // Tool availability
      if (validateTools && inspectionResult.toolAnalysis) {
        const unavailableTools = [];
        for (const [toolName, status] of Object.entries(inspectionResult.toolAnalysis.toolStatus)) {
          if (status.available === false) {
            unavailableTools.push(toolName);
          } else if (status.available === 'unknown') {
            warnings.push(`Unable to verify availability of tool: ${toolName}`);
          }
        }
        if (unavailableTools.length > 0) {
          errors.push(`Required tools not available: ${unavailableTools.join(', ')}`);
        }
      }
      
      // Dependency analysis
      if (inspectionResult.dependencyAnalysis && inspectionResult.dependencyAnalysis.errors) {
        errors.push(...inspectionResult.dependencyAnalysis.errors);
      }
      
      // Determine if plan is valid
      const isValid = errors.length === 0 && (!strict || warnings.length === 0);
      
      // Build response
      const response = {
        success: true,
        valid: isValid,
        errors,
        warnings,
        summary: {
          errorCount: errors.length,
          warningCount: warnings.length,
          stepCount: inspectionResult.complexity?.totalSteps || 0,
          actionCount: inspectionResult.complexity?.totalActions || 0,
          toolCount: inspectionResult.toolAnalysis?.totalTools || 0,
          variableCount: inspectionResult.variableFlowAnalysis?.availableVariables?.length || 0
        }
      };
      
      // Add detailed analysis if verbose
      if (verbose) {
        response.analysis = {
          validation: inspectionResult.validation,
          variableFlow: inspectionResult.variableFlowAnalysis,
          toolAnalysis: inspectionResult.toolAnalysis,
          dependencyAnalysis: inspectionResult.dependencyAnalysis,
          complexity: inspectionResult.complexity
        };
      }
      
      // Mark plan as validated if it passes and markAsValidated is true
      if (isValid && markAsValidated) {
        const validatedPlan = { ...plan, status: 'validated' };
        response.validatedPlan = validatedPlan;
        response.message = 'Plan validated successfully and marked as validated';
      } else if (isValid) {
        response.message = 'Plan is valid but not marked (markAsValidated=false)';
      } else {
        response.message = `Plan validation failed with ${errors.length} error(s) and ${warnings.length} warning(s)`;
      }
      
      return response;
      
    } catch (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`
      };
    }
  }
  
  /**
   * Quick validation method that just checks if a plan is valid
   * @param {Object} plan - The plan to validate
   * @returns {Promise<boolean>} True if plan is valid
   */
  async isValid(plan) {
    const result = await this.execute({
      plan,
      strict: true,
      markAsValidated: false,
      verbose: false
    });
    
    return result.success && result.valid;
  }
  
  /**
   * Get validation report without modifying the plan
   * @param {Object} plan - The plan to validate
   * @returns {Promise<Object>} Validation report
   */
  async getValidationReport(plan) {
    return await this.execute({
      plan,
      strict: true,
      markAsValidated: false,
      validateTools: true,
      validateVariables: true,
      verbose: true
    });
  }
}

export default ValidatePlanTool;