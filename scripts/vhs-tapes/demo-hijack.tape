# CapNet Demo - Agent Hijack Scenario
# Shows how CapNet prevents damage from prompt injection

Output demos/capnet-agent-hijack.mp4

Set FontSize 14
Set Width 1200
Set Height 900
Set Theme "Dracula"

Type "cd /mnt/c/Users/levic/CapNET"
Enter
Sleep 500ms

Type "# Scenario: Agent Hijack - Prompt injection attack"
Enter
Sleep 1s

Type "# An attacker tries to make the agent buy $10K in gift cards"
Enter
Sleep 1s

Type "# CapNet enforces spend constraints even on compromised agents"
Enter
Sleep 1.5s

Type "node node_modules/tsx/dist/cli.mjs sdk/src/scenarios/agent-hijack.ts --record"
Enter
Sleep 25s

Sleep 5s
