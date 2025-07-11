const OpenAI = require("openai");

class OpenRouterProvider {
    /**
     * @param {Object} config
     * @param {string} config.apiKey
     * @param {string} config.model
     */
    constructor(config) {
        this.client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: config.apiKey,
        });

        this.model = config.model;
    }

    /**
     * @param {Array<{role: string, content: string | Array}>} messages
     * @returns {Promise<Object>}
     */
    async sendAndReceiveResponse(messages) {
        const response = await this.client.chat.completions.create({
            messages,
            model: this.model,
            response_format: {
                'type': 'json_object'
            }
        });

        //console.log("Raw output is", response.choices[0].message.content);

        return JSON.parse(response.choices[0].message.content || '');
    }
}

module.exports = { OpenRouterProvider };