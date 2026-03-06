#!/bin/bash

# CapNet Demo Recording Script
# Uses asciinema to record terminal demos

ASCIINEMA="/tmp/asciinema-venv/bin/asciinema"
DEMOS_DIR="demos"

# Ensure demos directory exists
mkdir -p "$DEMOS_DIR"

echo "CapNet Demo Recording Script"
echo "============================="
echo ""
echo "Available demos to record:"
echo "1. Core Demo (demo:clean) - Main capability lifecycle"
echo "2. Runaway Agent (demo:runaway) - Tool restriction scenario"
echo "3. Agent Hijack (demo:hijack) - Prompt injection defense"
echo "4. Multi-Agent Company (demo:company) - Role isolation & delegation"
echo "5. All Demos (demo:all) - Run all scenarios"
echo ""

read -p "Which demo to record? (1-5): " choice

case $choice in
    1)
        DEMO_NAME="core"
        DEMO_CMD="npm run demo:clean"
        DEMO_TITLE="CapNet Core Demo - Capability Lifecycle"
        ;;
    2)
        DEMO_NAME="runaway"
        DEMO_CMD="npm run demo:runaway"
        DEMO_TITLE="CapNet - Runaway Agent Scenario"
        ;;
    3)
        DEMO_NAME="hijack"
        DEMO_CMD="npm run demo:hijack"
        DEMO_TITLE="CapNet - Agent Hijack Defense"
        ;;
    4)
        DEMO_NAME="company"
        DEMO_CMD="npm run demo:company"
        DEMO_TITLE="CapNet - Multi-Agent Company"
        ;;
    5)
        DEMO_NAME="all"
        DEMO_CMD="npm run demo:all"
        DEMO_TITLE="CapNet - All Demo Scenarios"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

OUTPUT_FILE="$DEMOS_DIR/capnet-$DEMO_NAME.cast"

echo ""
echo "Recording: $DEMO_TITLE"
echo "Output: $OUTPUT_FILE"
echo ""
echo "Instructions:"
echo "1. The recording will start in 3 seconds"
echo "2. Run the demo command when prompted"
echo "3. Press Ctrl+D or type 'exit' when done"
echo ""
echo "Starting in 3..."
sleep 1
echo "2..."
sleep 1
echo "1..."
sleep 1

# Record the demo
$ASCIINEMA rec "$OUTPUT_FILE" \
    --title "$DEMO_TITLE" \
    --idle-time-limit 3 \
    --overwrite \
    --command "cd /mnt/c/Users/levic/CapNET && echo 'Ready to record. Run: $DEMO_CMD' && bash"

echo ""
echo "Recording saved to: $OUTPUT_FILE"
echo ""
echo "To play back: $ASCIINEMA play $OUTPUT_FILE"
echo "To upload: $ASCIINEMA upload $OUTPUT_FILE"
echo ""
echo "Note: To convert to GIF, you can use:"
echo "  - agg (asciinema gif generator)"
echo "  - svg-term-cli"
echo "  - Upload to asciinema.org and embed the player"