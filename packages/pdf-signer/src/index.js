/**
 * @legion/pdf-signer - PDF signing package for Legion framework
 * 
 * This package provides server and client actors for PDF signature operations
 */

// Import all the components first
import { PDFSignerServerActor, createPDFSignerServerActor } from './server/PDFSignerServerActor.js';
import { PDFProcessor } from './server/PDFProcessor.js';
import { SignatureManager } from './server/SignatureManager.js';
import { PDFSignerClientActor, createPDFSignerClientActor } from './client/PDFSignerClientActor.js';
import { PDFViewer } from './client/PDFViewer.js';
import { SignaturePad } from './client/SignaturePad.js';
import { 
  PDFDocument,
  SignatureField,
  Signature,
  MessageTypes,
  createMessage,
  validateMessage
} from './shared/SignatureTypes.js';

// Export all components
export {
  // Server
  PDFSignerServerActor,
  createPDFSignerServerActor,
  PDFProcessor,
  SignatureManager,
  
  // Client
  PDFSignerClientActor,
  createPDFSignerClientActor,
  PDFViewer,
  SignaturePad,
  
  // Shared
  PDFDocument,
  SignatureField,
  Signature,
  MessageTypes,
  createMessage,
  validateMessage
};

/**
 * Create server actor factory for Legion framework
 */
export function createServerActorFactory() {
  return createPDFSignerServerActor;
}

/**
 * Create client actor factory for Legion framework
 */
export function createClientActorFactory() {
  return createPDFSignerClientActor;
}

/**
 * Register PDF signer actors with Legion server
 */
export function registerPDFSignerRoute(server, path = '/pdf-signer') {
  server.registerActorRoute(path, {
    actorFactory: createPDFSignerServerActor,
    clientPath: '@legion/pdf-signer/client',
    metadata: {
      name: 'PDF Signer',
      description: 'Sign PDF documents with hand-drawn signatures',
      version: '1.0.0'
    }
  });
  
  return server;
}