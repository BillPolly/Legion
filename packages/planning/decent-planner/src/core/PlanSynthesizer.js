/**
 * PlanSynthesizer - Bottom-up behavior tree synthesis and validation
 * 
 * Builds behavior trees from the bottom up, composing and validating
 * at each level of the hierarchy. Each validated subtree becomes an
 * atomic unit for higher levels.
 */

import { ValidatedSubtree } from './ValidatedSubtree.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';

export class PlanSynthesizer {
  constructor(dependencies) {
    this.llmClient = dependencies.llmClient;
    this.toolDiscovery = dependencies.toolDiscovery;
    this.contextHints = dependencies.contextHints;
    
    // Initialize planner and validator
    this.planner = new Planner({
      llmClient: this.llmClient,
      tools: null // Will provide per task
    });
    
    this.validator = new BTValidator({
      strictMode: true,
      validateTools: true,
      applyDefaults: true
    });
    
    // Cache for validated subtrees
    this.subtreeCache = new Map();
  }
  
  /**
   * Synthesize a complete plan bottom-up from a decomposed hierarchy
   * @param {Object} hierarchy - Decomposed task hierarchy
   * @param {Object} options - Synthesis options
   * @returns {Promise<Object>} Synthesis result with behaviorTrees for all nodes
   */
  async synthesize(hierarchy, options = {}) {
    const { debug = false } = options;
    
    if (debug) {
      console.log('[PlanSynthesizer] Starting bottom-up synthesis');
    }
    
    // Build the validated subtree from bottom to top
    const rootSubtree = await this._synthesizeNode(hierarchy, options);
    
    if (debug) {
      console.log(`[PlanSynthesizer] Synthesis complete. Valid: ${rootSubtree._isValid}`);
      console.log(`[PlanSynthesizer] Total tasks: ${rootSubtree.getTotalTasks()}`);
    }
    
    // Collect all behavior trees from the hierarchy
    const behaviorTrees = {};
    const collectBehaviorTrees = (subtree) => {
      if (subtree.behaviorTree) {
        behaviorTrees[subtree.id] = subtree.behaviorTree;
      }
      if (subtree.children) {
        subtree.children.forEach(child => collectBehaviorTrees(child));
      }
    };
    
    collectBehaviorTrees(rootSubtree);
    
    return {
      behaviorTrees,
      rootSubtree,
      validation: rootSubtree.validation,
      artifacts: rootSubtree.getContract()
    };
  }
  
  /**
   * Recursively synthesize a node and its children
   * @private
   */
  async _synthesizeNode(node, options) {
    const { debug = false } = options;
    
    // Check cache first
    const cacheKey = this._getCacheKey(node);
    if (this.subtreeCache.has(cacheKey)) {
      if (debug) {
        console.log(`[PlanSynthesizer] Using cached subtree for: ${node.description}`);
      }
      return this.subtreeCache.get(cacheKey);
    }
    
    // Create the validated subtree for this node
    const subtree = new ValidatedSubtree(node, null, { valid: false });
    
    if (node.complexity === 'SIMPLE') {
      // Leaf node - generate and validate behavior tree
      await this._synthesizeLeaf(subtree, node, options);
    } else {
      // Complex node - synthesize children first
      await this._synthesizeComplex(subtree, node, options);
    }
    
    // Cache the result
    this.subtreeCache.set(cacheKey, subtree);
    
    return subtree;
  }
  
  /**
   * Synthesize a leaf (simple) task
   * @private
   */
  async _synthesizeLeaf(subtree, node, options) {
    const { debug = false } = options;
    
    if (debug) {
      console.log(`[PlanSynthesizer] Synthesizing leaf: ${node.description}`);
    }
    
    try {
      // Get I/O hints
      const hints = this.contextHints.getHints(node.id);
      
      // Discover relevant tools
      const tools = await this._discoverTools(node, options);
      
      if (options.debug) {
        console.log(`[PlanSynthesizer] Tools discovered for '${node.description}':`, tools?.map(t => t.name) || 'none');
      }
      
      if (!tools || tools.length === 0) {
        subtree.validation = {
          valid: false,
          errors: [`No tools found for task: ${node.description}`]
        };
        subtree._isValid = false;
        return;
      }
      
      // Judge if tools are sufficient for the task
      const judgment = await this._judgeToolSufficiency(node, tools, hints);
      if (!judgment.sufficient) {
        subtree.validation = {
          valid: false,
          errors: [
            `Insufficient tools for task: ${node.description}`,
            `Judgment: ${judgment.reason}`,
            `Missing capabilities: ${judgment.missing.join(', ')}`,
            `Available tools: ${tools.map(t => t.name).join(', ')}`
          ]
        };
        subtree._isValid = false;
        
        if (options.debug) {
          console.log(`[PlanSynthesizer] Tool judgment failed:`);
          console.log(`  Task: ${node.description}`);
          console.log(`  Reason: ${judgment.reason}`);
          console.log(`  Missing: ${judgment.missing.join(', ')}`);
          console.log(`  Available: ${tools.map(t => t.name).join(', ')}`);
        }
        return;
      }
      
      // Generate behavior tree
      const requirements = this._buildRequirements(node, hints);
      const planResult = await this.planner.makePlan(
        requirements,
        tools,
        { debug: options.debug }
      );
      
      if (planResult.success) {
        subtree.behaviorTree = planResult.data.plan;
        
        // Validate the behavior tree
        const validation = await this.validator.validate(
          subtree.behaviorTree,
          tools,
          { strictMode: true }
        );
        
        subtree.validation = validation;
        subtree._isValid = validation.valid;
        
        // Extract actual I/O from the validated tree
        this._extractActualIO(subtree, planResult.data.plan);
        
      } else {
        subtree.validation = {
          valid: false,
          errors: [`Planning failed: ${planResult.error}`]
        };
        subtree._isValid = false;
      }
      
    } catch (error) {
      subtree.validation = {
        valid: false,
        errors: [`Synthesis error: ${error.message}`]
      };
      subtree._isValid = false;
    }
  }
  
  /**
   * Synthesize a complex task from its children
   * @private
   */
  async _synthesizeComplex(subtree, node, options) {
    const { debug = false } = options;
    
    if (debug) {
      console.log(`[PlanSynthesizer] Synthesizing complex: ${node.description}`);
    }
    
    // Synthesize all children first (bottom-up)
    const children = node.children || node.subtasks;
    if (!children || children.length === 0) {
      subtree.validation = {
        valid: false,
        errors: ['Complex task has no children']
      };
      subtree._isValid = false;
      return;
    }
    
    for (const childNode of children) {
      const childSubtree = await this._synthesizeNode(childNode, options);
      subtree.addChild(childSubtree);
    }
    
    // Check if all children are valid
    const invalidChildren = subtree.children.filter(child => !child._isValid);
    if (invalidChildren.length > 0) {
      subtree.validation = {
        valid: false,
        errors: [
          `${invalidChildren.length} child tasks failed validation`,
          ...invalidChildren.map(child => `- ${child.description}: ${child.validation.errors?.join(', ')}`)
        ]
      };
      subtree._isValid = false;
      return;
    }
    
    // Compose behavior tree from valid children
    const composedTree = subtree.composeBehaviorTree();
    subtree.behaviorTree = composedTree;
    
    // Validate the composed tree
    // For complex tasks, we need to gather all tools from children
    const allTools = await this._gatherChildTools(subtree, options);
    
    const validation = await this.validator.validate(
      composedTree,
      allTools,
      { strictMode: true }
    );
    
    subtree.validation = validation;
    subtree._isValid = validation.valid;
    
    // Verify I/O contracts match
    this._validateIOContracts(subtree);
  }
  
  /**
   * Discover tools for a task
   * @private
   */
  async _discoverTools(node, options) {
    try {
      const tools = await this.toolDiscovery.discoverTools(node, {
        maxTools: options.maxTools || 10,
        threshold: options.threshold || 0.3
      });
      return tools;
    } catch (error) {
      if (options.debug) {
        console.error(`[PlanSynthesizer] Tool discovery failed: ${error.message}`);
      }
      return [];
    }
  }
  
  /**
   * Build requirements string with I/O hints
   * @private
   */
  _buildRequirements(node, hints) {
    let requirements = node.description;
    
    if (hints.suggestedInputs && hints.suggestedInputs.length > 0) {
      requirements += `\n\nExpected inputs: ${hints.suggestedInputs.join(', ')}`;
    }
    
    if (hints.suggestedOutputs && hints.suggestedOutputs.length > 0) {
      requirements += `\nExpected outputs: ${hints.suggestedOutputs.join(', ')}`;
    }
    
    // Add sibling context if available
    const siblingOutputs = this.contextHints.getSiblingOutputs(node.parentId);
    if (siblingOutputs && siblingOutputs.length > 0) {
      requirements += `\nAvailable from previous steps: ${siblingOutputs.join(', ')}`;
    }
    
    return requirements;
  }
  
  /**
   * Extract actual I/O from a behavior tree
   * @private
   */
  _extractActualIO(subtree, behaviorTree) {
    const inputs = new Set();
    const outputs = new Set();
    
    // Traverse the tree to find actual I/O
    this._traverseBT(behaviorTree, (node) => {
      // Extract inputs from params
      if (node.params) {
        Object.values(node.params).forEach(value => {
          if (typeof value === 'string' && value.includes('context.artifacts')) {
            // Extract artifact reference
            const match = value.match(/context\.artifacts\['([^']+)'\]/);
            if (match) {
              inputs.add(match[1]);
            }
          }
        });
      }
      
      // Extract outputs from outputVariable
      if (node.outputVariable) {
        outputs.add(node.outputVariable);
      }
    });
    
    // Update subtree with actual I/O
    if (inputs.size > 0) {
      subtree.inputs = inputs;
    }
    if (outputs.size > 0) {
      subtree.outputs = outputs;
    }
  }
  
  /**
   * Traverse behavior tree and apply callback to each node
   * @private
   */
  _traverseBT(node, callback) {
    if (!node) return;
    
    callback(node);
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => this._traverseBT(child, callback));
    }
    
    if (node.child) {
      this._traverseBT(node.child, callback);
    }
  }
  
  /**
   * Gather all tools used by children
   * @private
   */
  async _gatherChildTools(subtree, options) {
    const toolSet = new Set();
    const toolMap = new Map();
    
    // Recursively gather tools from all descendants
    const gatherFromSubtree = async (st) => {
      if (st.complexity === 'SIMPLE') {
        // Leaf node - discover its tools
        const tools = await this._discoverTools(
          { id: st.id, description: st.description },
          options
        );
        tools.forEach(tool => {
          if (!toolMap.has(tool.name)) {
            toolMap.set(tool.name, tool);
            toolSet.add(tool);
          }
        });
      } else {
        // Complex node - gather from children
        for (const child of st.children) {
          await gatherFromSubtree(child);
        }
      }
    };
    
    await gatherFromSubtree(subtree);
    
    return Array.from(toolSet);
  }
  
  /**
   * Validate I/O contracts between levels
   * @private
   */
  _validateIOContracts(subtree) {
    const contract = subtree.getContract();
    
    // Check for unsatisfied internal dependencies
    for (const child of subtree.children) {
      for (const input of child.inputs) {
        // Input should either be external or provided by a sibling
        const isExternal = contract.inputs.includes(input);
        const isInternal = contract.internal.includes(input);
        
        if (!isExternal && !isInternal) {
          // This is a problem - unsatisfied dependency
          if (!subtree.validation.warnings) {
            subtree.validation.warnings = [];
          }
          subtree.validation.warnings.push(
            `Unsatisfied input '${input}' in child '${child.description}'`
          );
        }
      }
    }
  }
  
  /**
   * Generate cache key for a node
   * @private
   */
  _getCacheKey(node) {
    // Use description and level for now
    // Could be enhanced with a hash of the full node structure
    return `${node.description}-${node.level}-${node.complexity}`;
  }
  
  /**
   * Judge if discovered tools are sufficient for the task
   * @private
   */
  async _judgeToolSufficiency(node, tools, hints) {
    // Create a prompt for the LLM to judge tool sufficiency
    const toolList = tools.map(t => `- ${t.name}: ${t.description || 'No description'}`).join('\n');
    
    const prompt = `
Task: ${node.description}

Expected Inputs: ${hints.suggestedInputs?.join(', ') || 'None specified'}
Expected Outputs: ${hints.suggestedOutputs?.join(', ') || 'None specified'}

Available Tools:
${toolList}

Question: Are these tools sufficient to complete the task? 

Analyze if the available tools can:
1. Handle the required inputs
2. Produce the expected outputs
3. Perform the core operation described in the task

Respond with JSON:
{
  "sufficient": true/false,
  "reason": "Brief explanation",
  "missing": ["capability1", "capability2"] // List what's missing if insufficient
}
`;
    
    try {
      console.log('[DEBUG] Calling LLM for judgment');
      const response = await this.llmClient.generateResponse({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 500
      });
      
      // Parse the response
      const content = response.content || '{}';
      const jsonMatch = content.match(/\{[^}]+\}/s);
      if (jsonMatch) {
        const judgment = JSON.parse(jsonMatch[0]);
        return {
          sufficient: judgment.sufficient || false,
          reason: judgment.reason || 'No reason provided',
          missing: judgment.missing || []
        };
      }
    } catch (error) {
      // If LLM fails, we cannot judge - return insufficient with explanation
      console.warn('[PlanSynthesizer] LLM judgment failed:', error.message);
      return {
        sufficient: false,
        reason: 'Could not determine tool sufficiency - LLM judgment failed',
        missing: ['unable to determine - LLM unavailable']
      };
    }
    
    // Should never reach here if LLM is properly configured
    return {
      sufficient: false,
      reason: 'Tool sufficiency judgment failed',
      missing: ['unknown']
    };
  }
  
  /**
   * Clear the subtree cache
   */
  clearCache() {
    this.subtreeCache.clear();
  }
  
  /**
   * Synthesize a single simple task (for compatibility)
   * @param {Object} task - Simple task to synthesize
   * @returns {Promise<Object>} Synthesis result with behaviorTree, tools, artifacts
   */
  async synthesizeSimpleTask(task) {
    // Add task to context hints if provided
    if (task.suggestedInputs || task.suggestedOutputs) {
      this.contextHints.addHints(task.id, {
        suggestedInputs: task.suggestedInputs || [],
        suggestedOutputs: task.suggestedOutputs || []
      });
    }
    
    // Create a simple hierarchy node
    const node = {
      id: task.id,
      description: task.description,
      complexity: 'SIMPLE',
      suggestedInputs: task.suggestedInputs || [],
      suggestedOutputs: task.suggestedOutputs || []
    };
    
    // Synthesize using the main method
    const subtree = await this._synthesizeNode(node, { debug: false });
    
    // Discover tools for this task
    const tools = await this._discoverTools(node, {});
    
    // Extract artifacts from the behavior tree
    const artifacts = {};
    if (subtree.outputs && subtree.outputs.size > 0) {
      subtree.outputs.forEach(output => {
        artifacts[output] = { type: 'output', source: task.id };
      });
    }
    
    return {
      behaviorTree: subtree.behaviorTree,
      tools: tools,
      artifacts: artifacts,
      validation: subtree.validation
    };
  }
}