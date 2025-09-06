import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { SequentialQuery } from '../../../src/query/types/SequentialQuery.js';
import { TraversalQuery } from '../../../src/query/types/TraversalQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { FixedLengthPath, VariableLengthPath } from '../../../src/query/paths/index.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { RegexConstraint } from '../../../src/query/constraints/RegexConstraint.js';
import { FunctionConstraint } from '../../../src/query/constraints/FunctionConstraint.js';
import { QueryBuilder } from '../../../src/core/QueryBuilder.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 13.2: Real-World Scenario Testing', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive real-world test data
    setupRealWorldTestData(kg);
  });
  
  afterEach(async () => {
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  function setupRealWorldTestData(kg) {
    // Social Network Data
    const people = [
      { id: 'alice', name: 'Alice Johnson', age: 30, location: 'New York', profession: 'Engineer' },
      { id: 'bob', name: 'Bob Smith', age: 25, location: 'San Francisco', profession: 'Designer' },
      { id: 'charlie', name: 'Charlie Brown', age: 35, location: 'New York', profession: 'Manager' },
      { id: 'diana', name: 'Diana Prince', age: 28, location: 'Los Angeles', profession: 'Engineer' },
      { id: 'eve', name: 'Eve Wilson', age: 32, location: 'Chicago', profession: 'Analyst' },
      { id: 'frank', name: 'Frank Miller', age: 40, location: 'Boston', profession: 'Director' }
    ];
    
    // Add people to knowledge graph
    people.forEach(person => {
      kg.addTriple(`person:${person.id}`, 'rdf:type', 'Person');
      kg.addTriple(`person:${person.id}`, 'name', person.name);
      kg.addTriple(`person:${person.id}`, 'age', person.age);
      kg.addTriple(`person:${person.id}`, 'location', person.location);
      kg.addTriple(`person:${person.id}`, 'profession', person.profession);
    });
    
    // Social connections (friendship network)
    const friendships = [
      ['alice', 'bob'], ['alice', 'charlie'], ['alice', 'diana'],
      ['bob', 'diana'], ['bob', 'eve'],
      ['charlie', 'frank'], ['charlie', 'eve'],
      ['diana', 'eve'], ['diana', 'frank'],
      ['eve', 'frank']
    ];
    
    friendships.forEach(([person1, person2]) => {
      kg.addTriple(`person:${person1}`, 'knows', `person:${person2}`);
      kg.addTriple(`person:${person2}`, 'knows', `person:${person1}`); // Bidirectional
    });
    
    // Professional relationships
    kg.addTriple('person:charlie', 'manages', 'person:alice');
    kg.addTriple('person:charlie', 'manages', 'person:diana');
    kg.addTriple('person:frank', 'manages', 'person:charlie');
    kg.addTriple('person:frank', 'manages', 'person:eve');
    
    // Skills and expertise
    const skills = [
      { id: 'javascript', name: 'JavaScript', category: 'Programming', level: 'Advanced' },
      { id: 'python', name: 'Python', category: 'Programming', level: 'Advanced' },
      { id: 'design', name: 'UI/UX Design', category: 'Design', level: 'Expert' },
      { id: 'management', name: 'Team Management', category: 'Leadership', level: 'Expert' },
      { id: 'analytics', name: 'Data Analytics', category: 'Analysis', level: 'Advanced' },
      { id: 'strategy', name: 'Business Strategy', category: 'Leadership', level: 'Expert' }
    ];
    
    skills.forEach(skill => {
      kg.addTriple(`skill:${skill.id}`, 'rdf:type', 'Skill');
      kg.addTriple(`skill:${skill.id}`, 'name', skill.name);
      kg.addTriple(`skill:${skill.id}`, 'category', skill.category);
      kg.addTriple(`skill:${skill.id}`, 'level', skill.level);
    });
    
    // Person-skill relationships
    kg.addTriple('person:alice', 'hasSkill', 'skill:javascript');
    kg.addTriple('person:alice', 'hasSkill', 'skill:python');
    kg.addTriple('person:diana', 'hasSkill', 'skill:javascript');
    kg.addTriple('person:diana', 'hasSkill', 'skill:analytics');
    kg.addTriple('person:bob', 'hasSkill', 'skill:design');
    kg.addTriple('person:charlie', 'hasSkill', 'skill:management');
    kg.addTriple('person:eve', 'hasSkill', 'skill:analytics');
    kg.addTriple('person:frank', 'hasSkill', 'skill:strategy');
    kg.addTriple('person:frank', 'hasSkill', 'skill:management');
    
    // Projects and collaborations
    const projects = [
      { id: 'webapp', name: 'Web Application', status: 'active', budget: 100000, priority: 'high' },
      { id: 'mobile', name: 'Mobile App', status: 'planning', budget: 75000, priority: 'medium' },
      { id: 'analytics', name: 'Analytics Platform', status: 'completed', budget: 150000, priority: 'high' },
      { id: 'redesign', name: 'UI Redesign', status: 'active', budget: 50000, priority: 'low' }
    ];
    
    projects.forEach(project => {
      kg.addTriple(`project:${project.id}`, 'rdf:type', 'Project');
      kg.addTriple(`project:${project.id}`, 'name', project.name);
      kg.addTriple(`project:${project.id}`, 'status', project.status);
      kg.addTriple(`project:${project.id}`, 'budget', project.budget);
      kg.addTriple(`project:${project.id}`, 'priority', project.priority);
    });
    
    // Project assignments
    kg.addTriple('project:webapp', 'assignedTo', 'person:alice');
    kg.addTriple('project:webapp', 'assignedTo', 'person:diana');
    kg.addTriple('project:mobile', 'assignedTo', 'person:bob');
    kg.addTriple('project:mobile', 'assignedTo', 'person:alice');
    kg.addTriple('project:analytics', 'assignedTo', 'person:eve');
    kg.addTriple('project:analytics', 'assignedTo', 'person:diana');
    kg.addTriple('project:redesign', 'assignedTo', 'person:bob');
    
    // Data quality indicators
    kg.addTriple('person:alice', 'dataQuality', 'verified');
    kg.addTriple('person:bob', 'dataQuality', 'verified');
    kg.addTriple('person:charlie', 'dataQuality', 'pending');
    kg.addTriple('person:diana', 'dataQuality', 'verified');
    kg.addTriple('person:eve', 'dataQuality', 'verified');
    kg.addTriple('person:frank', 'dataQuality', 'incomplete');
    
    // Performance metrics
    kg.addTriple('person:alice', 'performance', 95);
    kg.addTriple('person:bob', 'performance', 88);
    kg.addTriple('person:charlie', 'performance', 92);
    kg.addTriple('person:diana', 'performance', 97);
    kg.addTriple('person:eve', 'performance', 90);
    kg.addTriple('person:frank', 'performance', 85);
  }
  
  test('Step 13.2.1: Test social network analysis queries', async () => {
    console.log('=== Social Network Analysis ===');
    
    // Query 1: Find mutual friends
    const mutualFriendsQuery = new PatternQuery();
    mutualFriendsQuery.addPattern(new TriplePattern('person:alice', 'knows', new QueryVariable('friend1')));
    mutualFriendsQuery.addPattern(new TriplePattern('person:bob', 'knows', new QueryVariable('friend1')));
    mutualFriendsQuery.addPattern(new TriplePattern(new QueryVariable('friend1'), 'name', new QueryVariable('friendName')));
    
    const mutualFriends = await mutualFriendsQuery.execute(kg);
    expect(mutualFriends.bindings.length).toBeGreaterThan(0);
    
    console.log('Mutual friends of Alice and Bob:');
    mutualFriends.bindings.forEach(binding => {
      console.log(`- ${binding.get('friendName')}`);
    });
    
    // Query 2: Find people within 2 degrees of separation
    const twoDegreesPath = new VariableLengthPath('knows', 1, 2, 'outgoing');
    const twoDegreesQuery = new TraversalQuery('person:alice', twoDegreesPath, new QueryVariable('connected'));
    
    const twoDegreesResult = await twoDegreesQuery.execute(kg);
    expect(twoDegreesResult.bindings.length).toBeGreaterThan(0);
    
    console.log(`People within 2 degrees of Alice: ${twoDegreesResult.bindings.length}`);
    
    // Query 3: Find the most connected person (highest degree centrality)
    const connectionsQuery = new PatternQuery();
    connectionsQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    connectionsQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'knows', new QueryVariable('friend')));
    connectionsQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    const connectionsAgg = new AggregationQuery(connectionsQuery, 'COUNT');
    connectionsAgg.groupBy('person');
    connectionsAgg.groupBy('name');
    
    const connectionCounts = await connectionsAgg.execute(kg);
    expect(connectionCounts.bindings.length).toBeGreaterThan(0);
    
    // Find person with most connections
    let maxConnections = 0;
    let mostConnected = '';
    connectionCounts.bindings.forEach(binding => {
      const count = binding.get('aggregate_result');
      if (count > maxConnections) {
        maxConnections = count;
        mostConnected = binding.get('name');
      }
    });
    
    console.log(`Most connected person: ${mostConnected} (${maxConnections} connections)`);
    expect(maxConnections).toBeGreaterThan(0);
    
    // Query 4: Find professional clusters (people in same location and profession)
    const clustersQuery = new PatternQuery();
    clustersQuery.addPattern(new TriplePattern(new QueryVariable('person1'), 'rdf:type', 'Person'));
    clustersQuery.addPattern(new TriplePattern(new QueryVariable('person2'), 'rdf:type', 'Person'));
    clustersQuery.addPattern(new TriplePattern(new QueryVariable('person1'), 'location', new QueryVariable('location')));
    clustersQuery.addPattern(new TriplePattern(new QueryVariable('person2'), 'location', new QueryVariable('location')));
    clustersQuery.addPattern(new TriplePattern(new QueryVariable('person1'), 'profession', new QueryVariable('profession')));
    clustersQuery.addPattern(new TriplePattern(new QueryVariable('person2'), 'profession', new QueryVariable('profession')));
    
    // Add constraint to avoid self-matches
    const person1Var = clustersQuery.getVariable('person1');
    person1Var.addConstraint(new FunctionConstraint((value, context) => {
      return value !== context.binding.get('person2');
    }, 'person1 != person2'));
    
    const clusters = await clustersQuery.execute(kg);
    expect(clusters).toBeDefined();
    
    console.log(`Professional clusters found: ${clusters.bindings.length} pairs`);
  });
  
  test('Step 13.2.2: Test knowledge discovery and exploration queries', async () => {
    console.log('=== Knowledge Discovery and Exploration ===');
    
    // Query 1: Discover skill gaps in teams
    const skillGapQuery = new SequentialQuery();
    
    // Stage 1: Find all required skills for active projects
    const projectSkillsQuery = new PatternQuery();
    projectSkillsQuery.addPattern(new TriplePattern(new QueryVariable('project'), 'status', 'active'));
    projectSkillsQuery.addPattern(new TriplePattern(new QueryVariable('project'), 'assignedTo', new QueryVariable('person')));
    projectSkillsQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    
    skillGapQuery.addStage(projectSkillsQuery);
    
    // Stage 2: Aggregate skills by category
    const skillCategoryAgg = new AggregationQuery(projectSkillsQuery, 'COUNT');
    skillCategoryAgg.groupBy('skill');
    
    skillGapQuery.addStage(skillCategoryAgg);
    
    const skillGaps = await skillGapQuery.execute(kg);
    expect(skillGaps).toBeDefined();
    
    console.log('Active project skill distribution:');
    skillGaps.bindings.forEach(binding => {
      console.log(`- Skill: ${binding.get('skill')}, Count: ${binding.get('aggregate_result')}`);
    });
    
    // Query 2: Find potential mentorship opportunities
    const mentorshipQuery = new PatternQuery();
    mentorshipQuery.addPattern(new TriplePattern(new QueryVariable('mentor'), 'rdf:type', 'Person'));
    mentorshipQuery.addPattern(new TriplePattern(new QueryVariable('mentee'), 'rdf:type', 'Person'));
    mentorshipQuery.addPattern(new TriplePattern(new QueryVariable('mentor'), 'hasSkill', new QueryVariable('skill')));
    mentorshipQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', new QueryVariable('category')));
    mentorshipQuery.addPattern(new TriplePattern(new QueryVariable('mentor'), 'age', new QueryVariable('mentorAge')));
    mentorshipQuery.addPattern(new TriplePattern(new QueryVariable('mentee'), 'age', new QueryVariable('menteeAge')));
    
    // Add constraints for mentorship criteria
    const mentorAgeVar = mentorshipQuery.getVariable('mentorAge');
    mentorAgeVar.addConstraint(new FunctionConstraint((mentorAge, context) => {
      const menteeAge = context.binding.get('menteeAge');
      return mentorAge > menteeAge + 3; // Mentor should be at least 3 years older
    }, 'mentor older than mentee'));
    
    const mentorships = await mentorshipQuery.execute(kg);
    expect(mentorships).toBeDefined();
    
    console.log(`Potential mentorship opportunities: ${mentorships.bindings.length}`);
    
    // Query 3: Discover hidden connections through shared projects
    const hiddenConnectionsQuery = new PatternQuery();
    hiddenConnectionsQuery.addPattern(new TriplePattern(new QueryVariable('person1'), 'rdf:type', 'Person'));
    hiddenConnectionsQuery.addPattern(new TriplePattern(new QueryVariable('person2'), 'rdf:type', 'Person'));
    hiddenConnectionsQuery.addPattern(new TriplePattern(new QueryVariable('project'), 'assignedTo', new QueryVariable('person1')));
    hiddenConnectionsQuery.addPattern(new TriplePattern(new QueryVariable('project'), 'assignedTo', new QueryVariable('person2')));
    hiddenConnectionsQuery.addPattern(new TriplePattern(new QueryVariable('person1'), 'name', new QueryVariable('name1')));
    hiddenConnectionsQuery.addPattern(new TriplePattern(new QueryVariable('person2'), 'name', new QueryVariable('name2')));
    
    // Exclude direct friendships and self-matches
    const person1Var = hiddenConnectionsQuery.getVariable('person1');
    person1Var.addConstraint(new FunctionConstraint((person1, context) => {
      const person2 = context.binding.get('person2');
      return person1 !== person2;
    }, 'different people'));
    
    const hiddenConnections = await hiddenConnectionsQuery.execute(kg);
    expect(hiddenConnections).toBeDefined();
    
    console.log('Hidden connections through shared projects:');
    const connectionPairs = new Set();
    hiddenConnections.bindings.forEach(binding => {
      const name1 = binding.get('name1');
      const name2 = binding.get('name2');
      const pair = [name1, name2].sort().join(' - ');
      connectionPairs.add(pair);
    });
    
    connectionPairs.forEach(pair => console.log(`- ${pair}`));
    
    // Query 4: Explore skill evolution patterns
    const skillEvolutionQuery = new LogicalQuery('AND');
    
    const programmingSkillsQuery = new PatternQuery();
    programmingSkillsQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    programmingSkillsQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', 'Programming'));
    programmingSkillsQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'age', new QueryVariable('age')));
    
    const experienceQuery = new PatternQuery();
    const ageVar = new QueryVariable('age');
    ageVar.addConstraint(new RangeConstraint('age', 30, 40));
    experienceQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'age', ageVar));
    
    skillEvolutionQuery.addOperand(programmingSkillsQuery);
    skillEvolutionQuery.addOperand(experienceQuery);
    
    const skillEvolution = await skillEvolutionQuery.execute(kg);
    expect(skillEvolution).toBeDefined();
    
    console.log(`Experienced programmers (30-40 years): ${skillEvolution.bindings.length}`);
  });
  
  test('Step 13.2.3: Test data quality and validation queries', async () => {
    console.log('=== Data Quality and Validation ===');
    
    // Query 1: Find incomplete profiles
    const incompleteProfilesQuery = new LogicalQuery('OR');
    
    const missingDataQuery = new PatternQuery();
    missingDataQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    missingDataQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'dataQuality', 'incomplete'));
    missingDataQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    const pendingDataQuery = new PatternQuery();
    pendingDataQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    pendingDataQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'dataQuality', 'pending'));
    pendingDataQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    incompleteProfilesQuery.addOperand(missingDataQuery);
    incompleteProfilesQuery.addOperand(pendingDataQuery);
    
    const incompleteProfiles = await incompleteProfilesQuery.execute(kg);
    expect(incompleteProfiles).toBeDefined();
    
    console.log('Profiles needing attention:');
    incompleteProfiles.bindings.forEach(binding => {
      console.log(`- ${binding.get('name')}`);
    });
    
    // Query 2: Validate data consistency
    const consistencyQuery = new PatternQuery();
    consistencyQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    consistencyQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'age', new QueryVariable('age')));
    consistencyQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    // Add validation constraint for reasonable age range
    const ageVar = consistencyQuery.getVariable('age');
    ageVar.addConstraint(new RangeConstraint('age', 18, 70));
    
    const validAges = await consistencyQuery.execute(kg);
    expect(validAges.bindings.length).toBeGreaterThan(0);
    
    console.log(`People with valid ages: ${validAges.bindings.length}`);
    
    // Query 3: Find orphaned data (skills without people)
    const orphanedSkillsQuery = new PatternQuery();
    orphanedSkillsQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'rdf:type', 'Skill'));
    orphanedSkillsQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'name', new QueryVariable('skillName')));
    
    // Find skills that are NOT referenced by any person
    const referencedSkillsQuery = new PatternQuery();
    referencedSkillsQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    
    const allSkills = await orphanedSkillsQuery.execute(kg);
    const referencedSkills = await referencedSkillsQuery.execute(kg);
    
    const referencedSkillIds = new Set(referencedSkills.bindings.map(b => b.get('skill')));
    const orphanedSkills = allSkills.bindings.filter(binding => 
      !referencedSkillIds.has(binding.get('skill'))
    );
    
    console.log(`Orphaned skills: ${orphanedSkills.length}`);
    
    // Query 4: Performance data validation
    const performanceValidationQuery = new PatternQuery();
    performanceValidationQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    performanceValidationQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'performance', new QueryVariable('performance')));
    performanceValidationQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    // Validate performance scores are in valid range
    const performanceVar = performanceValidationQuery.getVariable('performance');
    performanceVar.addConstraint(new RangeConstraint('performance', 0, 100));
    
    const validPerformance = await performanceValidationQuery.execute(kg);
    expect(validPerformance.bindings.length).toBeGreaterThan(0);
    
    console.log(`People with valid performance scores: ${validPerformance.bindings.length}`);
    
    // Calculate average performance
    const avgPerformanceQuery = new AggregationQuery(performanceValidationQuery, 'AVG');
    const avgPerformance = await avgPerformanceQuery.execute(kg);
    
    const averageScore = avgPerformance.bindings[0].get('aggregate_result');
    console.log(`Average performance score: ${averageScore.toFixed(2)}`);
    expect(averageScore).toBeGreaterThanOrEqual(0);
    expect(averageScore).toBeLessThanOrEqual(100);
  });
  
  test('Step 13.2.4: Test reporting and analytics queries', async () => {
    console.log('=== Reporting and Analytics ===');
    
    // Query 1: Department performance report
    const deptPerformanceQuery = new PatternQuery();
    deptPerformanceQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    deptPerformanceQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'profession', new QueryVariable('profession')));
    deptPerformanceQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'performance', new QueryVariable('performance')));
    
    const deptPerformanceAgg = new AggregationQuery(deptPerformanceQuery, 'AVG');
    deptPerformanceAgg.groupBy('profession');
    
    const deptPerformance = await deptPerformanceAgg.execute(kg);
    expect(deptPerformance.bindings.length).toBeGreaterThan(0);
    
    console.log('Department Performance Report:');
    deptPerformance.bindings.forEach(binding => {
      const profession = binding.get('profession');
      const avgPerformance = binding.get('aggregate_result');
      console.log(`- ${profession}: ${avgPerformance.toFixed(2)}`);
    });
    
    // Query 2: Project budget analysis
    const budgetAnalysisQuery = new PatternQuery();
    budgetAnalysisQuery.addPattern(new TriplePattern(new QueryVariable('project'), 'rdf:type', 'Project'));
    budgetAnalysisQuery.addPattern(new TriplePattern(new QueryVariable('project'), 'status', new QueryVariable('status')));
    budgetAnalysisQuery.addPattern(new TriplePattern(new QueryVariable('project'), 'budget', new QueryVariable('budget')));
    
    const budgetByStatusAgg = new AggregationQuery(budgetAnalysisQuery, 'SUM');
    budgetByStatusAgg.groupBy('status');
    
    const budgetAnalysis = await budgetByStatusAgg.execute(kg);
    expect(budgetAnalysis.bindings.length).toBeGreaterThan(0);
    
    console.log('Budget Analysis by Project Status:');
    let totalBudget = 0;
    budgetAnalysis.bindings.forEach(binding => {
      const status = binding.get('status');
      const totalBudgetForStatus = binding.get('aggregate_result');
      totalBudget += totalBudgetForStatus;
      console.log(`- ${status}: $${totalBudgetForStatus.toLocaleString()}`);
    });
    console.log(`Total Budget: $${totalBudget.toLocaleString()}`);
    
    // Query 3: Skill distribution analysis
    const skillDistributionQuery = new PatternQuery();
    skillDistributionQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    skillDistributionQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', new QueryVariable('category')));
    
    const skillDistributionAgg = new AggregationQuery(skillDistributionQuery, 'COUNT');
    skillDistributionAgg.groupBy('category');
    
    const skillDistribution = await skillDistributionAgg.execute(kg);
    expect(skillDistribution.bindings.length).toBeGreaterThan(0);
    
    console.log('Skill Distribution by Category:');
    skillDistribution.bindings.forEach(binding => {
      const category = binding.get('category');
      const count = binding.get('aggregate_result');
      console.log(`- ${category}: ${count} people`);
    });
    
    // Query 4: Geographic distribution report
    const geoDistributionQuery = new PatternQuery();
    geoDistributionQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    geoDistributionQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'location', new QueryVariable('location')));
    geoDistributionQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'profession', new QueryVariable('profession')));
    
    const geoDistributionAgg = new AggregationQuery(geoDistributionQuery, 'COUNT');
    geoDistributionAgg.groupBy('location');
    geoDistributionAgg.groupBy('profession');
    
    const geoDistribution = await geoDistributionAgg.execute(kg);
    expect(geoDistribution.bindings.length).toBeGreaterThan(0);
    
    console.log('Geographic Distribution by Profession:');
    geoDistribution.bindings.forEach(binding => {
      const location = binding.get('location');
      const profession = binding.get('profession');
      const count = binding.get('aggregate_result');
      console.log(`- ${location} (${profession}): ${count}`);
    });
    
    // Query 5: Executive summary metrics
    const summaryQueries = await Promise.all([
      // Total people
      new AggregationQuery(
        new PatternQuery().addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person')),
        'COUNT'
      ).execute(kg),
      
      // Total projects
      new AggregationQuery(
        new PatternQuery().addPattern(new TriplePattern(new QueryVariable('project'), 'rdf:type', 'Project')),
        'COUNT'
      ).execute(kg),
      
      // Average age
      new AggregationQuery(
        new PatternQuery()
          .addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'))
          .addPattern(new TriplePattern(new QueryVariable('person'), 'age', new QueryVariable('age'))),
        'AVG'
      ).execute(kg)
    ]);
    
    console.log('Executive Summary:');
    console.log(`- Total People: ${summaryQueries[0].bindings[0].get('aggregate_result')}`);
    console.log(`- Total Projects: ${summaryQueries[1].bindings[0].get('aggregate_result')}`);
    console.log(`- Average Age: ${summaryQueries[2].bindings[0].get('aggregate_result').toFixed(1)} years`);
    
    expect(summaryQueries[0].bindings[0].get('aggregate_result')).toBe(6);
    expect(summaryQueries[1].bindings[0].get('aggregate_result')).toBe(4);
    expect(summaryQueries[2].bindings[0].get('aggregate_result')).toBeGreaterThanOrEqual(0);
  });
  
  test('Step 13.2.5: Test interactive query building scenarios', async () => {
    console.log('=== Interactive Query Building ===');
    
    // Scenario 1: Progressive query refinement
    console.log('Scenario 1: Progressive Query Refinement');
    
    // Start with broad query
    let currentQuery = new PatternQuery();
    currentQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    currentQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    let results = await currentQuery.execute(kg);
    console.log(`Initial query results: ${results.bindings.length} people`);
    expect(results.bindings.length).toBe(6);
    
    // Refine by adding location filter
    currentQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'location', 'New York'));
    results = await currentQuery.execute(kg);
    console.log(`After location filter: ${results.bindings.length} people in New York`);
    expect(results.bindings.length).toBe(2); // Alice and Charlie
    
    // Further refine by adding profession filter
    currentQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'profession', 'Engineer'));
    results = await currentQuery.execute(kg);
    console.log(`After profession filter: ${results.bindings.length} engineers in New York`);
    expect(results.bindings.length).toBe(1); // Only Alice
    
    // Scenario 2: Query composition workflow
    console.log('\nScenario 2: Query Composition Workflow');
    
    // Build component queries
    const locationQuery = new PatternQuery();
    locationQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'location', new QueryVariable('location')));
    
    const skillQuery = new PatternQuery();
    skillQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    skillQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', 'Programming'));
    
    const performanceQuery = new PatternQuery();
    const perfVar = new QueryVariable('performance');
    perfVar.addConstraint(new RangeConstraint('performance', 90, 100));
    performanceQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'performance', perfVar));
    
    // Compose into complex query
    const composedQuery = new LogicalQuery('AND');
    composedQuery.addOperand(locationQuery);
    composedQuery.addOperand(skillQuery);
    composedQuery.addOperand(performanceQuery);
    
    const composedResults = await composedQuery.execute(kg);
    console.log(`High-performing programmers: ${composedResults.bindings.length}`);
    expect(composedResults).toBeDefined();
    
    // Scenario 3: Dynamic constraint adjustment
    console.log('\nScenario 3: Dynamic Constraint Adjustment');
    
    const dynamicQuery = new PatternQuery();
    dynamicQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    dynamicQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'age', new QueryVariable('age')));
    dynamicQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    // Test different age ranges
    const ageRanges = [
      { min: 20, max: 30, label: 'Young professionals' },
      { min: 30, max: 40, label: 'Mid-career professionals' },
      { min: 40, max: 50, label: 'Senior professionals' }
    ];
    
    for (const range of ageRanges) {
      // Clear previous constraints
      const ageVar = dynamicQuery.getVariable('age');
      ageVar.constraints = [];
      
      // Add new constraint
      ageVar.addConstraint(new RangeConstraint('age', range.min, range.max));
      
      const rangeResults = await dynamicQuery.execute(kg);
      console.log(`${range.label} (${range.min}-${range.max}): ${rangeResults.bindings.length} people`);
      expect(rangeResults).toBeDefined();
    }
    
    // Scenario 4: Query template instantiation
    console.log('\nScenario 4: Query Template Instantiation');
    
    // Create parameterized query template
    const createPersonByAttributeQuery = (attribute, value) => {
      const query = new PatternQuery();
      query.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
      query.addPattern(new TriplePattern(new QueryVariable('person'), attribute, value));
      query.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
      return query;
    };
    
    // Test different instantiations
    const templates = [
      { attribute: 'profession', value: 'Engineer', label: 'Engineers' },
      { attribute: 'location', value: 'New York', label: 'New Yorkers' },
      { attribute: 'dataQuality', value: 'verified', label: 'Verified profiles' }
    ];
    
    for (const template of templates) {
      const templateQuery = createPersonByAttributeQuery(template.attribute, template.value);
      const templateResults = await templateQuery.execute(kg);
      console.log(`${template.label}: ${templateResults.bindings.length} people`);
      expect(templateResults).toBeDefined();
    }
    
    // Scenario 5: Real-time query modification
    console.log('\nScenario 5: Real-time Query Modification');
    
    // Simulate user building a query step by step
    const interactiveQuery = new PatternQuery();
    
    // Step 1: Add base pattern
    interactiveQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    let stepResults = await interactiveQuery.execute(kg);
    console.log(`Step 1 - Base query: ${stepResults.bindings.length} results`);
    
    // Step 2: Add name pattern
    interactiveQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    stepResults = await interactiveQuery.execute(kg);
    console.log(`Step 2 - With names: ${stepResults.bindings.length} results`);
    
    // Step 3: Add skill pattern
    interactiveQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    stepResults = await interactiveQuery.execute(kg);
    console.log(`Step 3 - With skills: ${stepResults.bindings.length} results`);
    
    // Step 4: Add skill details
    interactiveQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'name', new QueryVariable('skillName')));
    stepResults = await interactiveQuery.execute(kg);
    console.log(`Step 4 - With skill details: ${stepResults.bindings.length} results`);
    
    expect(stepResults.bindings.length).toBeGreaterThan(0);
    
    // Verify final query structure
    expect(interactiveQuery.patterns.length).toBe(4);
    expect(interactiveQuery.variables.size).toBe(4); // person, name, skill, skillName
    
    console.log('Interactive query building completed successfully');
  });
});
