const { Tool } = require("../base/base-tool");
const CalculatorEvaluateTool = require('./CalculatorEvaluateTool');

class CalculatorTool extends Tool {

    constructor() {
        super();
        this.name = "Calculator Tool";
        this.identifier = "calculator_tool";
        this.abilities = ["Evaluate mathematical expressions"];
        this.instructions = ["Use the evaluate function to perform the mathematical expression evaluation and get the result"];
        this.functions = [{
            name: "evaluate",
            purpose: "To evaluate a mathematical expression in Javascript",
            arguments: [{
                name: "expression",
                description: "Javascript mathematical expression, for example: 784*566",
                dataType: "string"
            }],
            response: "result of expression evaluation"
        }];

        this.functionMap = {
            "evaluate": this.evaluate.bind(this)
        };
    }

    async evaluate(expression) {
        console.log("exp ", expression, eval(expression));
        return eval(expression);
    }
}

const calculatorTool = new CalculatorTool();

module.exports = { CalculatorTool, calculatorTool, CalculatorEvaluateTool };