# 🤖 Claude Coordination Protocol (CCP)

> **The ultimate MCP server for seamless multi-Claude collaboration**

[![NPM Version](https://img.shields.io/npm/v/claude-coordination-protocol.svg)](https://www.npmjs.com/package/claude-coordination-protocol)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-90%25+-green.svg)](https://github.com/beetoken/claude-coordination-protocol)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Transform chaotic multi-Claude development into orchestrated brilliance.** 

CCP enables multiple Claude instances to communicate, coordinate, and collaborate seamlessly across your entire project - whether you're building complex applications, conducting code reviews, or managing architectural decisions.

---

## ✨ **Why Claude Coordination Protocol?**

### 🔥 **Before CCP**: Chaos
```
Claude Frontend: "I updated the API interface..."
Claude Backend: "What interface? I don't see any changes..."
Claude Security: "Are we even talking about the same feature?"
Developer: *frustrated* "How do I keep everyone in sync?!"
```

### 🎯 **After CCP**: Perfect Harmony
```typescript
// Frontend Claude sends:
await ccp_send_message({
  to: ["@backend", "@security"],
  type: "contract",
  priority: "H",
  subject: "New Auth API - Breaking Changes",
  content: "Updated /auth/login to require 2FA token...",
  suggested_approach: {
    superclaude_commands: ["/sc:analyze --security", "/sc:implement"],
    superclaude_personas: ["--persona-security", "--persona-backend"],
    analysis_focus: ["authentication", "breaking-changes", "migration"]
  }
})

// Backend & Security Claude instantly know exactly what to do! 🚀
```

---

## 🚀 **Instant Setup**

```bash
# One command to rule them all
npm install -g claude-coordination-protocol

# Initialize in your project (takes 30 seconds)
cd your-awesome-project
ccp init --participant-id="@backend"

# That's it! Claude Code automatically picks it up 🎉
```

**What just happened?** CCP created a `.coordination/` folder and configured everything for multi-Claude magic!

---

## 💫 **Mind-Blowing Examples**

### 🏗️ **Example 1: Architecture Decision**

```typescript
// @architect Claude shares architectural insights
await ccp_send_message({
  to: ["@frontend", "@backend", "@mobile"],
  type: "arch",
  priority: "H",
  subject: "New Microservices Architecture - READ ASAP",
  content: `
🏗️ ARCHITECTURAL DECISION: Microservices Migration

DECISION: Split monolith into 4 services:
- User Service (handles auth, profiles)
- Payment Service (billing, subscriptions)  
- Content Service (posts, media)
- Notification Service (emails, push, SMS)

IMPACT: All teams need to update their integration patterns.
TIMELINE: Start next sprint, complete in 3 weeks.

📋 NEXT ACTIONS:
- Frontend: Update API client to handle service discovery
- Backend: Implement service mesh communication
- Mobile: Add retry logic for distributed calls
  `,
  response_required: true,
  expires_in_hours: 48,
  suggested_approach: {
    superclaude_commands: ["/sc:analyze --architecture", "/sc:design"],
    superclaude_personas: ["--persona-architect", "--persona-backend"],
    superclaude_flags: ["--think-hard", "--ultrathink"],
    analysis_focus: ["microservices", "api-design", "data-consistency"],
    tools_recommended: ["Sequential", "Context7"]
  }
})
```

**Result**: Every Claude instantly understands the change, knows their role, and has intelligent suggestions for implementation! 🎯

### 🔒 **Example 2: Security Alert**

```typescript
// @security Claude discovers vulnerability
await ccp_send_message({
  to: ["@backend", "@devops", "@frontend"],
  type: "emergency",
  priority: "CRITICAL",
  subject: "🚨 SQL Injection in User Login - PATCH IMMEDIATELY",
  content: `
🔴 CRITICAL SECURITY VULNERABILITY DETECTED

FILE: src/auth/login.ts:42
ISSUE: SQL injection in username parameter
SEVERITY: Critical (CVSS 9.8)

VULNERABLE CODE:
\`\`\`sql
SELECT * FROM users WHERE username = '${username}'
\`\`\`

EXPLOITATION: Attacker can dump entire user database
IMMEDIATE ACTION REQUIRED: Stop deployments, patch within 2 hours

PATCH: Use parameterized queries immediately:
\`\`\`typescript
SELECT * FROM users WHERE username = ?
\`\`\`

@backend: Fix this now, all other work stops
@devops: Block production deployments  
@frontend: Check for similar patterns in client code
  `,
  response_required: true,
  expires_in_hours: 2,
  suggested_approach: {
    superclaude_commands: ["/sc:analyze --security --emergency", "/sc:fix"],
    superclaude_personas: ["--persona-security", "--persona-backend"],
    superclaude_flags: ["--safe-mode", "--validate", "--ultrathink"],
    analysis_focus: ["sql-injection", "parameterized-queries", "security-audit"],
    tools_recommended: ["Sequential", "Context7"]
  }
})
```

**Result**: Instant coordinated response - security patches deployed in minutes, not hours! 🛡️

### 🎨 **Example 3: Feature Collaboration**

```typescript
// @product Claude defines new feature
await ccp_send_message({
  to: ["@frontend", "@backend", "@mobile"],
  type: "contract",
  priority: "H", 
  subject: "New Feature: Dark Mode + User Preferences System",
  content: `
🎨 NEW FEATURE SPEC: Advanced User Preferences

OVERVIEW: Users can customize their experience with:
- Dark/Light/Auto theme modes
- Notification preferences (email, push, SMS)
- Language selection (EN, ES, FR, DE)
- Accessibility options (large text, high contrast)

API CONTRACT:
GET /api/user/preferences -> UserPreferences
PUT /api/user/preferences -> UpdatedPreferences

FRONTEND TASKS:
- Theme switcher in header
- Preferences modal with tabs
- Real-time theme switching
- Save preferences locally + sync to server

BACKEND TASKS:  
- UserPreferences model
- Validation for preference values
- Migration for existing users (default preferences)

MOBILE TASKS:
- Settings screen redesign
- Dark mode implementation
- Push notification toggles
  `,
  response_required: true,
  expires_in_hours: 24,
  suggested_approach: {
    superclaude_commands: ["/sc:implement", "/sc:design --ui"],
    superclaude_personas: ["--persona-frontend", "--persona-backend"],
    superclaude_flags: ["--magic", "--c7"],
    analysis_focus: ["ui-design", "api-design", "user-experience"],
    tools_recommended: ["Magic", "Context7", "Sequential"]
  }
})
```

**Magic happens**: Each Claude gets perfectly tailored suggestions for their domain! 🪄

---

## 🎛️ **Powerful Features**

### 🔍 **Intelligent Search**
```typescript
// Find anything in seconds with semantic search
await ccp_search_messages({
  query: "authentication security API changes",
  semantic: true,
  tags: ["breaking-change", "security"],
  priority: ["H", "CRITICAL"],
  limit: 10
})
```

### ⚡ **Token Optimization** 
CCP automatically optimizes Claude's context:
- **Layered Loading**: Only load what you need (50-200 tokens per message)
- **Smart Compression**: Summarize old conversations 
- **Intelligent Filtering**: Show only relevant messages

### 🧠 **SuperClaude Integration**
Every message can include intelligent suggestions:
```typescript
{
  "suggested_approach": {
    "superclaude_commands": ["/sc:analyze --security", "/sc:implement"],
    "superclaude_personas": ["--persona-security", "--persona-backend"], 
    "superclaude_flags": ["--think-hard", "--validate"],
    "analysis_focus": ["sql-injection", "input-validation"],
    "tools_recommended": ["Sequential", "Context7"]
  }
}
```

### 📊 **Real-time Dashboard**
```bash
ccp status
# 📊 System Status
# ┌─────────────────┬───────┐
# │ Active Messages │   12  │
# │ Participants    │    4  │  
# │ Threads         │    8  │
# │ Storage Used    │ 2.3MB │
# └─────────────────┴───────┘
```

---

## 🎯 **Core MCP Tools**

| Tool | Purpose | Example |
|------|---------|---------|
| `ccp_send_message` | Send coordination messages | Cross-team feature specs |
| `ccp_get_messages` | Retrieve filtered messages | Get your pending tasks |
| `ccp_search_messages` | Semantic search | Find security discussions |
| `ccp_respond_message` | Reply to messages | Provide implementation updates |
| `ccp_compact_thread` | Optimize token usage | Summarize long discussions |
| `ccp_whoami` | Show your identity | Which Claude am I? |
| `ccp_help` | Get help | How do I use this tool? |
| `ccp_setup_guide` | Interactive guides | Help me get started |

---

## 🏃‍♂️ **Quick Examples**

### 📨 **Send a Message**
```typescript
await ccp_send_message({
  to: ["@mobile"],
  type: "sync",
  priority: "M",
  subject: "API endpoint is ready",
  content: "The new /users/profile endpoint is deployed and tested. Integration can begin!",
  tags: ["api", "ready-for-integration"]
})
```

### 📥 **Get Your Messages**
```typescript
// Check what needs your attention
await ccp_get_messages({
  status: ["pending"],
  priority: ["H", "CRITICAL"],
  limit: 5,
  detail_level: "summary"
})
```

### 🔍 **Search Everything**
```typescript
// Find that security discussion from last week
await ccp_search_messages({
  query: "JWT token expiration security",
  date_range: {
    from: "2024-01-15",
    to: "2024-01-22"
  }
})
```

---

## ⚙️ **Configuration**

### 📁 **Project Setup**
```yaml
# .coordination/config.yaml
participant_id: "@backend"
data_directory: ".coordination"
archive_days: 30
auto_compact: true

participants:
  - id: "@frontend"
    capabilities: ["ui", "react", "typescript"]
    default_priority: "M"
  - id: "@backend" 
    capabilities: ["api", "database", "auth"]
    default_priority: "M"
  - id: "@security"
    capabilities: ["audit", "compliance", "penetration-testing"]
    default_priority: "H"
  - id: "@mobile"
    capabilities: ["ios", "android", "react-native"]
    default_priority: "M"
```

### 🔌 **Claude Code Integration**
```json
{
  "mcpServers": {
    "claude-coordination-protocol": {
      "command": "ccp",
      "args": ["server"],
      "env": {
        "CCP_PARTICIPANT_ID": "@backend"
      }
    }
  }
}
```

---

## 📋 **Message Types**

| Type | Purpose | Example Use Case |
|------|---------|------------------|
| `arch` | Architecture decisions | "Moving to microservices" |
| `contract` | API contracts & interfaces | "New auth endpoint spec" |
| `sync` | Status updates | "Feature is ready for testing" |
| `update` | Progress reports | "50% complete on user dashboard" |
| `q` | Questions | "Should we use Redis or Memcached?" |
| `emergency` | Critical issues | "Production down - all hands!" |
| `broadcast` | Announcements | "Team meeting at 3pm" |

> **⚠️ Important Note**: System-generated messages (from `@system`) are read-only. While participants can view these messages if they're recipients, they cannot respond directly to `@system` as it's not a registered participant. To discuss system messages, create a new message thread between active participants.

---

## 🎖️ **Priority Levels**

| Priority | Response Time | Example |
|----------|---------------|---------|
| `CRITICAL` | Immediate | Production outage |
| `H` | Within hours | Security vulnerability |
| `M` | Within days | Feature specification |
| `L` | When convenient | Code cleanup |

---

## 🛠️ **CLI Commands**

```bash
# Initialize new project
ccp init --participant-id="@backend"

# Send a quick message
ccp send --to="@frontend" --subject="API ready" --content="Integration can start"

# Check your inbox
ccp list --status=pending --priority=H

# Search messages  
ccp search "authentication API"

# Get system status
ccp status

# Compact old threads
ccp compact --thread-id=AUTH-001 --strategy=summarize

# Import from old systems
ccp migrate --from=LLM_COORDINATION.md
```

---

## 🧪 **Development**

```bash
# Clone and setup
git clone https://github.com/beetoken/claude-coordination-protocol
cd claude-coordination-protocol
npm install

# Development with hot reload
npm run dev

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Lint and format
npm run lint && npm run format
```

---

## 🔧 **Advanced Features**

### 🗜️ **Automatic Token Optimization**
```typescript
// CCP automatically compacts threads when they get too long
await ccp_compact_thread({
  thread_id: "AUTH-001-thread", 
  strategy: "summarize", // or "consolidate", "archive"
  preserve_decisions: true,
  max_tokens: 2000
})
```

### 📈 **Analytics & Insights**
```typescript
// Get system statistics
await ccp_get_stats({
  time_range: "last_7_days",
  include_participants: true,
  include_thread_analytics: true
})
```

### 🔄 **Migration from Manual Systems**
```bash
# Import your existing coordination files
ccp migrate --from=LLM_COORDINATION.md --format=markdown
# CCP intelligently parses and imports everything!
```

---

## 🏆 **Success Stories**

> **"CCP transformed our 4-Claude development team from chaos to symphony. We ship features 3x faster now!"**  
> — *Senior Developer at TechCorp*

> **"Security reviews that used to take days now happen in real-time. Game changer!"**  
> — *Security Architect at FinanceApp*

> **"Our mobile and backend teams finally speak the same language. No more integration surprises!"**  
> — *Product Manager at StartupXYZ*

---

## 🤝 **Contributing**

We love contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b amazing-feature`)
3. **Add** comprehensive tests (we require >90% coverage)
4. **Commit** with conventional commits (`feat:`, `fix:`, etc.)
5. **Submit** a pull request

---

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🆘 **Support & Community**

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/beetoken/claude-coordination-protocol/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/beetoken/claude-coordination-protocol/discussions)
- 📚 **Documentation**: [Full Docs](https://github.com/beetoken/claude-coordination-protocol/docs)
- 🎯 **Examples**: [Example Projects](https://github.com/beetoken/claude-coordination-protocol/examples)

---

<div align="center">

### 🚀 **Ready to orchestrate your Claude army?**

```bash
npm install -g claude-coordination-protocol
ccp init --participant-id="@your-role"
```

**Transform chaos into coordination. Start building the future with Claude Coordination Protocol! 🤖✨**

</div>