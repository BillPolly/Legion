/**
 * Z3 Expression Handling
 * Parses and validates constraint expressions
 */

/**
 * Expression types (maps to constraint types)
 */
export const ExpressionType = {
  // Comparison
  GT: 'gt',
  LT: 'lt',
  GE: 'ge',
  LE: 'le',
  EQ: 'eq',
  NE: 'ne',

  // Logical
  AND: 'and',
  OR: 'or',
  NOT: 'not',
  IMPLIES: 'implies',

  // Arithmetic
  ADD: 'add',
  SUB: 'sub',
  MUL: 'mul',
  DIV: 'div'
};

/**
 * Map expression types to operators for display/debugging
 */
const OPERATOR_MAP = {
  // Comparison
  'gt': '>',
  'lt': '<',
  'ge': '>=',
  'le': '<=',
  'eq': '==',
  'ne': '!=',

  // Logical
  'and': 'AND',
  'or': 'OR',
  'not': 'NOT',
  'implies': '=>',

  // Arithmetic
  'add': '+',
  'sub': '-',
  'mul': '*',
  'div': '/'
};

/**
 * Check if an expression type is valid
 * @param {string} type - Expression type to validate
 * @returns {boolean}
 */
export function isValidExpressionType(type) {
  if (typeof type !== 'string') {
    return false;
  }

  return Object.values(ExpressionType).includes(type);
}

/**
 * Validate expression structure
 * @param {any} expr - Expression to validate
 * @returns {boolean}
 */
export function validateExpression(expr) {
  // Must be an object
  if (!expr || typeof expr !== 'object' || Array.isArray(expr)) {
    return false;
  }

  // Must have type and args
  if (!expr.type || !expr.args) {
    return false;
  }

  // Type must be valid
  if (!isValidExpressionType(expr.type)) {
    return false;
  }

  // Args must be non-empty array
  if (!Array.isArray(expr.args) || expr.args.length === 0) {
    return false;
  }

  // Recursively validate nested expressions
  for (const arg of expr.args) {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      // It's a nested expression
      if (!validateExpression(arg)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Parse expression and add operator info
 * @param {object} expr - Expression to parse
 * @returns {object} Parsed expression with operator field
 * @throws {Error} If expression is invalid
 */
export function parseExpression(expr) {
  if (!validateExpression(expr)) {
    if (!expr || !expr.type) {
      throw new Error('Invalid expression: missing type or args');
    }
    throw new Error(`Invalid expression type: ${expr.type}`);
  }

  // Parse nested expressions recursively
  const parsedArgs = expr.args.map(arg => {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      return parseExpression(arg);
    }
    return arg;
  });

  return {
    type: expr.type,
    operator: OPERATOR_MAP[expr.type],
    args: parsedArgs
  };
}
