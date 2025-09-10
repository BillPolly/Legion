import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';
import { QueryEngine } from '../../src/QueryEngine.js';

describe('KGEntityProxy Computed Properties Integration', () => {
  let core;
  let identityManager;
  let store;
  let queryEngine;

  beforeEach(() => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/email': { unique: 'identity' },
      ':person/employer': { card: 'one', valueType: 'ref' },
      ':person/friends': { card: 'many', valueType: 'ref' },
      ':company/name': { card: 'one' },
      ':company/employees': { card: 'many', valueType: 'ref' }
    };

    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    queryEngine = new QueryEngine(core, store, identityManager);
  });

  afterEach(() => {
    core = null;
    identityManager = null;
    store = null;
    queryEngine = null;
  });

  describe('Computed Properties with Live Store', () => {
    test('should work with computed properties that query the live store', () => {
      const manager = {
        type: 'person',
        name: 'Alice Manager',
        role: 'manager'
      };

      const employees = [
        { type: 'person', name: 'Bob Developer', role: 'developer', manager: manager },
        { type: 'person', name: 'Carol Designer', role: 'designer', manager: manager },
        { type: 'person', name: 'Dave Tester', role: 'tester', manager: manager }
      ];

      store.add(manager);
      store.addBatch(employees);

      const managerProxy = new KGEntityProxy(manager, store, identityManager);

      // Computed property that queries the store
      managerProxy.defineComputed('directReports', function() {
        const allPeople = store.queryObjects({ type: 'person' });
        return allPeople.filter(person => person.manager === this._target).length;
      });

      managerProxy.defineComputed('teamSummary', function() {
        const allPeople = store.queryObjects({ type: 'person' });
        const reports = allPeople.filter(person => person.manager === this._target);
        const roles = reports.map(person => person.role);
        return `${this.name} manages ${reports.length} people: ${roles.join(', ')}`;
      });

      expect(managerProxy.directReports).toBe(3);
      expect(managerProxy.teamSummary).toBe('Alice Manager manages 3 people: developer, designer, tester');

      // Add new employee
      const newEmployee = { type: 'person', name: 'Eve QA', role: 'qa', manager: manager };
      store.add(newEmployee);

      // Computed properties should update automatically
      expect(managerProxy.directReports).toBe(4);
      expect(managerProxy.teamSummary).toBe('Alice Manager manages 4 people: developer, designer, tester, qa');
    });

    test('should handle computed properties with object relationships', () => {
      const techCorp = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010,
        headquarters: 'San Francisco'
      };

      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        role: 'Senior Developer',
        salary: 120000,
        employer: techCorp
      };

      store.add(techCorp);
      store.add(alice);

      const aliceProxy = new KGEntityProxy(alice, store, identityManager);

      aliceProxy.defineComputed('workInfo', function() {
        return {
          employee: this.name,
          position: this.role,
          company: this.employer.name,
          location: this.employer.headquarters,
          companyAge: new Date().getFullYear() - this.employer.founded
        };
      });

      aliceProxy.defineComputed('isHighEarner', function() {
        return this.salary >= 100000;
      });

      const workInfo = aliceProxy.workInfo;
      expect(workInfo.employee).toBe('Alice Johnson');
      expect(workInfo.company).toBe('TechCorp');
      expect(workInfo.companyAge).toBe(2025 - 2010);
      expect(aliceProxy.isHighEarner).toBe(true);

      // Change company name
      techCorp.name = 'TechCorp Industries';
      store.update(techCorp);

      // Computed property should reflect the change
      const updatedWorkInfo = aliceProxy.workInfo;
      expect(updatedWorkInfo.company).toBe('TechCorp Industries');
      expect(updatedWorkInfo).not.toBe(workInfo); // New object due to dependency change
    });

    test('should support computed properties in query results', () => {
      const people = [
        { type: 'person', name: 'Alice', salary: 80000, department: 'Engineering' },
        { type: 'person', name: 'Bob', salary: 75000, department: 'Engineering' },
        { type: 'person', name: 'Carol', salary: 65000, department: 'Sales' },
        { type: 'person', name: 'Dave', salary: 90000, department: 'Engineering' }
      ];

      store.addBatch(people);

      // Create proxies for each person and add computed properties
      const proxies = people.map(person => {
        const proxy = new KGEntityProxy(person, store, identityManager);
        
        proxy.defineComputed('salaryTier', function() {
          if (this.salary >= 80000) return 'senior';
          if (this.salary >= 70000) return 'mid';
          return 'junior';
        });

        proxy.defineComputed('isEngineering', function() {
          return this.department === 'Engineering';
        });

        return proxy;
      });

      // Query for engineering people and check computed properties
      const engineeringPeople = proxies.filter(proxy => proxy.isEngineering);
      expect(engineeringPeople.length).toBe(3);

      const seniorEngineers = engineeringPeople.filter(proxy => proxy.salaryTier === 'senior');
      expect(seniorEngineers.length).toBe(2);
      expect(seniorEngineers.map(p => p.name).sort()).toEqual(['Alice', 'Dave']);
    });

    test('should handle computed properties with notifications and store updates', () => {
      const salesRep = {
        type: 'person',
        name: 'Alice Sales',
        baseSalary: 50000,
        commissionRate: 0.1,
        salesThisMonth: 80000
      };

      store.add(salesRep);
      const proxy = new KGEntityProxy(salesRep, store, identityManager);

      proxy.defineComputed('totalCompensation', function() {
        return this.baseSalary + (this.salesThisMonth * this.commissionRate);
      });

      proxy.defineComputed('performanceRating', function() {
        const totalComp = this.totalCompensation;
        if (totalComp >= 70000) return 'Excellent';
        if (totalComp >= 60000) return 'Good';
        if (totalComp >= 50000) return 'Satisfactory';
        return 'Needs Improvement';
      });

      expect(proxy.totalCompensation).toBe(58000);
      expect(proxy.performanceRating).toBe('Satisfactory');

      const computedChanges = [];
      proxy.onPropertyChange('totalCompensation', (change) => {
        computedChanges.push(change);
      });

      const performanceChanges = [];
      proxy.onPropertyChange('performanceRating', (change) => {
        performanceChanges.push(change);
      });

      // Increase sales - should trigger both computed property updates
      proxy.salesThisMonth = 120000;

      expect(computedChanges.length).toBe(1);
      expect(computedChanges[0].newValue).toBe(62000);

      expect(performanceChanges.length).toBe(1);
      expect(performanceChanges[0].newValue).toBe('Good');

      // Increase sales more - should trigger performance rating change
      proxy.salesThisMonth = 200000;

      expect(computedChanges.length).toBe(2);
      expect(computedChanges[1].newValue).toBe(70000);

      expect(performanceChanges.length).toBe(2);
      expect(performanceChanges[1].newValue).toBe('Excellent');
    });

    test('should handle complex computed property dependencies across multiple objects', () => {
      const project = {
        type: 'project',
        name: 'Web Redesign',
        budget: 100000,
        startDate: '2025-01-01',
        status: 'active'
      };

      const team = [
        { type: 'person', name: 'Alice PM', role: 'project-manager', hourlyRate: 80, project: project },
        { type: 'person', name: 'Bob Dev', role: 'developer', hourlyRate: 65, project: project },
        { type: 'person', name: 'Carol Designer', role: 'designer', hourlyRate: 60, project: project },
        { type: 'person', name: 'Dave QA', role: 'qa', hourlyRate: 55, project: project }
      ];

      store.add(project);
      store.addBatch(team);

      const projectProxy = new KGEntityProxy(project, store, identityManager);

      // Computed property that aggregates team data
      projectProxy.defineComputed('teamCost', function() {
        const teamMembers = store.queryObjects({ type: 'person' })
          .filter(person => person.project === this._target);
        return teamMembers.reduce((total, member) => total + member.hourlyRate, 0);
      });

      projectProxy.defineComputed('budgetUtilization', function() {
        const estimatedHours = 400; // 10 weeks * 40 hours
        const totalCost = this.teamCost * estimatedHours;
        return {
          totalCost,
          remaining: this.budget - totalCost,
          utilizationPercent: Math.round((totalCost / this.budget) * 100)
        };
      });

      expect(projectProxy.teamCost).toBe(260); // 80+65+60+55
      
      const utilization = projectProxy.budgetUtilization;
      expect(utilization.totalCost).toBe(104000); // 260 * 400
      expect(utilization.remaining).toBe(-4000); // Over budget
      expect(utilization.utilizationPercent).toBe(104);

      // Add team member - computed properties should update
      const newMember = { type: 'person', name: 'Eve Intern', role: 'intern', hourlyRate: 25, project: project };
      store.add(newMember);

      expect(projectProxy.teamCost).toBe(285);
      const newUtilization = projectProxy.budgetUtilization;
      expect(newUtilization.totalCost).toBe(114000);
      expect(newUtilization.utilizationPercent).toBe(114);
    });
  });

  describe('Performance with Computed Properties', () => {
    test('should handle many computed properties efficiently', () => {
      const data = {
        type: 'dataset',
        numbers: Array.from({ length: 100 }, (_, i) => i + 1)
      };

      store.add(data);
      const proxy = new KGEntityProxy(data, store, identityManager);

      // Define many computed properties
      proxy.defineComputed('sum', function() {
        return this.numbers.reduce((a, b) => a + b, 0);
      });

      proxy.defineComputed('average', function() {
        return this.sum / this.numbers.length;
      });

      proxy.defineComputed('variance', function() {
        const avg = this.average;
        const squaredDiffs = this.numbers.map(n => Math.pow(n - avg, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / this.numbers.length;
      });

      proxy.defineComputed('standardDeviation', function() {
        return Math.sqrt(this.variance);
      });

      proxy.defineComputed('min', function() {
        return Math.min(...this.numbers);
      });

      proxy.defineComputed('max', function() {
        return Math.max(...this.numbers);
      });

      proxy.defineComputed('range', function() {
        return this.max - this.min;
      });

      const startTime = Date.now();

      // Access all computed properties
      const results = {
        sum: proxy.sum,
        average: proxy.average,
        variance: proxy.variance,
        standardDeviation: proxy.standardDeviation,
        min: proxy.min,
        max: proxy.max,
        range: proxy.range
      };

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.sum).toBe(5050); // 1+2+...+100
      expect(results.average).toBe(50.5);
      expect(results.min).toBe(1);
      expect(results.max).toBe(100);
      expect(results.range).toBe(99);

      // Should complete computations within reasonable time
      expect(duration).toBeLessThan(100); // 100ms threshold

      // Accessing again should be faster due to caching
      const startTime2 = Date.now();
      
      const results2 = {
        sum: proxy.sum,
        average: proxy.average,
        variance: proxy.variance,
        standardDeviation: proxy.standardDeviation,
        min: proxy.min,
        max: proxy.max,
        range: proxy.range
      };

      const endTime2 = Date.now();
      const duration2 = endTime2 - startTime2;

      expect(duration2).toBeLessThan(10); // Should be much faster with caching
      expect(results2.sum).toBe(results.sum);
    });

    test('should handle computed property updates without performance degradation', () => {
      const counter = {
        type: 'counter',
        value: 0
      };

      store.add(counter);
      const proxy = new KGEntityProxy(counter, store, identityManager);

      proxy.defineComputed('squared', function() {
        return this.value * this.value;
      });

      proxy.defineComputed('cubed', function() {
        return this.value * this.value * this.value;
      });

      const startTime = Date.now();

      // Make many updates
      for (let i = 1; i <= 1000; i++) {
        proxy.value = i;
        // Access computed properties to ensure they recalculate
        const squared = proxy.squared;
        const cubed = proxy.cubed;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(proxy.value).toBe(1000);
      expect(proxy.squared).toBe(1000000);
      expect(proxy.cubed).toBe(1000000000);

      // Should handle 1000 updates in reasonable time
      expect(duration).toBeLessThan(500); // 500ms threshold
    });
  });

  describe('Computed Properties with Store Persistence', () => {
    test('should handle computed properties after store operations', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      proxy.defineComputed('canVote', function() {
        return this.age >= 18;
      });

      expect(proxy.fullName).toBe('Alice Johnson');
      expect(proxy.canVote).toBe(true);

      // Update through store
      person.firstName = 'Alice Marie';
      store.update(person);

      // Computed properties should still work
      expect(proxy.fullName).toBe('Alice Marie Johnson');
      expect(proxy.canVote).toBe(true);

      // Remove and re-add to store
      store.remove(person);
      expect(store.has(person)).toBe(false);

      store.add(person);
      const newProxy = new KGEntityProxy(person, store, identityManager);

      // Need to redefine computed properties on new proxy
      newProxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      expect(newProxy.fullName).toBe('Alice Marie Johnson');
    });
  });
});