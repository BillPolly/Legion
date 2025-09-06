/**
 * Tests for JSONSchemaLoader with complex nested structures
 */

import { JSONSchemaLoader } from '../../../../src/schema/loaders/JSONSchemaLoader.js';
import { SchemaDefinition } from '../../../../src/schema/core/SchemaDefinition.js';
import { InMemoryTripleStore } from '../../../../src/storage/InMemoryTripleStore.js';
import { KGEngine } from '../../../../src/core/KGEngine.js';

describe('JSONSchemaLoader - Complex Nested Structures', () => {
  let kg;
  let loader;

  beforeEach(() => {
    const store = new InMemoryTripleStore();
    kg = new KGEngine(store);
    loader = new JSONSchemaLoader(kg);
  });

  describe('Complex Nested Objects', () => {
    test('should handle deeply nested object structures', async () => {
      const complexSchema = {
        type: "object",
        title: "Company",
        properties: {
          name: { type: "string" },
          headquarters: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  country: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      code: { type: "string", pattern: "^[A-Z]{2}$" },
                      continent: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          code: { type: "string" }
                        },
                        required: ["name"]
                      }
                    },
                    required: ["name", "code"]
                  }
                },
                required: ["street", "city", "country"]
              },
              coordinates: {
                type: "object",
                properties: {
                  latitude: { type: "number", minimum: -90, maximum: 90 },
                  longitude: { type: "number", minimum: -180, maximum: 180 }
                },
                required: ["latitude", "longitude"]
              }
            },
            required: ["address"]
          }
        },
        required: ["name", "headquarters"]
      };

      await loader.loadSchema(complexSchema, 'schema:Company');
      
      // Verify schema was loaded
      const schemaTriples = kg.query('schema:Company', 'rdf:type', 'kg:Schema');
      expect(schemaTriples).toHaveLength(1);

      // Verify nested properties exist
      const propertyTriples = kg.query('schema:Company', 'kg:hasProperty', null);
      expect(propertyTriples.length).toBeGreaterThan(0);

      // Test validation with valid nested object
      const schemaDef = new SchemaDefinition('schema:Company', kg);
      const validCompany = {
        name: "TechCorp",
        headquarters: {
          address: {
            street: "123 Tech Street",
            city: "San Francisco",
            country: {
              name: "United States",
              code: "US",
              continent: {
                name: "North America",
                code: "NA"
              }
            }
          },
          coordinates: {
            latitude: 37.7749,
            longitude: -122.4194
          }
        }
      };

      const result = schemaDef.validate(validCompany);
      expect(result.isValid).toBe(true);
      expect(result.conformanceScore).toBe(1.0);
    });

    test('should validate nested object constraints', async () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  settings: {
                    type: "object",
                    properties: {
                      theme: { type: "string", enum: ["light", "dark"] },
                      notifications: { type: "boolean" }
                    },
                    required: ["theme"]
                  }
                },
                required: ["settings"]
              }
            },
            required: ["profile"]
          }
        },
        required: ["user"]
      };

      await loader.loadSchema(schema, 'schema:UserConfig');
      const schemaDef = new SchemaDefinition('schema:UserConfig', kg);

      // Test invalid nested enum
      const invalidConfig = {
        user: {
          profile: {
            settings: {
              theme: "invalid-theme", // Invalid enum value
              notifications: true
            }
          }
        }
      };

      const result = schemaDef.validate(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'enum_violation')).toBe(true);
    });
  });

  describe('Complex Array Structures', () => {
    test('should handle arrays of objects with nested structures', async () => {
      const schema = {
        type: "object",
        properties: {
          employees: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer" },
                name: { type: "string" },
                department: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    manager: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        email: { type: "string", format: "email" }
                      },
                      required: ["name", "email"]
                    }
                  },
                  required: ["name", "manager"]
                },
                skills: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                      certifications: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["name", "level"]
                  },
                  minItems: 1
                }
              },
              required: ["id", "name", "department", "skills"]
            },
            minItems: 1
          }
        },
        required: ["employees"]
      };

      await loader.loadSchema(schema, 'schema:Organization');
      const schemaDef = new SchemaDefinition('schema:Organization', kg);

      const validOrg = {
        employees: [
          {
            id: 1,
            name: "John Doe",
            department: {
              name: "Engineering",
              manager: {
                name: "Jane Smith",
                email: "jane.smith@company.com"
              }
            },
            skills: [
              {
                name: "JavaScript",
                level: "advanced",
                certifications: ["AWS Certified", "React Expert"]
              },
              {
                name: "Python",
                level: "intermediate",
                certifications: []
              }
            ]
          },
          {
            id: 2,
            name: "Alice Johnson",
            department: {
              name: "Design",
              manager: {
                name: "Bob Wilson",
                email: "bob.wilson@company.com"
              }
            },
            skills: [
              {
                name: "UI/UX Design",
                level: "advanced",
                certifications: ["Adobe Certified"]
              }
            ]
          }
        ]
      };

      const result = schemaDef.validate(validOrg);
      expect(result.isValid).toBe(true);
      expect(result.conformanceScore).toBe(1.0);
    });

    test('should handle nested arrays with constraints', async () => {
      const schema = {
        type: "object",
        properties: {
          matrix: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: "array",
                items: { type: "number" },
                minItems: 3,
                maxItems: 3
              },
              minItems: 3,
              maxItems: 3
            },
            minItems: 3,
            maxItems: 3
          },
          tags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                values: {
                  type: "array",
                  items: { type: "string" },
                  uniqueItems: true
                }
              },
              required: ["category", "values"]
            }
          }
        },
        required: ["matrix"]
      };

      await loader.loadSchema(schema, 'schema:ComplexArrays');
      const schemaDef = new SchemaDefinition('schema:ComplexArrays', kg);

      // Valid 3D matrix
      const validData = {
        matrix: [
          [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          [[10, 11, 12], [13, 14, 15], [16, 17, 18]],
          [[19, 20, 21], [22, 23, 24], [25, 26, 27]]
        ],
        tags: [
          {
            category: "colors",
            values: ["red", "green", "blue"]
          },
          {
            category: "sizes",
            values: ["small", "medium", "large"]
          }
        ]
      };

      const validResult = schemaDef.validate(validData);
      expect(validResult.isValid).toBe(true);

      // Invalid matrix (wrong dimensions)
      const invalidData = {
        matrix: [
          [[1, 2], [4, 5, 6]], // First sub-array too short
          [[10, 11, 12], [13, 14, 15], [16, 17, 18]],
          [[19, 20, 21], [22, 23, 24], [25, 26, 27]]
        ]
      };

      const invalidResult = schemaDef.validate(invalidData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.some(e => e.type === 'min_items_violation')).toBe(true);
    });
  });

  describe('Mixed Complex Structures', () => {
    test('should handle objects with arrays containing objects with arrays', async () => {
      const schema = {
        type: "object",
        properties: {
          project: {
            type: "object",
            properties: {
              name: { type: "string" },
              phases: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          assignees: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string" },
                                role: { type: "string" },
                                workload: {
                                  type: "object",
                                  properties: {
                                    hours: { type: "number", minimum: 0 },
                                    days: {
                                      type: "array",
                                      items: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday"] }
                                    }
                                  },
                                  required: ["hours", "days"]
                                }
                              },
                              required: ["name", "role", "workload"]
                            }
                          },
                          dependencies: {
                            type: "array",
                            items: { type: "string" }
                          }
                        },
                        required: ["title", "assignees"]
                      }
                    }
                  },
                  required: ["name", "tasks"]
                }
              }
            },
            required: ["name", "phases"]
          }
        },
        required: ["project"]
      };

      await loader.loadSchema(schema, 'schema:ProjectManagement');
      const schemaDef = new SchemaDefinition('schema:ProjectManagement', kg);

      const complexProject = {
        project: {
          name: "Website Redesign",
          phases: [
            {
              name: "Planning",
              tasks: [
                {
                  title: "Requirements Gathering",
                  assignees: [
                    {
                      name: "Alice",
                      role: "Product Manager",
                      workload: {
                        hours: 20,
                        days: ["monday", "tuesday", "wednesday"]
                      }
                    },
                    {
                      name: "Bob",
                      role: "Business Analyst",
                      workload: {
                        hours: 15,
                        days: ["tuesday", "thursday"]
                      }
                    }
                  ],
                  dependencies: []
                }
              ]
            },
            {
              name: "Development",
              tasks: [
                {
                  title: "Frontend Development",
                  assignees: [
                    {
                      name: "Charlie",
                      role: "Frontend Developer",
                      workload: {
                        hours: 40,
                        days: ["monday", "tuesday", "wednesday", "thursday", "friday"]
                      }
                    }
                  ],
                  dependencies: ["Requirements Gathering"]
                }
              ]
            }
          ]
        }
      };

      const result = schemaDef.validate(complexProject);
      expect(result.isValid).toBe(true);
      expect(result.conformanceScore).toBe(1.0);
    });

    test('should validate complex constraint violations in nested structures', async () => {
      const schema = {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              records: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    metadata: {
                      type: "object",
                      properties: {
                        tags: {
                          type: "array",
                          items: { type: "string" },
                          uniqueItems: true,
                          minItems: 1
                        },
                        score: { type: "number", minimum: 0, maximum: 100 }
                      },
                      required: ["tags", "score"]
                    }
                  },
                  required: ["metadata"]
                },
                minItems: 1
              }
            },
            required: ["records"]
          }
        },
        required: ["data"]
      };

      await loader.loadSchema(schema, 'schema:DataValidation');
      const schemaDef = new SchemaDefinition('schema:DataValidation', kg);

      // Test multiple constraint violations
      const invalidData = {
        data: {
          records: [
            {
              metadata: {
                tags: ["tag1", "tag1"], // Duplicate items
                score: 150 // Exceeds maximum
              }
            },
            {
              metadata: {
                tags: [], // Below minimum items
                score: -10 // Below minimum
              }
            }
          ]
        }
      };

      const result = schemaDef.validate(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check for specific error types
      const errorTypes = result.errors.map(e => e.type);
      expect(errorTypes).toContain('unique_items_violation');
      expect(errorTypes).toContain('maximum_violation');
      expect(errorTypes).toContain('min_items_violation');
      expect(errorTypes).toContain('minimum_violation');
    });
  });

  describe('Schema Composition with Complex Structures', () => {
    test('should handle allOf with nested objects', async () => {
      const schema = {
        type: "object",
        allOf: [
          {
            type: "object",
            properties: {
              basic: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" }
                },
                required: ["id"]
              }
            },
            required: ["basic"]
          },
          {
            type: "object",
            properties: {
              extended: {
                type: "object",
                properties: {
                  details: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        value: { type: "string" }
                      },
                      required: ["key", "value"]
                    }
                  }
                },
                required: ["details"]
              }
            },
            required: ["extended"]
          }
        ]
      };

      await loader.loadSchema(schema, 'schema:ComposedComplex');
      
      // Verify composition was loaded
      const allOfTriples = kg.query('schema:ComposedComplex', 'kg:allOf', null);
      expect(allOfTriples.length).toBe(2);
    });

    test('should handle oneOf with different array structures', async () => {
      const schema = {
        type: "object",
        properties: {
          data: {
            oneOf: [
              {
                type: "array",
                items: { type: "string" }
              },
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    value: { type: "string" }
                  },
                  required: ["id", "value"]
                }
              }
            ]
          }
        },
        required: ["data"]
      };

      await loader.loadSchema(schema, 'schema:OneOfArrays');
      
      // Verify oneOf was loaded - check the property level since oneOf is on the data property
      const dataPropertyTriples = kg.query('schema:OneOfArrays', 'kg:hasProperty', null);
      expect(dataPropertyTriples.length).toBeGreaterThan(0);
      
      const dataPropertyId = dataPropertyTriples.find(([,, propId]) => {
        const nameTriple = kg.query(propId, 'kg:propertyName', null)[0];
        return nameTriple && nameTriple[2] === 'data';
      })?.[2];
      
      expect(dataPropertyId).toBeDefined();
      
      // Check if oneOf triples exist for the data property
      const oneOfTriples = kg.query(dataPropertyId, 'kg:oneOf', null);
      expect(oneOfTriples.length).toBeGreaterThan(0);
    });
  });

  describe('Performance with Complex Structures', () => {
    test('should handle large nested structures efficiently', async () => {
      // Create a schema with deep nesting and many properties
      const createDeepSchema = (depth, breadth) => {
        if (depth === 0) {
          return { type: "string" };
        }
        
        const properties = {};
        for (let i = 0; i < breadth; i++) {
          properties[`prop${i}`] = createDeepSchema(depth - 1, breadth);
        }
        
        return {
          type: "object",
          properties,
          required: Object.keys(properties).slice(0, Math.floor(breadth / 2))
        };
      };

      const complexSchema = createDeepSchema(5, 3); // 5 levels deep, 3 properties per level
      
      const startTime = Date.now();
      await loader.loadSchema(complexSchema, 'schema:DeepNested');
      const loadTime = Date.now() - startTime;
      
      // Should load in reasonable time (less than 1 second)
      expect(loadTime).toBeLessThan(1000);
      
      // Verify it was loaded correctly
      const schemaTriples = kg.query('schema:DeepNested', 'rdf:type', 'kg:Schema');
      expect(schemaTriples).toHaveLength(1);
    });
  });

  describe('Error Handling with Complex Structures', () => {
    test('should provide detailed error paths for nested validation failures', async () => {
      const schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  level3: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        value: { type: "number", minimum: 0 }
                      },
                      required: ["value"]
                    }
                  }
                },
                required: ["level3"]
              }
            },
            required: ["level2"]
          }
        },
        required: ["level1"]
      };

      await loader.loadSchema(schema, 'schema:ErrorPaths');
      const schemaDef = new SchemaDefinition('schema:ErrorPaths', kg);

      const invalidData = {
        level1: {
          level2: {
            level3: [
              { value: 5 }, // Valid
              { value: -1 }, // Invalid - negative number
              { /* missing value */ } // Invalid - missing required property
            ]
          }
        }
      };

      const result = schemaDef.validate(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that error paths are detailed
      const errorPaths = result.errors.map(e => e.path);
      expect(errorPaths.some(path => path.includes('level3'))).toBe(true);
    });
  });
});
