/**
 * Z3 Type System (Sorts)
 * Defines valid Z3 sorts and type utilities
 */

/**
 * Valid Z3 Sorts
 */
export const Sorts = {
  Int: 'Int',
  Bool: 'Bool',
  Real: 'Real'
};

/**
 * Check if a sort name is valid
 * @param {string} sort - Sort name to validate
 * @returns {boolean}
 */
export function isValidSort(sort) {
  if (typeof sort !== 'string') {
    return false;
  }

  return Object.values(Sorts).includes(sort);
}

/**
 * Infer sort from JavaScript value
 * @param {any} value - Value to infer sort from
 * @returns {string|null} Sort name or null if cannot infer
 */
export function getSortType(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean') {
    return Sorts.Bool;
  }

  if (typeof value === 'number') {
    // Check if it's an integer
    if (Number.isInteger(value)) {
      return Sorts.Int;
    }
    // It's a float/decimal
    return Sorts.Real;
  }

  // Unknown type
  return null;
}
