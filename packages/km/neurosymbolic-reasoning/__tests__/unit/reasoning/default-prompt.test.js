import { createDefaultZ3Prompt } from '../../../src/reasoning/default-prompt.js';

describe('Default Z3 Program Generation Prompt', () => {
  test('should create prompt template', () => {
    const prompt = createDefaultZ3Prompt();
    expect(prompt).toBeDefined();
  });

  test('should include system instructions', () => {
    const prompt = createDefaultZ3Prompt();
    const rendered = prompt.render({ question: 'Is x > 5?' });

    expect(rendered).toContain('Z3 theorem prover');
    expect(rendered).toContain('JSON format');
  });

  test('should include JSON schema', () => {
    const prompt = createDefaultZ3Prompt();
    const rendered = prompt.render({ question: 'Is x > 5?' });

    expect(rendered).toContain('variables');
    expect(rendered).toContain('constraints');
    expect(rendered).toContain('query');
  });

  test('should include few-shot examples', () => {
    const prompt = createDefaultZ3Prompt();
    const rendered = prompt.renderWithExamples({ question: 'Is x > 5?' });

    expect(rendered).toContain('Example');
    expect(prompt.examples.length).toBeGreaterThan(0);
  });

  test('should substitute question variable', () => {
    const prompt = createDefaultZ3Prompt();
    const rendered = prompt.render({ question: 'Is x greater than 10?' });

    expect(rendered).toContain('Is x greater than 10?');
  });

  test('should include output format instructions', () => {
    const prompt = createDefaultZ3Prompt();
    const rendered = prompt.render({ question: 'test' });

    expect(rendered).toContain('Output only valid JSON');
  });

  test('should have example with Int constraints', () => {
    const prompt = createDefaultZ3Prompt();

    const hasIntExample = prompt.examples.some(ex =>
      JSON.stringify(ex).includes('Int')
    );

    expect(hasIntExample).toBe(true);
  });

  test('should have example with Bool constraints', () => {
    const prompt = createDefaultZ3Prompt();

    const hasBoolExample = prompt.examples.some(ex =>
      JSON.stringify(ex).includes('Bool')
    );

    expect(hasBoolExample).toBe(true);
  });

  test('should show constraint types in examples', () => {
    const prompt = createDefaultZ3Prompt();
    const rendered = prompt.renderWithExamples({ question: 'test' });

    expect(rendered).toContain('gt');
    expect(rendered).toContain('lt');
  });
});
