# CapNet Demo Screenshots Guide

Since VHS requires non-root execution, here are alternative approaches to create demo visuals:

## Option 1: Asciinema Recording

Use the provided `record-demos.sh` script:

```bash
cd /mnt/c/Users/levic/CapNET
./scripts/record-demos.sh
```

This creates `.cast` files that can be:
- Played back with `asciinema play`
- Uploaded to asciinema.org for web embedding
- Converted to GIF using tools like `agg`

## Option 2: Manual Terminal Screenshots

For the README, capture key moments:

### Core Demo Key Moments

1. **Start state**
```
$ npm run demo:clean
```

2. **Capability issued**
```
[3] Wallet issuing capability to agent...
    Cap ID: cap_1709740800000_abc123
    Budget: $50.00
    Blocked: alcohol, tobacco, gift_cards
```

3. **Allowed action**
```
[5] Building grocery cart (should be ALLOWED)...
    Cart:
      - Organic Milk (1 gal) ($5.99)
      - Whole Wheat Bread ($3.49)
      - Free Range Eggs (12) ($4.99)
    Total: $14.47
    Decision: ALLOW              ← CORRECT
```

4. **Denied action**
```
[6] Attempting to buy alcohol (should be DENIED)...
    Cart: Red Wine (750ml) ($14.99)
    Decision: DENY               ← CORRECT
    Reason: CATEGORY_BLOCKED:alcohol
```

5. **Post-revoke denial**
```
[8] Attempting groceries after revoke (should be DENIED)...
    Decision: DENY               ← CORRECT
    Reason: REVOKED
```

## Option 3: Create Static Demo Output Files

Generate clean demo outputs for documentation:

```bash
# Clean output without timestamps
npm run demo:clean 2>&1 | tee demos/core-demo-output.txt

# Individual scenarios
npm run demo:runaway 2>&1 | tee demos/runaway-output.txt
npm run demo:hijack 2>&1 | tee demos/hijack-output.txt
npm run demo:company 2>&1 | tee demos/company-output.txt
```

## Option 4: Use Windows Terminal Recording

If you have Windows Terminal, it has built-in recording features that might work better than VHS in WSL.

## Option 5: Create README with Text-Based Demo

Instead of GIFs, use formatted code blocks in the README showing the key outputs. This is lightweight and clear.