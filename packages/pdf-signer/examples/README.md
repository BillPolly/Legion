# PDF Signer Examples

This directory contains example applications demonstrating the PDF Signer functionality. Each example shows different use cases and capabilities of the @legion/pdf-signer package.

## Prerequisites

1. Install dependencies in the main package:
   ```bash
   cd .. # Go to pdf-signer root directory
   npm install
   ```

2. Ensure all tests pass:
   ```bash
   npm test
   ```

## Available Examples

### 1. Simple Signing Example (`simple-signing.js`)

**Purpose**: Demonstrates basic PDF signing workflow

**Features**:
- Upload a PDF document
- Add a signature field
- Sign the field with a test signature
- Download the signed PDF

**Usage**:
```bash
node simple-signing.js
```

**Output**:
- `signed-simple-contract.pdf` - The signed PDF document

**What it demonstrates**:
- Basic server actor setup
- PDF upload and processing
- Manual signature field creation
- Signature capture and embedding
- PDF download with signatures

---

### 2. Multi-Signer Example (`multi-signer.js`)

**Purpose**: Shows multiple parties signing the same document

**Features**:
- Upload a multi-party agreement PDF
- Multiple signature fields for different signers
- Track completion progress
- Generate audit reports

**Usage**:
```bash
node multi-signer.js
```

**Output**:
- `signed-multi-party-agreement.pdf` - The fully signed PDF
- `signature-audit-report.json` - Detailed audit trail

**What it demonstrates**:
- Multi-signer workflows
- Signature progress tracking
- Metadata collection for each signer
- Audit trail generation
- Document completion verification

---

### 3. Form Fields Example (`form-fields.js`)

**Purpose**: Demonstrates signature field detection in PDFs with forms

**Features**:
- Create PDF with various form field types
- Automatic signature field detection
- Text pattern recognition
- Field status tracking

**Usage**:
```bash
node form-fields.js
```

**Output**:
- `signed-form-with-fields.pdf` - The signed form document
- `field-analysis-report.json` - Field detection analysis

**What it demonstrates**:
- AcroForm signature field detection
- Text pattern-based field discovery
- Manual field placement
- Field metadata and labeling
- Detection strategy comparison

## Understanding the Output

### PDF Files

All generated PDF files contain embedded signatures and can be opened with any standard PDF viewer:

- **Adobe Acrobat Reader**: Will show signature indicators
- **Preview (macOS)**: Will display the embedded signature images
- **Chrome/Firefox**: Can view the PDFs with signatures visible
- **Any PDF viewer**: Should render the signatures as embedded images

### JSON Reports

The example applications generate detailed JSON reports containing:

- **Signature metadata**: Signer names, emails, timestamps, IP addresses
- **Field information**: Positions, labels, requirements, completion status
- **Audit trails**: Complete signing history and verification data
- **Detection analysis**: How fields were discovered and processed

## Running All Examples

To run all examples in sequence:

```bash
# Run each example individually
node simple-signing.js
node multi-signer.js  
node form-fields.js

# Or create a simple script to run all
echo "Running all PDF Signer examples..."
for example in simple-signing.js multi-signer.js form-fields.js; do
  echo "Running $example..."
  node "$example"
  echo "✅ $example completed"
  echo ""
done
echo "🎉 All examples completed!"
```

## Example Structure

Each example follows a consistent structure:

1. **Setup**: Create server actor with services
2. **Upload**: Load test PDF document
3. **Field Management**: Add/detect signature fields
4. **Signing**: Collect signatures from users
5. **Download**: Generate signed PDF
6. **Reporting**: Create audit reports
7. **Cleanup**: Release resources

## Customization

### Adding Your Own PDFs

Replace the test PDF generation functions with real PDF files:

```javascript
import { readFileSync } from 'fs';

// Instead of createTestPDF()
const pdfBuffer = readFileSync('path/to/your/document.pdf');
const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
```

### Custom Signature Images

Replace the test signature generation with real signature capture:

```javascript
// Use actual signature pad data
const signatureImage = 'data:image/png;base64,<actual_signature_data>';
```

### Integration with Web Applications

These examples can be adapted for web applications by:

1. Using the client actor for browser-based UI
2. Setting up WebSocket communication between client and server
3. Integrating with existing authentication systems
4. Adding real file upload/download handling

## Troubleshooting

### Common Issues

1. **"Module not found" errors**:
   - Ensure you're running from the examples directory
   - Check that dependencies are installed in the parent directory

2. **PDF generation errors**:
   - Verify pdf-lib is properly installed
   - Check that test PDF creation functions work

3. **Signature embedding failures**:
   - Ensure signature images are valid base64 PNG data
   - Check that field coordinates are within PDF bounds

### Debug Mode

Add debug logging to any example:

```javascript
// Add at the top of any example file
console.log('Debug mode enabled');
const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog('[DEBUG]', new Date().toISOString(), ...args);
};
```

## Next Steps

After running these examples, you can:

1. **Integrate with Legion Server Framework**: Use the actor factory functions to register PDF signing routes
2. **Build Web UI**: Create browser-based interfaces using the client actors
3. **Add Authentication**: Integrate with existing user management systems
4. **Scale for Production**: Add database storage, load balancing, and security features
5. **Customize Workflows**: Adapt the signing process for your specific business requirements

## Support

For issues or questions about these examples:

1. Check the main package documentation
2. Review test files for additional usage patterns
3. Examine the DESIGN.md file for architectural details
4. Run the test suite to verify functionality