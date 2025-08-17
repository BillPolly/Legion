#!/usr/bin/env node

/**
 * Multi-Signer PDF Example
 * 
 * This example demonstrates multiple signers signing the same document:
 * 1. Upload a PDF document with multiple signature fields
 * 2. Multiple signers add their signatures
 * 3. Track completion progress
 * 4. Download the fully signed PDF
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

// Create different signature images for different signers
function createSignatureForSigner(signerName) {
  // Create a simple colored signature based on signer name
  const colors = {
    'Alice Johnson': 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // red
    'Bob Smith': 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // blue
    'Carol Davis': 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABUlEQVR42mNkZGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==' // green
  };
  
  const base64 = colors[signerName] || colors['Alice Johnson'];
  return `data:image/png;base64,${base64}`;
}

// Create a complex test PDF with multiple signature areas
function createMultiSignerTestPDF() {
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
/Length 250
>>
stream
BT
/F1 14 Tf
50 750 Td
(MULTI-PARTY AGREEMENT) Tj
/F1 12 Tf
50 720 Td
(This agreement requires signatures from all parties below:) Tj

50 650 Td
(Party A - Project Manager:) Tj
50 630 Td
(Signature: ___________________  Date: ___________) Tj

50 580 Td
(Party B - Technical Lead:) Tj
50 560 Td
(Signature: ___________________  Date: ___________) Tj

50 510 Td
(Party C - Legal Counsel:) Tj
50 490 Td
(Signature: ___________________  Date: ___________) Tj

50 440 Td
(All signatures must be present for this agreement to be valid.) Tj
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
0000000544 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
613
%%EOF`;

  return Buffer.from(pdfContent);
}

async function runMultiSignerExample() {
  console.log('👥 Multi-Signer PDF Example Starting...\n');

  try {
    // Step 1: Create server actor
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

    // Step 2: Upload test PDF
    console.log('📄 Step 2: Creating and uploading multi-party agreement PDF');
    const pdfBuffer = createMultiSignerTestPDF();
    const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    const uploadResponse = await serverActor.receive(MessageTypes.UPLOAD_PDF, {
      pdfBase64,
      filename: 'multi-party-agreement.pdf'
    });

    if (uploadResponse.type !== MessageTypes.PDF_READY) {
      throw new Error(`Upload failed: ${uploadResponse.data.message}`);
    }

    const documentId = uploadResponse.data.documentId;
    console.log(`✅ PDF uploaded successfully. Document ID: ${documentId}\n`);

    // Step 3: Add signature fields for each party
    console.log('✍️  Step 3: Adding signature fields for each party');
    const doc = serverActor.documents.get(documentId);
    const SignatureField = (await import('../src/shared/SignatureTypes.js')).SignatureField;

    const signerFields = [
      {
        id: 'party-a-signature',
        label: 'Party A - Project Manager',
        signer: 'Alice Johnson',
        email: 'alice.johnson@company.com',
        rect: { x: 150, y: 610, width: 180, height: 40 }
      },
      {
        id: 'party-b-signature', 
        label: 'Party B - Technical Lead',
        signer: 'Bob Smith',
        email: 'bob.smith@company.com',
        rect: { x: 150, y: 540, width: 180, height: 40 }
      },
      {
        id: 'party-c-signature',
        label: 'Party C - Legal Counsel', 
        signer: 'Carol Davis',
        email: 'carol.davis@legal.com',
        rect: { x: 150, y: 470, width: 180, height: 40 }
      }
    ];

    // Create and add signature fields
    const signatureFields = [];
    signerFields.forEach(fieldData => {
      const field = new SignatureField({
        documentId: doc.id,
        page: 1,
        rect: fieldData.rect,
        label: fieldData.label,
        required: true
      });
      field.id = fieldData.id; // Set custom ID
      field.signerName = fieldData.signer;
      field.signerEmail = fieldData.email;
      
      doc.addField(field);
      signatureFields.push(field);
      console.log(`   ✅ Added field: ${field.label} (${field.signerName})`);
    });

    console.log(`\n📊 Total signature fields required: ${signatureFields.length}\n`);

    // Step 4: Simulate multiple signers signing the document
    console.log('🖊️  Step 4: Processing signatures from multiple parties\n');

    let completedSignatures = 0;
    
    for (const field of signatureFields) {
      console.log(`📝 Processing signature from: ${field.signerName}`);
      
      const signatureImage = createSignatureForSigner(field.signerName);
      
      const signResponse = await serverActor.receive(MessageTypes.ADD_SIGNATURE, {
        documentId,
        fieldId: field.id,
        signatureImage,
        metadata: {
          signerName: field.signerName,
          signerEmail: field.signerEmail,
          timestamp: Date.now() + (completedSignatures * 1000), // Stagger timestamps
          ipAddress: `192.168.1.${100 + completedSignatures}`,
          userAgent: 'PDF Signer Example'
        }
      });

      if (signResponse.type !== MessageTypes.SIGNATURE_ADDED) {
        throw new Error(`Signing failed for ${field.signerName}: ${signResponse.data.message}`);
      }

      completedSignatures++;
      const remainingFields = signResponse.data.remainingFields;
      
      console.log(`   ✅ ${field.signerName} signed successfully`);
      console.log(`   📊 Progress: ${completedSignatures}/${signatureFields.length} signatures complete`);
      console.log(`   📋 Remaining fields: ${remainingFields}`);
      
      if (remainingFields === 0) {
        console.log('   🎉 All required signatures collected!\n');
      } else {
        console.log('   ⏳ Waiting for remaining signatures...\n');
      }
    }

    // Step 5: Verify all signatures are present
    console.log('🔍 Step 5: Verifying signature completion');
    const signatures = serverActor.signatureManager.getDocumentSignatures(documentId);
    console.log(`✅ Total signatures in document: ${signatures.length}`);

    // Display signature summary
    console.log('\n📝 Signature Summary:');
    signatures.forEach((sig, index) => {
      const signingTime = new Date(sig.metadata?.timestamp || 0);
      console.log(`   ${index + 1}. ${sig.signerName} (${sig.metadata?.signerEmail || 'No email'})`);
      console.log(`      📅 Signed: ${signingTime.toLocaleString()}`);
      console.log(`      🌐 IP: ${sig.metadata?.ipAddress || 'Unknown'}`);
    });

    // Step 6: Download the fully signed PDF
    console.log('\n💾 Step 6: Downloading fully signed PDF');
    const downloadResponse = await serverActor.receive(MessageTypes.DOWNLOAD_PDF, {
      documentId
    });

    if (downloadResponse.type !== MessageTypes.PDF_DOWNLOAD_READY) {
      throw new Error(`Download failed: ${downloadResponse.data.message}`);
    }

    // Save the signed PDF
    const signedPdfData = downloadResponse.data.pdfBase64.split(',')[1];
    const signedPdfBuffer = Buffer.from(signedPdfData, 'base64');
    const outputPath = join(__dirname, 'signed-multi-party-agreement.pdf');
    
    writeFileSync(outputPath, signedPdfBuffer);
    console.log(`✅ Fully signed PDF saved to: ${outputPath}`);

    // Step 7: Generate signature audit report
    console.log('\n📊 Step 7: Generating signature audit report');
    const auditReport = {
      documentId,
      documentName: 'multi-party-agreement.pdf',
      totalSignaturesRequired: signatureFields.length,
      totalSignaturesCollected: signatures.length,
      isComplete: signatures.length === signatureFields.length,
      signers: signatures.map(sig => ({
        name: sig.signerName,
        email: sig.metadata?.signerEmail,
        signedAt: new Date(sig.metadata?.timestamp || 0).toISOString(),
        ipAddress: sig.metadata?.ipAddress
      })),
      completedAt: new Date().toISOString()
    };

    const reportPath = join(__dirname, 'signature-audit-report.json');
    writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
    console.log(`✅ Audit report saved to: ${reportPath}`);

    // Step 8: Cleanup
    console.log('\n🧹 Step 8: Cleaning up resources');
    serverActor.cleanup();
    console.log('✅ Resources cleaned up successfully');

    console.log('\n🎉 Multi-Signer PDF Example Completed Successfully!');
    console.log(`\n📁 Output files:`);
    console.log(`   📄 Signed PDF: ${outputPath}`);
    console.log(`   📊 Audit Report: ${reportPath}`);
    console.log('\n🔍 The signed PDF contains all three signatures and can be verified with any PDF viewer.');

  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
    console.error('\n🐛 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMultiSignerExample();
}

export { runMultiSignerExample };