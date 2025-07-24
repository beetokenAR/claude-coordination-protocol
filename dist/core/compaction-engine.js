import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';
import { withFileLock } from '../utils/file-lock.js';
import { validateInput } from '../utils/validation.js';
import { CompactThreadInput, ValidationError } from '../types/index.js';
export class CompactionEngine {
    db;
    dataDir;
    // Prepared statements
    selectThreadMessages;
    updateMessageStatus;
    insertCompactedMessage;
    selectConversation;
    updateConversation;
    constructor(db, dataDir) {
        this.db = db;
        this.dataDir = dataDir;
        this.prepareStatements();
    }
    prepareStatements() {
        this.selectThreadMessages = this.db.prepare(`
      SELECT * FROM messages 
      WHERE thread_id = ? 
      ORDER BY created_at ASC
    `);
        this.updateMessageStatus = this.db.prepare(`
      UPDATE messages SET status = 'archived', updated_at = ? WHERE id = ?
    `);
        this.insertCompactedMessage = this.db.prepare(`
      INSERT INTO messages (
        id, thread_id, from_participant, to_participants, type, priority, status,
        subject, summary, content_ref, created_at, updated_at, expires_at,
        response_required, dependencies, tags, semantic_vector
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        this.selectConversation = this.db.prepare(`
      SELECT * FROM conversations WHERE thread_id = ?
    `);
        this.updateConversation = this.db.prepare(`
      UPDATE conversations SET 
        status = ?, resolution_summary = ?, last_activity = ?
      WHERE thread_id = ?
    `);
    }
    /**
     * Compact a conversation thread using specified strategy
     */
    async compactThread(input, requestingParticipant) {
        const rawValidated = validateInput(CompactThreadInput, input, 'compact thread');
        const validated = {
            ...rawValidated,
            strategy: rawValidated.strategy ?? 'summarize',
            preserve_decisions: rawValidated.preserve_decisions ?? true,
            preserve_critical: rawValidated.preserve_critical ?? true
        };
        return withFileLock(this.dataDir, async () => {
            // Get all messages in the thread
            const messages = this.selectThreadMessages.all(validated.thread_id);
            if (messages.length === 0) {
                throw new ValidationError(`Thread not found: ${validated.thread_id}`);
            }
            // Check permissions - requesting participant must be involved in the thread
            const participantIds = new Set();
            for (const msg of messages) {
                participantIds.add(msg.from_participant);
                const toParticipants = JSON.parse(msg.to_participants);
                toParticipants.forEach((id) => participantIds.add(id));
            }
            if (!participantIds.has(requestingParticipant)) {
                throw new ValidationError('Access denied: not authorized to compact this thread');
            }
            const originalSizeBytes = await this.calculateThreadSize(validated.thread_id);
            let compactionResult;
            switch (validated.strategy) {
                case 'summarize':
                    compactionResult = await this.summarizeThread(messages, validated);
                    break;
                case 'consolidate':
                    compactionResult = await this.consolidateThread(messages, validated);
                    break;
                case 'archive':
                    compactionResult = await this.archiveThread(messages, validated);
                    break;
                default:
                    throw new ValidationError(`Unknown compaction strategy: ${validated.strategy}`);
            }
            const finalSizeBytes = await this.calculateThreadSize(validated.thread_id);
            return {
                ...compactionResult,
                space_saved_bytes: originalSizeBytes - finalSizeBytes
            };
        });
    }
    /**
     * Auto-compact old resolved threads
     */
    async autoCompactThreads(olderThanDays = 30, strategy = 'summarize') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        return withFileLock(this.dataDir, async () => {
            // Find old resolved conversations
            const oldThreads = this.db.prepare(`
        SELECT thread_id FROM conversations 
        WHERE status = 'resolved' 
        AND last_activity < ?
      `).all(cutoffDate.toISOString());
            const results = [];
            for (const { thread_id } of oldThreads) {
                try {
                    const result = await this.compactThread({ thread_id, strategy, preserve_decisions: true, preserve_critical: true }, '@system' // System-initiated compaction
                    );
                    results.push(result);
                }
                catch (error) {
                    console.warn(`Failed to compact thread ${thread_id}:`, error);
                }
            }
            return results;
        });
    }
    /**
     * Calculate token usage for optimization decisions
     */
    async calculateTokenUsage(participantId) {
        const messages = this.db.prepare(`
      SELECT status, priority, subject, summary, content_ref FROM messages
      WHERE from_participant = ? OR json_extract(to_participants, '$[*]') LIKE '%' || ? || '%'
    `).all(participantId, participantId);
        let totalTokens = 0;
        const byStatus = {};
        const byPriority = {};
        const recommendations = [];
        for (const msg of messages) {
            // Rough token estimation: ~4 characters per token
            let messageTokens = Math.ceil((msg.subject.length + msg.summary.length) / 4);
            // Add content file size if exists
            if (msg.content_ref) {
                try {
                    const contentPath = path.join(this.dataDir, msg.content_ref);
                    const content = await fs.readFile(contentPath, 'utf-8');
                    messageTokens += Math.ceil(content.length / 4);
                }
                catch {
                    // File might not exist, use summary length
                }
            }
            totalTokens += messageTokens;
            byStatus[msg.status] = (byStatus[msg.status] || 0) + messageTokens;
            byPriority[msg.priority] = (byPriority[msg.priority] || 0) + messageTokens;
        }
        // Generate recommendations
        if (totalTokens > 50000) {
            recommendations.push('Consider archiving resolved messages');
        }
        if (byStatus.archived && byStatus.archived > totalTokens * 0.3) {
            recommendations.push('High proportion of archived messages - consider cleanup');
        }
        if (byPriority.L && byPriority.L > totalTokens * 0.4) {
            recommendations.push('Many low-priority messages - consider bulk archiving');
        }
        return {
            total_estimated_tokens: totalTokens,
            by_status: byStatus,
            by_priority: byPriority,
            recommendations
        };
    }
    async summarizeThread(messages, options) {
        // Group messages by type and status
        const messageGroups = this.groupMessages(messages);
        // Create summary preserving important information
        const summary = this.createThreadSummary(messageGroups, options);
        // Create a single summarized message
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        const compactedMessage = {
            id: `${firstMessage.thread_id}-SUMMARY`,
            thread_id: firstMessage.thread_id,
            from: '@system',
            to: JSON.parse(firstMessage.to_participants),
            type: firstMessage.type,
            priority: firstMessage.priority,
            status: 'archived',
            subject: `Summary: ${firstMessage.subject}`,
            summary,
            content_ref: await this.storeCompactedContent(firstMessage.thread_id, 'summary', summary),
            created_at: new Date(firstMessage.created_at),
            updated_at: new Date(),
            expires_at: null,
            response_required: false,
            dependencies: [],
            tags: ['compacted', 'summary', ...this.extractCommonTags(messages)]
        };
        // Archive original messages and insert summary
        await this.replaceWithCompacted(messages, compactedMessage);
        return {
            original_count: messages.length,
            compacted_count: 1,
            space_saved_bytes: 0, // Will be calculated by caller
            summary
        };
    }
    async consolidateThread(messages, options) {
        // Remove duplicate information and merge related messages
        const consolidatedMessages = this.consolidateMessages(messages, options);
        // Archive original messages and insert consolidated ones
        for (const msg of consolidatedMessages) {
            await this.archiveContentFiles([msg]);
        }
        // Insert consolidated messages
        const now = new Date().toISOString();
        this.db.transaction(() => {
            // Archive originals
            for (const msg of messages) {
                this.updateMessageStatus.run(now, msg.id);
            }
            // Insert consolidated
            for (const msg of consolidatedMessages) {
                this.insertCompactedMessage.run(msg.id, msg.thread_id, msg.from, JSON.stringify(msg.to), msg.type, msg.priority, msg.status, msg.subject, msg.summary, msg.content_ref, msg.created_at.toISOString(), msg.updated_at.toISOString(), msg.expires_at?.toISOString() || null, msg.response_required ? 1 : 0, JSON.stringify(msg.dependencies), JSON.stringify(msg.tags), null);
            }
        });
        return {
            original_count: messages.length,
            compacted_count: consolidatedMessages.length,
            space_saved_bytes: 0 // Will be calculated by caller
        };
    }
    async archiveThread(messages, options) {
        const now = new Date().toISOString();
        // Move content files to archive
        await this.archiveContentFiles(messages);
        // Update message status
        this.db.transaction(() => {
            for (const msg of messages) {
                this.updateMessageStatus.run(now, msg.id);
            }
        });
        // Update conversation status
        this.updateConversation.run('archived', 'Thread archived due to age/resolution', now, messages[0].thread_id);
        return {
            original_count: messages.length,
            compacted_count: messages.length, // Messages still exist but archived
            space_saved_bytes: 0 // Content moved to archive
        };
    }
    groupMessages(messages) {
        const groups = {
            decisions: [],
            critical: [],
            resolved: [],
            responses: [],
            other: []
        };
        for (const msg of messages) {
            const tags = JSON.parse(msg.tags);
            if (msg.priority === 'CRITICAL') {
                groups.critical.push(msg);
            }
            else if (tags.includes('decision') || msg.subject.toLowerCase().includes('decision')) {
                groups.decisions.push(msg);
            }
            else if (msg.status === 'resolved') {
                groups.resolved.push(msg);
            }
            else if (tags.some((tag) => tag.startsWith('response_to:'))) {
                groups.responses.push(msg);
            }
            else {
                groups.other.push(msg);
            }
        }
        return groups;
    }
    createThreadSummary(groups, options) {
        const parts = [];
        if (groups.critical.length > 0) {
            parts.push(`## Critical Issues (${groups.critical.length})`);
            for (const msg of groups.critical) {
                parts.push(`- ${msg.subject}: ${msg.summary.substring(0, 100)}...`);
            }
        }
        if (groups.decisions.length > 0 && options.preserve_decisions) {
            parts.push(`## Decisions Made (${groups.decisions.length})`);
            for (const msg of groups.decisions) {
                parts.push(`- ${msg.subject}: ${msg.summary.substring(0, 150)}...`);
            }
        }
        if (groups.resolved.length > 0) {
            parts.push(`## Resolved Items (${groups.resolved.length})`);
            const resolutionSummary = groups.resolved
                .map(msg => msg.subject)
                .join(', ');
            parts.push(`Items resolved: ${resolutionSummary}`);
        }
        if (groups.other.length > 0) {
            parts.push(`## Other Communications (${groups.other.length})`);
            parts.push(`Various discussions and updates between participants.`);
        }
        const totalMessages = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
        parts.unshift(`# Thread Summary\nCompacted ${totalMessages} messages from ${groups.responses.length} exchanges.\n`);
        return parts.join('\n\n');
    }
    consolidateMessages(messages, options) {
        // Simple consolidation - group by participant and merge similar content
        const consolidated = [];
        const messagesByParticipant = new Map();
        for (const msg of messages) {
            if (options.preserve_critical && msg.priority === 'CRITICAL') {
                consolidated.push(msg); // Keep critical messages unchanged
                continue;
            }
            const key = `${msg.from}_${msg.type}_${msg.priority}`;
            if (!messagesByParticipant.has(key)) {
                messagesByParticipant.set(key, []);
            }
            messagesByParticipant.get(key).push(msg);
        }
        // Merge messages from same participant with same type/priority
        for (const [key, msgs] of messagesByParticipant) {
            if (msgs.length === 1) {
                consolidated.push(msgs[0]);
            }
            else {
                // Create consolidated message
                const first = msgs[0];
                const last = msgs[msgs.length - 1];
                consolidated.push({
                    ...first,
                    id: `${first.id}-CONSOLIDATED`,
                    subject: msgs.length > 2
                        ? `Consolidated: ${first.subject} (+${msgs.length - 1} more)`
                        : `Consolidated: ${first.subject}`,
                    summary: this.mergeSummaries(msgs),
                    updated_at: new Date(last.updated_at),
                    tags: [...JSON.parse(first.tags), 'consolidated']
                });
            }
        }
        return consolidated;
    }
    mergeSummaries(messages) {
        if (messages.length === 1) {
            return messages[0].summary;
        }
        const summaries = messages.map((msg, index) => `${index + 1}. ${msg.summary.substring(0, 200)}${msg.summary.length > 200 ? '...' : ''}`);
        return `Consolidated ${messages.length} messages:\n\n${summaries.join('\n\n')}`;
    }
    extractCommonTags(messages) {
        const tagCounts = new Map();
        for (const msg of messages) {
            const tags = JSON.parse(msg.tags);
            for (const tag of tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        }
        // Return tags that appear in at least 25% of messages
        const threshold = Math.ceil(messages.length * 0.25);
        return Array.from(tagCounts.entries())
            .filter(([_, count]) => count >= threshold)
            .map(([tag, _]) => tag);
    }
    async storeCompactedContent(threadId, type, content) {
        const archiveDir = path.join(this.dataDir, 'messages', 'archive', format(new Date(), 'yyyy/MM'));
        await fs.mkdir(archiveDir, { recursive: true });
        const fileName = `${threadId}-${type}-${Date.now()}.md`;
        const filePath = path.join(archiveDir, fileName);
        await fs.writeFile(filePath, content, 'utf-8');
        return path.relative(this.dataDir, filePath);
    }
    async replaceWithCompacted(originalMessages, compactedMessage) {
        const now = new Date().toISOString();
        this.db.transaction(() => {
            // Archive original messages
            for (const msg of originalMessages) {
                this.updateMessageStatus.run(now, msg.id);
            }
            // Insert compacted message
            this.insertCompactedMessage.run(compactedMessage.id, compactedMessage.thread_id, compactedMessage.from, JSON.stringify(compactedMessage.to), compactedMessage.type, compactedMessage.priority, compactedMessage.status, compactedMessage.subject, compactedMessage.summary, compactedMessage.content_ref, compactedMessage.created_at.toISOString(), compactedMessage.updated_at.toISOString(), null, // expires_at
            0, // response_required
            JSON.stringify(compactedMessage.dependencies), JSON.stringify(compactedMessage.tags), null // semantic_vector
            );
        });
    }
    async archiveContentFiles(messages) {
        const archiveDate = format(new Date(), 'yyyy/MM');
        const archiveDir = path.join(this.dataDir, 'messages', 'archive', archiveDate);
        await fs.mkdir(archiveDir, { recursive: true });
        for (const msg of messages) {
            if (msg.content_ref) {
                try {
                    const sourcePath = path.join(this.dataDir, msg.content_ref);
                    const archivePath = path.join(archiveDir, path.basename(msg.content_ref));
                    await fs.rename(sourcePath, archivePath);
                }
                catch (error) {
                    console.warn(`Failed to archive content file for message ${msg.id}:`, error);
                }
            }
        }
    }
    async calculateThreadSize(threadId) {
        const messages = this.selectThreadMessages.all(threadId);
        let totalSize = 0;
        for (const msg of messages) {
            // Count database row size (rough estimate)
            totalSize += JSON.stringify(msg).length;
            // Count content file size if exists
            if (msg.content_ref) {
                try {
                    const contentPath = path.join(this.dataDir, msg.content_ref);
                    const stats = await fs.stat(contentPath);
                    totalSize += stats.size;
                }
                catch {
                    // File might not exist
                }
            }
        }
        return totalSize;
    }
}
//# sourceMappingURL=compaction-engine.js.map