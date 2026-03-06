#!/usr/bin/env bash
#
# Record a CapNet demo using asciinema.
#
# Prerequisites:
#   - asciinema installed (pip install asciinema, or apt install asciinema)
#   - npm run dev running in another terminal (proxy:3100 + sandbox:3200)
#
# Usage:
#   bash scripts/record-demo.sh              # Record core demo
#   bash scripts/record-demo.sh hijack       # Record hijack scenario
#   bash scripts/record-demo.sh runaway      # Record runaway scenario
#   bash scripts/record-demo.sh company      # Record company scenario
#   bash scripts/record-demo.sh all          # Record all scenarios
#
# Output: demo-recordings/<scenario>.cast

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RECORDING_DIR="$PROJECT_DIR/demo-recordings"

mkdir -p "$RECORDING_DIR"

SCENARIO="${1:-core}"

# Map scenario to npm script and output file
case "$SCENARIO" in
  core)
    NPM_CMD="npm run demo:clean"
    TITLE="CapNet Demo - Capability Lifecycle"
    ;;
  hijack)
    NPM_CMD="npm run demo:hijack"
    TITLE="CapNet Demo - Agent Hijack (Prompt Injection)"
    ;;
  runaway)
    NPM_CMD="npm run demo:runaway"
    TITLE="CapNet Demo - Runaway Agent"
    ;;
  company)
    NPM_CMD="npm run demo:company"
    TITLE="CapNet Demo - Multi-Agent Company"
    ;;
  all)
    NPM_CMD="npm run demo:all"
    TITLE="CapNet Demo - All Scenarios"
    ;;
  *)
    echo "Unknown scenario: $SCENARIO"
    echo "Usage: $0 [core|hijack|runaway|company|all]"
    exit 1
    ;;
esac

OUTFILE="$RECORDING_DIR/$SCENARIO.cast"

echo "Recording: $TITLE"
echo "Output:    $OUTFILE"
echo ""

# Check services are running
if ! curl -s http://127.0.0.1:3100/health > /dev/null 2>&1; then
  echo "ERROR: Proxy not running. Start with: npm run dev"
  exit 1
fi

if ! curl -s http://127.0.0.1:3200/health > /dev/null 2>&1; then
  echo "ERROR: Sandbox not running. Start with: npm run dev"
  exit 1
fi

cd "$PROJECT_DIR"

# Record with asciinema
# --idle-time-limit: cap idle time to 2s (keeps recording tight)
# --title: shown in asciinema player
# --overwrite: replace existing recording
asciinema rec \
  --idle-time-limit 2 \
  --title "$TITLE" \
  --overwrite \
  --command "$NPM_CMD" \
  "$OUTFILE"

echo ""
echo "Recording saved: $OUTFILE"
echo ""
echo "To play back:    asciinema play $OUTFILE"
echo "To upload:       asciinema upload $OUTFILE"
echo "To embed:        https://asciinema.org (after upload)"
echo ""
echo "To convert to GIF (requires agg):"
echo "  agg $OUTFILE $RECORDING_DIR/$SCENARIO.gif"
