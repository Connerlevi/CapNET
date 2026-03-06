# CapNet Core Demo - Capability Lifecycle
# Records the main demo showing issue -> allow -> deny -> revoke flow

Output demos/capnet-core-demo.mp4

Set FontSize 14
Set Width 1200
Set Height 900
Set Theme "Dracula"

Type "cd /mnt/c/Users/levic/CapNET"
Enter
Sleep 500ms

Type "# CapNet Demo: Capability-based authorization for AI agents"
Enter
Sleep 1.5s

Type "node node_modules/tsx/dist/cli.mjs sdk/src/demo.ts --record"
Enter
Sleep 30s

Sleep 5s
