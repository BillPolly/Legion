// Type definitions exported as documentation comments and runtime validation helpers

/**
 * @typedef {Object} ToolFunctionArg
 * @property {string} name
 * @property {string} description
 * @property {string} dataType
 */

/**
 * @typedef {Object} ToolFunctionSpec
 * @property {string} name
 * @property {string} purpose
 * @property {ToolFunctionArg[]} arguments
 * @property {string} response
 */

// Runtime validation helpers
function validateToolFunctionArg(arg) {
    if (!arg || typeof arg !== 'object') {
        throw new Error('ToolFunctionArg must be an object');
    }
    if (typeof arg.name !== 'string') {
        throw new Error('ToolFunctionArg.name must be a string');
    }
    if (typeof arg.description !== 'string') {
        throw new Error('ToolFunctionArg.description must be a string');
    }
    if (typeof arg.dataType !== 'string') {
        throw new Error('ToolFunctionArg.dataType must be a string');
    }
    return true;
}

function validateToolFunctionSpec(spec) {
    if (!spec || typeof spec !== 'object') {
        throw new Error('ToolFunctionSpec must be an object');
    }
    if (typeof spec.name !== 'string') {
        throw new Error('ToolFunctionSpec.name must be a string');
    }
    if (typeof spec.purpose !== 'string') {
        throw new Error('ToolFunctionSpec.purpose must be a string');
    }
    if (!Array.isArray(spec.arguments)) {
        throw new Error('ToolFunctionSpec.arguments must be an array');
    }
    spec.arguments.forEach(arg => validateToolFunctionArg(arg));
    if (typeof spec.response !== 'string') {
        throw new Error('ToolFunctionSpec.response must be a string');
    }
    return true;
}

module.exports = {
    validateToolFunctionArg,
    validateToolFunctionSpec
};