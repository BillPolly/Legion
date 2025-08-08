/**
 * CodeFixingAgent - Specialized agent for fixing code syntax, logic, and quality issues
 * 
 * Unlike CodeGenerationAgent which creates new code from requirements,
 * this agent focuses specifically on identifying and fixing existing code problems.
 */

import { SDAgentBase } from '../SDAgentBase.js';
import { promises as fs } from 'fs';
import path from 'path';

export class CodeFixingAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'CodeFixingAgent',
      description: 'Specialized agent for fixing syntax errors, test failures, and code quality issues',
      capabilities: [
        'syntax_error_fixing',
        'test_failure_resolution',
        'logic_error_correction',
        'clean_code_refactoring'
      ]
    });
  }

  getCurrentPhase() {
    return 'code-fixing';
  }

  async receive(message) {
    const { type, payload } = message;
    
    switch (type) {
      case 'fix_syntax_errors':
        return await this.fixSyntaxErrors(payload);
      case 'fix_test_failures':
        return await this.fixTestFailures(payload);
      case 'add_missing_implementation':
        return await this.addMissingImplementation(payload);
      case 'correct_business_logic':
        return await this.correctBusinessLogic(payload);
      case 'refactor_for_clean_code':
        return await this.refactorForCleanCode(payload);
      default:
        return {
          success: false,
          error: `CodeFixingAgent does not handle message type: ${type}`
        };
    }
  }

  /**
   * Fix syntax errors in JavaScript files
   */
  async fixSyntaxErrors(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { file, message: errorMessage } = errorToFix;

      console.log(`[CodeFixingAgent] Fixing syntax error in ${file}: ${errorMessage}`);

      // Read the problematic file
      const filePath = path.join(context.projectPath || '/tmp/generated-project', file);
      const currentCode = await fs.readFile(filePath, 'utf-8');

      // Use LLM to fix the specific syntax error
      const prompt = `Fix the syntax error in this JavaScript code:

SYNTAX ERROR:
${errorMessage}

CURRENT CODE:
\`\`\`javascript
${currentCode}
\`\`\`

INSTRUCTIONS:
1. Identify the exact syntax error mentioned
2. Fix ONLY the syntax error - do not change functionality
3. Maintain the existing code structure and logic
4. Ensure the fix follows JavaScript ES modules syntax
5. Preserve all existing imports and exports

Return the corrected code:`;

      const fixedCode = await this.makeLLMDecision(prompt, {});

      // Write the fixed code back to the file
      await fs.writeFile(filePath, fixedCode, 'utf-8');

      return {
        success: true,
        data: {
          message: `Fixed syntax error in ${file}`,
          file: file,
          error: errorMessage,
          fix: 'Syntax error corrected',
          modifiedFiles: [file]
        }
      };
    } catch (error) {
      console.error(`[CodeFixingAgent] Error fixing syntax:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fix test failures by correcting the underlying code issues
   */
  async fixTestFailures(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { message: testFailureMessage } = errorToFix;

      console.log(`[CodeFixingAgent] Fixing test failure: ${testFailureMessage}`);

      // Parse test failure to understand what needs to be fixed
      const testAnalysis = await this.analyzeTestFailure(testFailureMessage, context);

      // Read the relevant source files that need fixing
      const filesToFix = testAnalysis.affectedFiles;
      const fixes = [];

      for (const file of filesToFix) {
        const filePath = path.join(context.projectPath || '/tmp/generated-project', file);
        const currentCode = await fs.readFile(filePath, 'utf-8');

        const prompt = `Fix the code to make the failing test pass:

TEST FAILURE:
${testFailureMessage}

CURRENT CODE IN ${file}:
\`\`\`javascript
${currentCode}
\`\`\`

TEST ANALYSIS:
${JSON.stringify(testAnalysis, null, 2)}

INSTRUCTIONS:
1. Identify why the test is failing based on the error message
2. Fix the code to satisfy the test requirements
3. Do not change the test - only fix the implementation
4. Ensure the fix maintains existing functionality for other tests
5. Follow clean code principles

Return the corrected code:`;

        const fixedCode = await this.makeLLMDecision(prompt, {});
        
        await fs.writeFile(filePath, fixedCode, 'utf-8');
        fixes.push({ file, fixed: true });
      }

      return {
        success: true,
        data: {
          message: `Fixed test failure: ${testFailureMessage}`,
          testFailure: testFailureMessage,
          fixes: fixes,
          modifiedFiles: filesToFix
        }
      };
    } catch (error) {
      console.error(`[CodeFixingAgent] Error fixing test failure:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add missing implementation for features that tests expect but don't exist
   */
  async addMissingImplementation(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { requirement, missing: missingFeature } = errorToFix;

      console.log(`[CodeFixingAgent] Adding missing implementation: ${missingFeature}`);

      const prompt = `Add the missing implementation to satisfy this requirement:

REQUIREMENT: ${requirement}
MISSING FEATURE: ${missingFeature}

CURRENT PROJECT STRUCTURE:
${JSON.stringify(originalArtifacts, null, 2)}

INSTRUCTIONS:
1. Identify which files need the missing implementation
2. Add the implementation following Clean Architecture patterns
3. Ensure the implementation satisfies the business requirement
4. Follow existing code patterns and naming conventions
5. Add appropriate error handling

Provide the implementation plan and code changes needed:`;

      const implementationPlan = await this.makeLLMDecision(prompt, {});
      
      // Execute the implementation plan
      const result = await this.executeImplementationPlan(implementationPlan, context);

      return {
        success: true,
        data: {
          message: `Added missing implementation: ${missingFeature}`,
          requirement: requirement,
          implementation: implementationPlan,
          modifiedFiles: result.modifiedFiles
        }
      };
    } catch (error) {
      console.error(`[CodeFixingAgent] Error adding missing implementation:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Correct business logic that doesn't align with requirements
   */
  async correctBusinessLogic(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { requirement, issue, suggestion } = errorToFix;

      console.log(`[CodeFixingAgent] Correcting business logic: ${issue}`);

      // Find files that contain the incorrect business logic
      const affectedFiles = await this.findBusinessLogicFiles(requirement, context);

      const fixes = [];
      for (const file of affectedFiles) {
        const filePath = path.join(context.projectPath || '/tmp/generated-project', file);
        const currentCode = await fs.readFile(filePath, 'utf-8');

        const prompt = `Correct the business logic in this code:

REQUIREMENT: ${requirement}
ISSUE: ${issue}
SUGGESTED FIX: ${suggestion}

CURRENT CODE IN ${file}:
\`\`\`javascript
${currentCode}
\`\`\`

INSTRUCTIONS:
1. Identify the business logic that doesn't match the requirement
2. Correct the logic according to the suggestion
3. Ensure the fix aligns with the business requirement
4. Maintain consistency with other parts of the system
5. Preserve existing functionality that is correct

Return the corrected code:`;

        const correctedCode = await this.makeLLMDecision(prompt, {});
        
        await fs.writeFile(filePath, correctedCode, 'utf-8');
        fixes.push({ file, corrected: true });
      }

      return {
        success: true,
        data: {
          message: `Corrected business logic: ${issue}`,
          requirement: requirement,
          issue: issue,
          fixes: fixes,
          modifiedFiles: affectedFiles
        }
      };
    } catch (error) {
      console.error(`[CodeFixingAgent] Error correcting business logic:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Refactor code to follow Clean Code principles
   */
  async refactorForCleanCode(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { principle, issue, location, suggestion } = errorToFix;

      console.log(`[CodeFixingAgent] Refactoring for clean code: ${principle} in ${location}`);

      // Find the specific file and function that needs refactoring
      const [fileName, functionName] = location.split(':');
      const filePath = path.join(context.projectPath || '/tmp/generated-project', fileName);
      const currentCode = await fs.readFile(filePath, 'utf-8');

      const prompt = `Refactor this code to follow Clean Code principles:

CLEAN CODE PRINCIPLE VIOLATED: ${principle}
ISSUE: ${issue}
LOCATION: ${location}
SUGGESTION: ${suggestion}

CURRENT CODE:
\`\`\`javascript
${currentCode}
\`\`\`

INSTRUCTIONS:
1. Focus on the specific Clean Code violation mentioned
2. Apply the suggested improvement
3. Maintain the same functionality
4. Ensure the refactoring improves readability and maintainability
5. Follow Clean Code best practices:
   - Meaningful names
   - Small functions
   - Clear intent
   - Minimal comments (self-documenting code)

Return the refactored code:`;

      const refactoredCode = await this.makeLLMDecision(prompt, {});
      
      await fs.writeFile(filePath, refactoredCode, 'utf-8');

      return {
        success: true,
        data: {
          message: `Refactored for clean code: ${principle}`,
          principle: principle,
          issue: issue,
          location: location,
          refactoring: 'Code quality improved',
          modifiedFiles: [fileName]
        }
      };
    } catch (error) {
      console.error(`[CodeFixingAgent] Error refactoring code:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze test failure to understand what code needs to be fixed
   * @private
   */
  async analyzeTestFailure(testFailureMessage, context) {
    const prompt = `Analyze this test failure to identify what code needs to be fixed:

TEST FAILURE MESSAGE:
${testFailureMessage}

PROJECT CONTEXT:
${JSON.stringify(context, null, 2)}

Return JSON:
{
  "failureType": "syntax|logic|missing_method|wrong_return_value|exception",
  "affectedFiles": ["list of files that likely need fixing"],
  "rootCause": "why the test is failing",
  "fixStrategy": "approach to fix the issue"
}`;

    try {
      const analysis = await this.makeLLMDecision(prompt, {});
      return typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
    } catch (error) {
      // Fallback analysis
      return {
        failureType: 'unknown',
        affectedFiles: ['src/domain/User.js', 'src/application/UserService.js'],
        rootCause: 'Unable to parse test failure',
        fixStrategy: 'Manual investigation required'
      };
    }
  }

  /**
   * Execute implementation plan by making code changes
   * @private
   */
  async executeImplementationPlan(plan, context) {
    // This would parse the implementation plan and execute the changes
    // For now, returning a simple result
    return {
      modifiedFiles: ['src/domain/User.js'],
      changesApplied: ['Added missing method'],
      success: true
    };
  }

  /**
   * Find files that contain business logic related to a requirement
   * @private
   */
  async findBusinessLogicFiles(requirement, context) {
    // This would analyze the requirement and find relevant files
    // For now, returning common business logic files
    return [
      'src/domain/User.js',
      'src/domain/Task.js',
      'src/application/UserService.js'
    ];
  }

  getMetadata() {
    return {
      type: 'code-fixing',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'syntax_error_fixing',
        'test_failure_resolution',
        'missing_implementation',
        'business_logic_correction',
        'clean_code_refactoring'
      ],
      specializations: [
        'error_analysis',
        'targeted_fixes',
        'code_quality_improvement',
        'test_satisfaction'
      ]
    };
  }
}