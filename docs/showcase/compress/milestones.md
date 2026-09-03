# Milestone Auto-Compaction & Snapshots

When agents complete major milestones, `oh-my-hook` captures git diffs and automatically triggers background compaction once the session is idle.

---

## Post-Push Idle Workflow

```
[Agent runs git push] ──► [Record Milestone Branch & Diffs]
 │
 ▼
 [Wait for Agent Idle]
 │
 ┌───────────┴───────────┐
 ▼ ▼
 [Cooldown Exceeded] [Under Threshold]
 │ │
 Run Auto-Compaction Skip
```

### 1. Milestone Detection
`compress/automation.js` intercepts successful `git push` commands, recording the target remote branch and modified file list.

### 2. Idle State Trigger
When the agent finishes responses and enters an idle state, `oh-my-hook` evaluates:
- Minimum session messages ($\ge 30$).
- Turns since push ($\ge 2$).
- Session cooldown timer ($10$ minutes).

### 3. Compaction Snapshot
Prior to compaction, a structured snapshot containing active git branches, uncommitted file diffs, and pending todos is injected into the compaction context, preventing post-compaction disorientation.
