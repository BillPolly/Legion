class Tool {
    constructor() {
        // Initialize properties that were abstract in TypeScript
        this.name = null;
        this.identifier = null;
        this.abilities = null;
        this.instructions = null;
        this.functions = null;
        this.functionMap = null;
        
        this.executingAgent = null;
        
        // Runtime check to ensure required properties are implemented
        // This check will run after the subclass constructor completes
        process.nextTick(() => {
            this._validateImplementation();
        });
    }
    
    _validateImplementation() {
        const requiredProperties = [
            'name',
            'identifier',
            'abilities',
            'instructions',
            'functions',
            'functionMap'
        ];
        
        for (const prop of requiredProperties) {
            if (this[prop] === null || this[prop] === undefined) {
                console.error(`Tool subclass must define: ${prop}`);
                process.exit(1);
            }
        }
        
        // Validate types
        if (typeof this.name !== 'string') {
            console.error(`Tool implementation error: 'name' must be a string in ${this.constructor.name}`);
            process.exit(1);
        }
        if (typeof this.identifier !== 'string') {
            console.error(`Tool implementation error: 'identifier' must be a string in ${this.constructor.name}`);
            process.exit(1);
        }
        if (!Array.isArray(this.abilities)) {
            console.error(`Tool implementation error: 'abilities' must be an array in ${this.constructor.name}`);
            process.exit(1);
        }
        if (!Array.isArray(this.instructions)) {
            console.error(`Tool implementation error: 'instructions' must be an array in ${this.constructor.name}`);
            process.exit(1);
        }
        if (!Array.isArray(this.functions)) {
            console.error(`Tool implementation error: 'functions' must be an array in ${this.constructor.name}`);
            process.exit(1);
        }
        if (typeof this.functionMap !== 'object' || this.functionMap === null) {
            console.error(`Tool implementation error: 'functionMap' must be an object in ${this.constructor.name}`);
            process.exit(1);
        }
    }

    setExecutingAgent(agent) {
        this.executingAgent = agent;
    }
}

module.exports = { Tool };