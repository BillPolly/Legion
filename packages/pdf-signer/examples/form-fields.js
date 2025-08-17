#!/usr/bin/env node

/**
 * Form Fields Detection Example
 * 
 * This example demonstrates signature field detection in PDFs with form fields:
 * 1. Create a PDF with various form field types
 * 2. Upload and analyze the PDF for signature fields
 * 3. Show field detection capabilities
 * 4. Sign detected fields and embedded signature fields
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import { 
  createPDFSignerServerActor, 
  MessageTypes 
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create signature image
function createTestSignature() {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return `data:image/png;base64,${pngBase64}`;
}

// Create a test PDF with various field types for demonstration
function createFormFieldsTestPDF() {
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/AcroForm <<
/Fields [6 0 R 7 0 R 8 0 R 9 0 R]
/DR <<
/Font <<
/Helv 10 0 R
>>
>>
/DA (/Helv 0 Tf 0 g)
>>
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
/Annots [6 0 R 7 0 R 8 0 R 9 0 R]
>>
endobj

4 0 obj
<<
/Length 320
>>
stream
BT
/F1 16 Tf
50 750 Td
(FORM WITH VARIOUS FIELD TYPES) Tj
/F1 12 Tf
50 700 Td
(This PDF demonstrates different form field types and signature detection.) Tj

50 650 Td
(Name:) Tj
50 620 Td
(Email:) Tj
50 590 Td
(Department:) Tj
50 540 Td
(Employee Signature:) Tj
50 500 Td
(Manager Signature:) Tj

50 450 Td
(Text patterns for signature detection:) Tj
50 420 Td
(Sign here: _____________________) Tj
50 390 Td
(Authorized signature: ___________________) Tj
50 360 Td
(X: ________________________) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

6 0 obj
<<
/Type /Annot
/Subtype /Widget
/FT /Tx
/T (Name)
/Rect [120 645 300 665]
/V ()
/DA (/Helv 12 Tf 0 g)
>>
endobj

7 0 obj
<<
/Type /Annot
/Subtype /Widget
/FT /Tx
/T (Email)
/Rect [120 615 300 635]
/V ()
/DA (/Helv 12 Tf 0 g)
>>
endobj

8 0 obj
<<
/Type /Annot
/Subtype /Widget
/FT /Ch
/T (Department)
/Rect [120 585 300 605]
/V ()
/Opt [(Engineering) (Sales) (Marketing) (Legal)]
/DA (/Helv 12 Tf 0 g)
>>
endobj

9 0 obj
<<
/Type /Annot
/Subtype /Widget
/FT /Sig
/T (EmployeeSignature)
/Rect [180 535 400 555]
/V ()
/DA (/Helv 12 Tf 0 g)
>>
endobj

10 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 11
0000000000 65535 f 
0000000010 00000 n 
0000000188 00000 n 
0000000235 00000 n 
0000000380 00000 n 
0000000752 00000 n 
0000000821 00000 n 
0000000945 00000 n 
0000001070 00000 n 
0000001230 00000 n 
0000001344 00000 n 
trailer
<<
/Size 11
/Root 1 0 R
>>
startxref
1413
%%EOF`;

  return Buffer.from(pdfContent);
}

async function runFormFieldsExample() {
  console.log('📋 Form Fields Detection Example Starting...\n');

  try {
    // Step 1: Create server actor
    console.log('🔧 Step 1: Setting up PDF Signer Server Actor');
    const services = new Map();
    services.set('resourceManager', {
      get: (key) => {
        if (key === 'env.MONOREPO_ROOT') return process.cwd();
        return null;
      }
    });

    const serverActor = createPDFSignerServerActor(services);
    console.log('✅ Server actor created successfully\n');

    // Step 2: Upload form PDF
    console.log('📄 Step 2: Creating and uploading PDF with form fields');
    const pdfBuffer = createFormFieldsTestPDF();
    const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
      pdfBase64,
      filename: 'form-with-fields.pdf'
    });

    if (uploadResponse.type !== MessageTypes.PDF_READY) {
      throw new Error(`Upload failed: ${uploadResponse.data.message}`);
    }

    const documentId = uploadResponse.data.documentId;
    console.log(`✅ PDF uploaded successfully. Document ID: ${documentId}`);

    // Step 3: Analyze detected signature fields
    console.log('\n🔍 Step 3: Analyzing detected signature fields');
    const detectedFields = uploadResponse.data.signatureFields || [];
    console.log(`📊 Automatic detection found: ${detectedFields.length} signature fields`);

    if (detectedFields.length > 0) {
      console.log('\n📝 Detected signature fields:');
      detectedFields.forEach((field, index) => {
        console.log(`   ${index + 1}. ${field.label || `Field ${field.id}`}`);
        console.log(`      📍 Page: ${field.page}, Position: (${field.rect?.x || 0}, ${field.rect?.y || 0})`);
        console.log(`      📏 Size: ${field.rect?.width || 0} x ${field.rect?.height || 0}`);
        console.log(`      ✅ Required: ${field.required ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('   ℹ️  No signature fields detected automatically');
    }

    // Step 4: Demonstrate field detection strategies
    console.log('\n🧠 Step 4: Demonstrating field detection strategies');
    
    const doc = serverActor.documents.get(documentId);
    const processor = serverActor.processor;

    // Test form field detection
    console.log('\n📋 Form Field Analysis:');
    try {
      const formFields = await processor.detectFormFields(doc);
      console.log(`   🔍 Form-based detection: ${formFields.length} signature fields`);
      formFields.forEach((field, index) => {
        console.log(`      ${index + 1}. ${field.label} (${field.id})`);
      });
    } catch (error) {
      console.log(`   ⚠️  Form field detection failed: ${error.message}`);
    }

    // Test text pattern detection
    console.log('\n📝 Text Pattern Analysis:');
    try {
      const textFields = await processor.detectTextPatterns(doc);
      console.log(`   🔍 Pattern-based detection: ${textFields.length} signature fields`);
      textFields.forEach((field, index) => {
        console.log(`      ${index + 1}. ${field.label} at (${field.rect.x}, ${field.rect.y})`);
      });
    } catch (error) {
      console.log(`   ⚠️  Text pattern detection failed: ${error.message}`);
    }

    // Step 5: Add additional signature fields manually
    console.log('\n➕ Step 5: Adding additional signature fields');
    const SignatureField = (await import('../src/shared/SignatureTypes.js')).SignatureField;

    const additionalFields = [
      {
        id: 'manager-signature',
        label: 'Manager Approval Signature',
        rect: { x: 180, y: 495, width: 200, height: 50 },
        required: true
      },
      {
        id: 'witness-signature', 
        label: 'Witness Signature',
        rect: { x: 180, y: 320, width: 200, height: 50 },
        required: false
      }
    ];

    const allFields = [];
    
    // Add detected fields to our list
    detectedFields.forEach(field => {
      allFields.push(field);
    });

    // Add manual fields
    additionalFields.forEach(fieldData => {
      const field = new SignatureField({
        documentId: doc.id,
        page: 1,
        rect: fieldData.rect,
        label: fieldData.label,
        required: fieldData.required
      });
      field.id = fieldData.id;
      
      doc.addField(field);
      allFields.push(field);
      console.log(`   ✅ Added: ${field.label}`);
    });

    console.log(`\n📊 Total signature fields available: ${allFields.length}`);

    // Step 6: Sign selected fields
    console.log('\n🖊️  Step 6: Signing selected fields');
    
    const signingPlan = [
      { fieldId: 'manager-signature', signer: 'Jane Manager', email: 'jane.manager@company.com' },
      { fieldId: 'witness-signature', signer: 'John Witness', email: 'john.witness@company.com' }
    ];

    // Add any detected signature fields to signing plan
    detectedFields.forEach(field => {
      if (field.id && !signingPlan.some(plan => plan.fieldId === field.id)) {
        signingPlan.push({
          fieldId: field.id,
          signer: 'Auto Detected Signer',
          email: 'auto@example.com'
        });
      }
    });

    console.log(`📋 Signing plan: ${signingPlan.length} signatures to collect\n`);

    let signedCount = 0;
    for (const plan of signingPlan) {
      // Check if field exists
      const field = doc.getField(plan.fieldId);
      if (!field) {
        console.log(`   ⚠️  Skipping ${plan.fieldId}: Field not found`);
        continue;
      }

      console.log(`📝 Collecting signature from: ${plan.signer}`);
      
      const signResponse = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: plan.fieldId,
        signatureImage: createTestSignature(),
        metadata: {
          signerName: plan.signer,
          signerEmail: plan.email,
          timestamp: Date.now() + (signedCount * 500),
          ipAddress: `10.0.0.${100 + signedCount}`,
          fieldType: 'detected'
        }
      });

      if (signResponse.type === MessageTypes.SIGNATURE_ADDED) {
        signedCount++;
        console.log(`   ✅ ${plan.signer} signed successfully`);
        console.log(`   📊 Progress: ${signedCount}/${signingPlan.length} signatures`);
      } else {
        console.log(`   ❌ Failed to collect signature from ${plan.signer}: ${signResponse.data.message}`);
      }
    }

    // Step 7: Display field status summary
    console.log('\n📋 Step 7: Field Status Summary');
    const allDocFields = Array.from(doc.fields.values());
    console.log(`\n📊 Field Status Report:`);
    console.log(`   📝 Total fields: ${allDocFields.length}`);
    console.log(`   ✅ Signed fields: ${allDocFields.filter(f => f.signed).length}`);
    console.log(`   ⏳ Pending fields: ${allDocFields.filter(f => !f.signed).length}`);

    console.log('\n📝 Detailed Field Information:');
    allDocFields.forEach((field, index) => {
      const status = field.signed ? '✅ SIGNED' : '⏳ PENDING';
      const required = field.required ? '(Required)' : '(Optional)';
      console.log(`   ${index + 1}. ${field.label} ${required} - ${status}`);
      console.log(`      📍 Position: (${field.rect.x}, ${field.rect.y}) Size: ${field.rect.width}x${field.rect.height}`);
      if (field.signed) {
        console.log(`      👤 Signed by: ${field.signerName || 'Unknown'}`);
      }
    });

    // Step 8: Download the signed PDF
    console.log('\n💾 Step 8: Downloading signed PDF');
    const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
      documentId
    });

    if (downloadResponse.type !== MessageTypes.PDF_DOWNLOAD_READY) {
      throw new Error(`Download failed: ${downloadResponse.data.message}`);
    }

    const signedPdfData = downloadResponse.data.pdfBase64.split(',')[1];
    const signedPdfBuffer = Buffer.from(signedPdfData, 'base64');
    const outputPath = join(__dirname, 'signed-form-with-fields.pdf');
    
    writeFileSync(outputPath, signedPdfBuffer);
    console.log(`✅ Signed PDF saved to: ${outputPath}`);

    // Step 9: Generate field analysis report
    console.log('\n📊 Step 9: Generating field analysis report');
    const signatures = serverActor.signatureManager.getDocumentSignatures(documentId);
    
    const fieldReport = {
      documentId,
      documentName: 'form-with-fields.pdf',
      analysis: {
        totalFieldsDetected: detectedFields.length,
        totalFieldsAdded: allDocFields.length,
        detectionStrategies: [
          'AcroForm field analysis',
          'Text pattern recognition',
          'Manual field placement'
        ]
      },
      fields: allDocFields.map(field => ({
        id: field.id,
        label: field.label,
        position: field.rect,
        required: field.required,
        signed: field.signed,
        signerName: field.signerName
      })),
      signatures: signatures.map(sig => ({
        fieldId: sig.fieldId,
        signerName: sig.signerName,
        email: sig.metadata?.signerEmail,
        timestamp: new Date(sig.metadata?.timestamp || 0).toISOString()
      })),
      summary: {
        totalSignatures: signatures.length,
        completionRate: `${Math.round((signatures.length / allDocFields.length) * 100)}%`,
        generatedAt: new Date().toISOString()
      }
    };

    const reportPath = join(__dirname, 'field-analysis-report.json');
    writeFileSync(reportPath, JSON.stringify(fieldReport, null, 2));
    console.log(`✅ Field analysis report saved to: ${reportPath}`);

    // Step 10: Cleanup
    console.log('\n🧹 Step 10: Cleaning up resources');
    serverActor.cleanup();
    console.log('✅ Resources cleaned up successfully');

    console.log('\n🎉 Form Fields Detection Example Completed Successfully!');
    console.log(`\n📁 Output files:`);
    console.log(`   📄 Signed PDF: ${outputPath}`);
    console.log(`   📊 Analysis Report: ${reportPath}`);
    console.log('\n🔍 This example demonstrated:');
    console.log('   • Automatic signature field detection from form fields');
    console.log('   • Text pattern recognition for signature areas');
    console.log('   • Manual signature field placement');
    console.log('   • Field status tracking and reporting');

  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
    console.error('\n🐛 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runFormFieldsExample();
}

export { runFormFieldsExample };