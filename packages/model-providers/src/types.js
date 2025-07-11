/**
 * @typedef {Object} ModelType
 * @property {'openai'} OpenAI
 * @property {'deepseek'} DeepSeek
 * @property {'openrouter'} OpenRouter
 */
const ModelType = {
    OpenAI: 'openai',
    DeepSeek: 'deepseek',
    OpenRouter: 'openrouter'
};

/**
 * @typedef {'gpt-4o'} OpenAIModel
 */

/**
 * @typedef {'deepseek-chat'} DeepSeekModel
 */

/**
 * @typedef {'openai/gpt-4o' | 'deepseek/deepseek-chat' | 'anthropic/claude-3.5-sonnet'} OpenRouterModel
 */

/**
 * @typedef {Object} OpenRouterModelConfig
 * @property {'OPEN_ROUTER'} provider
 * @property {OpenRouterModel} model
 * @property {string} apiKey
 */

/**
 * @typedef {Object} OpenAIModelConfig
 * @property {'OPEN_AI'} provider
 * @property {OpenAIModel} model
 * @property {string} apiKey
 */

/**
 * @typedef {Object} DeepSeekModelConfig
 * @property {'DEEP_SEEK'} provider
 * @property {DeepSeekModel} model
 * @property {string} apiKey
 */

/**
 * @typedef {Object} ModelExtendedContent
 * @property {"text" | "image_url"} type
 * @property {string} [text]
 * @property {{url: string}} [image_url]
 */

/**
 * @typedef {Object} ModelMessage
 * @property {'system' | 'user'} role
 * @property {string | ModelExtendedContent[]} content
 */

/**
 * @typedef {OpenAIModelConfig | DeepSeekModelConfig | OpenRouterModelConfig} AnyModelConfig
 */

/**
 * @typedef {Object} ModelConfig
 */

module.exports = {
    ModelType
};