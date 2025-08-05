import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { CoordinationDatabase } from '../database/connection.js'
import { MessageManager } from '../core/message-manager.js'
import { ParticipantRegistry } from '../core/participant-registry.js'
import { ParticipantId, SendMessageInput, GetMessagesInput } from '../types/index.js'

describe('Message Content Handling', () => {
  let tempDir: string
  let db: CoordinationDatabase
  let messageManager: MessageManager
  let participantRegistry: ParticipantRegistry
  const testParticipant: ParticipantId = '@test' as ParticipantId
  const targetParticipant: ParticipantId = '@mobile' as ParticipantId

  beforeEach(async () => {
    // Create a temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-test-'))
    
    // Initialize database and managers
    db = new CoordinationDatabase(tempDir)
    messageManager = new MessageManager(db.db, tempDir)
    participantRegistry = new ParticipantRegistry(db.db, tempDir)
    
    // Register test participants
    await participantRegistry.registerParticipant({
      id: testParticipant,
      capabilities: ['test'],
      default_priority: 'M'
    })
    
    await participantRegistry.registerParticipant({
      id: targetParticipant,
      capabilities: ['mobile'],
      default_priority: 'M'
    })
  })

  afterEach(() => {
    // Clean up
    db.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should handle very long message content correctly', async () => {
    // Create a VERY long message content (>1000 chars to trigger content_ref storage)
    const longContent = `
# 🚀 KYC/PEP Implementation Complete - Comprehensive API Documentation

## Overview
The PEP (Politically Exposed Persons) declaration functionality has been fully implemented and is now available in production. This comprehensive update includes multiple new endpoints, enhanced validation, and complete integration with our existing KYC flow.

## 🔧 Implementation Details

### 1. Database Schema Updates
We've added the following new tables and fields:
- **pep_declarations** table with full audit trail
- **document_templates** table for S3 URL management
- **kyc_session_documents** enhanced with PEP support
- Added indexes for optimal query performance
- Implemented soft deletes for compliance requirements

### 2. New API Endpoints

#### GET /api/v1/kyc/pep-template
Returns a pre-signed S3 URL for downloading the PEP declaration template.

**Response Example:**
\`\`\`json
{
  "success": true,
  "data": {
    "template_url": "https://kyc-documents.s3.amazonaws.com/templates/pep-declaration-v2.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
    "expires_at": "2024-01-15T10:30:00Z",
    "template_version": "2.0.1",
    "file_size_bytes": 245678,
    "content_type": "application/pdf",
    "supported_languages": ["en", "es", "pt"],
    "form_fields": {
      "full_name": { "required": true, "type": "string" },
      "identification_number": { "required": true, "type": "string" },
      "position": { "required": false, "type": "string" },
      "organization": { "required": false, "type": "string" },
      "relationship_details": { "required": false, "type": "text" },
      "declaration_date": { "required": true, "type": "date" },
      "signature": { "required": true, "type": "signature" }
    }
  }
}
\`\`\`

#### POST /api/v1/kyc/sessions/{session_id}/documents
Enhanced to accept PEP declaration documents.

**Request Body:**
\`\`\`json
{
  "document_type": "pep_declaration",
  "file_data": "base64_encoded_pdf_content_here...",
  "metadata": {
    "is_pep": false,
    "declaration_date": "2024-01-15",
    "form_version": "2.0.1",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "device_fingerprint": "abc123xyz789"
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "document_id": "doc_pep_abc123xyz",
    "status": "pending_review",
    "uploaded_at": "2024-01-15T09:15:30Z",
    "validation_results": {
      "format_valid": true,
      "signature_detected": true,
      "fields_complete": true,
      "document_authentic": "pending"
    },
    "next_steps": [
      "document_under_review",
      "notification_will_be_sent"
    ]
  }
}
\`\`\`

### 3. MCP Integration Commands

#### get_kyc_documents
New MCP command to retrieve KYC documents including PEP declarations.

**Usage:**
\`\`\`typescript
mcp.call('get_kyc_documents', {
  session_id: 'kyc_session_123',
  document_types: ['pep_declaration', 'identity_document'],
  include_metadata: true
})
\`\`\`

**Response includes:**
- Document URLs (pre-signed S3)
- Validation status
- Review timestamps
- Compliance flags

### 4. Frontend Integration Guide

#### Required Changes:
1. Add PEP declaration step to KYC flow
2. Implement document upload with progress indicator
3. Add declaration preview before submission
4. Handle validation errors gracefully

#### Component Example:
\`\`\`tsx
const PEPDeclarationStep = () => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const base64 = await convertToBase64(file);
      const response = await api.post(\`/kyc/sessions/\${sessionId}/documents\`, {
        document_type: 'pep_declaration',
        file_data: base64,
        metadata: generateMetadata()
      });
      
      if (response.data.success) {
        showSuccess('PEP declaration uploaded successfully');
        goToNextStep();
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <StepContainer>
      <DownloadTemplate />
      <FileUploader onChange={setFile} />
      <UploadButton onClick={handleUpload} loading={isUploading} />
    </StepContainer>
  );
};
\`\`\`

### 5. Testing Endpoints

#### Staging Environment:
- Base URL: https://staging-api.beetoken.com
- Auth: Use staging API keys
- Rate limits: 100 requests/minute

#### Test Scenarios Covered:
1. ✅ PEP declaration upload and validation
2. ✅ Template download with expiring URLs
3. ✅ Multiple language support
4. ✅ Duplicate submission prevention
5. ✅ Session expiry handling
6. ✅ Large file upload (up to 10MB)
7. ✅ Malformed PDF rejection
8. ✅ Missing signature detection

### 6. Security Considerations

- All S3 URLs expire after 15 minutes
- Files are encrypted at rest using AES-256
- PII data is automatically redacted in logs
- Audit trail maintained for all operations
- GDPR-compliant data retention policies

### 7. Migration Notes

For existing KYC sessions:
- Old sessions remain valid
- PEP declaration is optional for sessions created before 2024-01-15
- Bulk migration tool available via admin panel

### 8. Performance Metrics

- Average template generation: 150ms
- Document upload processing: 800ms
- Validation completion: 1.2s
- S3 upload time (5MB file): 2.5s

### 9. Error Codes Reference

| Code | Description | Action Required |
|------|-------------|-----------------|
| PEP001 | Invalid document format | Re-upload as PDF |
| PEP002 | Missing required fields | Complete all fields |
| PEP003 | Signature not detected | Add signature |
| PEP004 | Session expired | Start new session |
| PEP005 | Duplicate submission | Use existing document |
| PEP006 | File too large | Reduce file size |
| PEP007 | Template version mismatch | Download latest template |

### 10. Monitoring & Alerts

Dashboard available at: https://metrics.beetoken.com/kyc-pep

Key metrics being tracked:
- Upload success rate: 98.5%
- Average processing time: 1.8s
- Daily declaration count: ~1,200
- Error rate: 1.5%

## 📞 Support & Questions

- Technical issues: backend-team@beetoken.com
- API documentation: https://docs.beetoken.com/kyc/pep
- Slack channel: #kyc-implementation
- On-call engineer: @backend-oncall

## 🎯 Next Steps for Mobile Team

1. Implement PEP declaration UI component
2. Add file upload with progress tracking
3. Handle error states gracefully
4. Test with provided staging endpoints
5. Coordinate with QA for end-to-end testing

Please confirm receipt of this implementation and let me know if you need any clarification or have questions about the integration.

Best regards,
Backend Team
`.trim()

    // Send the message
    const input: SendMessageInput = {
      to: [targetParticipant],
      type: 'update',
      priority: 'H',
      subject: 'KYC PEP Complete - New API Endpoints Ready',
      content: longContent,
      response_required: true,
      expires_in_hours: 168,
      tags: ['kyc', 'pep', 'api-update', 'backend']
    }

    const sentMessage = await messageManager.createMessage(input, testParticipant)
    
    // Verify message was created
    expect(sentMessage).toBeDefined()
    expect(sentMessage.id).toBeTruthy()
    expect(sentMessage.subject).toBe('KYC PEP Complete - New API Endpoints Ready')
    
    // IMPORTANT: Verify that content_ref was created for long content
    expect(sentMessage.content_ref).toBeTruthy() // Should have content_ref for long messages
    expect(sentMessage.summary).toHaveLength(503) // Should be truncated to 500 chars + '...'
    expect(sentMessage.summary).toContain('KYC/PEP Implementation Complete')
    
    // Debug: Let's first check if we can get ANY messages
    const allDebugMessages = await messageManager.getMessages({
      limit: 100,
      active_only: false,
      detail_level: 'full'
    }, testParticipant)
    
    console.log('DEBUG: All messages found:', allDebugMessages.length)
    console.log('DEBUG: Looking for thread_id:', sentMessage.thread_id)
    if (allDebugMessages.length > 0) {
      console.log('DEBUG: First message thread_id:', allDebugMessages[0].thread_id)
    }
    
    // Now retrieve the message with different detail levels
    const messagesQuery: GetMessagesInput = {
      limit: 100,  // Get all messages to debug
      detail_level: 'full',
      active_only: false  // Make sure we get all messages
    }

    // Test FULL detail level - should get complete content
    // Use testParticipant since they sent the message, or targetParticipant since they received it
    const fullMessages = await messageManager.getMessages(messagesQuery, testParticipant)
    
    // Find our specific message
    expect(fullMessages.length).toBeGreaterThan(0)
    const fullMessage = fullMessages.find(m => m.thread_id === sentMessage.thread_id)
    expect(fullMessage).toBeDefined()
    
    // ✅ CRITICAL TEST: Verify full content is loaded correctly
    expect(fullMessage!.content).toBeDefined()
    expect(fullMessage!.content).toBe(longContent) // Should match EXACTLY
    expect(fullMessage!.content).toContain('### 10. Monitoring & Alerts') // Check end of content
    expect(fullMessage!.content).toContain('Backend Team') // Check very end
    expect(fullMessage!.content?.length).toBeGreaterThan(5000) // Should be very long
    
    // Test SUMMARY detail level
    const summaryQuery: GetMessagesInput = {
      ...messagesQuery,
      detail_level: 'summary'
    }
    const summaryMessages = await messageManager.getMessages(summaryQuery, testParticipant)
    expect(summaryMessages).toHaveLength(1)
    const summaryMessage = summaryMessages[0]
    
    // Summary should NOT have full content
    expect(summaryMessage.content).toBeUndefined()
    expect(summaryMessage.summary).toBeDefined()
    expect(summaryMessage.summary).toHaveLength(503)
    
    // Test INDEX detail level
    const indexQuery: GetMessagesInput = {
      ...messagesQuery,
      detail_level: 'index'
    }
    const indexMessages = await messageManager.getMessages(indexQuery, testParticipant)
    expect(indexMessages).toHaveLength(1)
    const indexMessage = indexMessages[0]
    
    // Index should have minimal info
    expect(indexMessage.content).toBeUndefined()
    expect(indexMessage.summary).toBeDefined() // Summary is always included
    expect(indexMessage.subject).toBeDefined()
    expect(indexMessage.id).toBeDefined()
  })

  it('should handle short messages without content_ref', async () => {
    const shortContent = 'Quick update: PEP implementation is done. Please test.'
    
    const input: SendMessageInput = {
      to: [targetParticipant],
      type: 'sync',
      priority: 'M',
      subject: 'Quick PEP Update',
      content: shortContent,
      response_required: false,
      expires_in_hours: 24
    }

    const sentMessage = await messageManager.createMessage(input, testParticipant)
    
    // Short messages should NOT have content_ref
    expect(sentMessage.content_ref).toBeUndefined()
    expect(sentMessage.summary).toBe(shortContent) // Summary should be the full content
    
    // Retrieve with full detail
    const messages = await messageManager.getMessages({
      thread_id: sentMessage.thread_id,
      limit: 1,
      detail_level: 'full',
      active_only: false
    }, testParticipant)
    
    expect(messages).toHaveLength(1)
    const message = messages[0]
    
    // For short messages, content should equal summary
    expect(message.content).toBe(shortContent)
    expect(message.summary).toBe(shortContent)
  })

  it('should handle content file read errors gracefully', async () => {
    // Create a message with long content
    const longContent = 'x'.repeat(1500) // Force content_ref creation
    
    const input: SendMessageInput = {
      to: [targetParticipant],
      type: 'sync',
      priority: 'L',
      subject: 'Test Message',
      content: longContent,
      response_required: false,
      expires_in_hours: 24
    }

    const sentMessage = await messageManager.createMessage(input, testParticipant)
    expect(sentMessage.content_ref).toBeTruthy()
    
    // Delete the content file to simulate read error
    const contentPath = path.join(tempDir, sentMessage.content_ref!)
    fs.unlinkSync(contentPath)
    
    // Try to retrieve with full detail
    const messages = await messageManager.getMessages({
      thread_id: sentMessage.thread_id,
      limit: 1,
      detail_level: 'full',
      active_only: false
    }, testParticipant)
    
    expect(messages).toHaveLength(1)
    const message = messages[0]
    
    // Should fallback to summary when content file is missing
    expect(message.content).toBeDefined()
    expect(message.content).toBe(message.summary)
    expect(message.content).toContain('xxx') // Should have truncated x's
  })

  it('should respect active_only filter for closed threads', async () => {
    // Create a message
    const input: SendMessageInput = {
      to: [targetParticipant],
      type: 'sync',
      priority: 'M',
      subject: 'Thread to be closed',
      content: 'This thread will be closed',
      response_required: true,
      expires_in_hours: 24
    }

    const sentMessage = await messageManager.createMessage(input, testParticipant)
    const threadId = sentMessage.thread_id
    
    // Close the thread
    await messageManager.closeThread({
      thread_id: threadId,
      resolution_status: 'complete',
      final_summary: 'Thread closed for testing'
    }, testParticipant)
    
    // Query with active_only = true (default)
    const activeMessages = await messageManager.getMessages({
      limit: 100,
      active_only: true
    }, testParticipant)
    
    // Should NOT include the closed message
    const closedMessage = activeMessages.find(m => m.thread_id === threadId && m.status === 'resolved')
    expect(closedMessage).toBeUndefined()
    
    // Query with active_only = false
    const allMessages = await messageManager.getMessages({
      limit: 100,
      active_only: false
    }, testParticipant)
    
    // Should include the closed message
    const foundMessage = allMessages.find(m => m.thread_id === threadId && m.status === 'resolved')
    expect(foundMessage).toBeDefined()
  })

  it('should handle edge cases in content loading', async () => {
    // Test with exactly 500 chars (boundary)
    const exact500 = 'a'.repeat(500)
    const msg1 = await messageManager.createMessage({
      to: [targetParticipant],
      type: 'sync',
      priority: 'L',
      subject: 'Exactly 500 chars',
      content: exact500,
      response_required: false,
      expires_in_hours: 24
    }, testParticipant)
    
    expect(msg1.content_ref).toBeUndefined() // Should not create content_ref
    expect(msg1.summary).toBe(exact500)
    
    // Test with 501 chars (just over boundary)
    const exact501 = 'b'.repeat(501)
    const msg2 = await messageManager.createMessage({
      to: [targetParticipant],
      type: 'sync',
      priority: 'L',
      subject: 'Exactly 501 chars',
      content: exact501,
      response_required: false,
      expires_in_hours: 24
    }, testParticipant)
    
    expect(msg2.summary).toHaveLength(503) // 500 + '...'
    expect(msg2.summary.endsWith('...')).toBe(true)
    
    // Test with exactly 1000 chars (content_ref boundary)
    const exact1000 = 'c'.repeat(1000)
    const msg3 = await messageManager.createMessage({
      to: [targetParticipant],
      type: 'sync',
      priority: 'L',
      subject: 'Exactly 1000 chars',
      content: exact1000,
      response_required: false,
      expires_in_hours: 24
    }, testParticipant)
    
    expect(msg3.content_ref).toBeUndefined() // Should not create content_ref at exactly 1000
    
    // Test with 1001 chars (just over content_ref boundary)
    const exact1001 = 'd'.repeat(1001)
    const msg4 = await messageManager.createMessage({
      to: [targetParticipant],
      type: 'sync',
      priority: 'L',
      subject: 'Exactly 1001 chars',
      content: exact1001,
      response_required: false,
      expires_in_hours: 24
    }, testParticipant)
    
    expect(msg4.content_ref).toBeTruthy() // Should create content_ref
    
    // Verify all can be read correctly with full detail
    const allMessages = await messageManager.getMessages({
      limit: 10,
      detail_level: 'full',
      active_only: false
    }, testParticipant)
    
    const check500 = allMessages.find(m => m.subject === 'Exactly 500 chars')
    expect(check500?.content).toBe(exact500)
    
    const check501 = allMessages.find(m => m.subject === 'Exactly 501 chars')
    expect(check501?.content).toBe(exact501)
    
    const check1000 = allMessages.find(m => m.subject === 'Exactly 1000 chars')
    expect(check1000?.content).toBe(exact1000)
    
    const check1001 = allMessages.find(m => m.subject === 'Exactly 1001 chars')
    expect(check1001?.content).toBe(exact1001)
  })
})