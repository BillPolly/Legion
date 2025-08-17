# User Acceptance Testing (UAT) Scenarios

This document outlines comprehensive User Acceptance Testing scenarios for the PDF Signer functionality. These scenarios are designed to validate that the system meets all specified requirements and performs correctly in real-world usage patterns.

## Prerequisites

### Test Environment Setup

1. **Node.js Environment**:
   ```bash
   node --version  # Should be >= 18.0.0
   npm --version   # Should be >= 8.0.0
   ```

2. **Package Installation**:
   ```bash
   npm install
   npm test  # Verify all tests pass
   ```

3. **Test Data Preparation**:
   - Simple PDF contract (1-2 pages)
   - Complex multi-page PDF with forms
   - Invalid file formats (.txt, .jpg, etc.)
   - Large PDF file (5-10MB)
   - PDF with existing signature fields

### Success Criteria

Each scenario must pass all acceptance criteria without errors, exceptions, or unexpected behavior.

---

## Scenario 1: Basic PDF Upload and Signing

### Objective
Verify that users can upload a PDF, add signature fields, sign the document, and download the signed PDF.

### Test Steps

1. **Setup**:
   ```bash
   node examples/simple-signing.js
   ```

2. **Verification Points**:
   - [ ] PDF uploads successfully without errors
   - [ ] System processes PDF and returns document ID
   - [ ] Signature field is added at correct coordinates
   - [ ] Signature image is embedded properly
   - [ ] Signed PDF downloads successfully
   - [ ] Downloaded PDF contains visible signature
   - [ ] File size is reasonable (not corrupted)

### Acceptance Criteria
- ✅ Complete workflow executes without errors
- ✅ Output PDF file exists and is valid
- ✅ Signature appears in correct location
- ✅ Console shows success messages at each step
- ✅ Resource cleanup completes successfully

### Expected Output Files
- `signed-simple-contract.pdf` - Valid PDF with embedded signature

---

## Scenario 2: Multi-Signer Workflow

### Objective
Validate that multiple parties can sign the same document with proper tracking and audit trails.

### Test Steps

1. **Setup**:
   ```bash
   node examples/multi-signer.js
   ```

2. **Verification Points**:
   - [ ] PDF with multiple signature fields uploads
   - [ ] Each signer can add their signature to designated field
   - [ ] Progress tracking shows completion status
   - [ ] All signatures are preserved in final document
   - [ ] Audit report contains all signing events
   - [ ] Signatures have proper metadata (names, emails, timestamps)

### Acceptance Criteria
- ✅ All three signers complete their signatures
- ✅ Progress tracking accurately reflects completion
- ✅ Final PDF contains all three signatures
- ✅ Audit report contains complete signing history
- ✅ Timestamps are in proper chronological order
- ✅ No signatures are lost or corrupted

### Expected Output Files
- `signed-multi-party-agreement.pdf` - PDF with three signatures
- `signature-audit-report.json` - Complete audit trail

---

## Scenario 3: Form Field Detection and Processing

### Objective
Test automatic signature field detection and handling of various form field types.

### Test Steps

1. **Setup**:
   ```bash
   node examples/form-fields.js
   ```

2. **Verification Points**:
   - [ ] System detects existing signature fields in PDF forms
   - [ ] Text pattern recognition finds signature areas
   - [ ] Manual field placement works correctly
   - [ ] All field types are processed appropriately
   - [ ] Field status tracking is accurate
   - [ ] Analysis report shows detection strategies

### Acceptance Criteria
- ✅ Automatic field detection identifies form signature fields
- ✅ Text patterns like "Sign here:" are recognized
- ✅ Manual fields can be added at specific coordinates
- ✅ Field status correctly tracks signed/unsigned state
- ✅ Analysis report contains comprehensive field information
- ✅ All signatures embed properly regardless of detection method

### Expected Output Files
- `signed-form-with-fields.pdf` - PDF with various signature types
- `field-analysis-report.json` - Field detection analysis

---

## Scenario 4: Error Handling and Edge Cases

### Objective
Verify that the system gracefully handles error conditions and invalid inputs.

### Test Cases

#### 4.1: Invalid File Upload
```javascript
// Test with non-PDF file
const invalidFile = Buffer.from('This is not a PDF');
const response = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
  pdfBase64: `data:application/pdf;base64,${invalidFile.toString('base64')}`,
  filename: 'invalid.pdf'
});
```

**Expected**: Error message about invalid PDF format

#### 4.2: Missing Document Access
```javascript
const response = await serverActor.receive(MessageTypes.GET_SIGNATURE_FIELDS, {
  documentId: 'non-existent-document'
});
```

**Expected**: Error message "Document not found"

#### 4.3: Invalid Signature Data
```javascript
const response = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
  documentId: validDocId,
  fieldId: validFieldId,
  signatureImage: 'invalid-image-data'
});
```

**Expected**: Error message about invalid signature format

#### 4.4: Oversized File Handling
Upload a very large PDF (>10MB) and verify appropriate handling.

### Acceptance Criteria
- ✅ All error conditions return appropriate error messages
- ✅ No system crashes or unhandled exceptions
- ✅ Error messages are user-friendly and informative
- ✅ System continues to function after error conditions
- ✅ Resources are properly cleaned up after errors

---

## Scenario 5: Performance and Scalability

### Objective
Validate system performance with various document sizes and concurrent operations.

### Test Cases

#### 5.1: Large Document Processing
- Upload 50+ page PDF document
- Add multiple signature fields
- Complete signing workflow

#### 5.2: High-Resolution Signatures
- Use high-resolution signature images (1000x500 pixels)
- Verify embedding performance and output quality

#### 5.3: Multiple Document Sessions
- Create multiple server actors
- Process different documents simultaneously
- Verify session isolation

### Performance Benchmarks
- PDF upload/processing: < 5 seconds for 10MB file
- Signature embedding: < 2 seconds per signature
- Document download: < 3 seconds for signed PDF
- Memory usage: < 100MB per active document session

### Acceptance Criteria
- ✅ Large documents process within acceptable time limits
- ✅ High-resolution signatures embed without quality loss
- ✅ Multiple sessions operate independently
- ✅ Memory usage remains within reasonable bounds
- ✅ No memory leaks after session cleanup

---

## Scenario 6: Data Integrity and Security

### Objective
Ensure data integrity, proper metadata handling, and security considerations.

### Test Cases

#### 6.1: Signature Metadata Verification
```javascript
const metadata = {
  signerName: 'John Doe',
  signerEmail: 'john@example.com',
  timestamp: Date.now(),
  ipAddress: '192.168.1.100',
  userAgent: 'Test Browser'
};
```

Verify all metadata is preserved and retrievable.

#### 6.2: Document Tampering Detection
- Sign a document
- Attempt to modify signature fields after signing
- Verify appropriate error handling

#### 6.3: Session Isolation
- Create multiple client sessions
- Verify documents cannot be accessed across sessions
- Test cleanup of session-specific data

### Acceptance Criteria
- ✅ All signature metadata is accurately stored and retrieved
- ✅ Signed fields cannot be modified inappropriately
- ✅ Sessions are properly isolated from each other
- ✅ Sensitive data is not exposed in error messages
- ✅ Resource cleanup removes all session data

---

## Scenario 7: Integration with Legion Framework

### Objective
Validate proper integration with the Legion Server Framework.

### Test Steps

1. **Factory Function Testing**:
   ```bash
   npm test -- __tests__/integration/ActorFactory.test.js
   ```

2. **Actor Communication Testing**:
   ```bash
   npm test -- __tests__/integration/ActorCommunication.test.js
   ```

3. **Service Injection Verification**:
   Verify server actors receive and use injected services correctly.

### Acceptance Criteria
- ✅ Actor factory functions create valid instances
- ✅ Server and client actors communicate bidirectionally
- ✅ Service injection works with resource manager
- ✅ Actor protocol compliance is maintained
- ✅ Integration follows Legion framework patterns

---

## Scenario 8: Browser Compatibility (Manual Testing)

### Objective
Verify client-side functionality works across different browsers.

### Test Environment Setup
1. Create a simple HTML page with PDF Signer client
2. Test in multiple browsers:
   - Chrome (latest)
   - Firefox (latest)
   - Safari (if available)
   - Edge (latest)

### Test Steps
1. Load PDF in browser
2. Display signature fields
3. Capture signature using signature pad
4. Verify PDF rendering

### Acceptance Criteria
- ✅ PDF.js renders documents correctly in all browsers
- ✅ Signature pad captures input properly
- ✅ No JavaScript errors in browser console
- ✅ Responsive behavior on different screen sizes

---

## Manual Test Execution Checklist

### Pre-Test Setup
- [ ] Development environment is set up
- [ ] All dependencies are installed
- [ ] Test suite passes completely
- [ ] Example files are ready

### During Testing
- [ ] Document all test results
- [ ] Capture screenshots of any issues
- [ ] Note performance characteristics
- [ ] Record any unexpected behavior

### Post-Test Validation
- [ ] All generated files are valid
- [ ] No temporary files are left behind
- [ ] System returns to clean state
- [ ] All resources are properly released

## Test Data Requirements

### PDF Documents Needed
1. **Simple Contract** (1-2 pages, no forms)
2. **Multi-Page Agreement** (5+ pages, multiple signature areas)
3. **Form Document** (with AcroForm signature fields)
4. **Large Document** (50+ pages, 5-10MB)
5. **Invalid Files** (non-PDF formats for error testing)

### Signature Images
1. **Simple signature** (basic pen stroke)
2. **Complex signature** (detailed drawing)
3. **High-resolution signature** (1000x500 pixels)
4. **Invalid image data** (for error testing)

## Success Criteria Summary

The UAT is considered successful when:

1. **All automated examples run without errors**
2. **All manual test scenarios pass acceptance criteria**
3. **Performance benchmarks are met**
4. **Error handling behaves appropriately**
5. **Generated files are valid and complete**
6. **System properly cleans up resources**
7. **Integration with Legion framework works correctly**

## Reporting Test Results

Document results in the following format:

```
Scenario: [Name]
Status: PASS/FAIL
Execution Time: [Duration]
Issues Found: [List any problems]
Notes: [Additional observations]
```

## Troubleshooting Common Issues

### PDF Generation Problems
- Verify pdf-lib dependency is correctly installed
- Check that test PDFs have valid structure
- Ensure base64 encoding is correct

### Signature Embedding Failures
- Validate signature image format (PNG required)
- Check field coordinates are within PDF bounds
- Verify signature image is not corrupted

### Memory or Performance Issues
- Monitor Node.js memory usage during tests
- Check for proper cleanup after each test
- Verify no event listeners or timers are left running

This comprehensive UAT ensures the PDF Signer functionality meets all requirements and performs reliably in real-world scenarios.