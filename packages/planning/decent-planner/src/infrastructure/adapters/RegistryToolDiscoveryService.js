/**
 * RegistryToolDiscoveryService - Infrastructure adapter for tool discovery using ToolRegistry
 * Implements the ToolDiscoveryService port
 */

import { ToolDiscoveryService } from '../../application/ports/ToolDiscoveryService.js';

export class RegistryToolDiscoveryService extends ToolDiscoveryService {
  constructor(toolRegistry, llmClient = null, options = {}) {
    super();
    if (!toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    this.toolRegistry = toolRegistry;
    this.llmClient = llmClient;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.maxTools = options.maxTools || 10;
  }

  async discoverTools(taskDescription) {
    if (!taskDescription || taskDescription.trim() === '') {
      throw new Error('Task description is required');
    }

    // If we have an LLM client, use semantic search
    if (this.llmClient) {
      return await this.semanticDiscovery(taskDescription);
    } else {
      // Fallback to keyword-based discovery
      return await this.keywordDiscovery(taskDescription);
    }
  }

  async semanticDiscovery(taskDescription) {
    // Get all available tools
    const allTools = await this.toolRegistry.listTools();
    
    // Use LLM to rank tools by relevance
    const prompt = this.generateRankingPrompt(taskDescription, allTools);
    const response = await this.llmClient.complete(prompt);
    const rankings = this.parseRankingResponse(response);
    
    // Filter and sort by confidence
    const relevantTools = rankings
      .filter(r => r.confidence >= this.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxTools)
      .map(r => ({
        ...r.tool,
        confidence: r.confidence,
        reasoning: r.reasoning
      }));
    
    return relevantTools;
  }

  async keywordDiscovery(taskDescription) {
    // Simple keyword-based matching
    const keywords = taskDescription.toLowerCase().split(/\s+/);
    const allTools = await this.toolRegistry.listTools();
    
    const scoredTools = allTools.map(tool => {
      const toolText = `${tool.name} ${tool.description || ''}`.toLowerCase();
      let score = 0;
      
      for (const keyword of keywords) {
        if (toolText.includes(keyword)) {
          score += 1;
        }
      }
      
      return {
        ...tool,
        confidence: Math.min(score / keywords.length, 1),
        reasoning: `Keyword matching score: ${score}/${keywords.length}`
      };
    });
    
    return scoredTools
      .filter(t => t.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxTools);
  }

  generateRankingPrompt(taskDescription, tools) {
    const toolList = tools.map(t => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || {}
    }));

    return `Given the following task, rank the relevance of available tools.

Task: ${taskDescription}

Available Tools:
${JSON.stringify(toolList, null, 2)}

For each tool that could be useful for this task, provide:
1. The tool name
2. A confidence score (0.0 to 1.0)
3. Brief reasoning for the relevance

Return as JSON:
{
  "rankings": [
    {
      "name": "tool_name",
      "confidence": 0.8,
      "reasoning": "Why this tool is relevant"
    }
  ]
}

Only include tools with confidence >= 0.5.
Return ONLY the JSON object.`;
  }

  parseRankingResponse(response) {
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (!parsed.rankings || !Array.isArray(parsed.rankings)) {
        throw new Error('Response must contain a rankings array');
      }
      
      return parsed.rankings.map(r => ({
        tool: this.toolRegistry.getTool(r.name),
        confidence: r.confidence || 0,
        reasoning: r.reasoning || ''
      }));
    } catch (error) {
      throw new Error(`Failed to parse ranking response: ${error.message}`);
    }
  }

  async isToolAvailable(toolName) {
    try {
      const tool = await this.toolRegistry.getTool(toolName);
      return tool !== null;
    } catch {
      return false;
    }
  }

  async getToolInfo(toolName) {
    try {
      return await this.toolRegistry.getTool(toolName);
    } catch {
      return null;
    }
  }
}