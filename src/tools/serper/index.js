const axios = require("axios");
const { Tool } = require("../base/base-tool");

class GoogleSearchTool extends Tool {
    constructor() {
        super();
        this.serperApiKey = null;
        this.name = "Google Search Tool";
        this.identifier = "google-search-tool";
        this.abilities = ["You can perform google search and get results"];
        this.functions = [{
            name: "search",
            purpose: "To do google search and get the results in JSON format",
            arguments: [{
                name: "query",
                description: "The query to be searched",
                dataType: "string"
            }, {
                name: "dateRange",
                description: "To return search results within the given date range. Values can be week, month, year",
                dataType: "string"
            }],
            response: "The search results in JSON format or some error message",
        }];

        this.instructions = ["Use the search function to perform google search"];

        this.functionMap = {
            'search': this.search.bind(this)
        };
    }

    init(config) {
        this.serperApiKey = config.serperApiKey;
    }

    async search(query, dateRange) {
        const dateMap = {
            week: "qdr:w",
            month: "qdr:m",
            year: "qdr:y",
        };

        if (!this.serperApiKey) {
            return 'Cannot do search, because search tool was not initialised with a serper api key!';
        }

        let dRQuery = "";
        if (dateRange) {
            "&tbs=" + dateMap[dateRange] || '';
        }

        const response = await axios.get("https://google.serper.dev/search?q=" + query + dateRange, {
            headers: {
                'X-API-KEY': this.serperApiKey,
                'Content-Type': 'application/json'
            }
        });

        return JSON.stringify(response.data);
    }
}

const googleSearchTool = new GoogleSearchTool();

module.exports = { googleSearchTool };