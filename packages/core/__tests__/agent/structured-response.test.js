const { StructuredResponse } = require('../../src/agent/structured-response');

describe('StructuredResponse', () => {
    it('should create an instance with given structure', () => {
        const structure = {
            name: 'Test',
            value: 123,
            nested: {
                key: 'value'
            }
        };

        const response = new StructuredResponse(structure);

        expect(response.name).toBe('Test');
        expect(response.value).toBe(123);
        expect(response.nested).toEqual({ key: 'value' });
    });

    it('should handle empty structure', () => {
        const response = new StructuredResponse({});

        // Only toJson method should be present as an own property
        const ownKeys = Object.keys(response).filter(key => response.hasOwnProperty(key));
        expect(ownKeys).toEqual([]);
    });

    it('should allow dynamic property access', () => {
        const response = new StructuredResponse({
            prop1: 'value1',
            prop2: 'value2'
        });

        expect(response['prop1']).toBe('value1');
        expect(response['prop2']).toBe('value2');
    });

    describe('toJson', () => {
        it('should convert to JSON string', () => {
            const structure = {
                name: 'Test',
                value: 123,
                array: [1, 2, 3]
            };

            const response = new StructuredResponse(structure);
            const json = response.toJson();
            const parsed = JSON.parse(json);

            expect(parsed.name).toBe('Test');
            expect(parsed.value).toBe(123);
            expect(parsed.array).toEqual([1, 2, 3]);
        });

        it('should handle complex nested structures', () => {
            const structure = {
                level1: {
                    level2: {
                        level3: 'deep value'
                    }
                },
                array: [
                    { id: 1, name: 'item1' },
                    { id: 2, name: 'item2' }
                ]
            };

            const response = new StructuredResponse(structure);
            const json = response.toJson();
            const parsed = JSON.parse(json);

            expect(parsed.level1.level2.level3).toBe('deep value');
            expect(parsed.array).toHaveLength(2);
            expect(parsed.array[0].name).toBe('item1');
        });
    });
});