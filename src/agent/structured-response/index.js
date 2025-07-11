class StructuredResponse {
    constructor(structure) {
        Object.keys(structure).forEach(key => {
            this[key] = structure[key];
        });
    }

    toJson() {
        return JSON.stringify(this);
    }
}

module.exports = { StructuredResponse };