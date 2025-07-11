const { Tool } = require("../base/base-tool");
const { exec } = require("child_process");
const { appendFile, readFile, writeFile } = require("fs/promises");
const { promisify } = require('util');

const execPromise = promisify(exec);

class BashExecutorTool extends Tool {
    constructor() {
        super();
        this.name = "bash executor tool";
        this.identifier = "bash-executor-tool";
        this.abilities = ["Can execute a command in bash and return the response"];
        this.instructions = [
            "Execute the bash command using execute function",
        ];

        this.functions = [
            {
                name: "execute",
                purpose: "Execute a bash command in terminal",
                arguments: [
                    {
                        name: "command",
                        description: "Command to be executed",
                        dataType: "string",
                    },
                ],
                response: "The output of executed command",
            }
        ];

        this.functionMap = {
            execute: this.execute.bind(this)
        };
    }

    async execute(command) {
        try {
            // Execute command and wait for completion
            const { stdout, stderr } = await execPromise(command, { timeout: 50000 });

            // If there's stderr output but the command didn't fail, you might want to include it
            if (stderr) {
                return `${stdout}\nSTDERR: ${stderr}`;
            }

            return stdout;
        } catch (error) {
            // Handle any errors that occurred during execution
            if (error.code === 'ETIMEDOUT') {
                return 'Command timed out. Maybe because it needed an input from you, which is impossible as per your first instruction. Remember - interactive prompts are not supported. You must find alternative ways to run the command or use a different command!';
            }
            return 'Command execution failed: ' + error.message;
        }
    }
}

const bashExecutorTool = new BashExecutorTool();

module.exports = { bashExecutorTool };