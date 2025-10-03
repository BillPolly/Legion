# Markdown to Mac Pages Converter

Convert markdown documents to Mac Pages format with a single command.

## Overview

This tool converts markdown documents to Mac Pages format using a two-step process:
1. **Markdown → DOCX** using [remark-docx](https://github.com/inokawa/remark-docx)
2. **DOCX → Pages** (optional) using AppleScript automation

## Features

- ✅ Pure JavaScript/Node.js solution (no external dependencies like pandoc)
- ✅ Preserves markdown formatting (headings, lists, tables, code blocks, etc.)
- ✅ Optional automatic conversion to native Pages format
- ✅ Can auto-open documents in Pages after conversion
- ✅ CLI interface with sensible defaults
- ✅ Works with any markdown document

## Installation

### 1. Install Dependencies

From the monorepo root:
```bash
cd /path/to/Legion
npm install
```

Or install just for the ontology package:
```bash
cd packages/km/ontology
npm install
```

### 2. Verify Installation

```bash
cd packages/km/ontology
node scripts/markdown-to-pages.js --help
```

## Usage

### Basic Usage

```bash
# Convert markdown to DOCX
node scripts/markdown-to-pages.js report.md

# Output: report.docx
```

### Advanced Options

```bash
# Custom output path
node scripts/markdown-to-pages.js report.md -o output/my-document.docx

# Auto-open in Pages after conversion
node scripts/markdown-to-pages.js report.md --auto-open

# Convert to native Pages format
node scripts/markdown-to-pages.js report.md --convert-to-pages

# Convert to Pages and remove intermediate DOCX
node scripts/markdown-to-pages.js report.md --convert-to-pages

# Keep DOCX file when converting to Pages
node scripts/markdown-to-pages.js report.md --convert-to-pages --keep-docx
```

### Real-World Example

Convert the Phase 2 knowledge graph report:

```bash
cd packages/km/ontology

# Simple DOCX conversion
node scripts/markdown-to-pages.js plumbing-knowledge-graph-phase2-report.md

# Convert to Pages format
node scripts/markdown-to-pages.js plumbing-knowledge-graph-phase2-report.md --convert-to-pages

# Convert and auto-open in Pages
node scripts/markdown-to-pages.js plumbing-knowledge-graph-phase2-report.md --auto-open
```

## Command-Line Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--output <file>` | `-o` | Specify output file path (default: same as input with .docx extension) |
| `--auto-open` | | Automatically open the output file in Pages |
| `--convert-to-pages` | | Convert DOCX to native Pages format using AppleScript |
| `--keep-docx` | | Keep intermediate DOCX file when converting to Pages |
| `--help` | `-h` | Show help message |

## How It Works

### Step 1: Markdown → DOCX

The tool uses the **unified/remark** ecosystem with **remark-docx** plugin:

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDocx from 'remark-docx';

const processor = unified()
  .use(remarkParse)
  .use(remarkDocx, { output: 'buffer' });

const docxBuffer = await processor.process(markdown);
```

**Supported Markdown Features:**
- Headings (H1-H6)
- Paragraphs
- Bold/Italic/Strikethrough
- Lists (ordered and unordered)
- Tables
- Code blocks and inline code
- Links
- Images
- Blockquotes
- Horizontal rules

### Step 2: DOCX → Pages (Optional)

Uses AppleScript to automate Pages:

```applescript
tell application "Pages"
  set theDoc to open POSIX file "/path/to/input.docx"
  export theDoc to POSIX file "/path/to/output.pages" as Pages
  close theDoc saving no
end tell
```

## Output Examples

### Example 1: Knowledge Graph Report

**Input:** `plumbing-knowledge-graph-phase2-report.md` (745 lines)

**Command:**
```bash
node scripts/markdown-to-pages.js plumbing-knowledge-graph-phase2-report.md
```

**Output:**
- File: `plumbing-knowledge-graph-phase2-report.docx`
- Size: ~50 KB
- Formatted with proper headings, tables, and code blocks

### Example 2: Convert to Pages Format

**Command:**
```bash
node scripts/markdown-to-pages.js plumbing-knowledge-graph-phase2-report.md --convert-to-pages
```

**Output:**
- File: `plumbing-knowledge-graph-phase2-report.pages`
- Size: ~100 KB (Pages format with embedded resources)
- Fully editable in Pages
- Intermediate DOCX removed automatically

## Troubleshooting

### Error: Cannot find module 'unified'

**Problem:** Dependencies not installed

**Solution:**
```bash
cd packages/km/ontology
npm install
```

### Error: Conversion failed - Pages not installed

**Problem:** Mac Pages is not installed or not accessible

**Solution:**
- Install Pages from the Mac App Store
- Grant terminal access to control Pages (System Preferences → Privacy & Security)

### Error: EUNSUPPORTEDPROTOCOL workspace:*

**Problem:** npm workspace configuration issue

**Solution:**
```bash
# Install from monorepo root
cd /path/to/Legion
npm install

# Or use pnpm if the project uses it
pnpm install
```

### Warning dialogs during conversion

**Problem:** Pages shows warnings about DOCX compatibility

**Solution:**
- This is normal for complex documents
- The conversion will still succeed
- Review the output in Pages to ensure formatting is correct
- Adjust markdown if needed

## Architecture

### File Structure

```
scripts/
├── markdown-to-pages.js          # Main CLI script
└── lib/
    └── convert-to-pages.applescript  # AppleScript helper
```

### Dependencies

```json
{
  "remark": "^15.0.1",
  "remark-parse": "^11.0.0",
  "remark-docx": "^4.0.3",
  "unified": "^11.0.4",
  "to-vfile": "^8.0.0"
}
```

### Technology Stack

- **unified/remark** - Markdown parsing and processing
- **remark-docx** - DOCX generation
- **AppleScript** - Pages automation
- **Node.js ES Modules** - Modern JavaScript

## Limitations

1. **Mac Only** - AppleScript Pages integration only works on macOS
2. **Pages Required** - For .pages format conversion, Pages must be installed
3. **Formatting Differences** - Some advanced markdown features may not translate perfectly
4. **No Custom Styling** - Currently uses default styles (future enhancement)
5. **Tables** - Complex tables may need manual adjustment in Pages

## Future Enhancements

Planned improvements:
1. **Custom styling templates** - Define fonts, colors, spacing
2. **Batch conversion** - Convert multiple files at once
3. **Watch mode** - Auto-convert on file changes
4. **HTML intermediate** - Alternative conversion path via HTML
5. **PDF export** - Direct markdown to PDF conversion
6. **Style preservation** - Better handling of markdown extensions

## Related Tools

- **MarkdownReporter** - Generates markdown reports from knowledge graphs
- **generate-report.js** - CLI for generating knowledge graph reports
- **demo-full-report.js** - Demo script for end-to-end report generation

## Integration Example

Complete workflow from knowledge graph to Pages document:

```bash
# Step 1: Generate markdown report
node scripts/demo-phase2-plumber-article.js

# Step 2: Convert to Pages format
node scripts/markdown-to-pages.js \
  plumbing-knowledge-graph-phase2-report.md \
  --convert-to-pages \
  --auto-open
```

## API Usage (Programmatic)

You can also use the conversion logic in your own scripts:

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDocx from 'remark-docx';
import { readFile, writeFile } from 'fs/promises';

async function convertMarkdownToDocx(inputPath, outputPath) {
  const markdown = await readFile(inputPath, 'utf-8');

  const processor = unified()
    .use(remarkParse)
    .use(remarkDocx, { output: 'buffer' });

  const result = await processor.process(markdown);
  await writeFile(outputPath, result.result);
}

// Usage
await convertMarkdownToDocx('report.md', 'report.docx');
```

## Support

For issues or questions:
1. Check this documentation
2. Review the script help: `node scripts/markdown-to-pages.js --help`
3. Check [remark-docx documentation](https://github.com/inokawa/remark-docx)
4. Review [AppleScript Pages documentation](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)

## License

MIT License - Part of the Legion Knowledge Management framework
