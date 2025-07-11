const OpenAI = require("openai");

class DeepSeekProvider {
    /**
     * @param {Object} config
     * @param {string} config.apiKey
     * @param {string} config.model
     */
    constructor(config) {
        this.client = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: config.apiKey,
        });

        this.model = config.model;
    }

    /**
     * @param {Array<{role: string, content: string | Array}>} messages
     * @returns {Promise<Object>}
     */
    async sendAndReceiveResponse(messages) {
        try {
            const response = await this.client.chat.completions.create({
                messages,
                model: this.model,
                response_format: {
                    'type': 'json_object'
                }
            });

            return JSON.parse(response.choices[0].message.content || '');

        } catch (error) {
            throw new Error(error);
        }
    }
}

module.exports = { DeepSeekProvider };