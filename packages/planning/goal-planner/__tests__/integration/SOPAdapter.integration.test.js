import { ResourceManager } from '@legion/resource-manager';
import SOPRegistry from '@legion/sop-registry';
import { SOPAdapter } from '../../src/SOPAdapter.js';

describe('SOPAdapter Integration', () => {
  let resourceManager;
  let sopRegistry;
  let sopAdapter;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopRegistry = await SOPRegistry.getInstance();
    sopAdapter = new SOPAdapter({ resourceManager });
    
    await sopRegistry.sopStorage.clearAll();
    await sopRegistry.sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopRegistry.sopStorage._seedPerspectiveTypes();
    await sopRegistry.loadAllSOPs();
  });
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  test('adapts complete train-booking SOP', async () => {
    const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
    
    const goal = {
      gloss: 'Book train to Paris',
      evidence: {
        origin: 'London',
        destination: 'Paris',
        travelDate: '2025-10-01'
      }
    };
    
    const result = await sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
    
    expect(result.subgoals.length).toBe(5);
    expect(result.decomp).toBe('AND');
    expect(result.confidence).toBeGreaterThan(0.9);
    
    const searchStep = result.subgoals.find(s => 
      s.gloss.includes('Search for available trains')
    );
    expect(searchStep).toBeDefined();
    expect(searchStep.pred.args.tool).toBe('train-search-api');
    expect(searchStep.provenance.sopTitle).toBe('Book a train ticket');
  });
  
  test('generates gather subgoals for missing parameters', async () => {
    const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
    
    const goal = {
      gloss: 'Book train',
      evidence: {}
    };
    
    const result = await sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
    
    const paramGathers = result.subgoals.filter(s =>
      s.provenance?.reason === 'parameter_gathering'
    );
    
    expect(paramGathers.length).toBe(3);
    expect(paramGathers.map(g => g.pred.args.key)).toEqual(['origin', 'destination', 'travelDate']);
    
    const firstThree = result.subgoals.slice(0, 3);
    expect(firstThree).toEqual(paramGathers);
  });
  
  test('verifies all subgoals have provenance', async () => {
    const apiSOP = await sopRegistry.getSOPByTitle('Call external API with authentication');
    
    const goal = {
      gloss: 'Call API',
      evidence: {
        apiUrl: 'https://api.example.com',
        credentials: { key: 'test' }
      }
    };
    
    const result = await sopAdapter.adaptSOPToSubgoals(apiSOP, goal);
    
    result.subgoals.forEach(subgoal => {
      expect(subgoal.provenance).toBeDefined();
      expect(subgoal.provenance.sopId).toBeDefined();
      expect(subgoal.provenance.sopTitle).toBe('Call external API with authentication');
      expect(subgoal.provenance.stepIndex).toBeGreaterThanOrEqual(-1);
    });
  });
  
  test('handles SOP with minimal structure', async () => {
    const fileSOP = await sopRegistry.getSOPByTitle('Read and process file');
    
    const goal = {
      gloss: 'Read file',
      evidence: {
        filePath: '/test.txt'
      }
    };
    
    const result = await sopAdapter.adaptSOPToSubgoals(fileSOP, goal);
    
    expect(result.subgoals.length).toBeGreaterThan(0);
    expect(result.decomp).toBe('AND');
    
    result.subgoals.forEach(subgoal => {
      expect(subgoal.gloss).toBeDefined();
      expect(subgoal.pred).toBeDefined();
      expect(subgoal.doneWhen).toBeInstanceOf(Array);
    });
  });
  
  test('preserves tool suggestions from SOP steps', async () => {
    const apiSOP = await sopRegistry.getSOPByTitle('Call external API with authentication');
    
    const goal = {
      gloss: 'Call API',
      evidence: {
        apiUrl: 'test',
        credentials: {}
      }
    };
    
    const result = await sopAdapter.adaptSOPToSubgoals(apiSOP, goal);
    
    const toolSubgoals = result.subgoals.filter(s => s.pred.args.tool);
    
    expect(toolSubgoals.length).toBeGreaterThan(0);
    expect(toolSubgoals.some(s => s.pred.args.tool === 'credential-manager')).toBe(true);
    expect(toolSubgoals.some(s => s.pred.args.tool === 'http-client')).toBe(true);
  });
});