#!/usr/bin/env node

/**
 * Simple PDF Signing Example
 * 
 * This example demonstrates basic PDF signing functionality:
 * 1. Upload a PDF document
 * 2. Add a signature field
 * 3. Sign the field with a test signature
 * 4. Download the signed PDF
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { 
  createPDFSignerServerActor, 
  MessageTypes 
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a simple test signature image (1x1 pixel PNG)
function createTestSignature() {
  // Base64 encoded 1x1 transparent PNG
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return `data:image/png;base64,${pngBase64}`;
}

// Create a simple test PDF with text
function createSimpleTestPDF() {
  // This creates a minimal PDF document for demonstration
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
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
>>
endobj

4 0 obj
<<
/Length 73
>>
stream
BT
/F1 12 Tf
50 750 Td
(Simple Contract Document) Tj
50 700 Td
(Signature: ___________________) Tj
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

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000100 00000 n 
0000000242 00000 n 
0000000366 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
435
%%EOF`;

  return Buffer.from(pdfContent);
}

async function runSimpleSigningExample() {
  console.log('🔍 Simple PDF Signing Example Starting...\n');

  try {
    // Step 1: Create server actor with basic services
    console.log('📋 Step 1: Setting up PDF Signer Server Actor');
    const services = new Map();
    services.set('resourceManager', {
      get: (key) => {
        if (key === 'env.MONOREPO_ROOT') return process.cwd();
        return null;
      }
    });

    const serverActor = createPDFSignerServerActor(services);
    console.log('✅ Server actor created successfully\n');

    // Step 2: Create and upload test PDF
    console.log('📄 Step 2: Creating and uploading test PDF');
    const pdfBuffer = createSimpleTestPDF();
    const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
      pdfBase64,
      filename: 'simple-contract.pdf'
    });

    if (uploadResponse.type !== MessageTypes.PDF_READY) {
      throw new Error(`Upload failed: ${uploadResponse.data.message}`);
    }

    const documentId = uploadResponse.data.documentId;
    console.log(`✅ PDF uploaded successfully. Document ID: ${documentId}`);
    console.log(`📊 Detected ${uploadResponse.data.signatureFields.length} signature fields\n`);

    // Step 3: Add a signature field manually
    console.log('✍️  Step 3: Adding signature field');
    const doc = serverActor.documents.get(documentId);
    
    // Create a signature field at the signature line location
    const SignatureField = (await import('../src/shared/SignatureTypes.js')).SignatureField;
    const signatureField = new SignatureField({
      documentId: doc.id,
      page: 1,
      rect: { x: 200, y: 680, width: 200, height: 50 }, // Position near signature line
      label: 'Primary Signature',
      required: true
    });

    doc.addField(signatureField);
    console.log(`✅ Signature field added: ${signatureField.label}\n`);

    // Step 4: Sign the document
    console.log('🖊️  Step 4: Signing the document');
    const testSignature = createTestSignature();
    
    const signResponse = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
      documentId,
      fieldId: signatureField.id,
      signatureImage: testSignature,
      metadata: {
        signerName: 'John Doe',
        signerEmail: 'john.doe@example.com',
        timestamp: Date.now(),
        ipAddress: '127.0.0.1'
      }
    });

    if (signResponse.type !== MessageTypes.SIGNATURE_ADDED) {
      throw new Error(`Signing failed: ${signResponse.data.message}`);
    }

    console.log('✅ Document signed successfully');
    console.log(`📋 Remaining fields to sign: ${signResponse.data.remainingFields}\n`);

    // Step 5: Download the signed PDF
    console.log('💾 Step 5: Downloading signed PDF');
    const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
      documentId
    });

    if (downloadResponse.type !== MessageTypes.PDF_DOWNLOAD_READY) {
      throw new Error(`Download failed: ${downloadResponse.data.message}`);
    }

    // Save the signed PDF
    const signedPdfData = downloadResponse.data.pdfBase64.split(',')[1];
    const signedPdfBuffer = Buffer.from(signedPdfData, 'base64');
    const outputPath = join(__dirname, 'signed-simple-contract.pdf');
    
    writeFileSync(outputPath, signedPdfBuffer);
    console.log(`✅ Signed PDF saved to: ${outputPath}`);
    console.log(`📊 Total signatures in document: ${downloadResponse.data.signatures.length}`);
    
    // Display signature information
    if (downloadResponse.data.signatures.length > 0) {
      console.log('\n📝 Signature Details:');
      downloadResponse.data.signatures.forEach((sig, index) => {
        console.log(`   ${index + 1}. Signer: ${sig.signerName}`);
        console.log(`      Email: ${sig.metadata?.signerEmail || 'N/A'}`);
        console.log(`      Date: ${new Date(sig.metadata?.timestamp || 0).toLocaleString()}`);
      });
    }

    // Step 6: Cleanup
    console.log('\n🧹 Step 6: Cleaning up resources');
    serverActor.cleanup();
    console.log('✅ Resources cleaned up successfully');

    console.log('\n🎉 Simple PDF Signing Example Completed Successfully!');
    console.log(`\n📁 Output file: ${outputPath}`);
    console.log('🔍 You can open the signed PDF with any PDF viewer to see the embedded signature.');

  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
    console.error('\n🐛 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSimpleSigningExample();
}

export { runSimpleSigningExample };