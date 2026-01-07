#!/bin/bash
# Test script to purchase a $5 contract
# Usage: ./scripts/test-purchase.sh

if [ -z "$CRON_SECRET" ]; then
  echo "❌ Error: CRON_SECRET environment variable not set"
  echo "Set it with: export CRON_SECRET=your_secret"
  exit 1
fi

echo "🧪 Testing contract purchase..."
echo ""

curl -X POST "https://polymarket-trader.vercel.app/api/test/purchase-contract" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "✅ Test complete!"
