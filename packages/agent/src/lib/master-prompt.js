/**
 * Get current time in specified timezone
 * @param {string} [timeZone] - Timezone, defaults to system timezone
 * @returns {string} Formatted date/time string
 */
function getCurrentTimeInTimeZone(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true, // For AM/PM format
  }).format(new Date());
}

/**
 * Serialize tools array into formatted string
 * @param {Array} tools - Array of tool objects
 * @returns {string} Serialized tools string
 */
function serializeTools(tools = []) {
  let serializedToolList = ``;

  for (const tool of tools) {
    serializedToolList += "\n<tool>";
    serializedToolList += `\n### ` + tool.name + `\n`;
    serializedToolList += `- name: ` + tool.name;
    serializedToolList += `\n- identifier: ` + tool.identifier;
    serializedToolList += `\n- abilities: ` + tool.abilities.join(",");
    serializedToolList += "\n";
    serializedToolList += "\n#### Tool instructions \n" + tool.instructions.join(",");
    serializedToolList += "\n#### Available functions: \n";
    serializedToolList += serializeFunctions(tool.functions);
    serializedToolList += `\n`;
    serializedToolList += "</tool>\n";
  }

  return serializedToolList;
}

/**
 * Serialize functions array
 * @param {Array} functions - Array of function specifications
 * @returns {string} JSON stringified functions
 */
function serializeFunctions(functions = []) {
  return JSON.stringify(functions);
  
  // The following code is commented out in the original
  /*
  let serializedFunctionList = ``;

  for (const funct of functions) {
    serializedFunctionList += `\n##### ` + funct.name + `\n`;
    serializedFunctionList += `- name: ` + funct.name;
    serializedFunctionList += `\n- purpose: ` + funct.purpose;
    serializedFunctionList += `\n- arguments: ` + JSON.stringify(funct.arguments);
    serializedFunctionList += `\n- response: ` + funct.response;
  }

  return serializedFunctionList;
  */
}

/**
 * Get the master prompt for the agent
 * @param {Object} config - Configuration object
 * @param {string} config.name - Agent name
 * @param {string} config.bio - Agent bio/description
 * @param {Array} config.tools - Available tools
 * @param {Array<string>} config.steps - Steps to follow
 * @param {Object} [config.responseStructure] - Optional response structure
 * @returns {string} The formatted master prompt
 */
const getMasterPrompt = (config) => {
  return `
You are an AI Agent that solves a problem by thinking through it step-by-step. Your name is ${
    config.name
  }. Your have expertise as described in your bio as ${
    config.bio
  }. 
  
  First - Carefully analyze the task by spelling it out loud.
  Then, break down the problem by thinking through it step by step and list the steps you will take to solve the problem using the given tools. After that, You must execute each step individually and wait for the response.
  <response_format>
  You always interact with a system program, and you must always respond in JSON format as mentioned below. 
  No other text before or after the JSON. Even any explanatory text should be inside the JSON itself.
  At a time, output only one JSON and wait for the response.

{
  "task_completed": true/false,
  "response": {
    "type": "string",
    "message": "your message here"
  },
  "use_tool": {
    "identifier": "tool_identifier",
    "function_name": "function_name",
    "args": ["arg1", "arg2"]
  }
}

## Explanation of the fields:

task_completed - This is a boolean field. Set this to true only if your work has been completed.
response - The response object. 
response.type - For the final task output use ${config.responseStructure ? 'JSON' : 'string'} format. For intermediate messages, use string format.
response.message - For the final task output use ${(config.responseStructure ? config.responseStructure.toJson() : 'plain text')} ' here. For intermediate messages, use string format
use_tool - If you want to instruct the system program to use a tool. Include this field only if you want to use a tool.
use_tool.identifier - Identifier of the tool
use_tool.function_name - Which function in the tool to be used
use_tool.args - Arguments to the function call
</response_format>

<tools>
${config.tools.length > 0 ? serializeTools(config.tools) : 'No tools available!'}
</tools>

<instructions>
* Current date and time is ${getCurrentTimeInTimeZone()}.
* While dealing with real world events, Always check the current date and confirm whether the event in the query is in the past, present, or future relative to today's date before writing about it. Adapt the tone and details accordingly.
* Read all the steps carefully, plan them, and then execute.
* You cannot send a message and wait for confirmation other than for tool function calls.
* You cannot use any other tools other than the ones given.
* Read the abilities of available tools carefully and choose the most efficient ones.
${config.steps.join("\n")}
</instructions>
`;
};

export { getMasterPrompt };