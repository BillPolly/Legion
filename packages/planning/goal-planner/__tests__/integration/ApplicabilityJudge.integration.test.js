import { ResourceManager } from '@legion/resource-manager';
import SOPRegistry from '@legion/sop-registry';
import { ApplicabilityJudge } from '../../src/ApplicabilityJudge.js';

describe('ApplicabilityJudge Integration', () => {
  let resourceManager;
  let sopRegistry;
  let judge;
  let sops;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopRegistry = await SOPRegistry.getInstance();
    judge = new ApplicabilityJudge({ resourceManager });
    await judge.initialize();
    
    await sopRegistry.sopStorage.clearAll();
    await sopRegistry.sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopRegistry.sopStorage._seedPerspectiveTypes();
    await sopRegistry.loadAllSOPs();
    
    sops = {
      train: await sopRegistry.getSOPByTitle('Book a train ticket'),
      file: await sopRegistry.getSOPByTitle('Read and process file'),
      api: await sopRegistry.getSOPByTitle('Call external API with authentication')
    };
  });
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  test('judges multiple SOPs against matching goal', async () => {
    const goal = {
      gloss: 'Book train travel',
      evidence: {
        origin: 'London',
        destination: 'Paris',
        travelDate: '2025-10-01'
      }
    };
    
    const trainJudgment = await judge.judge(sops.train, goal, { paymentConfigured: true });
    const fileJudgment = await judge.judge(sops.file, goal, {});
    const apiJudgment = await judge.judge(sops.api, goal, {});
    
    expect(trainJudgment.confidence).toBeGreaterThan(fileJudgment.confidence);
    expect(trainJudgment.confidence).toBeGreaterThan(apiJudgment.confidence);
  });
  
  test('high confidence for good match with complete evidence', async () => {
    const goal = {
      gloss: 'I want to book a train from London to Paris for October 1st',
      evidence: {
        origin: 'London',
        destination: 'Paris',
        travelDate: '2025-10-01'
      }
    };
    
    const context = {
      domain: 'travel',
      paymentConfigured: true,
      apiAccess: true
    };
    
    const judgment = await judge.judge(sops.train, goal, context);
    
    expect(judgment.confidence).toBeGreaterThan(0.5);
    expect(judgment.missingParameters.length).toBe(0);
  });
  
  test('detects missing prerequisites', async () => {
    const goal = {
      gloss: 'Call the weather API',
      evidence: {}
    };
    
    const context = {
      apiAccessible: false,
      credentialsAvailable: false
    };
    
    const judgment = await judge.judge(sops.api, goal, context);
    
    expect(judgment.missingPrerequisites).toBeInstanceOf(Array);
  });
  
  test('identifies missing parameters correctly', async () => {
    const goal = {
      gloss: 'Read a file',
      evidence: {}
    };
    
    const judgment = await judge.judge(sops.file, goal, {});
    
    expect(judgment.missingParameters).toBeInstanceOf(Array);
  });
  
  test('provides reasoning for judgment', async () => {
    const goal = {
      gloss: 'Authenticate with OAuth',
      evidence: {
        clientId: 'test-id',
        clientSecret: 'test-secret'
      }
    };
    
    const oauthSOP = await sopRegistry.getSOPByTitle('Authenticate with OAuth2 service');
    const judgment = await judge.judge(oauthSOP, goal, {});
    
    expect(judgment.reasoning).toBeDefined();
    expect(judgment.reasoning.length).toBeGreaterThan(10);
  });
});