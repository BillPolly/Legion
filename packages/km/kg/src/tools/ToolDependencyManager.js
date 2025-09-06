/**
 * Manages tool dependencies and composition
 */
export class ToolDependencyManager {
  constructor(kgEngine) {
    this.kg = kgEngine;
  }

  /**
   * Add dependency between tools
   */
  addToolDependency(dependentTool, requiredTool, type = 'dependsOn') {
    const dependentId = dependentTool.getId();
    const requiredId = requiredTool.getId();
    
    this.kg.addTriple(dependentId, `kg:${type}`, requiredId);
  }

  /**
   * Add subgoal relationship between methods
   */
  addSubgoal(parentMethod, subgoal) {
    this.kg.addTriple(parentMethod, 'kg:hasSubgoal', subgoal);
  }

  /**
   * Get all dependencies for a tool
   */
  getToolDependencies(toolId) {
    return this.kg.query(toolId, null, null)
      .filter(([, predicate]) => predicate.startsWith('kg:depends') || predicate === 'kg:requires' || predicate === 'kg:')
      .map(([, predicate, objectId]) => ({
        type: predicate.replace('kg:', ''),
        tool: objectId
      }));
  }

  /**
   * Get dependency chain for a tool
   */
  getDependencyChain(toolId, visited = new Set()) {
    if (visited.has(toolId)) {
      throw new Error(`Circular dependency detected involving ${toolId}`);
    }
    
    const newVisited = new Set(visited);
    newVisited.add(toolId);
    const dependencies = this.getToolDependencies(toolId);
    const chain = [toolId];
    
    for (const dep of dependencies) {
      const subChain = this.getDependencyChain(dep.tool, newVisited);
      chain.push(...subChain);
    }
    
    return [...new Set(chain)]; // Remove duplicates
  }

  /**
   * Check if tools can be composed to achieve a goal
   */
  canAchieveGoal(goal, availableTools) {
    // Find methods that can achieve the goal
    const capableMethods = this.kg.query(null, 'kg:hasGoal', goal)
      .map(([methodId]) => methodId);

    for (const methodId of capableMethods) {
      // Check if we have the tool for this method
      const toolQueries = [
        this.kg.query(methodId, 'kg:methodOf', null),
        this.kg.query(methodId, 'kg:staticMethodOf', null)
      ];

      for (const results of toolQueries) {
        for (const [, , toolId] of results) {
          if (availableTools.includes(toolId)) {
            // Check subgoals
            const subgoals = this.kg.query(methodId, 'kg:hasSubgoal', null)
              .map(([, , subgoal]) => subgoal);
            
            if (subgoals.length === 0) {
              return { achievable: true, method: methodId, tool: toolId, chain: [methodId] };
            }

            // Recursively check subgoals
            const subgoalResults = subgoals.map(subgoal => 
              this.canAchieveGoal(subgoal, availableTools)
            );

            if (subgoalResults.every(result => result.achievable)) {
              return {
                achievable: true,
                method: methodId,
                tool: toolId,
                chain: [methodId, ...subgoalResults.flatMap(r => r.chain)]
              };
            }
          }
        }
      }
    }

    return { achievable: false };
  }
}
