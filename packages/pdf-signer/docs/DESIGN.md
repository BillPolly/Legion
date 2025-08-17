# PDF Signer Design Document

## Executive Summary

The PDF Signer package (`@legion/pdf-signer`) is a Legion framework module that provides comprehensive PDF viewing and electronic signature capabilities through an actor-based architecture. The system enables users to view PDF documents, automatically detect signature fields, capture hand-drawn signatures via canvas interface, and embed those signatures into the PDF document. This is achieved through coordinated frontend and backend actors that leverage the Legion Server Framework for seamless bidirectional communication.

## System Architecture

### Overview

The PDF Signer system follows a distributed actor model with clear separation between client-side presentation/interaction and server-side document processing. The architecture consists of two primary actors that communicate through the Legion ActorSpace protocol over WebSockets.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  PDFSignerClientActor                                          │
│  ├── PDFViewer (PDF.js integration)                           │
│  ├── SignaturePad (Canvas-based drawing)                      │
│  └── UI State Management                                       │
├─────────────────────────────────────────────────────────────────┤
│                    ActorSpace (Client)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↕ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                    ActorSpace (Server)                         │
├─────────────────────────────────────────────────────────────────┤
│  PDFSignerServerActor                                          │
│  ├── PDFProcessor (pdf-lib integration)                        │
│  ├── SignatureManager (Metadata & storage)                    │
│  └── Document State Management                                 │
├─────────────────────────────────────────────────────────────────┤
│                      Node.js (Server)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Client-Side Components

**PDFSignerClientActor**
- Root client actor that manages all client-side state and coordination
- Handles user interactions and UI updates
- Communicates with server actor for document operations
- Manages the lifecycle of PDF viewing and signature capture sessions

**PDFViewer**
- Wraps PDF.js library for document rendering
- Manages page navigation, zoom, and pan controls
- Overlays signature field indicators on the rendered PDF
- Handles click events on signature areas to trigger signature capture

**SignaturePad**
- Provides canvas-based signature drawing interface
- Supports both mouse and touch input for signature capture
- Implements smooth line drawing with configurable pen properties
- Converts captured signatures to base64-encoded images

#### Server-Side Components

**PDFSignerServerActor**
- Root server actor that manages server-side document processing
- Maintains document state and signature data
- Coordinates between PDFProcessor and SignatureManager
- Handles client requests and sends appropriate responses

**PDFProcessor**
- Parses PDF documents using pdf-lib to extract structure
- Detects existing form fields, particularly signature fields
- Identifies signature placeholder areas through text pattern matching
- Embeds signature images into PDF at specified coordinates
- Generates final signed PDF documents

**SignatureManager**
- Stores signature images and associated metadata
- Manages signature history and document versions
- Tracks signature positions and field associations
- Handles signature validation and verification logic

## Data Flow and State Management

### Document Upload Flow

1. User selects PDF file through file input in browser
2. PDFSignerClientActor reads file and converts to base64
3. Client sends `upload_pdf` message to server with document data
4. PDFSignerServerActor receives and processes the PDF
5. PDFProcessor analyzes document structure and identifies signature fields
6. Server stores document in memory with unique document ID
7. Server responds with `pdf_ready` message containing document metadata
8. Client renders PDF using PDFViewer component
9. Signature fields are highlighted as interactive overlays

### Signature Capture Flow

1. User clicks on highlighted signature field
2. SignaturePad modal appears for signature drawing
3. User draws signature using mouse or touch input
4. Signature is captured as canvas data
5. User confirms signature (or clears to retry)
6. Canvas data is converted to base64 PNG image
7. Client sends `add_signature` message with signature data
8. Server embeds signature image at field coordinates
9. Server responds with `signature_added` confirmation
10. Client updates UI to show signed status for that field

### Document Download Flow

1. User requests to download signed document
2. Client sends `download_pdf` message to server
3. PDFProcessor generates final PDF with all embedded signatures
4. Server converts PDF to base64 for transmission
5. Server sends `pdf_download_ready` with document data
6. Client triggers browser download of the signed PDF

## Actor Communication Protocol

### Message Types and Structures

#### Client to Server Messages

**Upload PDF Document**
```javascript
{
  type: 'upload_pdf',
  data: {
    pdfBase64: string,      // Base64 encoded PDF file
    filename: string,       // Original filename
    metadata: {            // Optional metadata
      uploadTime: number,
      userAgent: string
    }
  }
}
```

**Get Signature Fields**
```javascript
{
  type: 'get_signature_fields',
  data: {
    documentId: string,     // Unique document identifier
    pageNumber?: number     // Optional: specific page (null for all)
  }
}
```

**Add Signature to Field**
```javascript
{
  type: 'add_signature',
  data: {
    documentId: string,     // Document to sign
    fieldId: string,        // Signature field identifier
    signatureImage: string, // Base64 PNG image
    metadata: {
      timestamp: number,    // Signature timestamp
      signerName: string,   // Name of signer
      signerEmail?: string, // Optional email
      ipAddress?: string,   // Optional IP for audit
      dimensions: {         // Signature dimensions
        width: number,
        height: number
      }
    }
  }
}
```

**Clear Signature Field**
```javascript
{
  type: 'clear_signature',
  data: {
    documentId: string,
    fieldId: string
  }
}
```

**Download Signed PDF**
```javascript
{
  type: 'download_pdf',
  data: {
    documentId: string,
    format?: 'pdf' | 'pdf/a'  // Optional format specification
  }
}
```

#### Server to Client Messages

**PDF Ready for Viewing**
```javascript
{
  type: 'pdf_ready',
  data: {
    documentId: string,        // Unique document ID
    filename: string,          // Original filename
    pageCount: number,         // Total pages
    documentSize: number,      // Size in bytes
    signatureFields: [{        // Array of detected fields
      id: string,              // Unique field ID
      page: number,            // Page number (1-indexed)
      x: number,               // X coordinate
      y: number,               // Y coordinate  
      width: number,           // Field width
      height: number,          // Field height
      label?: string,          // Optional field label
      required: boolean,       // Is signature required
      signed: boolean          // Current signed status
    }],
    pdfBase64: string         // PDF data for rendering
  }
}
```

**Signature Successfully Added**
```javascript
{
  type: 'signature_added',
  data: {
    documentId: string,
    fieldId: string,
    success: boolean,
    timestamp: number,
    remainingFields: number    // Unsigned fields count
  }
}
```

**Signature Cleared**
```javascript
{
  type: 'signature_cleared',
  data: {
    documentId: string,
    fieldId: string,
    success: boolean
  }
}
```

**Signed PDF Ready for Download**
```javascript
{
  type: 'pdf_download_ready',
  data: {
    documentId: string,
    filename: string,          // Suggested download filename
    pdfBase64: string,         // Complete signed PDF
    signatures: [{             // Summary of signatures
      fieldId: string,
      signerName: string,
      timestamp: number
    }]
  }
}
```

**Error Message**
```javascript
{
  type: 'error',
  data: {
    code: string,              // Error code
    message: string,           // Human-readable message
    context?: any              // Optional error context
  }
}
```

### Actor Lifecycle Management

#### Initialization Sequence

1. **Server Startup**
   - BaseServer initializes with ResourceManager
   - Registers `/pdf-signer` route with PDFSignerServerActor factory
   - Factory function creates new actor instance per connection

2. **Client Connection**
   - User navigates to `/pdf-signer` URL
   - HTML template loads with embedded PDFSignerClientActor
   - WebSocket connection established to server
   - ActorSpace creates bidirectional channel

3. **Actor Pairing**
   - Client and server actors exchange GUIDs
   - Remote actor references established
   - Actors ready for message exchange

#### Session Management

Each WebSocket connection maintains isolated state:
- Unique document storage per session
- Independent signature data
- No cross-session data leakage
- Automatic cleanup on disconnect

## PDF Processing Pipeline

### Field Detection Algorithm

The system employs multiple strategies to identify signature fields:

1. **Form Field Analysis**
   - Parse PDF AcroForm dictionary
   - Identify fields with type "Sig" or "Signature"
   - Extract field rectangles and page associations

2. **Text Pattern Recognition**
   - Search for keywords: "Signature", "Sign here", "Authorized by"
   - Identify underlined blank spaces following signature prompts
   - Detect date fields adjacent to signature areas

3. **Visual Structure Analysis**
   - Locate bordered rectangles without content
   - Identify horizontal lines with labels
   - Find grouped signature blocks (multiple signers)

4. **Fallback Mechanisms**
   - Allow manual field selection if none detected
   - Support user-defined signature zones
   - Remember field locations for document templates

### Signature Embedding Process

1. **Image Preparation**
   - Receive base64 PNG from client
   - Decode and validate image data
   - Resize to fit field dimensions
   - Maintain aspect ratio

2. **PDF Modification**
   - Load PDF into pdf-lib document model
   - Create image XObject from signature
   - Calculate positioning within field bounds
   - Apply image to specified page

3. **Metadata Insertion**
   - Add signature timestamp to document info
   - Store signer information in custom metadata
   - Create audit trail in document properties
   - Preserve original field structure

4. **Document Generation**
   - Save modified PDF with embedded content
   - Optimize file size where possible
   - Ensure compatibility with PDF readers
   - Generate base64 for transmission

## User Interface Design

### PDF Viewer Interface

The PDF viewer provides a clean, intuitive interface for document navigation and signature field identification:

```
┌─────────────────────────────────────────────────────────┐
│  [← →] Page 1 of 3  [−][100%][+]  [↻]  [Download PDF]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    ┌───────────────────────────────────────────┐      │
│    │                                           │      │
│    │         PDF Document Content              │      │
│    │                                           │      │
│    │    ┌──────────────────────┐             │      │
│    │    │ 📝 Click to sign     │ ← Signature │      │
│    │    └──────────────────────┘    Field    │      │
│    │                                           │      │
│    │    Signature: ____________               │      │
│    │              (unsigned)                   │      │
│    │                                           │      │
│    └───────────────────────────────────────────┘      │
│                                                         │
│  Status: 2 signature fields detected, 0 signed         │
└─────────────────────────────────────────────────────────┘
```

Key UI Elements:
- **Navigation Controls**: Page forward/back, jump to page
- **Zoom Controls**: Zoom in/out, fit to width, actual size
- **Rotation**: Rotate document view
- **Download Button**: Save signed PDF
- **Status Bar**: Shows signature field count and status
- **Field Overlays**: Interactive areas highlighting signature zones

### Signature Capture Modal

When a signature field is clicked, a modal dialog appears for signature input:

```
┌─────────────────────────────────────────────────────────┐
│                    Sign Document                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Signing as: [John Doe                              ]  │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │                                               │    │
│  │                                               │    │
│  │          [Canvas Drawing Area]                │    │
│  │                                               │    │
│  │                                               │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
│  Pen Color: [●] Black  [○] Blue  [○] Dark Blue        │
│  Pen Width: [──────●──] 2px                           │
│                                                         │
│  [Clear]  [Undo]           [Cancel]  [Apply Signature] │
└─────────────────────────────────────────────────────────┘
```

Modal Features:
- **Signer Name Field**: Pre-filled or editable
- **Drawing Canvas**: Pressure-sensitive drawing area
- **Pen Options**: Color and width selection
- **Action Buttons**: Clear, undo, cancel, apply
- **Touch Support**: Optimized for mobile devices

### Visual Feedback Systems

The interface provides clear visual feedback for all operations:

1. **Field Status Indicators**
   - Green checkmark: Field signed
   - Yellow highlight: Field selected
   - Red border: Required field unsigned
   - Gray overlay: Field disabled

2. **Loading States**
   - PDF upload progress bar
   - Page rendering spinner
   - Signature processing indicator
   - Download preparation status

3. **Success/Error Messages**
   - Toast notifications for actions
   - Inline validation messages
   - Connection status indicator
   - Error recovery prompts

## Technical Implementation Details

### Frontend Technology Stack

**PDF.js Integration**
```javascript
// PDF rendering configuration
const pdfjsConfig = {
  workerSrc: '/pdf.worker.js',
  cMapUrl: '/cmaps/',
  cMapPacked: true,
  renderTextLayer: true,
  renderAnnotationLayer: true
};
```

**Signature Pad Configuration**
```javascript
// Canvas drawing settings
const signaturePadConfig = {
  minWidth: 0.5,
  maxWidth: 2.5,
  velocityFilterWeight: 0.7,
  backgroundColor: 'rgb(255, 255, 255)',
  penColor: 'rgb(0, 0, 0)',
  throttle: 16  // 60fps
};
```

### Backend Processing Architecture

**Document Storage Strategy**
- In-memory storage for active sessions
- Document isolation per connection
- Automatic garbage collection on disconnect
- No persistent storage in MVP

**PDF Manipulation Pipeline**
```javascript
// Processing stages
1. Parse PDF structure (pdf-parse)
2. Extract form fields (pdf-lib)
3. Identify signature zones
4. Create field mapping
5. Prepare for client rendering
```

**Signature Image Processing**
```javascript
// Image handling workflow
1. Decode base64 to buffer
2. Validate PNG format
3. Extract dimensions
4. Calculate scaling factor
5. Embed at coordinates
```

### Security Considerations

While this MVP does not implement cryptographic signatures, it includes basic security measures:

1. **Input Validation**
   - PDF file size limits (10MB default)
   - Image format verification
   - Field boundary checking
   - Message structure validation

2. **Session Isolation**
   - Unique document IDs per session
   - No cross-session access
   - Memory cleanup on disconnect
   - Actor-based isolation

3. **Data Transmission**
   - Base64 encoding for binary data
   - WebSocket message size limits
   - Connection timeout handling
   - Error recovery mechanisms

## Integration with Legion Framework

### Server Framework Usage

The PDF Signer integrates seamlessly with the Legion Server Framework:

```javascript
// Route registration
server.registerRoute(
  '/pdf-signer',
  createPDFSignerServerActor,
  clientActorPath,
  port
);
```

### Actor Factory Pattern

```javascript
// Server actor factory
export function createPDFSignerServerActor(services) {
  return new PDFSignerServerActor({
    resourceManager: services.get('resourceManager'),
    // Other service dependencies
  });
}
```

### Client Actor Module

```javascript
// ES6 module with default export
export default class PDFSignerClientActor {
  constructor() {
    this.initializeComponents();
  }
  
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.startSession();
  }
  
  receive(messageType, data) {
    // Handle server messages
  }
}
```

## Data Models and Types

### Core Data Structures

**Document Model**
```javascript
class PDFDocument {
  id: string;              // Unique identifier
  filename: string;        // Original filename
  data: Buffer;           // PDF binary data
  pageCount: number;      // Total pages
  fields: SignatureField[]; // Detected fields
  signatures: Signature[]; // Applied signatures
  uploadTime: Date;       // Upload timestamp
  lastModified: Date;     // Last modification
}
```

**Signature Field Model**
```javascript
class SignatureField {
  id: string;           // Field identifier
  documentId: string;   // Parent document
  page: number;         // Page number
  rect: {              // Field rectangle
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label?: string;       // Field label/name
  required: boolean;    // Is required
  signatureId?: string; // Applied signature
}
```

**Signature Model**
```javascript
class Signature {
  id: string;           // Signature ID
  fieldId: string;      // Associated field
  imageData: string;    // Base64 PNG
  signerName: string;   // Signer name
  timestamp: Date;      // Signing time
  metadata: {          // Additional data
    ipAddress?: string;
    userAgent?: string;
    dimensions: {
      width: number;
      height: number;
    };
  };
}
```

## Error Handling and Recovery

### Error Categories

1. **Document Errors**
   - Invalid PDF format
   - Corrupted file data
   - Unsupported PDF version
   - File size exceeded

2. **Processing Errors**
   - Field detection failure
   - Image embedding error
   - Memory allocation failure
   - Parsing exceptions

3. **Communication Errors**
   - WebSocket disconnection
   - Message timeout
   - Invalid message format
   - Actor communication failure

4. **User Input Errors**
   - Invalid signature image
   - Missing required fields
   - Invalid field selection
   - Concurrent modification

### Error Recovery Strategies

- **Automatic Retry**: For transient network errors
- **Graceful Degradation**: Continue with reduced functionality
- **User Notification**: Clear error messages with actions
- **State Recovery**: Restore from last known good state
- **Manual Intervention**: Allow user to retry operation

## Testing Strategy

### Unit Testing Coverage

- PDF processing functions
- Signature field detection
- Image embedding logic
- Message validation
- Actor communication

### Integration Testing

- End-to-end document flow
- Actor message exchange
- WebSocket communication
- Error handling paths
- Session management

### Example Test Scenarios

1. Upload PDF and detect fields
2. Sign single field
3. Sign multiple fields
4. Clear and re-sign
5. Download signed document
6. Handle connection loss
7. Process invalid PDF
8. Exceed size limits

## Summary

The PDF Signer package provides a complete, actor-based solution for PDF viewing and electronic signature capture within the Legion framework. Through careful separation of concerns between client and server actors, the system achieves a clean architecture that is both maintainable and extensible. The use of established libraries (PDF.js, pdf-lib, Signature Pad) ensures reliable functionality while the Legion Server Framework provides the robust communication infrastructure needed for real-time document interaction.

The MVP focuses on core functionality: viewing PDFs, detecting signature fields, capturing signatures, and embedding them into documents. This design provides a solid foundation that successfully addresses the immediate requirements while maintaining the flexibility to evolve as needs grow.