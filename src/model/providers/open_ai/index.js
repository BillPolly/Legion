const OpenAI = require("openai");

class OpenAIProvider {
    /**
     * @param {Object} config
     * @param {string} config.apiKey
     * @param {string} config.model
     */
    constructor(config) {
        this.client = new OpenAI({
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

        const content = response.choices[0].message.content;
        if (!content || content.trim() === '') {
            return {};
        }
        return JSON.parse(content);
    }
}

module.exports = { OpenAIProvider };