# Compress Configuration

Configuration options for in-memory dynamic pruning and post-push auto-compaction.

---

## ⚙️ Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
  "compress": {
    "enabled": true,

    // In-memory dynamic pruning configuration
    "pruning": {
      "enabled": true,
      "recentTurns": 2, // Number of recent turns completely protected
      "keepHeadChars": 1000,
      "keepTailChars": 1500,
      "minOutputChars": 8000 // Minimum size before collapsing historical tool output
    },

    // Milestone post-push background compaction
    "milestones": {
      "enabled": true,
      "pushAutoCompress": true,
      "minMessages": 30,
      "minTurnsAfterPush": 2,
      "idleCooldownMs": 600000 // 10 minutes
    }
  }
}
```
