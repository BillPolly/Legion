import { WorksWithRelationship } from '../../../src/relationships/WorksWithRelationship.js';
import '../../../src/serialization/ObjectExtensions.js'; // Enable getId() method

describe('WorksWithRelationship', () => {
  let person1, person2, relationship;

  beforeEach(() => {
    // Create test objects
    person1 = { name: 'John', age: 30 };
    person2 = { name: 'Jane', age: 28 };
    
    // Create basic works with relationship
    relationship = new WorksWithRelationship(person1, person2);
  });

  describe('Multiple Inheritance Chain', () => {
    test('should inherit from KnowsRelationship', () => {
      expect(relationship.from).toBe(person1);
      expect(relationship.to).toBe(person2);
      expect(relationship.type).toBe('knows');
    });

    test('should automatically set context to work', () => {
      expect(relationship.context).toBe('work');
    });

    test('should inherit KnowsRelationship properties', () => {
      const data = {
        howMet: 'office',
        closeness: 'colleague'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      
      expect(rel.howMet).toBe('office');
      expect(rel.closeness).toBe('colleague');
    });

    test('should inherit base Relationship properties', () => {
      const data = {
        started: '2020-01-15',
        confidence: 0.9,
        source: 'hr_system'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      
      expect(rel.started).toBe('2020-01-15');
      expect(rel.confidence).toBe(0.9);
      expect(rel.source).toBe('hr_system');
    });
  });

  describe('Context Override Behavior', () => {
    test('should override context to work even if provided', () => {
      const data = {
        context: 'personal' // This should be overridden
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      
      expect(rel.context).toBe('work');
    });

    test('should maintain work context with other properties', () => {
      const data = {
        context: 'social',
        department: 'Engineering',
        role: 'Developer'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      
      expect(rel.context).toBe('work');
      expect(rel.department).toBe('Engineering');
      expect(rel.role).toBe('Developer');
    });
  });

  describe('WorksWithRelationship Specific Properties', () => {
    test('should create relationship without specific properties', () => {
      expect(relationship.department).toBeUndefined();
      expect(relationship.role).toBeUndefined();
    });

    test('should create relationship with department property', () => {
      const rel = new WorksWithRelationship(person1, person2, { department: 'Engineering' });
      expect(rel.department).toBe('Engineering');
    });

    test('should create relationship with role property', () => {
      const rel = new WorksWithRelationship(person1, person2, { role: 'Manager' });
      expect(rel.role).toBe('Manager');
    });

    test('should create relationship with both work-specific properties', () => {
      const data = {
        department: 'Marketing',
        role: 'Director'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      
      expect(rel.department).toBe('Marketing');
      expect(rel.role).toBe('Director');
    });

    test('should handle all property types together', () => {
      const data = {
        started: '2019-06-01',
        confidence: 0.95,
        source: 'employee_directory',
        howMet: 'orientation',
        closeness: 'colleague',
        department: 'Sales',
        role: 'Account_Manager'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      
      // Base properties
      expect(rel.started).toBe('2019-06-01');
      expect(rel.confidence).toBe(0.95);
      expect(rel.source).toBe('employee_directory');
      expect(rel.context).toBe('work'); // Always work
      
      // KnowsRelationship properties
      expect(rel.howMet).toBe('orientation');
      expect(rel.closeness).toBe('colleague');
      
      // WorksWithRelationship properties
      expect(rel.department).toBe('Sales');
      expect(rel.role).toBe('Account_Manager');
    });
  });

  describe('Triple Generation', () => {
    test('should generate all inherited relationship triples', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      // Should include base relationship triples
      expect(triples).toContainEqual([person1.getId(), relationshipId, person2.getId()]);
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'WorksWithRelationship']);
      expect(triples).toContainEqual([relationshipId, 'kg:from', person1.getId()]);
      expect(triples).toContainEqual([relationshipId, 'kg:to', person2.getId()]);
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', 'knows']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
    });

    test('should include work-specific properties in triples when provided', () => {
      const data = {
        department: 'HR',
        role: 'Recruiter'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:department', 'HR']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', 'Recruiter']);
    });

    test('should not include undefined work-specific properties in triples', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      // Should not contain triples for undefined properties
      const hasDepartment = triples.some(t => t[0] === relationshipId && t[1] === 'kg:department');
      const hasRole = triples.some(t => t[0] === relationshipId && t[1] === 'kg:role');
      
      expect(hasDepartment).toBe(false);
      expect(hasRole).toBe(false);
    });

    test('should include all properties when fully specified', () => {
      const data = {
        started: '2020-03-01',
        finished: '2023-08-31',
        confidence: 0.9,
        source: 'hr_database',
        howMet: 'team_meeting',
        closeness: 'close_colleague',
        department: 'Product',
        role: 'Product_Manager'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Base properties
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-03-01']);
      expect(triples).toContainEqual([relationshipId, 'kg:finished', '2023-08-31']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.9]);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
      expect(triples).toContainEqual([relationshipId, 'kg:source', 'hr_database']);
      
      // KnowsRelationship properties
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'team_meeting']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'close_colleague']);
      
      // WorksWithRelationship properties
      expect(triples).toContainEqual([relationshipId, 'kg:department', 'Product']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', 'Product_Manager']);
    });

    test('should handle empty string values for work-specific properties', () => {
      const data = {
        department: '',
        role: ''
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Empty strings should be included as valid values
      expect(triples).toContainEqual([relationshipId, 'kg:department', '']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', '']);
    });

    test('should handle null values for work-specific properties', () => {
      const data = {
        department: null,
        role: null
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      // Null values should not be included
      const hasDepartment = triples.some(t => t[0] === relationshipId && t[1] === 'kg:department');
      const hasRole = triples.some(t => t[0] === relationshipId && t[1] === 'kg:role');
      
      expect(hasDepartment).toBe(false);
      expect(hasRole).toBe(false);
    });
  });

  describe('Common Department Values', () => {
    test('should handle various department names', () => {
      const departments = [
        'Engineering',
        'Marketing',
        'Sales',
        'HR',
        'Finance',
        'Operations',
        'Product',
        'Design',
        'Legal',
        'Customer_Support'
      ];
      
      departments.forEach(department => {
        const rel = new WorksWithRelationship(person1, person2, { department });
        const triples = rel.toTriples();
        const relationshipId = rel.getId();
        
        expect(triples).toContainEqual([relationshipId, 'kg:department', department]);
      });
    });
  });

  describe('Common Role Values', () => {
    test('should handle various role types', () => {
      const roles = [
        'Manager',
        'Director',
        'VP',
        'Developer',
        'Designer',
        'Analyst',
        'Coordinator',
        'Specialist',
        'Lead',
        'Senior_Engineer'
      ];
      
      roles.forEach(role => {
        const rel = new WorksWithRelationship(person1, person2, { role });
        const triples = rel.toTriples();
        const relationshipId = rel.getId();
        
        expect(triples).toContainEqual([relationshipId, 'kg:role', role]);
      });
    });
  });

  describe('Real-world Work Scenarios', () => {
    test('should handle same department colleagues', () => {
      const data = {
        started: '2021-01-15',
        howMet: 'team_meeting',
        closeness: 'colleague',
        department: 'Engineering',
        role: 'Software_Engineer',
        confidence: 0.95
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2021-01-15']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'team_meeting']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'colleague']);
      expect(triples).toContainEqual([relationshipId, 'kg:department', 'Engineering']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', 'Software_Engineer']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.95]);
    });

    test('should handle cross-department collaboration', () => {
      const data = {
        started: '2020-06-01',
        howMet: 'project_kickoff',
        closeness: 'collaborator',
        department: 'Marketing',
        role: 'Product_Marketing_Manager',
        confidence: 0.8,
        source: 'project_management_tool'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2020-06-01']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'project_kickoff']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'collaborator']);
      expect(triples).toContainEqual([relationshipId, 'kg:department', 'Marketing']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', 'Product_Marketing_Manager']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 0.8]);
      expect(triples).toContainEqual([relationshipId, 'kg:source', 'project_management_tool']);
    });

    test('should handle manager-report relationship', () => {
      const data = {
        started: '2019-03-01',
        howMet: 'hiring_process',
        closeness: 'manager',
        department: 'Sales',
        role: 'Sales_Director',
        confidence: 1.0,
        source: 'org_chart'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:started', '2019-03-01']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
      expect(triples).toContainEqual([relationshipId, 'kg:howMet', 'hiring_process']);
      expect(triples).toContainEqual([relationshipId, 'kg:closeness', 'manager']);
      expect(triples).toContainEqual([relationshipId, 'kg:department', 'Sales']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', 'Sales_Director']);
      expect(triples).toContainEqual([relationshipId, 'kg:confidence', 1.0]);
      expect(triples).toContainEqual([relationshipId, 'kg:source', 'org_chart']);
    });
  });

  describe('Edge Cases', () => {
    test('should handle special characters in department and role', () => {
      const data = {
        department: 'R&D',
        role: 'Sr. Software Engineer'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:department', 'R&D']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', 'Sr. Software Engineer']);
    });

    test('should handle very long department and role names', () => {
      const longDepartment = 'Very Long Department Name That Goes On And On'.repeat(5);
      const longRole = 'Senior Principal Staff Software Engineering Manager'.repeat(3);
      
      const data = {
        department: longDepartment,
        role: longRole
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      
      expect(() => {
        const triples = rel.toTriples();
        expect(triples.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    test('should handle numeric-like strings in work properties', () => {
      const data = {
        department: '2023',
        role: '001'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:department', '2023']);
      expect(triples).toContainEqual([relationshipId, 'kg:role', '001']);
    });
  });

  describe('Type Information', () => {
    test('should have correct class name in type triple', () => {
      const triples = relationship.toTriples();
      const relationshipId = relationship.getId();
      
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'WorksWithRelationship']);
    });

    test('should maintain knows type and work context', () => {
      const data = {
        department: 'Finance',
        role: 'Analyst'
      };
      
      const rel = new WorksWithRelationship(person1, person2, data);
      const triples = rel.toTriples();
      const relationshipId = rel.getId();
      
      expect(triples).toContainEqual([relationshipId, 'kg:relationType', 'knows']);
      expect(triples).toContainEqual([relationshipId, 'kg:context', 'work']);
      expect(triples).toContainEqual([relationshipId, 'rdf:type', 'WorksWithRelationship']);
    });
  });

  describe('Performance', () => {
    test('should handle triple generation efficiently', () => {
      const startTime = performance.now();
      
      // Generate triples for 100 work relationships
      for (let i = 0; i < 100; i++) {
        const rel = new WorksWithRelationship(person1, person2, {
          department: `dept_${i}`,
          role: `role_${i}`,
          howMet: `method_${i}`,
          closeness: `level_${i}`,
          started: `2020-01-${i + 1}`,
          confidence: i / 100
        });
        rel.toTriples();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
