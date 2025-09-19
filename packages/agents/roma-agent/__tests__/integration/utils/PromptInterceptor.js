/**
 * PromptInterceptor - Wrapper for LLM client that captures all prompts to files
 * This allows inspection of actual prompts being sent to the LLM
 */

import fs from 'fs/promises';
import path from 'path';

export class PromptInterceptor {
  constructor(realLLMClient, outputDir) {
    this.realLLMClient = realLLMClient;
    this.outputDir = outputDir;
    this.capturedPrompts = [];
    this.promptCounter = 1;
    
    // Ensure output directory exists
    this.ensureOutputDir();
  }
  
  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.warn(`Could not create output directory: ${error.message}`);
    }
  }
  
  /**
   * Intercept and capture LLM complete calls
   */
  async complete(prompt) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const promptId = `prompt-${this.promptCounter.toString().padStart(3, '0')}`;
    this.promptCounter++;
    
    // Determine prompt type based on content analysis
    const promptType = this.classifyPrompt(prompt);
    const filename = `${promptType}-${promptId}-${timestamp}.txt`;
    const filepath = path.join(this.outputDir, filename);
    
    // Capture prompt metadata
    const promptData = {
      id: promptId,
      type: promptType,
      timestamp: new Date().toISOString(),
      length: prompt.length,
      filename: filename,
      prompt: prompt
    };
    
    this.capturedPrompts.push(promptData);
    
    try {
      // Save prompt to file with metadata header
      const fileContent = this.formatPromptFile(promptData);
      await fs.writeFile(filepath, fileContent, 'utf8');
      console.log(`📝 Captured ${promptType} prompt: ${filename}`);
    } catch (error) {
      console.warn(`Failed to save prompt to file: ${error.message}`);
    }
    
    // Call the real LLM client
    try {
      const response = await this.realLLMClient.complete(prompt);
      
      // Also capture the response
      const responseFilename = `${promptType}-${promptId}-response-${timestamp}.txt`;
      const responseFilepath = path.join(this.outputDir, responseFilename);
      
      try {
        const responseContent = this.formatResponseFile({
          ...promptData,
          response: response,
          responseFilename: responseFilename
        });
        await fs.writeFile(responseFilepath, responseContent, 'utf8');
        console.log(`📝 Captured response: ${responseFilename}`);
      } catch (error) {
        console.warn(`Failed to save response to file: ${error.message}`);
      }
      
      return response;
    } catch (error) {
      // Capture error in response file too
      const errorFilename = `${promptType}-${promptId}-error-${timestamp}.txt`;
      const errorFilepath = path.join(this.outputDir, errorFilename);
      
      try {
        const errorContent = this.formatErrorFile({
          ...promptData,
          error: error.message,
          errorFilename: errorFilename
        });
        await fs.writeFile(errorFilepath, errorContent, 'utf8');
        console.log(`📝 Captured error: ${errorFilename}`);
      } catch (saveError) {
        console.warn(`Failed to save error to file: ${saveError.message}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Classify prompt type based on content analysis
   */
  classifyPrompt(prompt) {
    const content = prompt.toLowerCase();
    
    if (content.includes('classify') && content.includes('simple or complex')) {
      return 'task-classification';
    }
    
    if (content.includes('generate tool descriptions') || content.includes('given this task')) {
      return 'tool-discovery';
    }
    
    if (content.includes('simple task') && (content.includes('tool calls') || content.includes('usetool'))) {
      return 'simple-execution';
    }
    
    if (content.includes('complex') && content.includes('decompose')) {
      return 'complex-decomposition';
    }
    
    if (content.includes('available tools') || content.includes('toolcalls')) {
      return 'tool-execution';
    }
    
    return 'unknown-prompt';
  }
  
  /**
   * Format prompt file with metadata
   */
  formatPromptFile(promptData) {
    return `=== ROMA AGENT PROMPT CAPTURE ===
Prompt ID: ${promptData.id}
Type: ${promptData.type}
Timestamp: ${promptData.timestamp}
Length: ${promptData.length} characters
Filename: ${promptData.filename}

=== ANALYSIS ===
Contains "SIMPLE task": ${promptData.prompt.includes('SIMPLE task') ? 'YES' : 'NO'}
Contains "COMPLEX": ${promptData.prompt.includes('COMPLEX') ? 'YES' : 'NO'}
Contains "AVAILABLE TOOLS": ${promptData.prompt.includes('AVAILABLE TOOLS') ? 'YES' : 'NO'}
Contains "AVAILABLE ARTIFACTS": ${promptData.prompt.includes('AVAILABLE ARTIFACTS') ? 'YES' : 'NO'}
Contains "@artifact": ${promptData.prompt.includes('@') ? 'YES' : 'NO'}
Contains "toolCalls": ${promptData.prompt.includes('toolCalls') ? 'YES' : 'NO'}
Contains "useTools": ${promptData.prompt.includes('useTools') ? 'YES' : 'NO'}
Contains "decompose": ${promptData.prompt.includes('decompose') ? 'YES' : 'NO'}

=== ARTIFACT REFERENCES ===
${this.extractArtifactReferences(promptData.prompt)}

=== TOOL REFERENCES ===
${this.extractToolReferences(promptData.prompt)}

=== FULL PROMPT ===
${promptData.prompt}
`;
  }
  
  /**
   * Format response file with metadata
   */
  formatResponseFile(promptData) {
    return `=== ROMA AGENT RESPONSE CAPTURE ===
Prompt ID: ${promptData.id}
Type: ${promptData.type}
Timestamp: ${promptData.timestamp}
Response Filename: ${promptData.responseFilename}

=== RESPONSE ANALYSIS ===
Response Length: ${promptData.response.length} characters
Contains JSON: ${this.looksLikeJSON(promptData.response) ? 'YES' : 'NO'}
Contains "useTools": ${promptData.response.includes('useTools') ? 'YES' : 'NO'}
Contains "toolCalls": ${promptData.response.includes('toolCalls') ? 'YES' : 'NO'}
Contains "decompose": ${promptData.response.includes('decompose') ? 'YES' : 'NO'}
Contains "complexity": ${promptData.response.includes('complexity') ? 'YES' : 'NO'}

=== FULL RESPONSE ===
${promptData.response}
`;
  }
  
  /**
   * Format error file with metadata
   */
  formatErrorFile(promptData) {
    return `=== ROMA AGENT ERROR CAPTURE ===
Prompt ID: ${promptData.id}
Type: ${promptData.type}
Timestamp: ${promptData.timestamp}
Error Filename: ${promptData.errorFilename}

=== ERROR ===
${promptData.error}

=== ORIGINAL PROMPT ===
${promptData.prompt}
`;
  }
  
  /**
   * Extract artifact references from prompt
   * Only count references in AVAILABLE ARTIFACTS section, not examples in instructions
   */
  extractArtifactReferences(prompt) {
    // Look specifically for the AVAILABLE ARTIFACTS section and stop at the next section or important marker
    const availableArtifactsMatch = prompt.match(/AVAILABLE ARTIFACTS:[\s\S]*?(?=\n\nIMPORTANT:|COMPLETE EXAMPLE|Since this is|\n\n[A-Z])/);
    
    if (!availableArtifactsMatch) {
      // No AVAILABLE ARTIFACTS section found - check if prompt says "NO" artifacts
      if (prompt.includes('AVAILABLE ARTIFACTS: NO') || 
          prompt.includes('AVAILABLE ARTIFACTS": NO') ||
          !prompt.includes('AVAILABLE ARTIFACTS')) {
        return 'No AVAILABLE ARTIFACTS section found (no real artifacts in registry)';
      }
      return 'AVAILABLE ARTIFACTS section format not recognized';
    }
    
    const artifactsSection = availableArtifactsMatch[0];
    
    // Extract only artifact references from the artifacts section 
    // Look for bullet points with @artifact_name pattern
    const artifactMatches = artifactsSection.match(/• @\w+/g) || [];
    
    if (artifactMatches.length === 0) {
      return 'AVAILABLE ARTIFACTS section exists but contains no @references (no real artifacts)';
    }
    
    // Clean up the matches to remove the bullet point
    const cleanMatches = artifactMatches.map(match => match.replace('• ', ''));
    
    return `Found ${cleanMatches.length} real artifact references in AVAILABLE ARTIFACTS section:\n${cleanMatches.map(ref => `  - ${ref}`).join('\n')}`;
  }
  
  /**
   * Extract tool references from prompt
   */
  extractToolReferences(prompt) {
    const toolMatches = [];
    
    // Look for tool names in "• toolname" format
    const bulletMatches = prompt.match(/• (\w+)/g) || [];
    toolMatches.push(...bulletMatches.map(match => match.replace('• ', '')));
    
    // Look for tool names in JSON examples
    const jsonToolMatches = prompt.match(/"tool":\s*"([^"]+)"/g) || [];
    toolMatches.push(...jsonToolMatches.map(match => match.match(/"([^"]+)"/)[1]));
    
    if (toolMatches.length === 0) {
      return 'No tool references found';
    }
    
    const uniqueTools = [...new Set(toolMatches)];
    return `Found ${uniqueTools.length} tool references:\n${uniqueTools.map(tool => `  - ${tool}`).join('\n')}`;
  }
  
  /**
   * Check if response looks like JSON
   */
  looksLikeJSON(response) {
    const trimmed = response.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }
  
  /**
   * Get all captured prompts
   */
  getCapturedPrompts() {
    return this.capturedPrompts;
  }
  
  /**
   * Get captured prompts by type
   */
  getCapturedPromptsByType(type) {
    return this.capturedPrompts.filter(p => p.type === type);
  }
  
  /**
   * Clear captured prompts
   */
  clearCaptured() {
    this.capturedPrompts = [];
    this.promptCounter = 1;
  }
  
  /**
   * Generate summary of captured prompts
   */
  generateSummary() {
    const typeCount = {};
    this.capturedPrompts.forEach(prompt => {
      typeCount[prompt.type] = (typeCount[prompt.type] || 0) + 1;
    });
    
    return {
      totalPrompts: this.capturedPrompts.length,
      typeBreakdown: typeCount,
      outputDirectory: this.outputDir
    };
  }
}

/**
 * Create a prompt interceptor that wraps an existing LLM client
 */
export function createPromptInterceptor(llmClient, outputDir) {
  return new PromptInterceptor(llmClient, outputDir);
}