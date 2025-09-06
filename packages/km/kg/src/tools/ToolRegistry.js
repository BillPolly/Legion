import { ClassSerializer } from '../serialization/ClassSerializer.js';
import { idManager } from '../core/IDManager.js';

/**
 * Registry for agent tools with KG-based discovery
 */
export class ToolRegistry {
  constructor(kgEngine) {
    this.kg = kgEngine;
    this.serializer = new ClassSerializer(idManager);
    this.tools = new Map();
  }

  /**
   * Register a tool class with metadata
   */
  registerTool(ToolClass, metadata = {}) {
    const toolId = ToolClass.getId();
    
    // Store tool class
    this.tools.set(toolId, ToolClass);

    // Add tool-specific metadata
    this.kg.addTriple(toolId, 'rdf:type', 'kg:AgentTool');
    
    if (metadata && metadata.capabilities) {
      metadata.capabilities.forEach(capability => {
        this.kg.addTriple(toolId, 'kg:hasCapability', capability);
      });
    }

    if (metadata && metadata.category) {
      this.kg.addTriple(toolId, 'kg:category', metadata.category);
    }

    if (metadata && metadata.requiresCredential) {
      this.kg.addTriple(toolId, 'kg:requiresCredential', metadata.requiresCredential);
    }

    if (metadata && metadata.requiresNetwork !== undefined) {
      this.kg.addTriple(toolId, 'kg:requiresNetwork', metadata.requiresNetwork);
    }

    // Serialize class structure
    const triples = this.serializer.serializeClass(ToolClass, metadata);
    triples.forEach(([s, p, o]) => {
      this.kg.addTriple(s, p, o);
    });

    return toolId;
  }

  /**
   * Find tools by capability
   */
  findToolsByCapability(capability) {
    return this.kg.query(null, 'kg:hasCapability', capability)
      .map(([toolId]) => ({
        id: toolId,
        class: this.tools.get(toolId)
      }))
      .filter(tool => tool.class);
  }

  /**
   * Find tools by goal
   */
  findToolsByGoal(goal) {
    const methodIds = this.kg.query(null, 'kg:hasGoal', goal).map(([methodId]) => methodId);
    const tools = new Map();

    methodIds.forEach(methodId => {
      // Find which tool this method belongs to
      const toolQueries = [
        this.kg.query(methodId, 'kg:methodOf', null),
        this.kg.query(methodId, 'kg:staticMethodOf', null),
        this.kg.query(methodId, 'kg:constructorOf', null)
      ];

      toolQueries.forEach(results => {
        results.forEach(([, , toolId]) => {
          if (this.tools.has(toolId)) {
            if (!tools.has(toolId)) {
              tools.set(toolId, {
                id: toolId,
                class: this.tools.get(toolId),
                methods: []
              });
            }
            tools.get(toolId).methods.push(methodId);
          }
        });
      });
    });

    return Array.from(tools.values());
  }

  /**
   * Get available tools based on context
   */
  getAvailableTools(context = {}) {
    const allTools = this.kg.query(null, 'rdf:type', 'kg:AgentTool')
      .map(([toolId]) => toolId)
      .filter(toolId => this.tools.has(toolId));

    return allTools.filter(toolId => {
      return this._checkToolAvailability(toolId, context);
    }).map(toolId => ({
      id: toolId,
      class: this.tools.get(toolId)
    }));
  }

  /**
   * Check if a tool is available in the current context
   */
  _checkToolAvailability(toolId, context) {
    // Check credentials
    const credentialReq = this.kg.query(toolId, 'kg:requiresCredential', null);
    if (credentialReq.length > 0 && !context.credentials) {
      return false;
    }

    // Check network requirement
    const networkReq = this.kg.query(toolId, 'kg:requiresNetwork', null);
    if (networkReq.length > 0 && networkReq[0][2] === true && !context.hasNetwork) {
      return false;
    }

    // Add more context checks as needed
    return true;
  }
}
