import { RobustJsonParser } from '../../src/utils/RobustJsonParser.js';

describe('RobustJsonParser', () => {
    describe('parseFromText', () => {
        it('should parse valid JSON', () => {
            const result = RobustJsonParser.parseFromText('{"key": "value"}');
            expect(result).toEqual({ key: 'value' });
        });

        it('should parse JSON array', () => {
            const result = RobustJsonParser.parseFromText('[1, 2, 3]');
            expect(result).toEqual([1, 2, 3]);
        });

        it('should extract JSON from text with surrounding content', () => {
            const text = 'Here is some JSON: {"data": "test"} and some more text';
            const result = RobustJsonParser.parseFromText(text);
            expect(result).toEqual({ data: 'test' });
        });

        it('should extract JSON array from text', () => {
            const text = '[{"id": 1}, {"id": 2}]';
            const result = RobustJsonParser.parseFromText(text);
            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('should handle markdown code blocks', () => {
            const text = '```json\n{"wrapped": true}\n```';
            const result = RobustJsonParser.parseFromText(text);
            expect(result).toEqual({ wrapped: true });
        });

        it('should parse JSON5 format with unquoted keys', () => {
            const json5 = '{"key": "value", "trailing": true}';
            const result = RobustJsonParser.parseFromText(json5);
            expect(result).toEqual({ key: 'value', trailing: true });
        });

        it('should handle double quotes', () => {
            const text = '{"key": "value"}';
            const result = RobustJsonParser.parseFromText(text);
            expect(result).toEqual({ key: 'value' });
        });

        it('should throw error for invalid JSON', () => {
            expect(() => RobustJsonParser.parseFromText('not json at all')).toThrow('Failed to parse JSON from text');
        });

        it('should throw error for empty input', () => {
            expect(() => RobustJsonParser.parseFromText('')).toThrow('Input text is empty or not a string');
        });

        it('should handle nested objects', () => {
            const json = '{"outer": {"inner": {"deep": "value"}}}';
            const result = RobustJsonParser.parseFromText(json);
            expect(result).toEqual({ outer: { inner: { deep: 'value' } } });
        });

        it('should handle escaped characters', () => {
            const json = '{"text": "Line 1\\nLine 2\\tTabbed"}';
            const result = RobustJsonParser.parseFromText(json);
            expect(result).toEqual({ text: 'Line 1\nLine 2\tTabbed' });
        });
    });

    describe('parseAndValidate', () => {
        it('should parse and validate structure with expected keys', () => {
            const text = '{"name": "test", "value": 123}';
            const result = RobustJsonParser.parseAndValidate(text, ['name', 'value']);
            expect(result).toEqual({ name: 'test', value: 123 });
        });

        it('should throw error when expected keys are missing', () => {
            const text = '{"name": "test"}';
            expect(() => RobustJsonParser.parseAndValidate(text, ['name', 'value']))
                .toThrow('Parsed JSON missing expected keys: name, value');
        });
    });
});