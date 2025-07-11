const axios = require("axios");
const { Tool } = require("../base/base-tool");
const puppeteer = require("puppeteer");

class CrawlerTool extends Tool {
    constructor() {
        super();
        this.name = "Crawler Tool";
        this.identifier = "crawler-tool";
        this.instructions = ["Crawl the given URL and return the HTML response", "If the LLM Model has token limit, it's safe to pass a limit using the maxChars argument"];
        this.abilities = ["Can crawl a given URL and return the HTML body of that page", "Can read the content of any web page"];
        this.functions = [
            {
                name: "crawl",
                purpose: "crawl a given url and gets its raw HTML body",
                arguments: [{
                    name: "url",
                    description: "URL of the page to be crawled",
                    dataType: "string"
                }, {
                    name: "maxChars",
                    description: "Maximum characters to be returned in response. Use this if the LLM model has token limits",
                    dataType: "number"
                }],
                response: "HTML body of the crawled page. If it has only Javascript, then it indicates that it's an SPA and this tool may not work"
            }
        ];

        this.functionMap = {
            'crawl': this.crawl.bind(this)
        };
    }

    async crawl(url, maxChars = 10000) {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        await page.waitForSelector('body');
        const response = await page.evaluate(() => {
            const body = document.querySelector('body');
            return body ? body.innerHTML : null;
        });
        if (maxChars) {
            return response ? response.substring(0, maxChars) : null;
        }

        return response;
    }
}

const crawlerTool = new CrawlerTool();

module.exports = { crawlerTool };