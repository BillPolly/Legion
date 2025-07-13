export class DefaultPromptBuilder {
  buildPrompt(template, context) {
    let prompt = template;
    
    // Simple template replacement
    for (const [key, value] of Object.entries(context)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    
    return prompt;
  }
}