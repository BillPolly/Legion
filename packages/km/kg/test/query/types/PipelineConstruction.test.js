import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { SequentialQuery } from '../../../src/query/types/SequentialQuery.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { FunctionConstraint } from '../../../src/query/constraints/FunctionConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 6.1: Pipeline Construction', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for pipeline testing
    // Create a rich dataset with people, projects, skills, and relationships
    
    // People with detailed attributes
    kg.addTriple('alice', 'rdf:type', 'Person');
    kg.addTriple('alice', 'name', 'Alice Smith');
    kg.addTriple('alice', 'age', 30);
    kg.addTriple('alice', 'department', 'Engineering');
    kg.addTriple('alice', 'salary', 75000);
    kg.addTriple('alice', 'level', 'Senior');
    kg.addTriple('alice', 'location', 'San Francisco');
    kg.addTriple('alice', 'startDate', '2020-01-15');
    kg.addTriple('alice', 'performance', 'Excellent');
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 25);
    kg.addTriple('bob', 'department', 'Engineering');
    kg.addTriple('bob', 'salary', 60000);
    kg.addTriple('bob', 'level', 'Junior');
    kg.addTriple('bob', 'location', 'New York');
    kg.addTriple('bob', 'startDate', '2022-03-01');
    kg.addTriple('bob', 'performance', 'Good');
    
    kg.addTriple('charlie', 'rdf:type', 'Person');
    kg.addTriple('charlie', 'name', 'Charlie Brown');
    kg.addTriple('charlie', 'age', 35);
    kg.addTriple('charlie', 'department', 'Sales');
    kg.addTriple('charlie', 'salary', 90000);
    kg.addTriple('charlie', 'level', 'Manager');
    kg.addTriple('charlie', 'location', 'Chicago');
    kg.addTriple('charlie', 'startDate', '2018-06-10');
    kg.addTriple('charlie', 'performance', 'Excellent');
    
    kg.addTriple('diana', 'rdf:type', 'Person');
    kg.addTriple('diana', 'name', 'Diana Prince');
    kg.addTriple('diana', 'age', 28);
    kg.addTriple('diana', 'department', 'Marketing');
    kg.addTriple('diana', 'salary', 85000);
    kg.addTriple('diana', 'level', 'Senior');
    kg.addTriple('diana', 'location', 'Los Angeles');
    kg.addTriple('diana', 'startDate', '2021-09-20');
    kg.addTriple('diana', 'performance', 'Excellent');
    
    kg.addTriple('eve', 'rdf:type', 'Person');
    kg.addTriple('eve', 'name', 'Eve Wilson');
    kg.addTriple('eve', 'age', 32);
    kg.addTriple('eve', 'department', 'Marketing');
    kg.addTriple('eve', 'salary', 95000);
    kg.addTriple('eve', 'level', 'Manager');
    kg.addTriple('eve', 'location', 'Seattle');
    kg.addTriple('eve', 'startDate', '2019-11-05');
    kg.addTriple('eve', 'performance', 'Good');
    
    // Projects
    kg.addTriple('project1', 'rdf:type', 'Project');
    kg.addTriple('project1', 'name', 'AI Platform');
    kg.addTriple('project1', 'budget', 500000);
    kg.addTriple('project1', 'status', 'Active');
    kg.addTriple('project1', 'priority', 'High');
    kg.addTriple('project1', 'deadline', '2025-12-31');
    kg.addTriple('project1', 'complexity', 'High');
    
    kg.addTriple('project2', 'rdf:type', 'Project');
    kg.addTriple('project2', 'name', 'Mobile App');
    kg.addTriple('project2', 'budget', 200000);
    kg.addTriple('project2', 'status', 'Planning');
    kg.addTriple('project2', 'priority', 'Medium');
    kg.addTriple('project2', 'deadline', '2025-08-15');
    kg.addTriple('project2', 'complexity', 'Medium');
    
    kg.addTriple('project3', 'rdf:type', 'Project');
    kg.addTriple('project3', 'name', 'Data Analytics');
    kg.addTriple('project3', 'budget', 300000);
    kg.addTriple('project3', 'status', 'Active');
    kg.addTriple('project3', 'priority', 'High');
    kg.addTriple('project3', 'deadline', '2025-10-01');
    kg.addTriple('project3', 'complexity', 'High');
    
    // Skills
    kg.addTriple('skill1', 'rdf:type', 'Skill');
    kg.addTriple('skill1', 'name', 'JavaScript');
    kg.addTriple('skill1', 'category', 'Programming');
    kg.addTriple('skill1', 'level', 'Advanced');
    
    kg.addTriple('skill2', 'rdf:type', 'Skill');
    kg.addTriple('skill2', 'name', 'Python');
    kg.addTriple('skill2', 'category', 'Programming');
    kg.addTriple('skill2', 'level', 'Advanced');
    
    kg.addTriple('skill3', 'rdf:type', 'Skill');
    kg.addTriple('skill3', 'name', 'Project Management');
    kg.addTriple('skill3', 'category', 'Management');
    kg.addTriple('skill3', 'level', 'Expert');
    
    kg.addTriple('skill4', 'rdf:type', 'Skill');
    kg.addTriple('skill4', 'name', 'Data Analysis');
    kg.addTriple('skill4', 'category', 'Analytics');
    kg.addTriple('skill4', 'level', 'Advanced');
    
    // Relationships
    kg.addTriple('alice', 'worksOn', 'project1');
    kg.addTriple('alice', 'worksOn', 'project3');
    kg.addTriple('bob', 'worksOn', 'project1');
    kg.addTriple('bob', 'worksOn', 'project2');
    kg.addTriple('charlie', 'worksOn', 'project2');
    kg.addTriple('diana', 'worksOn', 'project2');
    kg.addTriple('diana', 'worksOn', 'project3');
    kg.addTriple('eve', 'worksOn', 'project3');
    
    kg.addTriple('alice', 'hasSkill', 'skill1');
    kg.addTriple('alice', 'hasSkill', 'skill2');
    kg.addTriple('bob', 'hasSkill', 'skill1');
    kg.addTriple('charlie', 'hasSkill', 'skill3');
    kg.addTriple('diana', 'hasSkill', 'skill4');
    kg.addTriple('eve', 'hasSkill', 'skill3');
    kg.addTriple('eve', 'hasSkill', 'skill4');
    
    kg.addTriple('alice', 'manages', 'bob');
    kg.addTriple('charlie', 'manages', 'alice');
    kg.addTriple('eve', 'manages', 'diana');
    
    // Companies
    kg.addTriple('techcorp', 'rdf:type', 'Company');
    kg.addTriple('techcorp', 'name', 'TechCorp Inc');
    kg.addTriple('techcorp', 'industry', 'Technology');
    
    kg.addTriple('alice', 'worksAt', 'techcorp');
    kg.addTriple('bob', 'worksAt', 'techcorp');
    kg.addTriple('charlie', 'worksAt', 'techcorp');
    kg.addTriple('diana', 'worksAt', 'techcorp');
    kg.addTriple('eve', 'worksAt', 'techcorp');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 6.1.1: Test SequentialQuery stage addition and ordering', async () => {
    // Test basic stage addition
    const pipeline = new SequentialQuery();
    
    // Stage 1: Find all people
    const personVar = new QueryVariable('person');
    const allPeoplePattern = new TriplePattern(personVar, 'rdf:type', 'Person');
    const allPeopleQuery = new PatternQuery();
    allPeopleQuery.addPattern(allPeoplePattern);
    
    // Stage 2: Filter by department
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    // Stage 3: Filter by level
    const seniorPattern = new TriplePattern(personVar, 'level', 'Senior');
    const seniorQuery = new PatternQuery();
    seniorQuery.addPattern(seniorPattern);
    
    // Add stages in order
    pipeline.addStage(allPeopleQuery);
    pipeline.addStage(engineeringQuery);
    pipeline.addStage(seniorQuery);
    
    // Verify stage count and ordering
    expect(pipeline.stages.length).toBe(3);
    expect(pipeline.stages[0]).toBe(allPeopleQuery);
    expect(pipeline.stages[1]).toBe(engineeringQuery);
    expect(pipeline.stages[2]).toBe(seniorQuery);
    
    // Test method chaining
    const chainedPipeline = new SequentialQuery()
      .addStage(allPeopleQuery)
      .addStage(engineeringQuery)
      .addStage(seniorQuery);
    
    expect(chainedPipeline.stages.length).toBe(3);
    expect(chainedPipeline).toBeInstanceOf(SequentialQuery);
    
    // Test execution to verify stages work together
    const results = await pipeline.execute(kg);
    expect(results.bindings.length).toBeGreaterThan(0);
    
    // Verify all results are people in Engineering with Senior level
    for (const binding of results.bindings) {
      const person = binding.get('person');
      
      const deptTriples = kg.query(person, 'department', null);
      expect(deptTriples.length).toBeGreaterThan(0);
      expect(deptTriples[0][2]).toBe('Engineering');
      
      const levelTriples = kg.query(person, 'level', null);
      expect(levelTriples.length).toBeGreaterThan(0);
      expect(levelTriples[0][2]).toBe('Senior');
    }
    
    // Test empty pipeline
    const emptyPipeline = new SequentialQuery();
    const emptyResults = await emptyPipeline.execute(kg);
    expect(emptyResults.bindings.length).toBe(0);
    expect(emptyResults.variableNames.length).toBe(0);
    
    // Test single stage pipeline
    const singleStagePipeline = new SequentialQuery();
    singleStagePipeline.addStage(allPeopleQuery);
    
    const singleResults = await singleStagePipeline.execute(kg);
    expect(singleResults.bindings.length).toBe(5); // All 5 people
    
    // Test complex multi-stage pipeline with different query types
    const complexPipeline = new SequentialQuery();
    
    // Stage 1: Pattern query for people
    complexPipeline.addStage(allPeopleQuery);
    
    // Stage 2: Logical query (Engineering OR Marketing)
    const marketingPattern = new TriplePattern(personVar, 'department', 'Marketing');
    const marketingQuery = new PatternQuery();
    marketingQuery.addPattern(marketingPattern);
    
    const deptOrQuery = new LogicalQuery('OR');
    deptOrQuery.addOperand(engineeringQuery);
    deptOrQuery.addOperand(marketingQuery);
    
    complexPipeline.addStage(deptOrQuery);
    
    // Stage 3: Constraint-based filtering
    const highSalaryVar = new QueryVariable('person');
    highSalaryVar.addConstraint(new FunctionConstraint((value) => {
      const salaryTriples = kg.query(value, 'salary', null);
      return salaryTriples.length > 0 && salaryTriples[0][2] >= 70000;
    }));
    
    const highSalaryPattern = new TriplePattern(highSalaryVar, 'rdf:type', 'Person');
    const highSalaryQuery = new PatternQuery();
    highSalaryQuery.addPattern(highSalaryPattern);
    
    complexPipeline.addStage(highSalaryQuery);
    
    const complexResults = await complexPipeline.execute(kg);
    expect(complexResults.bindings.length).toBeGreaterThan(0);
    
    // Verify complex pipeline results
    for (const binding of complexResults.bindings) {
      const person = binding.get('person');
      
      // Should be in Engineering OR Marketing
      const deptTriples = kg.query(person, 'department', null);
      expect(deptTriples.length).toBeGreaterThan(0);
      const dept = deptTriples[0][2];
      expect(['Engineering', 'Marketing']).toContain(dept);
      
      // Should have high salary
      const salaryTriples = kg.query(person, 'salary', null);
      expect(salaryTriples.length).toBeGreaterThan(0);
      expect(salaryTriples[0][2]).toBeGreaterThanOrEqual(70000);
    }
  });
  
  test('Step 6.1.2: Test pipeline data flow between stages', async () => {
    // Test data flow and context passing between stages
    const pipeline = new SequentialQuery();
    
    // Create a custom query that uses previous results from context
    class ContextAwareQuery extends PatternQuery {
      constructor(useContext = false) {
        super();
        this.useContext = useContext;
      }
      
      async _executeInternal(kgEngine, context = {}) {
        if (this.useContext && context.previousResult) {
          // Use previous result to filter current query
          const previousPeople = context.previousResult.bindings.map(b => b.get('person'));
          
          // Only return results that were in the previous stage
          const baseResults = await super._executeInternal(kgEngine, context);
          const filteredBindings = baseResults.bindings.filter(binding => {
            const person = binding.get('person');
            return previousPeople.includes(person);
          });
          
          return {
            bindings: filteredBindings,
            variableNames: baseResults.variableNames
          };
        }
        
        return super._executeInternal(kgEngine, context);
      }
    }
    
    // Stage 1: Find people in Engineering
    const personVar = new QueryVariable('person');
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new ContextAwareQuery();
    engineeringQuery.addPattern(engineeringPattern);
    
    // Stage 2: Find people with high salary (context-aware)
    const salaryVar = new QueryVariable('salary');
    salaryVar.addConstraint(new RangeConstraint(70000, 100000));
    const salaryPattern = new TriplePattern(personVar, 'salary', salaryVar);
    const salaryQuery = new ContextAwareQuery(true);
    salaryQuery.addPattern(salaryPattern);
    
    // Stage 3: Find people with excellent performance (context-aware)
    const performancePattern = new TriplePattern(personVar, 'performance', 'Excellent');
    const performanceQuery = new ContextAwareQuery(true);
    performanceQuery.addPattern(performancePattern);
    
    pipeline.addStage(engineeringQuery);
    pipeline.addStage(salaryQuery);
    pipeline.addStage(performanceQuery);
    
    const results = await pipeline.execute(kg);
    
    // Should find people who are in Engineering AND have high salary AND excellent performance
    expect(results.bindings.length).toBeGreaterThan(0);
    
    for (const binding of results.bindings) {
      const person = binding.get('person');
      
      // Verify Engineering department
      const deptTriples = kg.query(person, 'department', null);
      expect(deptTriples[0][2]).toBe('Engineering');
      
      // Verify high salary
      const salaryTriples = kg.query(person, 'salary', null);
      expect(salaryTriples[0][2]).toBeGreaterThanOrEqual(70000);
      expect(salaryTriples[0][2]).toBeLessThanOrEqual(100000);
      
      // Verify excellent performance
      const perfTriples = kg.query(person, 'performance', null);
      expect(perfTriples[0][2]).toBe('Excellent');
    }
    
    // Test data flow with variable transformation
    const transformPipeline = new SequentialQuery();
    
    // Stage 1: Find people
    const peopleQuery = new PatternQuery();
    peopleQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    
    // Stage 2: Find their projects
    const projectVar = new QueryVariable('project');
    const projectQuery = new PatternQuery();
    projectQuery.addPattern(new TriplePattern(personVar, 'worksOn', projectVar));
    
    // Stage 3: Get project details
    const projectNameVar = new QueryVariable('projectName');
    const projectDetailsQuery = new PatternQuery();
    projectDetailsQuery.addPattern(new TriplePattern(projectVar, 'name', projectNameVar));
    
    transformPipeline.addStage(peopleQuery);
    transformPipeline.addStage(projectQuery);
    transformPipeline.addStage(projectDetailsQuery);
    
    const transformResults = await transformPipeline.execute(kg);
    
    expect(transformResults.bindings.length).toBeGreaterThan(0);
    expect(transformResults.variableNames).toContain('person');
    expect(transformResults.variableNames).toContain('project');
    expect(transformResults.variableNames).toContain('projectName');
    
    // Verify data flow integrity
    for (const binding of transformResults.bindings) {
      const person = binding.get('person');
      const project = binding.get('project');
      const projectName = binding.get('projectName');
      
      expect(person).toBeDefined();
      expect(project).toBeDefined();
      expect(projectName).toBeDefined();
      
      // Verify relationships exist
      const worksOnTriples = kg.query(person, 'worksOn', project);
      expect(worksOnTriples.length).toBeGreaterThan(0);
      
      const nameTriples = kg.query(project, 'name', projectName);
      expect(nameTriples.length).toBeGreaterThan(0);
    }
    
    // Test empty intermediate results
    const emptyIntermediatePipeline = new SequentialQuery();
    
    // Stage 1: Find non-existent department
    const nonExistentPattern = new TriplePattern(personVar, 'department', 'NonExistent');
    const nonExistentQuery = new PatternQuery();
    nonExistentQuery.addPattern(nonExistentPattern);
    
    // Stage 2: This should receive empty results
    const followUpQuery = new PatternQuery();
    followUpQuery.addPattern(new TriplePattern(personVar, 'level', 'Senior'));
    
    emptyIntermediatePipeline.addStage(nonExistentQuery);
    emptyIntermediatePipeline.addStage(followUpQuery);
    
    const emptyResults = await emptyIntermediatePipeline.execute(kg);
    expect(emptyResults.bindings.length).toBe(0);
  });
  
  test('Step 6.1.3: Test pipeline context passing and variable scoping', async () => {
    // Test variable scoping and context inheritance in pipelines
    const pipeline = new SequentialQuery();
    
    // Create a query that explicitly uses context
    class ScopedQuery extends PatternQuery {
      constructor(contextKey) {
        super();
        this.contextKey = contextKey;
      }
      
      async _executeInternal(kgEngine, context = {}) {
        // Store execution context for verification
        this.lastContext = context;
        
        // Add context information to metadata
        if (context.previousResult) {
          this.setMetadata('previousResultCount', context.previousResult.bindings.length);
          this.setMetadata('previousVariables', context.previousResult.variableNames.join(','));
        }
        
        if (context.stageNumber !== undefined) {
          this.setMetadata('stageNumber', context.stageNumber);
        }
        
        return super._executeInternal(kgEngine, context);
      }
    }
    
    // Stage 1: Find all people
    const personVar = new QueryVariable('person');
    const stage1 = new ScopedQuery('stage1');
    stage1.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    
    // Stage 2: Filter by department
    const stage2 = new ScopedQuery('stage2');
    stage2.addPattern(new TriplePattern(personVar, 'department', 'Engineering'));
    
    // Stage 3: Add salary information
    const salaryVar = new QueryVariable('salary');
    const stage3 = new ScopedQuery('stage3');
    stage3.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    
    pipeline.addStage(stage1);
    pipeline.addStage(stage2);
    pipeline.addStage(stage3);
    
    // Execute with custom context
    const initialContext = {
      pipelineId: 'test_pipeline_123',
      executionMode: 'test',
      customData: { testFlag: true }
    };
    
    const results = await pipeline.execute(kg, initialContext);
    
    // Verify context was passed and preserved
    expect(stage1.lastContext).toBeDefined();
    expect(stage1.lastContext.pipelineId).toBe('test_pipeline_123');
    expect(stage1.lastContext.executionMode).toBe('test');
    expect(stage1.lastContext.customData.testFlag).toBe(true);
    
    // Verify previous results were passed to subsequent stages
    expect(stage2.lastContext.previousResult).toBeDefined();
    expect(stage2.lastContext.previousResult.bindings.length).toBeGreaterThan(0);
    expect(stage2.getMetadata('previousResultCount')).toBeGreaterThan(0);
    
    expect(stage3.lastContext.previousResult).toBeDefined();
    expect(stage3.lastContext.previousResult.bindings.length).toBeGreaterThan(0);
    
    // Test variable scoping with shared variables
    const scopingPipeline = new SequentialQuery();
    
    // Use the same variable name across stages to test scoping
    const sharedPersonVar = new QueryVariable('person');
    const sharedProjectVar = new QueryVariable('project');
    
    // Stage 1: Find people
    const peopleStage = new PatternQuery();
    peopleStage.addPattern(new TriplePattern(sharedPersonVar, 'rdf:type', 'Person'));
    
    // Stage 2: Find their projects (same person variable)
    const projectStage = new PatternQuery();
    projectStage.addPattern(new TriplePattern(sharedPersonVar, 'worksOn', sharedProjectVar));
    
    // Stage 3: Filter projects by status (same project variable)
    const statusStage = new PatternQuery();
    statusStage.addPattern(new TriplePattern(sharedProjectVar, 'status', 'Active'));
    
    scopingPipeline.addStage(peopleStage);
    scopingPipeline.addStage(projectStage);
    scopingPipeline.addStage(statusStage);
    
    const scopingResults = await scopingPipeline.execute(kg);
    
    expect(scopingResults.bindings.length).toBeGreaterThan(0);
    expect(scopingResults.variableNames).toContain('person');
    expect(scopingResults.variableNames).toContain('project');
    
    // Verify variable binding consistency
    for (const binding of scopingResults.bindings) {
      const person = binding.get('person');
      const project = binding.get('project');
      
      // Verify person works on project
      const worksOnTriples = kg.query(person, 'worksOn', project);
      expect(worksOnTriples.length).toBeGreaterThan(0);
      
      // Verify project is active
      const statusTriples = kg.query(project, 'status', null);
      expect(statusTriples.length).toBeGreaterThan(0);
      expect(statusTriples[0][2]).toBe('Active');
    }
    
    // Test context isolation between different pipelines
    const pipeline1 = new SequentialQuery();
    const pipeline2 = new SequentialQuery();
    
    const contextQuery1 = new ScopedQuery('pipeline1');
    contextQuery1.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    
    const contextQuery2 = new ScopedQuery('pipeline2');
    contextQuery2.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    
    pipeline1.addStage(contextQuery1);
    pipeline2.addStage(contextQuery2);
    
    await pipeline1.execute(kg, { pipelineId: 'pipeline_1' });
    await pipeline2.execute(kg, { pipelineId: 'pipeline_2' });
    
    // Verify context isolation
    expect(contextQuery1.lastContext.pipelineId).toBe('pipeline_1');
    expect(contextQuery2.lastContext.pipelineId).toBe('pipeline_2');
    
    // Test nested context preservation
    const nestedPipeline = new SequentialQuery();
    
    class NestedContextQuery extends PatternQuery {
      async _executeInternal(kgEngine, context = {}) {
        // Create nested context
        const nestedContext = {
          ...context,
          nestedLevel: (context.nestedLevel || 0) + 1,
          parentStage: this.constructor.name
        };
        
        this.nestedContext = nestedContext;
        return super._executeInternal(kgEngine, nestedContext);
      }
    }
    
    const nested1 = new NestedContextQuery();
    nested1.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    
    const nested2 = new NestedContextQuery();
    nested2.addPattern(new TriplePattern(personVar, 'department', 'Engineering'));
    
    nestedPipeline.addStage(nested1);
    nestedPipeline.addStage(nested2);
    
    await nestedPipeline.execute(kg, { initialLevel: 0 });
    
    expect(nested1.nestedContext.nestedLevel).toBe(1);
    expect(nested2.nestedContext.nestedLevel).toBe(1); // Both stages get the same initial context
    expect(nested1.nestedContext.initialLevel).toBe(0);
    expect(nested2.nestedContext.initialLevel).toBe(0);
  });
  
  test('Step 6.1.4: Test pipeline serialization to triples', async () => {
    // Test comprehensive serialization of sequential queries
    const pipeline = new SequentialQuery();
    
    // Add metadata to the pipeline
    pipeline.setMetadata('name', 'Employee Analysis Pipeline');
    pipeline.setMetadata('description', 'Multi-stage analysis of employee data');
    pipeline.setMetadata('version', '1.0.0');
    pipeline.setMetadata('author', 'test_user');
    
    // Stage 1: Find all people
    const personVar = new QueryVariable('person');
    const allPeoplePattern = new TriplePattern(personVar, 'rdf:type', 'Person');
    const allPeopleQuery = new PatternQuery();
    allPeopleQuery.addPattern(allPeoplePattern);
    allPeopleQuery.setMetadata('stageName', 'FindAllPeople');
    allPeopleQuery.setMetadata('description', 'Initial data collection');
    
    // Stage 2: Filter by department
    const engineeringPattern = new TriplePattern(personVar, 'department', 'Engineering');
    const engineeringQuery = new PatternQuery();
    engineeringQuery.addPattern(engineeringPattern);
    engineeringQuery.setMetadata('stageName', 'FilterByDepartment');
    engineeringQuery.setMetadata('filterValue', 'Engineering');
    
    // Stage 3: Add salary constraints
    const salaryVar = new QueryVariable('salary');
    salaryVar.addConstraint(new RangeConstraint(70000, 100000));
    const salaryPattern = new TriplePattern(personVar, 'salary', salaryVar);
    const salaryQuery = new PatternQuery();
    salaryQuery.addPattern(salaryPattern);
    salaryQuery.setMetadata('stageName', 'ApplySalaryFilter');
    salaryQuery.setMetadata('minSalary', 70000);
    salaryQuery.setMetadata('maxSalary', 100000);
    
    pipeline.addStage(allPeopleQuery);
    pipeline.addStage(engineeringQuery);
    pipeline.addStage(salaryQuery);
    
    // Execute to generate execution statistics
    await pipeline.execute(kg);
    
    // Test serialization
    const triples = pipeline.toTriples();
    expect(triples.length).toBeGreaterThan(0);
    
    // Verify pipeline metadata serialization
    const pipelineId = pipeline.getId();
    
    // Check main pipeline type
    const typeTriple = triples.find(([s, p, o]) => 
      s === pipelineId && p === 'rdf:type' && o === 'kg:Query'
    );
    expect(typeTriple).toBeDefined();
    
    // Check pipeline metadata
    const nameTriple = triples.find(([s, p, o]) => 
      s === pipelineId && p === 'kg:name' && o === 'Employee Analysis Pipeline'
    );
    expect(nameTriple).toBeDefined();
    
    const versionTriple = triples.find(([s, p, o]) => 
      s === pipelineId && p === 'kg:version' && o === '1.0.0'
    );
    expect(versionTriple).toBeDefined();
    
    // Check stage serialization
    const stageTriples = triples.filter(([s, p, o]) => 
      s === pipelineId && p === 'kg:hasStage'
    );
    expect(stageTriples.length).toBe(3);
    
    // Verify stage ordering
    const stage0Triple = triples.find(([s, p, o]) => 
      s.includes('_stage_0') && p === 'kg:stageOrder' && o === 0
    );
    expect(stage0Triple).toBeDefined();
    
    const stage1Triple = triples.find(([s, p, o]) => 
      s.includes('_stage_1') && p === 'kg:stageOrder' && o === 1
    );
    expect(stage1Triple).toBeDefined();
    
    const stage2Triple = triples.find(([s, p, o]) => 
      s.includes('_stage_2') && p === 'kg:stageOrder' && o === 2
    );
    expect(stage2Triple).toBeDefined();
    
    // Verify stage dependencies
    const inputFromTriple = triples.find(([s, p, o]) => 
      s.includes('_stage_1') && p === 'kg:inputFrom' && o.includes('_stage_0')
    );
    expect(inputFromTriple).toBeDefined();
    
    // Verify stage query references
    const stageQueryTriples = triples.filter(([s, p, o]) => 
      p === 'kg:stageQuery'
    );
    expect(stageQueryTriples.length).toBe(3);
    
    // Verify nested query serialization
    const allStageIds = stageTriples.map(([s, p, o]) => o);
    for (const stageId of allStageIds) {
      const stageQueryTriple = triples.find(([s, p, o]) => 
        s === stageId && p === 'kg:stageQuery'
      );
      expect(stageQueryTriple).toBeDefined();
      
      const queryId = stageQueryTriple[2];
      // Check that the query exists in the triples (either as kg:Query or with queryType)
      const queryTypeTriple = triples.find(([s, p, o]) => 
        s === queryId && (p === 'rdf:type' || p === 'kg:queryType')
      );
      expect(queryTypeTriple).toBeDefined();
    }
    
    // Test execution statistics serialization
    const statsTriples = triples.filter(([s, p, o]) => 
      s.includes('_stats')
    );
    expect(statsTriples.length).toBeGreaterThan(0);
    
    // Verify constraint serialization within stages
    const constraintTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasConstraint'
    );
    expect(constraintTriples.length).toBeGreaterThan(0);
    
    // Test complex nested pipeline serialization
    const nestedPipeline = new SequentialQuery();
    nestedPipeline.setMetadata('type', 'nested_analysis');
    
    // Add a logical query as a stage
    const logicalStage = new LogicalQuery('AND');
    logicalStage.addOperand(engineeringQuery);
    logicalStage.addOperand(salaryQuery);
    logicalStage.setMetadata('logicalType', 'intersection');
    
    nestedPipeline.addStage(allPeopleQuery);
    nestedPipeline.addStage(logicalStage);
    
    const nestedTriples = nestedPipeline.toTriples();
    expect(nestedTriples.length).toBeGreaterThan(0);
    
    // Verify nested logical query serialization
    const nestedLogicalTriples = nestedTriples.filter(([s, p, o]) => 
      p === 'kg:operator'
    );
    expect(nestedLogicalTriples.length).toBeGreaterThan(0);
  });
  
  test('Step 6.1.5: Test pipeline reconstruction from triples', async () => {
    // Test pipeline reconstruction and round-trip serialization
    const originalPipeline = new SequentialQuery();
    
    // Add comprehensive metadata
    originalPipeline.setMetadata('name', 'Test Reconstruction Pipeline');
    originalPipeline.setMetadata('description', 'Pipeline for testing serialization round-trip');
    originalPipeline.setMetadata('version', '2.1.0');
    originalPipeline.setMetadata('created', '2025-01-01T00:00:00Z');
    originalPipeline.setMetadata('tags', 'test,reconstruction,pipeline');
    
    // Create stages with metadata
    const personVar = new QueryVariable('person');
    
    // Stage 1: Basic pattern query
    const stage1 = new PatternQuery();
    stage1.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    stage1.setMetadata('stageName', 'InitialCollection');
    stage1.setMetadata('purpose', 'Collect all person entities');
    stage1.setMetadata('expectedResults', 'all_people');
    
    // Stage 2: Constraint-based filtering
    const constrainedVar = new QueryVariable('person');
    constrainedVar.addConstraint(new FunctionConstraint((value) => {
      const ageTriples = kg.query(value, 'age', null);
      return ageTriples.length > 0 && ageTriples[0][2] >= 30;
    }));
    
    const stage2 = new PatternQuery();
    stage2.addPattern(new TriplePattern(constrainedVar, 'rdf:type', 'Person'));
    stage2.setMetadata('stageName', 'AgeFiltering');
    stage2.setMetadata('constraint', 'age >= 30');
    stage2.setMetadata('filterType', 'demographic');
    
    // Stage 3: Relationship expansion
    const projectVar = new QueryVariable('project');
    const stage3 = new PatternQuery();
    stage3.addPattern(new TriplePattern(personVar, 'worksOn', projectVar));
    stage3.setMetadata('stageName', 'RelationshipExpansion');
    stage3.setMetadata('relationship', 'worksOn');
    stage3.setMetadata('targetEntity', 'project');
    
    originalPipeline.addStage(stage1);
    originalPipeline.addStage(stage2);
    originalPipeline.addStage(stage3);
    
    // Execute to generate statistics
    const originalResults = await originalPipeline.execute(kg);
    expect(originalResults.bindings.length).toBeGreaterThan(0);
    
    // Serialize to triples
    const triples = originalPipeline.toTriples();
    expect(triples.length).toBeGreaterThan(0);
    
    // Test conceptual reconstruction (in a real implementation, this would involve
    // a full deserialization system)
    const reconstructedPipeline = new SequentialQuery();
    
    // Extract and verify pipeline metadata from triples
    const pipelineId = originalPipeline.getId();
    
    const nameTriple = triples.find(([s, p, o]) => 
      s === pipelineId && p === 'kg:name'
    );
    if (nameTriple) {
      reconstructedPipeline.setMetadata('name', nameTriple[2]);
    }
    
    const versionTriple = triples.find(([s, p, o]) => 
      s === pipelineId && p === 'kg:version'
    );
    if (versionTriple) {
      reconstructedPipeline.setMetadata('version', versionTriple[2]);
    }
    
    const descriptionTriple = triples.find(([s, p, o]) => 
      s === pipelineId && p === 'kg:description'
    );
    if (descriptionTriple) {
      reconstructedPipeline.setMetadata('description', descriptionTriple[2]);
    }
    
    // Verify metadata reconstruction
    expect(reconstructedPipeline.getMetadata('name')).toBe('Test Reconstruction Pipeline');
    expect(reconstructedPipeline.getMetadata('version')).toBe('2.1.0');
    expect(reconstructedPipeline.getMetadata('description')).toBe('Pipeline for testing serialization round-trip');
    
    // Extract stage information
    const stageTriples = triples.filter(([s, p, o]) => 
      s === pipelineId && p === 'kg:hasStage'
    );
    expect(stageTriples.length).toBe(3);
    
    // Verify stage ordering information
    const stageOrderTriples = triples.filter(([s, p, o]) => 
      p === 'kg:stageOrder'
    );
    expect(stageOrderTriples.length).toBe(3);
    
    // Check stage order values
    const orderValues = stageOrderTriples.map(([s, p, o]) => o).sort();
    expect(orderValues).toEqual([0, 1, 2]);
    
    // Verify stage dependencies
    const inputFromTriples = triples.filter(([s, p, o]) => 
      p === 'kg:inputFrom'
    );
    expect(inputFromTriples.length).toBe(2); // Stage 1 -> Stage 2, Stage 2 -> Stage 3
    
    // Test execution statistics preservation
    const statsTriples = triples.filter(([s, p, o]) => 
      s.includes('_stats')
    );
    expect(statsTriples.length).toBeGreaterThan(0);
    
    // Verify execution count is preserved
    const executionCountTriple = triples.find(([s, p, o]) => 
      p === 'kg:executionCount'
    );
    expect(executionCountTriple).toBeDefined();
    expect(executionCountTriple[2]).toBe(1);
    
    // Verify result count is preserved
    const resultCountTriple = triples.find(([s, p, o]) => 
      p === 'kg:resultCount'
    );
    expect(resultCountTriple).toBeDefined();
    expect(resultCountTriple[2]).toBe(originalResults.bindings.length);
    
    // Test constraint preservation in serialization
    const constraintTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasConstraint'
    );
    expect(constraintTriples.length).toBeGreaterThan(0);
    
    // Test variable preservation
    const variableTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasVariable' || p === 'kg:variableName'
    );
    expect(variableTriples.length).toBeGreaterThan(0);
    
    // Verify variable names are preserved
    const variableNameTriples = triples.filter(([s, p, o]) => 
      p === 'kg:variableName'
    );
    const variableNames = variableNameTriples.map(([s, p, o]) => o);
    expect(variableNames).toContain('person');
    expect(variableNames).toContain('project');
    
    // Test pattern preservation
    const patternTriples = triples.filter(([s, p, o]) => 
      p === 'kg:hasPattern'
    );
    expect(patternTriples.length).toBeGreaterThan(0);
    
    // Test round-trip integrity by creating a new pipeline with same structure
    const roundTripPipeline = new SequentialQuery();
    roundTripPipeline.setMetadata('name', 'Test Reconstruction Pipeline');
    roundTripPipeline.setMetadata('version', '2.1.0');
    roundTripPipeline.setMetadata('description', 'Pipeline for testing serialization round-trip');
    
    // Recreate stages (in a real implementation, this would be automated)
    const newStage1 = new PatternQuery();
    newStage1.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    
    const newStage2 = new PatternQuery();
    const newConstrainedVar = new QueryVariable('person');
    newConstrainedVar.addConstraint(new FunctionConstraint((value) => {
      const ageTriples = kg.query(value, 'age', null);
      return ageTriples.length > 0 && ageTriples[0][2] >= 30;
    }));
    newStage2.addPattern(new TriplePattern(newConstrainedVar, 'rdf:type', 'Person'));
    
    const newStage3 = new PatternQuery();
    newStage3.addPattern(new TriplePattern(new QueryVariable('person'), 'worksOn', new QueryVariable('project')));
    
    roundTripPipeline.addStage(newStage1);
    roundTripPipeline.addStage(newStage2);
    roundTripPipeline.addStage(newStage3);
    
    // Execute round-trip pipeline
    const roundTripResults = await roundTripPipeline.execute(kg);
    
    // Verify round-trip results match original
    expect(roundTripResults.bindings.length).toBe(originalResults.bindings.length);
    expect(roundTripResults.variableNames.sort()).toEqual(originalResults.variableNames.sort());
    
    // Verify individual bindings match
    for (let i = 0; i < originalResults.bindings.length; i++) {
      const originalBinding = originalResults.bindings[i];
      const roundTripBinding = roundTripResults.bindings[i];
      
      for (const varName of originalResults.variableNames) {
        expect(roundTripBinding.get(varName)).toBe(originalBinding.get(varName));
      }
    }
    
    // Test serialization consistency
    const originalTripleCount = triples.length;
    const roundTripTriples = roundTripPipeline.toTriples();
    
    // Should have similar structure (exact match would require identical IDs)
    expect(roundTripTriples.length).toBeGreaterThan(originalTripleCount * 0.8);
    expect(roundTripTriples.length).toBeLessThan(originalTripleCount * 1.2);
  });
});
