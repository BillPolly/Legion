import { ToolResult } from "@jsenvoy/module-loader";
import { LLMClient } from "@jsenvoy/llm";
import { getMasterPrompt } from "./lib/master-prompt.js";
import ora from "ora";
import { writeFile, appendFile } from "fs/promises";
import readline from "readline";
import { RetryManager } from "./RetryManager.js";

/**
 * Agent class with robust response parsing and retry logic
 */
class Agent {
  constructor(config) {
    this.name = config.name || "default_agent";
    this.bio = config.bio;
    this.steps = config.steps || [];
    this.modelConfig = config.modelConfig;
    this.tools = config.tools || [];
    this._debugMode = config._debugMode || false;
    this.responseStructure = config.responseStructure;
    this.showToolUsage = config.showToolUsage || false;
    this.metaData = config.metaData || {};
    this.maxRetries = config.maxRetries || 3;
    this.retryBackoff = config.retryBackoff || 1000;
    
    this.responseMessages = [];
    this.messages = [];

    if (config.tools) {
      this.tools = config.tools;

      for (const tool of this.tools) {
        tool.setExecutingAgent(this);
      }
    }

    // Initialize the LLM client
    // Convert modelConfig format to LLMClient format
    const providerMap = {
      'OPEN_AI': 'openai',
      'DEEP_SEEK': 'deepseek',
      'OPEN_ROUTER': 'openrouter'
    };
    
    this.llmClient = new LLMClient({
      provider: providerMap[this.modelConfig.provider] || this.modelConfig.provider.toLowerCase(),
      apiKey: this.modelConfig.apiKey,
      model: this.modelConfig.model,
      maxRetries: this.maxRetries,
      baseDelay: this.retryBackoff
    });

    // Initialize retry manager with tools
    this.retryManager = new RetryManager({
      maxRetries: this.maxRetries,
      backoffMultiplier: this.retryBackoff,
      tools: this.tools
    });

    this.initialiseAgent();
  }

  initialiseAgent() {
    this.messages.push({
      role: "system",
      content: this.preparePrompt(),
    });
  }

  preparePrompt() {
    const prompt = getMasterPrompt({
      name: this.name,
      bio: this.bio,
      tools: this.tools,
      steps: this.steps,
      responseStructure: this.responseStructure,
    });

    return prompt;
  }

  addMessage(content, imageBase64) {
    const contentArray = [
      {
        type: "text",
        text: content,
      },
    ];

    if (imageBase64) {
      contentArray.push({
        type: "image_url",
        image_url: {
          url: imageBase64,
        },
      });
    }

    this.messages.push({
      role: "user",
      content: contentArray,
    });
  }

  /**
   * Enhanced prompt method with retry logic
   */
  async prompt(prompt, imageBase64) {
    if (this._debugMode) {
      await appendFile("agentOut.txt", " awaiting llm response\n");
    }

    if (imageBase64) {
      this.addMessage(prompt, imageBase64);
    } else {
      this.addMessage(prompt);
    }

    // Use retry manager to get response
    const result = await this.retryManager.processResponse(this.llmClient, this.messages);

    if (this._debugMode) {
      await appendFile("agentOut.txt", ` llm responded (retries: ${result.retries})\n`);
      await appendFile("agentOut.txt", ` result: ${JSON.stringify(result)}\n`);
    }

    if (!result.success) {
      // If we still failed after retries, throw an error
      throw new Error(`Failed to get valid response: ${result.error}`);
    }

    // Add the successful response to messages
    this.messages.push({
      role: "assistant",
      content: JSON.stringify(result.data)
    });

    return result.data;
  }

  async newProcess(response) {
    // Handle null or undefined response
    if (!response) {
      return {
        taskCompleted: false,
        nextPrompt: "No response received. Please try again."
      };
    }
    
    if (
      response.use_tool &&
      (response.use_tool != undefined ||
        typeof response.use_tool != "undefined")
    ) {
      this.showToolUsage &&
        console.log(
          "\n 🛠️ Using tool " +
            response.use_tool.identifier +
            " with function ",
          response.use_tool.function_name + " and args ",
          response.use_tool.args + "\n"
        );

      const tool = this.getTool(response.use_tool.identifier);

      if (!tool) {
        // Instead of exiting, return an error to retry
        return {
          taskCompleted: false,
          nextPrompt: `Error: Tool '${response.use_tool.identifier}' not found. Please check the tool identifier and try again.`,
        };
      }

      const fn = response.use_tool.function_name;
      const args = response.use_tool.args;

      let functionResponse;
      try {
        if (this._debugMode) {
          await appendFile("agentOut.txt", `Attempting to call function '${fn}' on tool '${response.use_tool.identifier}'\n`);
          await appendFile("agentOut.txt", `Tool has invoke: ${typeof tool.invoke === 'function'}\n`);
          await appendFile("agentOut.txt", `Args: ${JSON.stringify(args)}\n`);
        }

        // Check if this is a new-style tool with invoke method
        if (typeof tool.invoke === 'function' || typeof tool.safeInvoke === 'function') {
          // Convert args array to proper object format
          let argsObject = {};
          if (Array.isArray(args)) {
            if (args.length === 1 && typeof args[0] === 'object') {
              // Single object argument: use it directly
              argsObject = args[0];
            } else if (args.length === 1 && typeof args[0] === 'string') {
              // Single string argument: assume it's the first parameter
              // Get the first parameter name from tool function
              const toolFunctions = tool.functions || [];
              const matchingFunction = toolFunctions.find(f => f.name === fn);
              if (matchingFunction && matchingFunction.arguments.length > 0) {
                argsObject[matchingFunction.arguments[0]] = args[0];
              } else {
                // Fallback: assume 'expression' for calculator
                argsObject.expression = args[0];
              }
            } else {
              // Multiple arguments: map to parameter names
              const toolFunctions = tool.functions || [];
              const matchingFunction = toolFunctions.find(f => f.name === fn);
              if (matchingFunction) {
                matchingFunction.arguments.forEach((paramName, index) => {
                  if (index < args.length) {
                    argsObject[paramName] = args[index];
                  }
                });
              }
            }
          } else if (typeof args === 'object') {
            argsObject = args;
          }

          // Create a tool call in OpenAI format
          const toolCall = {
            id: `agent-${Date.now()}`,
            type: 'function',
            function: {
              name: fn,
              arguments: JSON.stringify(argsObject)
            }
          };

          if (this._debugMode) {
            await appendFile("agentOut.txt", `Created tool call: ${JSON.stringify(toolCall)}\n`);
          }

          // Use safeInvoke if available, otherwise invoke
          const invokeMethod = tool.safeInvoke ? 'safeInvoke' : 'invoke';
          const toolResult = await tool[invokeMethod](toolCall);

          if (this._debugMode) {
            await appendFile("agentOut.txt", `Tool result: ${JSON.stringify(toolResult)}\n`);
          }

          // Handle ToolResult format
          if (toolResult && typeof toolResult === 'object' && 'success' in toolResult) {
            if (!toolResult.success) {
              return {
                taskCompleted: false,
                nextPrompt: `<tool_error>${toolResult.error}</tool_error>\n<tool_data>${JSON.stringify(toolResult.data || {})}</tool_data>`,
              };
            }

            // Check if result contains an image
            if (toolResult.data && (toolResult.data.isImage || toolResult.data.image)) {
              return {
                taskCompleted: response.task_completed,
                nextPrompt: "Here is the image",
                image: toolResult.data.image,
              };
            }

            functionResponse = JSON.stringify(toolResult.data || toolResult);
          } else {
            // Handle legacy response format or plain response
            functionResponse = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
          }
        } 
        // Legacy tool with functionMap
        else if (tool.functionMap && tool.functionMap[fn]) {
          functionResponse = await tool.functionMap[fn](...args);

          if (functionResponse && functionResponse.isImage) {
            return {
              taskCompleted: response.task_completed,
              nextPrompt: "Here is the image",
              image: functionResponse.image,
            };
          }
        } else {
          return {
            taskCompleted: false,
            nextPrompt: `Error: Function '${fn}' not found in tool '${response.use_tool.identifier}'. Available functions: ${tool.functions ? tool.functions.map(f => f.name).join(', ') : 'none'}. Tool does not have invoke method or functionMap.`,
          };
        }

        return {
          taskCompleted: response.task_completed,
          nextPrompt: "<tool_response>" + functionResponse + "</tool_response>. Give me the next one step in JSON format.",
        };
      } catch (error) {
        functionResponse = "Oops! Function call returned error " + error;
        return {
          taskCompleted: response.task_completed,
          nextPrompt: "<tool_response>" + functionResponse + "</tool_response>",
        };
      }
    } else if (response.task_completed == false) {
      return {
        taskCompleted: false,
        nextPrompt: "Continue with whatever data available. If impossible to continue, mark task_completed to true with a failure message. ",
      };
    }

    return {
      taskCompleted: true,
      nextPrompt: "",
    };
  }

  async autoPrompt(initialPrompt, initialImageBase64) {
    let prompt = initialPrompt;
    let imageBase64 = initialImageBase64;
    let finalResponse;

    while (true) {
      if (this._debugMode) {
        await appendFile("agentOut.txt", "Prompt: " + prompt + "\n");
      }
      
      let response;
      try {
        response = await this.prompt(prompt, imageBase64);
      } catch (error) {
        // If we couldn't get a valid response after retries, give up
        console.error("Failed to get valid response:", error.message);
        finalResponse = {
          type: "string",
          message: `Error: ${error.message}`
        };
        break;
      }
      
      if (this._debugMode) {
        await appendFile(
          "agentOut.txt",
          "Response: " + JSON.stringify(response) + "\n"
        );
      }
      const processResponse = await this.newProcess(response);

      if (processResponse?.taskCompleted) {
        finalResponse = response.response;
        break;
      }

      prompt = processResponse?.nextPrompt;

      if (processResponse.image) {
        imageBase64 = processResponse.image;
      } else {
        imageBase64 = undefined;
      }
    }

    return finalResponse;
  }

  getTool(identifier) {
    const tool = this.tools?.find((tool) => tool.identifier === identifier) || false;
    return tool;
  }

  /**
   * Run the agent with given prompt
   * @param {string} prompt - The prompt to run
   * @param {string} [imageBase64] - Optional base64 encoded image
   * @returns {Promise<any>} The agent response
   */
  async run(prompt, imageBase64) {
    if (this._debugMode) {
      await writeFile("agentOut.txt", "");
    }
    const finalResponse = await this.autoPrompt(prompt, imageBase64);
    return finalResponse;
  }

  /**
   * Print the agent response to console
   * @param {string} prompt - The prompt to run
   * @param {string} [imageBase64] - Optional base64 encoded image
   * @param {Object} [config] - Optional configuration
   */
  async printResponse(prompt, imageBase64, config) {
    const spinner = ora().start();
    console.log((await this.run(prompt, imageBase64))?.message);
    spinner.stop();

    if (this._debugMode) {
      console.log("Agent raw message stack written to agentRawMessageStack.txt");
      await writeFile("agentRawMessageStack.txt", JSON.stringify(this.messages.slice(1)));
    }
  }
}

export { Agent };