# SuperClaude Suggestions Examples

This document shows how to use the SuperClaude suggestions feature in CCP to guide recipient Claude instances.

## SuperClaude Command Reference

SuperClaude commands use the `/sc:` prefix:
- `/sc:analyze` - Analyze code or systems
- `/sc:implement` - Implement features
- `/sc:improve` - Improve existing code
- `/sc:fix` - Fix bugs or issues
- `/sc:test` - Create or run tests
- `/sc:document` - Create documentation
- `/sc:estimate` - Estimate complexity
- `/sc:task` - Create tasks

## Example Scenarios

### 1. Security Vulnerability Alert

```typescript
await ccp_send_message({
  to: ["@backend", "@frontend"],
  type: "emergency",
  priority: "CRITICAL",
  subject: "Critical XSS vulnerability in comment system",
  content: "User comments are rendered without escaping HTML. This allows script injection...",
  suggested_approach: {
    superclaude_commands: [
      "/sc:analyze --security",
      "/sc:fix --validate",
      "/sc:test --security"
    ],
    superclaude_personas: ["--persona-security", "--persona-qa"],
    superclaude_flags: ["--think-hard", "--validate", "--safe-mode"],
    analysis_focus: [
      "xss-prevention",
      "html-escaping", 
      "content-security-policy",
      "input-validation"
    ],
    tools_recommended: ["Sequential", "Context7"]
  }
})
```

### 2. API Contract Change

```typescript
await ccp_send_message({
  to: ["@mobile", "@frontend"],
  type: "contract",
  priority: "H",
  subject: "Breaking change: User API response format",
  content: "The /api/users endpoint now returns paginated results with metadata...",
  suggested_approach: {
    superclaude_commands: [
      "/sc:analyze --impact",
      "/sc:implement --backwards-compatible",
      "/sc:test --integration"
    ],
    superclaude_personas: ["--persona-frontend", "--persona-architect"],
    superclaude_flags: ["--c7", "--magic", "--think"],
    analysis_focus: [
      "type-definitions",
      "error-handling",
      "backwards-compatibility",
      "pagination-logic"
    ],
    tools_recommended: ["Context7", "Magic", "Sequential"]
  }
})
```

### 3. Performance Optimization Request

```typescript
await ccp_send_message({
  to: ["@backend"],
  type: "sync",
  priority: "M",
  subject: "Dashboard loading slowly (>5s)",
  content: "Users reporting dashboard takes 5-10 seconds to load. Metrics show DB queries...",
  suggested_approach: {
    superclaude_commands: [
      "/sc:analyze --performance",
      "/sc:improve --perf",
      "/sc:test --benchmark"
    ],
    superclaude_personas: ["--persona-performance", "--persona-backend"],
    superclaude_flags: ["--think-hard", "--metrics", "--profile"],
    analysis_focus: [
      "database-queries",
      "n+1-problems",
      "query-optimization",
      "caching-strategy",
      "index-usage"
    ],
    tools_recommended: ["Sequential", "Playwright"]
  }
})
```

### 4. Architecture Decision Request

```typescript
await ccp_send_message({
  to: ["@backend", "@frontend", "@mobile"],
  type: "arch",
  priority: "M",
  subject: "Proposal: Migrate to event-driven architecture",
  content: "To improve scalability and decouple services, proposing event-driven design...",
  suggested_approach: {
    superclaude_commands: [
      "/sc:analyze --arch",
      "/sc:estimate --complexity",
      "/sc:document --architecture"
    ],
    superclaude_personas: ["--persona-architect"],
    superclaude_flags: ["--ultrathink", "--validate", "--scope system"],
    analysis_focus: [
      "scalability-impact",
      "migration-complexity",
      "service-boundaries",
      "event-schemas",
      "rollback-strategy"
    ],
    tools_recommended: ["Sequential", "Context7"]
  }
})
```

### 5. Code Quality Improvement

```typescript
await ccp_send_message({
  to: ["@backend"],
  type: "update",
  priority: "L",
  subject: "Tech debt: Refactor user service",
  content: "UserService has grown to 2000+ lines with mixed responsibilities...",
  suggested_approach: {
    superclaude_commands: [
      "/sc:analyze --quality",
      "/sc:improve --refactor",
      "/sc:test --coverage"
    ],
    superclaude_personas: ["--persona-refactorer", "--persona-qa"],
    superclaude_flags: ["--think", "--validate", "--loop"],
    analysis_focus: [
      "single-responsibility",
      "dependency-injection",
      "test-coverage",
      "code-duplication"
    ],
    tools_recommended: ["Sequential", "Context7"]
  }
})
```

### 6. Feature Implementation

```typescript
await ccp_send_message({
  to: ["@mobile"],
  type: "sync",
  priority: "H",
  subject: "Implement offline mode for mobile app",
  content: "Users need to access core features without internet connection...",
  suggested_approach: {
    superclaude_commands: [
      "/sc:analyze --requirements",
      "/sc:implement --incremental",
      "/sc:test --offline"
    ],
    superclaude_personas: ["--persona-mobile", "--persona-frontend"],
    superclaude_flags: ["--c7", "--magic", "--think-hard"],
    analysis_focus: [
      "local-storage",
      "sync-strategy",
      "conflict-resolution",
      "data-consistency",
      "offline-ui-patterns"
    ],
    tools_recommended: ["Magic", "Context7", "Sequential"]
  }
})
```

## How Recipients Use Suggestions

When a Claude instance receives a message with suggestions:

1. **View the message with suggested approach**:
```typescript
const messages = await ccp_get_messages({ status: ["pending"] })
// Check messages[0].suggested_approach
```

2. **Apply the suggestions**:
```bash
# Use the suggested commands
/sc:analyze --security --persona-security --think-hard --validate

# Focus on suggested areas during analysis
# Use recommended MCP tools
```

3. **Respond with results**:
```typescript
await ccp_respond_message({
  message_id: "msg-001",
  content: "Fixed XSS vulnerability by implementing HTML escaping...",
  resolution_status: "complete"
})
```

## Best Practices

1. **Be Specific**: Provide concrete commands and flags, not generic advice
2. **Context Matters**: Include analysis_focus to guide investigation
3. **Tool Selection**: Recommend MCP tools that fit the task
4. **Persona Alignment**: Suggest personas that match the problem domain
5. **Graduated Response**: Use appropriate thinking depth (--think vs --ultrathink)

## Common Patterns

### Security Issues
```json
{
  "superclaude_commands": ["/sc:analyze --security", "/sc:fix --validate"],
  "superclaude_personas": ["--persona-security"],
  "superclaude_flags": ["--think-hard", "--safe-mode", "--validate"]
}
```

### Performance Problems
```json
{
  "superclaude_commands": ["/sc:analyze --performance", "/sc:improve --perf"],
  "superclaude_personas": ["--persona-performance"],
  "superclaude_flags": ["--metrics", "--profile", "--think-hard"]
}
```

### API Changes
```json
{
  "superclaude_commands": ["/sc:analyze --impact", "/sc:implement"],
  "superclaude_personas": ["--persona-frontend", "--persona-backend"],
  "superclaude_flags": ["--c7", "--validate"]
}
```

### Architecture Decisions
```json
{
  "superclaude_commands": ["/sc:analyze --arch", "/sc:estimate"],
  "superclaude_personas": ["--persona-architect"],
  "superclaude_flags": ["--ultrathink", "--scope system"]
}
```