/**
 * @typedef {Object} AgentMessage
 * @property {"string" | "json"} type - Message type
 * @property {string | Record<string, any>} message - Message content
 */

/**
 * @typedef {Object} UseTool
 * @property {string} identifier - Tool identifier
 * @property {string} function_name - Function name to call
 * @property {string[]} args - Function arguments
 */

/**
 * @typedef {Object} AgentResponse
 * @property {boolean} task_completed - Whether the task is completed
 * @property {AgentMessage} [response] - Optional response message
 * @property {UseTool} [use_tool] - Optional tool usage details
 */

// This file exports type definitions as JSDoc comments
// No actual code is exported since these are just type definitions
module.exports = {};