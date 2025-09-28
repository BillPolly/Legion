import { ToolDependencyManager } from '../../../src/tools/ToolDependencyManager.js';
import { KGEngine } from '../../../src/core/KGEngine.js';
import '../../../src/serialization/ObjectExtensions.js';

// Mock WeatherTool for testing (previously from @legion/kg-examples)
class WeatherTool {
  constructor() {
    this.apiKey = null;
  }
  
  async getCurrentWeather(location, units = 'metric') {
    return { location, temperature: 20, units };
  }
  
  async getForecast(location, days = 5) {
    return { location, days, forecast: [] };
  }
}

describe('ToolDependencyManager', () => {
  let kgEngine, dependencyManager;

  beforeEach(() => {
    kgEngine = new KGEngine();
    dependencyManager = new ToolDependencyManager(kgEngine);
  });

  describe('Constructor', () => {
    test('should initialize with KG engine', () => {
      expect(dependencyManager.kg).toBe(kgEngine);
    });
  });

  describe('Tool Dependencies', () => {
    let weatherTool, databaseTool, analyticsTool;

    beforeEach(() => {
      class WeatherTool {}
      class DatabaseTool {}
      class AnalyticsTool {}

      weatherTool = WeatherTool;
      databaseTool = DatabaseTool;
      analyticsTool = AnalyticsTool;
    });

    test('should add basic dependency between tools', () => {
      dependencyManager.addToolDependency(analyticsTool, weatherTool);

      const analyticsId = analyticsTool.getId();
      const weatherId = weatherTool.getId();

      const dependencies = kgEngine.query(analyticsId, 'kg:dependsOn', weatherId);
      expect(dependencies).toHaveLength(1);
    });

    test('should add dependency with custom type', () => {
      dependencyManager.addToolDependency(analyticsTool, databaseTool, 'requires');

      const analyticsId = analyticsTool.getId();
      const databaseId = databaseTool.getId();

      const dependencies = kgEngine.query(analyticsId, 'kg:requires', databaseId);
      expect(dependencies).toHaveLength(1);
    });

    test('should add multiple dependencies for same tool', () => {
      dependencyManager.addToolDependency(analyticsTool, weatherTool, 'dependsOn');
      dependencyManager.addToolDependency(analyticsTool, databaseTool, 'requires');

      const analyticsId = analyticsTool.getId();
      const dependencies = dependencyManager.getToolDependencies(analyticsId);

      expect(dependencies).toHaveLength(2);
      expect(dependencies.map(d => d.type)).toContain('dependsOn');
      expect(dependencies.map(d => d.type)).toContain('requires');
    });

    test('should get tool dependencies', () => {
      const analyticsId = analyticsTool.getId();
      const weatherId = weatherTool.getId();
      const databaseId = databaseTool.getId();

      dependencyManager.addToolDependency(analyticsTool, weatherTool, 'dependsOn');
      dependencyManager.addToolDependency(analyticsTool, databaseTool, 'requires');

      const dependencies = dependencyManager.getToolDependencies(analyticsId);

      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContainEqual({
        type: 'dependsOn',
        tool: weatherId
      });
      expect(dependencies).toContainEqual({
        type: 'requires',
        tool: databaseId
      });
    });

    test('should return empty array for tool with no dependencies', () => {
      const weatherId = weatherTool.getId();
      const dependencies = dependencyManager.getToolDependencies(weatherId);

      expect(dependencies).toHaveLength(0);
    });

    test('should filter dependency predicates correctly', () => {
      const analyticsId = analyticsTool.getId();
      const weatherId = weatherTool.getId();

      // Add non-dependency triple
      kgEngine.addTriple(analyticsId, 'kg:hasCapability', 'analytics');
      // Add dependency triple
      dependencyManager.addToolDependency(analyticsTool, weatherTool);

      const dependencies = dependencyManager.getToolDependencies(analyticsId);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].type).toBe('dependsOn');
    });
  });

  describe('Subgoal Management', () => {
    test('should add subgoal relationship', () => {
      const parentMethod = 'method_plan_trip';
      const subgoal = 'get_weather_forecast';

      dependencyManager.addSubgoal(parentMethod, subgoal);

      const subgoals = kgEngine.query(parentMethod, 'kg:hasSubgoal', subgoal);
      expect(subgoals).toHaveLength(1);
    });

    test('should add multiple subgoals to same method', () => {
      const parentMethod = 'method_plan_trip';
      const subgoal1 = 'get_weather_forecast';
      const subgoal2 = 'find_hotels';
      const subgoal3 = 'book_flights';

      dependencyManager.addSubgoal(parentMethod, subgoal1);
      dependencyManager.addSubgoal(parentMethod, subgoal2);
      dependencyManager.addSubgoal(parentMethod, subgoal3);

      const subgoals = kgEngine.query(parentMethod, 'kg:hasSubgoal', null);
      expect(subgoals).toHaveLength(3);

      const subgoalValues = subgoals.map(([, , subgoal]) => subgoal);
      expect(subgoalValues).toContain(subgoal1);
      expect(subgoalValues).toContain(subgoal2);
      expect(subgoalValues).toContain(subgoal3);
    });
  });

  describe('Dependency Chain Resolution', () => {
    let toolA, toolB, toolC, toolD;

    beforeEach(() => {
      class ToolA {}
      class ToolB {}
      class ToolC {}
      class ToolD {}

      toolA = ToolA;
      toolB = ToolB;
      toolC = ToolC;
      toolD = ToolD;
    });

    test('should get simple dependency chain', () => {
      // A depends on B
      dependencyManager.addToolDependency(toolA, toolB);

      const chainA = dependencyManager.getDependencyChain(toolA.getId());
      expect(chainA).toContain(toolA.getId());
      expect(chainA).toContain(toolB.getId());
      expect(chainA).toHaveLength(2);
    });

    test('should get complex dependency chain', () => {
      // A depends on B, B depends on C, C depends on D
      dependencyManager.addToolDependency(toolA, toolB);
      dependencyManager.addToolDependency(toolB, toolC);
      dependencyManager.addToolDependency(toolC, toolD);

      const chainA = dependencyManager.getDependencyChain(toolA.getId());
      expect(chainA).toContain(toolA.getId());
      expect(chainA).toContain(toolB.getId());
      expect(chainA).toContain(toolC.getId());
      expect(chainA).toContain(toolD.getId());
      expect(chainA).toHaveLength(4);
    });

    test('should handle multiple dependencies per tool', () => {
      // A depends on B and C, B depends on D, C depends on D
      dependencyManager.addToolDependency(toolA, toolB);
      dependencyManager.addToolDependency(toolA, toolC);
      dependencyManager.addToolDependency(toolB, toolD);
      dependencyManager.addToolDependency(toolC, toolD);

      const chainA = dependencyManager.getDependencyChain(toolA.getId());
      expect(chainA).toContain(toolA.getId());
      expect(chainA).toContain(toolB.getId());
      expect(chainA).toContain(toolC.getId());
      expect(chainA).toContain(toolD.getId());
      expect(chainA).toHaveLength(4); // Should remove duplicates
    });

    test('should detect circular dependencies', () => {
      // A depends on B, B depends on C, C depends on A (circular)
      dependencyManager.addToolDependency(toolA, toolB);
      dependencyManager.addToolDependency(toolB, toolC);
      dependencyManager.addToolDependency(toolC, toolA);

      expect(() => {
        dependencyManager.getDependencyChain(toolA.getId());
      }).toThrow('Circular dependency detected');
    });

    test('should handle self-dependency as circular', () => {
      // A depends on A (self-circular)
      dependencyManager.addToolDependency(toolA, toolA);

      expect(() => {
        dependencyManager.getDependencyChain(toolA.getId());
      }).toThrow('Circular dependency detected');
    });

    test('should return single tool for no dependencies', () => {
      const chainA = dependencyManager.getDependencyChain(toolA.getId());
      expect(chainA).toEqual([toolA.getId()]);
    });
  });

  describe('Goal Achievement Analysis', () => {
    beforeEach(() => {
      // Set up test scenario:
      // WeatherTool can achieve 'get_weather'
      // DatabaseTool can achieve 'store_data' 
      // AnalyticsTool can achieve 'analyze_data' but needs 'get_weather' and 'store_data'

      const weatherToolId = WeatherTool.getId();
      const weatherMethodId = `${weatherToolId}_getCurrentWeather`;
      
      kgEngine.addTriple(weatherMethodId, 'kg:hasGoal', 'get_weather');
      kgEngine.addTriple(weatherMethodId, 'kg:methodOf', weatherToolId);

      class DatabaseTool {}
      const databaseToolId = DatabaseTool.getId();
      const storeMethodId = `${databaseToolId}_store`;
      
      kgEngine.addTriple(storeMethodId, 'kg:hasGoal', 'store_data');
      kgEngine.addTriple(storeMethodId, 'kg:methodOf', databaseToolId);

      class AnalyticsTool {}
      const analyticsToolId = AnalyticsTool.getId();
      const analyzeMethodId = `${analyticsToolId}_analyze`;
      
      kgEngine.addTriple(analyzeMethodId, 'kg:hasGoal', 'analyze_data');
      kgEngine.addTriple(analyzeMethodId, 'kg:methodOf', analyticsToolId);
      kgEngine.addTriple(analyzeMethodId, 'kg:hasSubgoal', 'get_weather');
      kgEngine.addTriple(analyzeMethodId, 'kg:hasSubgoal', 'store_data');
    });

    test('should achieve simple goal with available tool', () => {
      const weatherToolId = WeatherTool.getId();
      const availableTools = [weatherToolId];

      const result = dependencyManager.canAchieveGoal('get_weather', availableTools);

      expect(result.achievable).toBe(true);
      expect(result.tool).toBe(weatherToolId);
      expect(result.method).toBeDefined();
      expect(result.chain).toHaveLength(1);
    });

    test('should not achieve goal without required tool', () => {
      const availableTools = []; // No tools available

      const result = dependencyManager.canAchieveGoal('get_weather', availableTools);

      expect(result.achievable).toBe(false);
    });

    test('should achieve complex goal with all dependencies available', () => {
      const weatherToolId = WeatherTool.getId();
      class DatabaseTool {}
      class AnalyticsTool {}
      const databaseToolId = DatabaseTool.getId();
      const analyticsToolId = AnalyticsTool.getId();
      
      const availableTools = [weatherToolId, databaseToolId, analyticsToolId];

      const result = dependencyManager.canAchieveGoal('analyze_data', availableTools);

      expect(result.achievable).toBe(true);
      expect(result.tool).toBe(analyticsToolId);
      expect(result.chain.length).toBeGreaterThan(1); // Should include subgoals
    });

    test('should not achieve complex goal with missing dependencies', () => {
      const weatherToolId = WeatherTool.getId();
      class AnalyticsTool {}
      const analyticsToolId = AnalyticsTool.getId();
      
      const availableTools = [weatherToolId, analyticsToolId]; // Missing DatabaseTool

      const result = dependencyManager.canAchieveGoal('analyze_data', availableTools);

      expect(result.achievable).toBe(false);
    });

    test('should handle goal with no methods', () => {
      const weatherToolId = WeatherTool.getId();
      const availableTools = [weatherToolId];

      const result = dependencyManager.canAchieveGoal('nonexistent_goal', availableTools);

      expect(result.achievable).toBe(false);
    });

    test('should handle static methods', () => {
      const weatherToolId = WeatherTool.getId();
      const staticMethodId = `${weatherToolId}_staticMethod`;
      
      kgEngine.addTriple(staticMethodId, 'kg:hasGoal', 'static_goal');
      kgEngine.addTriple(staticMethodId, 'kg:staticMethodOf', weatherToolId);

      const availableTools = [weatherToolId];
      const result = dependencyManager.canAchieveGoal('static_goal', availableTools);

      expect(result.achievable).toBe(true);
      expect(result.tool).toBe(weatherToolId);
    });

    test('should handle methods with no subgoals', () => {
      const weatherToolId = WeatherTool.getId();
      const availableTools = [weatherToolId];

      const result = dependencyManager.canAchieveGoal('get_weather', availableTools);

      expect(result.achievable).toBe(true);
      expect(result.chain).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty dependency types', () => {
      class ToolA {}
      class ToolB {}

      expect(() => {
        dependencyManager.addToolDependency(ToolA, ToolB, '');
      }).not.toThrow();

      const dependencies = dependencyManager.getToolDependencies(ToolA.getId());
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].type).toBe('');
    });

    test('should handle null/undefined subgoals', () => {
      expect(() => {
        dependencyManager.addSubgoal('method1', null);
        dependencyManager.addSubgoal('method2', undefined);
      }).not.toThrow();
    });

    test('should handle malformed KG data in dependency resolution', () => {
      class ToolA {}
      
      // Add malformed dependency data
      kgEngine.addTriple(ToolA.getId(), 'kg:dependsOn', 'nonexistent-tool');

      const dependencies = dependencyManager.getToolDependencies(ToolA.getId());
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].tool).toBe('nonexistent-tool');
    });

    test('should handle very deep dependency chains', () => {
      const tools = [];
      for (let i = 0; i < 10; i++) {
        // Create classes with unique names to ensure unique IDs
        const ToolClass = class {};
        Object.defineProperty(ToolClass, 'name', { value: `Tool${i}` });
        tools.push(ToolClass);
      }

      // Create chain: Tool0 -> Tool1 -> Tool2 -> ... -> Tool9
      for (let i = 0; i < tools.length - 1; i++) {
        dependencyManager.addToolDependency(tools[i], tools[i + 1]);
      }

      const chain = dependencyManager.getDependencyChain(tools[0].getId());
      expect(chain).toHaveLength(10);
    });

    test('should handle goal achievement with complex subgoal chains', () => {
      // Create a complex scenario:
      // Goal A needs subgoal B
      // Subgoal B needs subgoal C
      // Subgoal C is achievable directly

      class ToolA {}
      const toolAId = ToolA.getId();
      const methodA = `${toolAId}_methodA`;
      
      kgEngine.addTriple(methodA, 'kg:hasGoal', 'goal_A');
      kgEngine.addTriple(methodA, 'kg:methodOf', toolAId);
      kgEngine.addTriple(methodA, 'kg:hasSubgoal', 'goal_B');

      class ToolB {}
      const toolBId = ToolB.getId();
      const methodB = `${toolBId}_methodB`;
      
      kgEngine.addTriple(methodB, 'kg:hasGoal', 'goal_B');
      kgEngine.addTriple(methodB, 'kg:methodOf', toolBId);
      kgEngine.addTriple(methodB, 'kg:hasSubgoal', 'goal_C');

      class ToolC {}
      const toolCId = ToolC.getId();
      const methodC = `${toolCId}_methodC`;
      
      kgEngine.addTriple(methodC, 'kg:hasGoal', 'goal_C');
      kgEngine.addTriple(methodC, 'kg:methodOf', toolCId);

      const availableTools = [toolAId, toolBId, toolCId];
      const result = dependencyManager.canAchieveGoal('goal_A', availableTools);

      expect(result.achievable).toBe(true);
      expect(result.chain.length).toBeGreaterThan(1);
    });
  });

  describe('Performance', () => {
    test('should handle large numbers of dependencies efficiently', () => {
      const tools = [];
      for (let i = 0; i < 100; i++) {
        class Tool {}
        tools.push(Tool);
      }

      // Add dependencies: each tool depends on the next one
      for (let i = 0; i < tools.length - 1; i++) {
        dependencyManager.addToolDependency(tools[i], tools[i + 1]);
      }

      const startTime = performance.now();
      const dependencies = dependencyManager.getToolDependencies(tools[0].getId());
      const endTime = performance.now();

      expect(dependencies).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    test('should handle complex goal resolution efficiently', () => {
      // Create many tools with goals
      const tools = [];
      for (let i = 0; i < 50; i++) {
        class Tool {}
        const toolId = Tool.getId();
        const methodId = `${toolId}_method`;
        
        kgEngine.addTriple(methodId, 'kg:hasGoal', `goal_${i}`);
        kgEngine.addTriple(methodId, 'kg:methodOf', toolId);
        
        tools.push(toolId);
      }

      const startTime = performance.now();
      const result = dependencyManager.canAchieveGoal('goal_25', tools);
      const endTime = performance.now();

      expect(result.achievable).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });
  });
});
