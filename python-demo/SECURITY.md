# Prompt Injection Defense

## Overview

The python-demo research system implements defense-in-depth against prompt injection attacks using:

1. **Delimiter Wrapping** (Prevention) - XML tags force LLMs to treat external content as data
2. **Pattern Detection** (Detection) - Regex-based detection of common injection attempts
3. **Prompt Hardening** (Mitigation) - System prompts explicitly instruct LLMs to ignore injections

This follows OWASP 2025 best practices for LLM security without requiring heavyweight ML models or external services.

## Architecture

### Security Module (`src/security.py`)

Three main functions provide defense:

```python
# 1. Wrap untrusted content in XML delimiters
wrapped = wrap_untrusted_content(content)
# Output: <untrusted_content>\n{content}\n</untrusted_content>

# 2. Check for injection patterns
is_safe, reason = check_injection_patterns(text)
# Returns: (False, "Suspicious pattern detected: ...") if malicious

# 3. Full sanitization pipeline
is_safe, sanitized, reason = sanitize_web_content(url, content)
# Combines detection + wrapping
```

### Integration Points

**Content Extractor** (`src/agents/content_extractor.py:144-158`):
- Checks all web content before LLM summarization
- Skips suspicious URLs with logging
- Wraps safe content in delimiters

**Prompts** (`src/prompts.py`):
- CONTENT_SUMMARIZER_SYSTEM - Instructs to only read from `<untrusted_content>` tags
- ANALYST_SYSTEM - Additional protection for report generation

## Detection Patterns

The system detects common injection attempts:

- **Instruction Override**: "ignore previous instructions", "forget everything"
- **System Tags**: `<system>`, `<admin>`, `<instruction>`
- **Role Hijacking**: "you are now a hacker", "system: new task"
- **Prompt Leakage**: "reveal your system prompt", "what are your instructions"
- **Indirect Commands**: "instead of X, say Y", "override previous rules"

All patterns are case-insensitive and use flexible matching.

## Performance

- **~0ms overhead** for delimiter wrapping
- **~1ms per page** for pattern detection
- **No ML models** or external API calls required
- **Scales to 10+ pages** per research query with negligible impact

## Testing

Comprehensive test suite with 16 tests covering:

✅ Delimiter wrapping functionality
✅ Detection of all pattern types
✅ Full sanitization pipeline
✅ Real-world injection examples
✅ Edge cases and obfuscation attempts

Run tests:
```bash
python3 -m pytest __tests__/test_security.py -v
```

## Limitations

**What This Protects Against:**
- Direct prompt injections in web content
- Common attack patterns (ignore instructions, role hijacking, etc.)
- Attempts to leak system prompts
- Malicious content trying to manipulate summaries

**What This Does NOT Protect Against:**
- Novel injection techniques not in pattern list
- Sophisticated multi-turn attacks
- Unicode obfuscation (partially - delimiters still protect)
- Adversarial attacks specifically targeting this system

## Defense-in-Depth

Even if pattern detection fails:

1. **Delimiters** still force LLM to treat content as data
2. **Prompt hardening** instructs LLM to ignore injections
3. **Logging** captures suspicious attempts for analysis

No single layer provides complete protection - layered defense is essential.

## Comparison to HuggingFaceInjectionIdentifier

The initial proposal suggested using `HuggingFaceInjectionIdentifier`:

| Feature | Our Approach | HuggingFace Detector |
|---------|-------------|---------------------|
| **Model Size** | 0 bytes (regex only) | 400MB+ ML model |
| **Latency** | ~1ms per page | 100-200ms per page |
| **Accuracy** | Good for common patterns | Unknown (no metrics) |
| **Integration** | Simple functions | Requires LangChain agent framework |
| **Maintenance** | Update regex patterns | Model retraining needed |
| **Architecture Fit** | Works with LangGraph | Designed for LangChain agents |

**Verdict**: Pattern detection + delimiters provides better performance and simpler integration for this use case.

## Future Improvements

If needed, consider:

1. **LLM-based guard** - Use GPT-4o-mini as final check for suspicious content
2. **Adaptive patterns** - Learn from flagged attempts to improve detection
3. **Rate limiting** - Throttle requests from sources with repeated injections
4. **Honeypot detection** - Identify attackers probing for vulnerabilities

## References

- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [OWASP Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [AWS LLM Prompt Engineering Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/llm-prompt-engineering-best-practices/common-attacks.html)
