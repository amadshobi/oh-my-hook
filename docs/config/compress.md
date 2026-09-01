# Compress Configuration

Configuration options for generic size-based dynamic pruning, selective command
protection, live TUI toast notifications, and post-push auto-compaction.

---

## Full Schema

```jsonc
// ~/.config/opencode/omh.jsonc
{
 "compress": {
 "enabled": true,

 // Compression mode: "auto" (deterministic), "model" (model-driven tool),
 // or "hybrid" (both — default)
 "mode": "hybrid",

 // Generic size-based dynamic pruning configuration
 "pruning": {
 "enabled": true,
 "recentTurns": 2, // Number of recent turns completely protected
 "keepHeadChars": 500, // Head chars preserved when collapsing
 "keepTailChars": 1500, // Tail chars preserved (success/error output)
 "minOutputChars": 2000, // Minimum size before collapsing ANY eligible tool output
 "keepImportantLines": true, // Preserve error/pass/summary lines from the middle

 // Automatic strategies (DCP-style)
 "strategies": {
 "deduplication": {
 "enabled": true,
 "protectedTools": ["read", "write", "edit", "grep", "glob"]
 },
 "purgeErrors": {
 "enabled": true,
 "turns": 4 // Turns before errored tool inputs are pruned
 }
 },

 // Deterministic auto range compression (balanced, not over-aggressive)
 "compress": {
 "recentTurns": 2,
 "targetSaveRatio": 0.5, // Stop once ~50% of used tokens freed
 "minTokensToCompress": 30000, // Only compress when context is big enough
 "triggerRatio": 0.8 // Auto-compress when usage exceeds 80% of model context
 },

 // Live TUI toast notification on pruning events
 "toast": {
 "enabled": true,
 "cooldownMs": 30000 // Min gap between toasts (anti-spam)
 },

 // Per-session debug snapshot audit trail
 // (lazily generated at ~/.local/share/opencode/compress/<session-id>/snapshot.md)
 "debug": {
 "enabled": true, // Default ON; only writes when compress activity occurs
 "maxSessions": 20 // Retention: oldest sessions auto-cleaned
 },

 // Selective command pruning (dual-mode, empty = prune all above threshold)
 "commandPatterns": {
 "alwaysPrune": [
 "npm (install|ci|run build|test)",
 "git (commit|push|log|status|add)"
 ],
 "neverPrune": [
 "git (diff|show|log -p|blame)",
 "cat .*",
 "kubectl get -o yaml"
 ]
 },

 // Protected tools never pruned (read/write/edit/grep/glob/find/ls/todo/webfetch)
 "protectedTools": {
 "read": true,
 "write": true,
 "edit": true,
 "grep": true,
 "glob": true
 },

 // Tools eligible for pruning (default: bash only)
 "eligibleTools": {
 "bash": true
 },

 // Outputs containing these signals are NEVER pruned (failures stay intact)
 "failureSignals": {
 "fail": "FAILED|FAILURE|tests? failed",
 "crash": "panic:|Traceback|SyntaxError",
 "npm": "npm ERR!",
 "os": "EACCES|ENOENT|exit status 1"
 }
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
