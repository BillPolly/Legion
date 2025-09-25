/**
 * Comprehensive tests for the ROMA Agent data model entities
 * 
 * Tests all entity types to ensure they work correctly with prompts
 * and provide proper validation and serialization.
 */

import { 
  BaseEntity,
  RequirementsEntity,
  ProjectPlanEntity, 
  PlanPhaseEntity, 
  CompositeProjectPlan,
  EndpointEntity,
  QualityAssessmentEntity,
  ErrorEntity,
  EntityFactory,
  EntityValidator,
  EntitySerializer,
  DEFAULT_ENTITY_TYPES
} from '../../../src/data/entities/index.js';

describe('ROMA Agent Entity Data Model', () => {
  
  describe('BaseEntity', () => {
    class TestEntity extends BaseEntity {
      static getEntityType() {
        return 'test';
      }
      static getSchema() {
        return {
          ':test/name': { type: 'string', cardinality: 'one' },
          ':test/value': { type: 'long', cardinality: 'one' }
        };
      }
      static getRequiredFields() {
        return [':test/name'];
      }
      static getJSONSchema() {
        return {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            value: { type: 'number' }
          },
          required: ['name']
        };
      }
    }

    test('should create entity with data', () => {
      const entity = new TestEntity({
        ':test/name': 'test-entity',
        ':test/value': 42
      });

      expect(entity.getField('name')).toBe('test-entity');
      expect(entity.getField('value')).toBe(42);
      expect(entity.isDirty()).toBe(false);
    });

    test('should validate required fields', () => {
      const entity = new TestEntity({});
      
      expect(entity.validate()).toBe(false);
      expect(entity.getErrors()).toContain('Missing required field: :test/name');
    });

    test('should validate with JSON schema', () => {
      const entity = new TestEntity({
        ':test/name': 'test',
        ':test/value': 42
      });

      expect(entity.validate()).toBe(true);
      expect(entity.getErrors()).toHaveLength(0);
    });

    test('should track dirty state', () => {
      const entity = new TestEntity({ ':test/name': 'test' });
      expect(entity.isDirty()).toBe(false);

      entity.setField('value', 100);
      expect(entity.isDirty()).toBe(true);

      entity.markClean();
      expect(entity.isDirty()).toBe(false);
    });

    test('should convert to DataScript format', () => {
      const entity = new TestEntity({
        ':test/name': 'test',
        ':test/value': 42
      });
      
      const dataScript = entity.toDataScript();
      expect(dataScript).toEqual({
        ':test/name': 'test',
        ':test/value': 42
      });
    });

    test('should convert to JSON format', () => {
      const entity = new TestEntity({
        ':test/name': 'test',
        ':test/value': 42
      });

      const json = entity.toJSON();
      expect(json.name).toBe('test');
      expect(json.value).toBe(42);
      expect(json.entityType).toBe('test');
    });

    test('should create from JSON', () => {
      const json = {
        name: 'test',
        value: 42,
        entityType: 'test'
      };

      const entity = TestEntity.fromJSON(json);
      expect(entity.getField('name')).toBe('test');
      expect(entity.getField('value')).toBe(42);
    });
  });

  describe('RequirementsEntity', () => {
    test('should create functional requirement', () => {
      const req = RequirementsEntity.createFunctional(
        'User should be able to login with email and password',
        'project-1',
        'high'
      );

      expect(req.description).toBe('User should be able to login with email and password');
      expect(req.type).toBe('functional');
      expect(req.priority).toBe('high');
      expect(req.projectId).toBe('project-1');
      expect(req.status).toBe('pending');
    });

    test('should validate requirement data', () => {
      const req = new RequirementsEntity({
        ':requirement/description': 'Short desc',
        ':requirement/type': 'functional',
        ':requirement/project': 'project-1',
        ':requirement/acceptanceCriteria': []
      });

      expect(req.validate()).toBe(false);
      expect(req.getErrors()).toContain('Description must be at least 10 characters long');
    });

    test('should manage acceptance criteria', () => {
      const req = RequirementsEntity.createFunctional(
        'User authentication feature',
        'project-1'
      );

      req.addAcceptanceCriteria('User can login with valid credentials');
      req.addAcceptanceCriteria('User sees error with invalid credentials');

      expect(req.acceptanceCriteria).toHaveLength(2);

      req.removeAcceptanceCriteria('User can login with valid credentials');
      expect(req.acceptanceCriteria).toHaveLength(1);
    });

    test('should check status helpers', () => {
      const req = RequirementsEntity.createFunctional('Test req', 'project-1', 'critical');
      
      expect(req.isCritical()).toBe(true);
      expect(req.isImplemented()).toBe(false);
      
      req.status = 'implemented';
      expect(req.isImplemented()).toBe(true);
      
      req.status = 'accepted';
      expect(req.isAccepted()).toBe(true);
    });
  });

  describe('ProjectPlanEntity and CompositeProjectPlan', () => {
    test('should create project plan', () => {
      const plan = ProjectPlanEntity.create('test-plan-1', 'project-1');
      
      expect(plan.planId).toBe('test-plan-1');
      expect(plan.projectId).toBe('project-1');
      expect(plan.status).toBe('draft');
    });

    test('should create composite plan with phases', () => {
      const plan = ProjectPlanEntity.create('test-plan-1', 'project-1');
      const composite = new CompositeProjectPlan(plan);
      
      composite.addPhase('setup', 1);
      composite.addPhase('development', 2);
      composite.addPhase('testing', 3);
      
      expect(composite.phases).toHaveLength(3);
      expect(composite.getNextPhase().name).toBe('setup');
    });

    test('should manage phase progression', () => {
      const plan = ProjectPlanEntity.create('test-plan-1', 'project-1');
      const composite = new CompositeProjectPlan(plan);
      
      composite.addPhase('setup', 1);
      composite.addPhase('development', 2);
      
      expect(composite.getProgress()).toBe(0);
      
      composite.startPhase('setup');
      expect(composite.phases[0].status).toBe('in_progress');
      
      composite.completePhase('setup');
      expect(composite.phases[0].status).toBe('completed');
      expect(composite.getProgress()).toBe(50);
    });

    test('should convert to prompt format', () => {
      const promptResponse = {
        planId: 'test-plan',
        phases: [
          { phase: 'setup', priority: 1, tasks: [] },
          { phase: 'development', priority: 2, tasks: [] }
        ]
      };
      
      const composite = CompositeProjectPlan.fromPromptResponse(promptResponse, 'project-1');
      const promptFormat = composite.toPromptFormat();
      
      expect(promptFormat.planId).toBe('test-plan');
      expect(promptFormat.phases).toHaveLength(2);
      expect(promptFormat.phases[0].phase).toBe('setup');
    });
  });

  describe('EndpointEntity', () => {
    test('should create health check endpoint', () => {
      const endpoint = EndpointEntity.createHealthCheck('project-1');
      
      expect(endpoint.method).toBe('GET');
      expect(endpoint.path).toBe('/api/health');
      expect(endpoint.requiresAuthentication).toBe(false);
    });

    test('should create CRUD endpoints', () => {
      const createEndpoint = EndpointEntity.createCRUDEndpoint('users', 'CREATE', 'project-1');
      const readEndpoint = EndpointEntity.createCRUDEndpoint('users', 'READ', 'project-1');
      
      expect(createEndpoint.method).toBe('POST');
      expect(createEndpoint.path).toBe('/users');
      expect(readEndpoint.method).toBe('GET');
      expect(readEndpoint.path).toBe('/users/:id');
    });

    test('should validate HTTP methods', () => {
      const endpoint = new EndpointEntity({
        ':endpoint/method': 'GET',
        ':endpoint/path': '/test',
        ':endpoint/project': 'project-1'
      });

      expect(() => {
        endpoint.method = 'INVALID';
      }).toThrow('Invalid HTTP method: INVALID');
    });

    test('should manage parameters and responses', () => {
      const endpoint = new EndpointEntity({
        ':endpoint/method': 'POST',
        ':endpoint/path': '/users',
        ':endpoint/project': 'project-1'
      });

      endpoint.addParameter('name', 'string', true, 'User name');
      endpoint.addParameter('email', 'string', true, 'User email');
      endpoint.addResponse(201, 'User created successfully', { type: 'object' });

      const params = endpoint.parameters;
      expect(params.name.type).toBe('string');
      expect(params.name.required).toBe(true);

      const responses = endpoint.responses;
      expect(responses[201].description).toBe('User created successfully');
    });

    test('should convert to prompt format', () => {
      const endpoint = EndpointEntity.createHealthCheck('project-1');
      const promptFormat = endpoint.toPromptFormat();
      
      expect(promptFormat.method).toBe('GET');
      expect(promptFormat.path).toBe('/api/health');
      expect(promptFormat.authentication).toBe(false);
    });
  });

  describe('QualityAssessmentEntity', () => {
    test('should create quality assessment', () => {
      const assessment = QualityAssessmentEntity.create('file-1', 'project-1', 8.5);
      
      expect(assessment.codeId).toBe('file-1');
      expect(assessment.score).toBe(8.5);
      expect(assessment.getQualityLevel()).toBe('good');
    });

    test('should validate score range', () => {
      expect(() => {
        const assessment = QualityAssessmentEntity.create('file-1', 'project-1');
        assessment.score = 15;
      }).toThrow('Score must be a number between 0 and 10');
    });

    test('should manage issues and strengths', () => {
      const assessment = QualityAssessmentEntity.create('file-1', 'project-1', 6.0);
      
      assessment.addIssue('Missing error handling');
      assessment.addIssue('No input validation');
      assessment.addStrength('Clear variable names');
      
      expect(assessment.issues).toHaveLength(2);
      expect(assessment.strengths).toHaveLength(1);
      
      assessment.removeIssue('Missing error handling');
      expect(assessment.issues).toHaveLength(1);
    });

    test('should calculate quality levels correctly', () => {
      const exceptional = QualityAssessmentEntity.create('file-1', 'project-1', 9.5);
      const good = QualityAssessmentEntity.create('file-2', 'project-1', 7.5);
      const poor = QualityAssessmentEntity.create('file-3', 'project-1', 2.0);
      
      expect(exceptional.isExceptional()).toBe(true);
      expect(good.isGood()).toBe(true);
      expect(poor.isPoor()).toBe(true);
      
      expect(exceptional.getQualityDescription()).toBe('Production-ready, exceptional quality');
    });

    test('should set criteria scores with weights', () => {
      const assessment = QualityAssessmentEntity.create('file-1', 'project-1');
      
      assessment.setCriteriaScores(8, 7, 9, 6, 8); // structure, practices, readability, maintainability, performance
      
      // Weighted score: 8*0.3 + 7*0.25 + 9*0.2 + 6*0.15 + 8*0.1 = 7.55
      expect(assessment.score).toBe(7.6); // Rounded
    });

    test('should create from prompt response', () => {
      const promptResponse = {
        score: 8.5,
        issues: ['Missing comments', 'Hard-coded values'],
        strengths: ['Good structure', 'Proper error handling']
      };
      
      const assessment = QualityAssessmentEntity.fromPromptResponse(
        promptResponse, 
        'file-1', 
        'project-1'
      );
      
      expect(assessment.score).toBe(8.5);
      expect(assessment.issues).toEqual(['Missing comments', 'Hard-coded values']);
      expect(assessment.strengths).toEqual(['Good structure', 'Proper error handling']);
    });

    test('should compare assessments', () => {
      const assessment1 = QualityAssessmentEntity.create('file-1', 'project-1', 6.0);
      assessment1.issues = ['Issue A', 'Issue B'];
      
      const assessment2 = QualityAssessmentEntity.create('file-1', 'project-1', 8.0);
      assessment2.issues = ['Issue B', 'Issue C'];
      
      const comparison = assessment2.compareTo(assessment1);
      
      expect(comparison.scoreDiff).toBe(2.0);
      expect(comparison.improved).toBe(true);
      expect(comparison.newIssues).toEqual(['Issue C']);
      expect(comparison.resolvedIssues).toEqual(['Issue A']);
    });
  });

  describe('ErrorEntity', () => {
    test('should create error from exception', () => {
      const jsError = new Error('Cannot read property "name" of undefined');
      jsError.stack = 'TypeError: Cannot read property "name" of undefined\n    at getUserName (/app/user.js:15:23)';
      
      const error = ErrorEntity.fromException(jsError, 'project-1', 'file-1');
      
      expect(error.message).toBe('Cannot read property "name" of undefined');
      expect(error.getErrorType()).toBe('TypeError');
      expect(error.getFunctionName()).toBe('getUserName');
    });

    test('should detect error types correctly', () => {
      const typeError = ErrorEntity.create('Cannot read properties of undefined', 'project-1');
      const referenceError = ErrorEntity.create('someVariable is not defined', 'project-1');
      const syntaxError = ErrorEntity.create('Unexpected token {', 'project-1');
      
      expect(typeError.getErrorType()).toBe('TypeError');
      expect(referenceError.getErrorType()).toBe('ReferenceError');
      expect(syntaxError.getErrorType()).toBe('SyntaxError');
    });

    test('should manage error resolution', () => {
      const error = ErrorEntity.create('Test error', 'project-1');
      
      expect(error.isResolved).toBe(false);
      
      error.resolve('Add null check before accessing property');
      
      expect(error.isResolved).toBe(true);
      expect(error.resolution).toBe('Add null check before accessing property');
    });

    test('should convert to prompt format', () => {
      const error = new ErrorEntity({
        ':error/message': 'Cannot read property "name"',
        ':error/stack': 'TypeError: Cannot read property "name" of undefined\n    at getUserName (/app/user.js:15:23)',
        ':error/project': 'project-1'
      });

      const promptFormat = error.toPromptFormat();
      
      expect(promptFormat.errorMessage).toBe('Cannot read property "name"');
      expect(promptFormat.stackTrace).toContain('TypeError');
      expect(promptFormat.location.function).toBe('getUserName');
    });
  });

  describe('EntityFactory', () => {
    test('should create requirements of different types', () => {
      const functional = EntityFactory.createRequirement('User login', 'project-1', 'functional');
      const constraint = EntityFactory.createRequirement('Must use HTTPS', 'project-1', 'constraint');
      
      expect(functional.type).toBe('functional');
      expect(constraint.type).toBe('constraint');
    });

    test('should create project plan from prompt', () => {
      const promptResponse = {
        planId: 'test-plan',
        phases: [
          { phase: 'setup', priority: 1, tasks: [] }
        ]
      };
      
      const plan = EntityFactory.createProjectPlan(promptResponse, 'project-1');
      
      expect(plan.plan.planId).toBe('test-plan');
      expect(plan.phases).toHaveLength(1);
    });

    test('should create CRUD endpoints', () => {
      const endpoints = EntityFactory.createCRUDEndpoints('users', 'project-1');
      
      expect(endpoints).toHaveLength(5); // CREATE, READ, UPDATE, DELETE, LIST
      expect(endpoints[0].method).toBe('POST'); // CREATE
      expect(endpoints[1].method).toBe('GET');  // READ
    });
  });

  describe('EntityValidator', () => {
    test('should validate multiple entities', () => {
      const req1 = RequirementsEntity.createFunctional('Valid requirement', 'project-1');
      const req2 = new RequirementsEntity({}); // Invalid - missing required fields
      
      const result = EntityValidator.validateEntities([req1, req2]);
      
      expect(result.valid).toBe(false);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].valid).toBe(true);
      expect(result.entities[1].valid).toBe(false);
    });

    test('should validate entity relationships', () => {
      const plan = ProjectPlanEntity.create('plan-1', 'project-1');
      const phase = PlanPhaseEntity.create('setup', 1, 'plan-1');
      const orphanPhase = PlanPhaseEntity.create('orphan', 1, 'nonexistent-plan');
      
      // Mock IDs for relationship validation
      plan.id = 'plan-entity-1';
      
      const result = EntityValidator.validateRelationships([plan, phase, orphanPhase]);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing referenced entity: :phase/plan -> nonexistent-plan');
    });
  });

  describe('EntitySerializer', () => {
    test('should convert entities to JSON', () => {
      const req = RequirementsEntity.createFunctional('Test requirement', 'project-1');
      const plan = ProjectPlanEntity.create('plan-1', 'project-1');
      
      const json = EntitySerializer.toJSON([req, plan]);
      
      expect(json).toHaveLength(2);
      expect(json[0].entityType).toBe('requirement');
      expect(json[1].entityType).toBe('plan');
    });

    test('should convert entities to prompt format', () => {
      const endpoint = EndpointEntity.createHealthCheck('project-1');
      const assessment = QualityAssessmentEntity.create('file-1', 'project-1', 8.5);
      
      const promptFormat = EntitySerializer.toPromptFormat([endpoint, assessment]);
      
      expect(promptFormat.endpoint).toHaveLength(1);
      expect(promptFormat.assessment).toHaveLength(1);
      expect(promptFormat.endpoint[0].method).toBe('GET');
    });

    test('should deserialize from JSON', () => {
      const jsonArray = [
        { entityType: 'requirement', description: 'Test req', type: 'functional', project: 'project-1' },
        { entityType: 'plan', id: 'plan-1', project: 'project-1', status: 'draft' }
      ];
      
      const entities = EntitySerializer.fromJSON(jsonArray, DEFAULT_ENTITY_TYPES);
      
      expect(entities).toHaveLength(2);
      expect(entities[0]).toBeInstanceOf(RequirementsEntity);
      expect(entities[1]).toBeInstanceOf(ProjectPlanEntity);
    });
  });

  describe('Integration with Prompt Data', () => {
    test('should create entities from typical prompt responses', () => {
      // Simulate a requirements analysis prompt response
      const requirementAnalysis = {
        type: 'api',
        features: ['authentication', 'user management', 'data validation'],
        constraints: ['secure', 'scalable', 'maintainable'],
        technologies: ['nodejs', 'express', 'mongodb']
      };
      
      // Create requirements from analysis
      const requirements = requirementAnalysis.features.map(feature => 
        EntityFactory.createRequirement(
          `Implement ${feature} functionality`,
          'project-1',
          'functional',
          'high'
        )
      );
      
      expect(requirements).toHaveLength(3);
      expect(requirements[0].description).toBe('Implement authentication functionality');
      
      // Simulate a project plan prompt response
      const planResponse = {
        planId: 'api-development-plan',
        phases: [
          {
            phase: 'setup',
            priority: 1,
            tasks: [
              { id: 'init-project', action: 'Initialize Node.js project', dependencies: [] },
              { id: 'install-deps', action: 'Install Express and MongoDB', dependencies: ['init-project'] }
            ]
          },
          {
            phase: 'development',
            priority: 2,
            tasks: [
              { id: 'auth-middleware', action: 'Create authentication middleware', dependencies: ['install-deps'] }
            ]
          }
        ]
      };
      
      const projectPlan = EntityFactory.createProjectPlan(planResponse, 'project-1');
      
      expect(projectPlan.plan.planId).toBe('api-development-plan');
      expect(projectPlan.phases).toHaveLength(2);
      
      // Simulate server generation prompt response
      const serverEndpoints = [
        { method: 'GET', path: '/api/health', description: 'Health check' },
        { method: 'POST', path: '/api/auth/login', description: 'User login' },
        { method: 'GET', path: '/api/users', description: 'List users' }
      ];
      
      const endpoints = EntityFactory.createEndpointsFromPrompt(serverEndpoints, 'project-1');
      
      expect(endpoints).toHaveLength(3);
      expect(endpoints[1].path).toBe('/api/auth/login');
      
      // Simulate quality assessment prompt response
      const qualityResponse = {
        score: 7.5,
        issues: ['Missing error handling in login endpoint', 'No input validation'],
        strengths: ['Clear API structure', 'Good endpoint organization']
      };
      
      const qualityAssessment = EntityFactory.createQualityAssessment(
        qualityResponse, 
        'server-file-1', 
        'project-1'
      );
      
      expect(qualityAssessment.score).toBe(7.5);
      expect(qualityAssessment.getQualityLevel()).toBe('good');
      
      // Validate all entities work together
      const allEntities = [...requirements, projectPlan.plan, ...projectPlan.phases, ...endpoints, qualityAssessment];
      const validation = EntityValidator.validateEntities(allEntities);
      
      expect(validation.valid).toBe(true);
    });
  });
});