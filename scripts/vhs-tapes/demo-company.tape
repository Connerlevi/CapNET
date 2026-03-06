# CapNet Demo - Multi-Agent Company
# Shows role-based isolation and delegation in an AI company

Output demos/capnet-multi-agent.mp4

Set FontSize 14
Set Width 1200
Set Height 900
Set Theme "Dracula"

Type "cd /mnt/c/Users/levic/CapNET"
Enter
Sleep 500ms

Type "# Scenario: Multi-Agent Company with role isolation"
Enter
Sleep 1s

Type "# Sales, Finance, and Engineering agents with different permissions"
Enter
Sleep 1s

Type "# Demonstrates delegation and cascade revocation"
Enter
Sleep 1.5s

Type "node node_modules/tsx/dist/cli.mjs sdk/src/scenarios/multi-agent-company.ts --record"
Enter
Sleep 50s

Sleep 5s
