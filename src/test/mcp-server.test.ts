import { describe, it, expect } from 'vitest'

// Create a test helper to simulate the server's response formatting
interface TestMessage {
  id: string
  from: string
  to: string[]
  subject: string
  content: string
  summary: string
  type: string
  priority: string
  status: string
  created_at: Date
  thread_id: string
}

function formatGetMessagesResponse(messages: TestMessage[], detailLevel: string = 'full') {
  if (messages.length === 0) {
    return '📭 No messages found matching the criteria.'
  }

  const formatMessage = (msg: TestMessage) => {
    const status =
      msg.status === 'pending'
        ? '⏳'
        : msg.status === 'read'
          ? '👁️'
          : msg.status === 'responded'
            ? '💬'
            : msg.status === 'resolved'
              ? '✅'
              : '📁'

    const priority =
      msg.priority === 'CRITICAL'
        ? '🚨'
        : msg.priority === 'H'
          ? '🔴'
          : msg.priority === 'M'
            ? '🟡'
            : '🟢'

    let content = ''
    if (detailLevel === 'index') {
      // Just the subject line
      content = ''
    } else if (detailLevel === 'summary') {
      // Show truncated summary
      content = `   ${msg.summary.substring(0, 150)}${msg.summary.length > 150 ? '...' : ''}\n`
    } else {
      // detail_level === 'full' - show full content
      content = `   ${msg.content}\n`
    }

    return (
      `${status} ${priority} **${msg.id}** - ${msg.subject}\n` +
      `   From: ${msg.from} → To: ${msg.to.join(', ')}\n` +
      `   Type: ${msg.type} | Created: ${msg.created_at.toLocaleDateString()}\n` +
      content
    )
  }

  const messageList = messages.map(formatMessage).join('\n')
  return `📨 **${messages.length} Messages Found**\n\n${messageList}`
}

interface SearchResult {
  message: {
    id: string
    from: string
    subject: string
    content: string
    created_at: Date
  }
  relevance_score: number
  match_context: string | null
}

function formatSearchResponse(results: SearchResult[]) {
  if (results.length === 0) {
    return '🔍 No messages found for query'
  }

  const formatResult = (result: SearchResult) => {
    const relevance = Math.round(result.relevance_score * 100)
    // Show match context if available, otherwise show a preview of content
    const preview =
      result.match_context ||
      (result.message.content.length > 200
        ? result.message.content.substring(0, 200) + '...'
        : result.message.content)

    return (
      `**${result.message.id}** (${relevance}% match)\n` +
      `${result.message.subject}\n` +
      `From: ${result.message.from} | ${result.message.created_at.toLocaleDateString()}\n` +
      `${preview}\n`
    )
  }

  const resultList = results.map(formatResult).join('\n')
  return `🔍 **${results.length} Search Results**\n\n${resultList}`
}

describe('CCP Message Display - Detail Level Functionality', () => {
  describe('Message Formatting with detail_level', () => {
    const mockMessages = [
      {
        id: 'MSG-123',
        from: '@sender',
        to: ['@receiver'],
        subject: 'Test Message with IP',
        content:
          'This is the complete message content with all details including IP addresses like 192.168.1.100 and other important information that should not be truncated.',
        summary: 'This is a summary of the message',
        type: 'sync',
        priority: 'H',
        status: 'pending',
        created_at: new Date('2024-01-15'),
        thread_id: 'THREAD-123',
      },
    ]

    it('should show full content when detail_level is "full"', () => {
      const result = formatGetMessagesResponse(mockMessages, 'full')

      // Verify the full content is shown
      expect(result).toContain(
        'This is the complete message content with all details including IP addresses like 192.168.1.100'
      )
      expect(result).toContain('and other important information that should not be truncated.')
      expect(result).not.toContain('This is a summary') // Should not show summary
    })

    it('should show truncated summary when detail_level is "summary"', () => {
      const longSummary =
        'This is a very long summary that exceeds 150 characters and should be truncated when displayed. It contains lots of details that will be cut off with ellipsis at the end when shown in summary mode.'
      const messages = [
        {
          ...mockMessages[0],
          summary: longSummary,
        },
      ]

      const result = formatGetMessagesResponse(messages, 'summary')

      // Verify summary is truncated at 150 chars
      expect(result).toContain(longSummary.substring(0, 150))
      expect(result).toContain('...')
      expect(result).not.toContain('This is the complete message content') // Should not show full content
    })

    it('should show no content when detail_level is "index"', () => {
      const result = formatGetMessagesResponse(mockMessages, 'index')

      // Verify no content or summary is shown
      expect(result).not.toContain('This is the complete message content')
      expect(result).not.toContain('This is a summary')
      // But metadata should still be there
      expect(result).toContain('MSG-123')
      expect(result).toContain('Test Message with IP')
      expect(result).toContain('@sender')
    })

    it('should default to full content when detail_level is not specified', () => {
      // When not specified, it defaults to 'full'
      const result = formatGetMessagesResponse(mockMessages)

      expect(result).toContain(
        'This is the complete message content with all details including IP addresses like 192.168.1.100'
      )
    })
  })

  describe('Search Results Content Display', () => {
    it('should show full content for short messages in search results', () => {
      const shortContent = 'Short message with IP 192.168.1.100'
      const results = [
        {
          message: {
            id: 'MSG-200',
            from: '@sender',
            subject: 'Test',
            content: shortContent,
            created_at: new Date('2024-01-15'),
          },
          relevance_score: 0.95,
          match_context: null,
        },
      ]

      const result = formatSearchResponse(results)

      // Full short content should be shown
      expect(result).toContain(shortContent)
      expect(result).not.toContain('...')
    })

    it('should truncate long content in search results', () => {
      const longContent = 'A'.repeat(250) // 250 characters
      const results = [
        {
          message: {
            id: 'MSG-201',
            from: '@sender',
            subject: 'Test',
            content: longContent,
            created_at: new Date('2024-01-15'),
          },
          relevance_score: 0.9,
          match_context: null,
        },
      ]

      const result = formatSearchResponse(results)

      // Content should be truncated at 200 chars
      expect(result).toContain('A'.repeat(200))
      expect(result).toContain('...')
      expect(result).not.toContain('A'.repeat(201))
    })

    it('should prefer match_context over content preview', () => {
      const matchContext = 'This is the specific match context showing IP 192.168.1.100'
      const content = 'This is the full message content that is different and very long'

      const results = [
        {
          message: {
            id: 'MSG-202',
            from: '@sender',
            subject: 'Test',
            content: content,
            created_at: new Date('2024-01-15'),
          },
          relevance_score: 0.85,
          match_context: matchContext,
        },
      ]

      const result = formatSearchResponse(results)

      // Match context should be shown instead of content
      expect(result).toContain(matchContext)
      expect(result).not.toContain('This is the full message content')
    })
  })

  describe('Real-world scenarios', () => {
    it('should properly display IP addresses in full mode', () => {
      const messages = [
        {
          id: 'SYNC-123',
          from: '@nlp-team',
          to: ['@backend'],
          subject: 'Voice API Server Ready',
          content:
            'El servidor de voice API está listo en http://192.168.1.100:7004/process. CORS está configurado para aceptar requests desde la app móvil.',
          summary: 'Voice API server ready at http://192...',
          type: 'sync',
          priority: 'H',
          status: 'pending',
          created_at: new Date('2024-01-15'),
          thread_id: 'VOICE-API-thread',
        },
      ]

      const result = formatGetMessagesResponse(messages, 'full')

      // Full IP should be visible
      expect(result).toContain('http://192.168.1.100:7004/process')
      expect(result).toContain('CORS está configurado')
    })

    it('should truncate IP addresses in summary mode', () => {
      const messages = [
        {
          id: 'SYNC-124',
          from: '@nlp-team',
          to: ['@backend'],
          subject: 'Database Connection String',
          content: 'Full connection details here',
          summary:
            'Please use the following connection string for the database: postgresql://user:pass@192.168.1.50:5432/mydb. This includes all necessary authentication.',
          type: 'sync',
          priority: 'H',
          status: 'pending',
          created_at: new Date('2024-01-15'),
          thread_id: 'DB-thread',
        },
      ]

      const result = formatGetMessagesResponse(messages, 'summary')

      // Should be truncated
      expect(result).toContain('Please use the following connection string')
      expect(result).toContain('...')
      // Full connection string might be cut off
      expect(result.length).toBeLessThan(messages[0].summary.length + 200) // Some overhead for formatting
    })
  })
})
