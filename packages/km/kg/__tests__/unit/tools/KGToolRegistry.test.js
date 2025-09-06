import { KGToolRegistry } from '../../../src/tools/KGToolRegistry.js';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { WeatherTool } from '@legion/kg-examples';
import '../../../src/serialization/ObjectExtensions.js';

describe('KGToolRegistry', () => {
  let kgEngine, registry;

  beforeEach(() => {
    kgEngine = new KGEngine();
    registry = new KGToolRegistry(kgEngine);
  });

  describe('Constructor', () => {
    test('should initialize with KG engine', () => {
      expect(registry.kg).toBe(kgEngine);
      expect(registry.serializer).toBeDefined();
      expect(registry.tools).toBeInstanceOf(Map);
    });
  });

  describe('Tool Registration', () => {
    test('should register a tool with basic metadata', () => {
      const toolId = registry.registerTool(WeatherTool, {
        capabilities: ['weather', 'forecast'],
        category: 'information'
      });

      expect(toolId).toBeDefined();
      expect(registry.tools.has(toolId)).toBe(true);
      expect(registry.tools.get(toolId)).toBe(WeatherTool);

      // Check KG triples
      const typeTriples = kgEngine.query(toolId, 'rdf:type', 'kg:AgentTool');
      expect(typeTriples).toHaveLength(1);

      const capabilityTriples = kgEngine.query(toolId, 'kg:hasCapability', null);
      expect(capabilityTriples).toHaveLength(2);
      expect(capabilityTriples.map(t => t[2])).toContain('weather');
      expect(capabilityTriples.map(t => t[2])).toContain('forecast');

      const categoryTriples = kgEngine.query(toolId, 'kg:category', 'information');
      expect(categoryTriples).toHaveLength(1);
    });

    test('should register tool with credential requirements', () => {
      const toolId = registry.registerTool(WeatherTool, {
        requiresCredential: 'api_key',
        requiresNetwork: true
      });

      const credentialTriples = kgEngine.query(toolId, 'kg:requiresCredential', 'api_key');
      expect(credentialTriples).toHaveLength(1);

      const networkTriples = kgEngine.query(toolId, 'kg:requiresNetwork', true);
      expect(networkTriples).toHaveLength(1);
    });

    test('should register tool without metadata', () => {
      const toolId = registry.registerTool(WeatherTool);

      expect(toolId).toBeDefined();
      expect(registry.tools.has(toolId)).toBe(true);

      const typeTriples = kgEngine.query(toolId, 'rdf:type', 'kg:AgentTool');
      expect(typeTriples).toHaveLength(1);
    });

    test('should serialize class structure during registration', () => {
      const toolId = registry.registerTool(WeatherTool);

      // Check that class metadata was serialized
      const classTriples = kgEngine.query(toolId, 'rdf:type', 'kg:EntityClass');
      expect(classTriples.length).toBeGreaterThan(0);

      // Check for method serialization
      const methodTriples = kgEngine.query(null, 'kg:methodOf', toolId);
      expect(methodTriples.length).toBeGreaterThan(0);
    });

    test('should handle multiple tool registrations', () => {
      class TestTool1 {}
      class TestTool2 {}

      const toolId1 = registry.registerTool(TestTool1, { category: 'test1' });
      const toolId2 = registry.registerTool(TestTool2, { category: 'test2' });

      expect(toolId1).not.toBe(toolId2);
      expect(registry.tools.size).toBe(2);

      const allTools = kgEngine.query(null, 'rdf:type', 'kg:AgentTool');
      expect(allTools).toHaveLength(2);
    });
  });

  describe('Tool Discovery by Capability', () => {
    beforeEach(() => {
      registry.registerTool(WeatherTool, {
        capabilities: ['weather', 'forecast', 'temperature']
      });

      class DatabaseTool {}
      registry.registerTool(DatabaseTool, {
        capabilities: ['database', 'query', 'storage']
      });

      class AnalyticsTool {}
      registry.registerTool(AnalyticsTool, {
        capabilities: ['analytics', 'forecast', 'statistics']
      });
    });

    test('should find tools by single capability', () => {
      const weatherTools = registry.findToolsByCapability('weather');
      expect(weatherTools).toHaveLength(1);
      expect(weatherTools[0].class).toBe(WeatherTool);

      const databaseTools = registry.findToolsByCapability('database');
      expect(databaseTools).toHaveLength(1);
      expect(databaseTools[0].class.name).toBe('DatabaseTool');
    });

    test('should find multiple tools with shared capability', () => {
      const forecastTools = registry.findToolsByCapability('forecast');
      expect(forecastTools).toHaveLength(2);
      
      const toolClasses = forecastTools.map(t => t.class);
      expect(toolClasses).toContain(WeatherTool);
      expect(toolClasses.some(c => c.name === 'AnalyticsTool')).toBe(true);
    });

    test('should return empty array for non-existent capability', () => {
      const tools = registry.findToolsByCapability('nonexistent');
      expect(tools).toHaveLength(0);
    });

    test('should filter out tools not in registry', () => {
      // Add a capability triple for a tool not in the registry
      kgEngine.addTriple('fake-tool-id', 'kg:hasCapability', 'weather');

      const weatherTools = registry.findToolsByCapability('weather');
      expect(weatherTools).toHaveLength(1);
      expect(weatherTools[0].class).toBe(WeatherTool);
    });
  });

  describe('Tool Discovery by Goal', () => {
    beforeEach(() => {
      const weatherToolId = registry.registerTool(WeatherTool);
      
      // Add goal metadata for methods
      const getCurrentWeatherMethod = `${weatherToolId}_getCurrentWeather`;
      const getForecastMethod = `${weatherToolId}_getForecast`;
      
      kgEngine.addTriple(getCurrentWeatherMethod, 'kg:hasGoal', 'get_current_weather');
      kgEngine.addTriple(getForecastMethod, 'kg:hasGoal', 'get_weather_forecast');
      kgEngine.addTriple(getCurrentWeatherMethod, 'kg:methodOf', weatherToolId);
      kgEngine.addTriple(getForecastMethod, 'kg:methodOf', weatherToolId);

      class TravelTool {}
      const travelToolId = registry.registerTool(TravelTool);
      const planTripMethod = `${travelToolId}_planTrip`;
      
      kgEngine.addTriple(planTripMethod, 'kg:hasGoal', 'plan_trip');
      kgEngine.addTriple(planTripMethod, 'kg:methodOf', travelToolId);
    });

    test('should find tools by goal', () => {
      const weatherTools = registry.findToolsByGoal('get_current_weather');
      expect(weatherTools).toHaveLength(1);
      expect(weatherTools[0].class).toBe(WeatherTool);
      expect(weatherTools[0].methods).toHaveLength(1);
    });

    test('should find tools with multiple methods for different goals', () => {
      const forecastTools = registry.findToolsByGoal('get_weather_forecast');
      expect(forecastTools).toHaveLength(1);
      expect(forecastTools[0].class).toBe(WeatherTool);
    });

    test('should return empty array for non-existent goal', () => {
      const tools = registry.findToolsByGoal('nonexistent_goal');
      expect(tools).toHaveLength(0);
    });

    test('should handle static methods', () => {
      const weatherToolId = WeatherTool.getId();
      const staticMethod = `${weatherToolId}_staticMethod`;
      
      kgEngine.addTriple(staticMethod, 'kg:hasGoal', 'static_goal');
      kgEngine.addTriple(staticMethod, 'kg:staticMethodOf', weatherToolId);

      const tools = registry.findToolsByGoal('static_goal');
      expect(tools).toHaveLength(1);
      expect(tools[0].class).toBe(WeatherTool);
    });

    test('should handle constructor methods', () => {
      const weatherToolId = WeatherTool.getId();
      const constructorMethod = `${weatherToolId}_constructor`;
      
      kgEngine.addTriple(constructorMethod, 'kg:hasGoal', 'create_weather_tool');
      kgEngine.addTriple(constructorMethod, 'kg:constructorOf', weatherToolId);

      const tools = registry.findToolsByGoal('create_weather_tool');
      expect(tools).toHaveLength(1);
      expect(tools[0].class).toBe(WeatherTool);
    });
  });

  describe('Context-Based Tool Availability', () => {
    beforeEach(() => {
      registry.registerTool(WeatherTool, {
        requiresCredential: 'api_key',
        requiresNetwork: true
      });

      class OfflineTool {}
      registry.registerTool(OfflineTool, {
        requiresNetwork: false
      });

      class PublicTool {}
      registry.registerTool(PublicTool);
    });

    test('should return all tools with full context', () => {
      const context = {
        credentials: { api_key: 'test-key' },
        hasNetwork: true
      };

      const availableTools = registry.getAvailableTools(context);
      expect(availableTools).toHaveLength(3);
    });

    test('should filter out tools requiring credentials when not provided', () => {
      const context = { hasNetwork: true };

      const availableTools = registry.getAvailableTools(context);
      expect(availableTools).toHaveLength(2);
      
      const toolClasses = availableTools.map(t => t.class);
      expect(toolClasses).not.toContain(WeatherTool);
    });

    test('should filter out tools requiring network when offline', () => {
      const context = {
        credentials: { api_key: 'test-key' },
        hasNetwork: false
      };

      const availableTools = registry.getAvailableTools(context);
      expect(availableTools).toHaveLength(2);
      
      const toolClasses = availableTools.map(t => t.class);
      expect(toolClasses).not.toContain(WeatherTool);
    });

    test('should return tools with no requirements when context is empty', () => {
      const context = {};

      const availableTools = registry.getAvailableTools(context);
      expect(availableTools).toHaveLength(2);
      
      const toolClasses = availableTools.map(t => t.class);
      expect(toolClasses).not.toContain(WeatherTool);
    });

    test('should handle tools with network requirement set to false', () => {
      const context = { hasNetwork: false };

      const availableTools = registry.getAvailableTools(context);
      expect(availableTools.length).toBeGreaterThan(0);
      
      // Should include OfflineTool and PublicTool
      const toolNames = availableTools.map(t => t.class.name);
      expect(toolNames).toContain('OfflineTool');
      expect(toolNames).toContain('PublicTool');
    });
  });

  describe('Tool Availability Checking', () => {
    let weatherToolId;

    beforeEach(() => {
      weatherToolId = registry.registerTool(WeatherTool, {
        requiresCredential: 'api_key',
        requiresNetwork: true
      });
    });

    test('should check credential requirements', () => {
      const contextWithCredentials = { credentials: { api_key: 'test' } };
      const contextWithoutCredentials = {};

      expect(registry._checkToolAvailability(weatherToolId, contextWithCredentials)).toBe(false); // Still needs network
      expect(registry._checkToolAvailability(weatherToolId, contextWithoutCredentials)).toBe(false);
    });

    test('should check network requirements', () => {
      const contextWithNetwork = { 
        credentials: { api_key: 'test' },
        hasNetwork: true 
      };
      const contextWithoutNetwork = { 
        credentials: { api_key: 'test' },
        hasNetwork: false 
      };

      expect(registry._checkToolAvailability(weatherToolId, contextWithNetwork)).toBe(true);
      expect(registry._checkToolAvailability(weatherToolId, contextWithoutNetwork)).toBe(false);
    });

    test('should return true for tools with no requirements', () => {
      class SimpleTool {}
      const simpleToolId = registry.registerTool(SimpleTool);

      expect(registry._checkToolAvailability(simpleToolId, {})).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle tool registration with empty capabilities array', () => {
      const toolId = registry.registerTool(WeatherTool, {
        capabilities: []
      });

      const capabilityTriples = kgEngine.query(toolId, 'kg:hasCapability', null);
      expect(capabilityTriples).toHaveLength(0);
    });

    test('should handle tool registration with null metadata', () => {
      expect(() => {
        registry.registerTool(WeatherTool, null);
      }).not.toThrow();
    });

    test('should handle finding tools when no tools are registered', () => {
      const newRegistry = new KGToolRegistry(new KGEngine());
      
      expect(newRegistry.findToolsByCapability('weather')).toHaveLength(0);
      expect(newRegistry.findToolsByGoal('get_weather')).toHaveLength(0);
      expect(newRegistry.getAvailableTools()).toHaveLength(0);
    });

    test('should handle malformed KG data gracefully', () => {
      // Add malformed triples
      kgEngine.addTriple('malformed-tool', 'rdf:type', 'kg:AgentTool');
      
      const availableTools = registry.getAvailableTools();
      expect(availableTools).toHaveLength(0); // Should filter out tools not in registry
    });
  });

  describe('Integration with ClassSerializer', () => {
    test('should serialize tool methods with parameters', () => {
      const toolId = registry.registerTool(WeatherTool, {
        methods: {
          getCurrentWeather: {
            parameters: [
              {
                name: 'location',
                type: 'String',
                required: true,
                description: 'Location to get weather for'
              },
              {
                name: 'units',
                type: 'String',
                required: false,
                defaultValue: 'metric',
                allowedValues: ['metric', 'imperial', 'kelvin']
              }
            ]
          }
        }
      });

      // Check that method parameters were serialized
      const parameterTriples = kgEngine.query(null, 'kg:parameterOf', null);
      expect(parameterTriples.length).toBeGreaterThan(0);

      // Check for specific method parameters
      const methodTriples = kgEngine.query(null, 'kg:methodOf', toolId);
      expect(methodTriples.length).toBeGreaterThan(0);
    });

    test('should preserve method metadata during registration', () => {
      const toolId = registry.registerTool(WeatherTool, {
        methodMetadata: {
          getCurrentWeather: {
            description: 'Get current weather conditions',
            goal: 'get_current_weather'
          }
        }
      });

      // Verify that method metadata is preserved in KG
      const methodTriples = kgEngine.query(null, 'kg:methodOf', toolId);
      expect(methodTriples.length).toBeGreaterThan(0);
    });
  });
});
