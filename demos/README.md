# CapNet Demo Recordings

This directory contains demo output captures and recording scripts.

## Text Output Files

- `core-demo-output.txt` - Main capability lifecycle demo
- `runaway-output.txt` - Runaway agent scenario 
- `hijack-output.txt` - Agent hijack defense scenario
- `company-output.txt` - Multi-agent company with role isolation

## Recording Options

### 1. Asciinema (Recommended)
Use the provided recording script:
```bash
./scripts/record-demos.sh
```

This creates `.cast` files that can be:
- Played back locally: `asciinema play demos/capnet-core.cast`
- Uploaded to asciinema.org for web embedding
- Converted to GIF using `agg` (asciinema gif generator)

### 2. VHS (Requires non-root)
VHS tape files are in `scripts/vhs-tapes/`:
- `quickstart.tape` - 60-second quickstart
- `demo-core.tape` - Core capability lifecycle
- `demo-runaway.tape` - Runaway agent scenario
- `demo-hijack.tape` - Agent hijack scenario
- `demo-company.tape` - Multi-agent company

To use VHS (requires running as non-root user):
```bash
vhs scripts/vhs-tapes/quickstart.tape
```

### 3. Terminal Screenshots
For static documentation, use the text output files above or capture key moments from the live demos.

## Demo Commands

```bash
# Start services first
npm run dev

# Run individual demos
npm run demo:clean    # Core demo with fresh data
npm run demo:runaway  # Runaway agent scenario
npm run demo:hijack   # Agent hijack scenario  
npm run demo:company  # Multi-agent company
npm run demo:all      # Run all scenarios

# Capture output to file
npm run demo:clean 2>&1 | tee demos/my-demo.txt
```