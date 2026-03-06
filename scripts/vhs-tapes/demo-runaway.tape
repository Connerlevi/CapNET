# CapNet Demo - Runaway Agent Scenario
# Shows how CapNet contains a cleanup bot that tries dangerous operations

Output demos/capnet-runaway-agent.mp4

Set FontSize 14
Set Width 1200
Set Height 900
Set Theme "Dracula"

Type "cd /mnt/c/Users/levic/CapNET"
Enter
Sleep 500ms

Type "# Scenario: Runaway Agent - Cleanup bot with dangerous intentions"
Enter
Sleep 1s

Type "# The bot will try to drop databases and terminate servers"
Enter
Sleep 1s

Type "# CapNet will enforce tool_call restrictions"
Enter
Sleep 1.5s

Type "node node_modules/tsx/dist/cli.mjs sdk/src/scenarios/runaway-agent.ts --record"
Enter
Sleep 30s

Sleep 5s
