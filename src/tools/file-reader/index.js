const { Tool } = require("../base/base-tool");
const { readFile } = require('fs/promises');

class FileReaderTool extends Tool {
    constructor() {
        super();
        this.name = "file reader tool";
        this.identifier = "file-reader-tool";
        this.abilities = ["You can read a given file from disk"];
        this.instructions = ["Read using read function"];

        this.functions = [{
            name: "read",
            purpose: "Read a file from disk",
            arguments: [{
                name: "filePath",
                description: "Path of the file to read",
                dataType: "string"
            }],
            response: "Content of the file in string format"
        }];

        this.functionMap = {
            'read': this.read.bind(this)
        };
    }

    async read(filePath) {
        try {
            const data = await readFile(filePath, 'utf-8');
            return data;
        } catch (err) {
            return 'Error reading file: ' + err;
        }
    }
}

const fileReaderTool = new FileReaderTool();

module.exports = { fileReaderTool };