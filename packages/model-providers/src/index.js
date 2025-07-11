import { DeepSeekProvider } from "./providers/deepseek/index.js";
import { OpenAIProvider } from "./providers/open_ai/index.js";
import { OpenRouterProvider } from "./providers/openrouter/index.js";
import ora from 'ora';

// Re-export all types (for documentation purposes)
// In JS, we'll document types using JSDoc comments

class Model {
    /**
     * @param {Object} config
     * @param {Object} config.modelConfig - The model configuration
     * @param {'OPEN_AI' | 'DEEP_SEEK' | 'OPEN_ROUTER'} config.modelConfig.provider
     * @param {string} config.modelConfig.model
     * @param {string} config.modelConfig.apiKey
     */
    constructor(config) {
        this.modelConfig = config.modelConfig;
    }

    initializeModel() {
        switch (this.modelConfig.provider) {
            case 'OPEN_AI': {
                //console.log("initialising openai")

                if (!this.modelConfig.apiKey) {
                    throw new Error('OpenAI API Key is missing!');
                }
                this.openAiProvider = new OpenAIProvider(this.modelConfig);

                break;
            }

            case 'DEEP_SEEK': {
                //console.log("initialising deepseek")
                if (!this.modelConfig.apiKey) {
                    throw new Error('DEEP SEEK API Key is missing!');
                }
                this.deepSeekProvider = new DeepSeekProvider(this.modelConfig);

                break;
            }

            case 'OPEN_ROUTER': {
                //console.log("initialising deepseek")
                if (!this.modelConfig.apiKey) {
                    throw new Error('OPEN ROUTER API Key is missing!');
                }
                this.openRouterProvider = new OpenRouterProvider(this.modelConfig);

                break;
            }
        }
    }

    /**
     * @param {Array<Object>} messages - Array of message objects
     * @param {Array<{role: 'system' | 'user', content: string | Array}>} messages
     * @returns {Promise<any>}
     */
    async sendAndReceiveResponse(messages) {
        let response;
        switch (this.modelConfig.provider) {
            case 'OPEN_AI': {
                response = await this.openAiProvider.sendAndReceiveResponse(messages);
                break;
            }

            case 'DEEP_SEEK': {
                response = await this.deepSeekProvider.sendAndReceiveResponse(messages);
                break;
            }

            case 'OPEN_ROUTER': {
                response = await this.openRouterProvider.sendAndReceiveResponse(messages);
                break;
            }
        }

        // Parse the response if it's a string (for backward compatibility)
        if (typeof response === 'string') {
            try {
                return JSON.parse(response);
            } catch (e) {
                // If parsing fails, return as is
                return response;
            }
        }
        
        return response;
    }
}

export { Model };