# 🚀 Quick Start: Markdown to Pages Converter

## Installation

### Step 1: Install Dependencies

The required dependencies have been added to `package.json`. Install them:

```bash
cd /Users/maxximus/Documents/max-projects/pocs/Legion

# Try npm install from root
npm install
```

**Note:** If you encounter "workspace:" protocol errors, you may need to:
- Use `pnpm install` if this project uses pnpm
- Or manually install in the ontology package:
  ```bash
  cd packages/km/ontology
  npm install remark@^15.0.1 remark-parse@^11.0.0 remark-docx@^4.0.3 unified@^11.0.4 to-vfile@^8.0.0
  ```

### Step 2: Verify Installation

```bash
cd packages/km/ontology
node scripts/markdown-to-pages.js --help
```

You should see the help message with usage instructions.

## Quick Test

### Test 1: Convert Phase 2 Report to DOCX

```bash
cd packages/km/ontology

node scripts/markdown-to-pages.js plumbing-knowledge-graph-phase2-report.md
```

**Expected output:**
```
🚀 MARKDOWN TO PAGES CONVERTER

======================================================================

📋 Configuration:
   Input:  /Users/maxximus/.../plumbing-knowledge-graph-phase2-report.md
   Output: /Users/maxximus/.../plumbing-knowledge-graph-phase2-report.docx
   Auto-open: false
   Convert to Pages: false
   Keep DOCX: false

📄 Reading markdown file: plumbing-knowledge-graph-phase2-report.md
✅ Read 23456 characters

🔄 Converting markdown to DOCX...
✅ Generated DOCX buffer (45678 bytes)

💾 Writing DOCX file: plumbing-knowledge-graph-phase2-report.docx
✅ DOCX file created successfully

======================================================================

✨ SUCCESS!

📄 Output file: plumbing-knowledge-graph-phase2-report.docx

📊 File size: 44.61 KB
```

### Test 2: Convert and Open in Pages

```bash
node scripts/markdown-to-pages.js \
  plumbing-knowledge-graph-phase2-report.md \
  --auto-open
```

This will:
1. Create the DOCX file
2. Automatically open it in Pages
3. You can then manually save as Pages format if desired

### Test 3: Full Conversion to Pages Format

```bash
node scripts/markdown-to-pages.js \
  plumbing-knowledge-graph-phase2-report.md \
  --convert-to-pages
```

This will:
1. Create DOCX file
2. Use AppleScript to open in Pages
3. Export to native .pages format
4. Remove intermediate DOCX file
5. Leave you with `plumbing-knowledge-graph-phase2-report.pages`

**Note:** This requires Pages to be installed and may show a permissions dialog on first run.

## Common Usage Patterns

### Pattern 1: Simple DOCX Export

```bash
# Convert any markdown file
node scripts/markdown-to-pages.js my-document.md
```

### Pattern 2: Custom Output Location

```bash
# Save to specific location
node scripts/markdown-to-pages.js report.md -o ~/Documents/MyReport.docx
```

### Pattern 3: Complete Workflow

```bash
# Generate report → Convert to Pages → Open
node scripts/demo-phase2-plumber-article.js && \
node scripts/markdown-to-pages.js \
  plumbing-knowledge-graph-phase2-report.md \
  --convert-to-pages \
  --auto-open
```

## What Was Created

### 1. Main Converter Script
**File:** `scripts/markdown-to-pages.js`
- Full-featured CLI tool
- Handles markdown → DOCX conversion
- Optional AppleScript automation
- Progress logging and error handling

### 2. AppleScript Helper
**File:** `scripts/lib/convert-to-pages.applescript`
- Standalone AppleScript for DOCX → Pages
- Can be used independently:
  ```bash
  osascript scripts/lib/convert-to-pages.applescript input.docx output.pages
  ```

### 3. Documentation
**File:** `docs/MARKDOWN_TO_PAGES.md`
- Complete feature documentation
- API usage examples
- Troubleshooting guide
- Architecture overview

### 4. Dependencies Added to package.json
```json
{
  "remark": "^15.0.1",
  "remark-parse": "^11.0.0",
  "remark-docx": "^4.0.3",
  "unified": "^11.0.4",
  "to-vfile": "^8.0.0"
}
```

## Troubleshooting

### Can't Find Module Errors

**Problem:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'unified'
```

**Solution:**
Dependencies not installed. Run:
```bash
cd packages/km/ontology
npm install
```

### AppleScript Permission Denied

**Problem:**
```
Conversion failed: Not authorized to send Apple events to Pages
```

**Solution:**
1. Go to System Preferences → Privacy & Security → Automation
2. Allow Terminal (or your IDE) to control Pages
3. Try the conversion again

### Pages Not Installed

**Problem:**
```
Application "Pages" isn't running
```

**Solution:**
- Install Pages from Mac App Store (free with macOS)
- For DOCX-only conversion, don't use `--convert-to-pages` flag

## Next Steps

1. **Try the converter** with the Phase 2 report
2. **Check the output** in Pages to verify formatting
3. **Integrate into your workflow** - use with report generation scripts
4. **Read full docs** at `docs/MARKDOWN_TO_PAGES.md`
5. **Customize if needed** - the script is fully modifiable

## Summary

✅ **Created:**
- Full markdown → DOCX → Pages converter
- CLI tool with multiple options
- AppleScript automation for Pages
- Comprehensive documentation

✅ **Added Dependencies:**
- remark ecosystem for markdown processing
- remark-docx for DOCX generation

✅ **Ready to Use:**
```bash
cd packages/km/ontology
node scripts/markdown-to-pages.js plumbing-knowledge-graph-phase2-report.md --auto-open
```

🎉 **You're all set!**
