import { z } from 'zod';

/**
 * Z3 Program JSON Schema
 * Defines the structure for Z3 theorem prover programs
 */

// Valid Z3 sorts (types)
const sortSchema = z.enum(['Int', 'Bool', 'Real']);

// Variable definition
const variableSchema = z.object({
  name: z.string().min(1),
  sort: sortSchema
});

// Valid constraint types
const constraintTypeSchema = z.enum([
  // Comparison operators
  'gt', 'lt', 'ge', 'le', 'eq', 'ne',
  // Logical operators
  'and', 'or', 'not', 'implies',
  // Arithmetic operators
  'add', 'sub', 'mul', 'div'
]);

// Constraint expression (recursive)
const constraintSchema = z.lazy(() =>
  z.object({
    type: constraintTypeSchema,
    args: z.array(z.union([
      z.string(),      // Variable name
      z.number(),      // Literal value
      z.boolean(),     // Boolean literal
      constraintSchema // Nested constraint
    ])).min(1)
  })
);

// Assertion
const assertionSchema = z.object({
  expression: constraintSchema
});

// Query
const querySchema = z.object({
  type: z.enum(['check-sat', 'get-model', 'get-proof']),
  goal: z.string().optional()
});

// Complete Z3 Program
export const z3ProgramSchema = z.object({
  variables: z.array(variableSchema),
  constraints: z.array(constraintSchema),
  assertions: z.array(assertionSchema).optional(),
  query: querySchema
});

/**
 * Validate a Z3 program
 * @param {any} program - Program to validate
 * @returns {{success: boolean, data?: object, error?: object}}
 */
export function validateZ3Program(program) {
  try {
    const result = z3ProgramSchema.safeParse(program);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        error: result.error.format()
      };
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message,
        name: error.name
      }
    };
  }
}

/**
 * Validate and parse a Z3 program (throws on error)
 * @param {any} program - Program to validate
 * @returns {object} Parsed program
 * @throws {Error} If validation fails
 */
export function parseZ3Program(program) {
  const result = validateZ3Program(program);

  if (!result.success) {
    const errorMsg = JSON.stringify(result.error, null, 2);
    throw new Error(`Invalid Z3 program: ${errorMsg}`);
  }

  return result.data;
}
