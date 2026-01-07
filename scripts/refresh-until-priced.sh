#!/bin/bash

# Script to refresh markets until we find markets with actual pricing data (bid or ask > 0)

DEPLOYMENT_URL="${DEPLOYMENT_URL:-https://polymarket-trader.vercel.app}"
CRON_SECRET="${CRON_SECRET:-2FYlg42wajLvnRlktyZieGgESkNWEFQtqZfI/rfK0Is=}"

MAX_PAGES=10  # Maximum number of pages to check
PAGE_DELAY=5  # Seconds to wait between pages

echo "🔄 Refreshing Markets Until We Find Pricing Data"
echo "=================================================="
echo ""

# Step 1: Clear contracts
echo "🗑️ Step 1: Clearing all contracts..."
response=$(curl -s -X DELETE "$DEPLOYMENT_URL/api/test/clear-contracts" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --max-time 60)

deleted=$(echo "$response" | jq -r '.deleted // 0' 2>/dev/null)
echo "   ✅ Cleared $deleted contracts"
echo ""

# Step 2: Refresh pages until we find markets with pricing
echo "🔄 Step 2: Refreshing market pages until we find pricing..."
echo ""

page_count=0
markets_found=0
total_markets=0
cursor=""

while [ $page_count -lt $MAX_PAGES ]; do
  page_count=$((page_count + 1))
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📄 Page $page_count/$MAX_PAGES"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Build URL with cursor if we have one
  url="$DEPLOYMENT_URL/api/cron/refresh-markets"
  if [ -n "$cursor" ]; then
    url="$url?cursor=$cursor"
  fi
  
  response=$(curl -s -X GET "$url" \
    -H "Authorization: Bearer $CRON_SECRET" \
    --max-time 60)
  
  markets_cached=$(echo "$response" | jq -r '.marketsCached // 0' 2>/dev/null)
  has_next=$(echo "$response" | jq -r '.hasNextPage // false' 2>/dev/null)
  cursor=$(echo "$response" | jq -r '.nextCursor // ""' 2>/dev/null)
  message=$(echo "$response" | jq -r '.message // ""' 2>/dev/null)
  
  echo "   Markets cached this page: $markets_cached"
  echo "   Has next page: $has_next"
  echo "   Message: $message"
  
  total_markets=$((total_markets + markets_cached))
  
  if [ "$markets_cached" -gt 0 ]; then
    markets_found=$markets_cached
    echo ""
    echo "✅ SUCCESS! Found $markets_cached markets with pricing data!"
    echo "   Total markets cached: $total_markets"
    break
  fi
  
  if [ "$has_next" != "true" ] || [ -z "$cursor" ]; then
    echo ""
    echo "⚠️ No more pages available"
    break
  fi
  
  echo ""
  echo "⏳ Waiting $PAGE_DELAY seconds before next page..."
  sleep $PAGE_DELAY
  echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Pages checked: $page_count"
echo "   Total markets cached: $total_markets"
echo ""

if [ "$markets_found" -gt 0 ]; then
  echo "✅ Found markets with pricing!"
  echo ""
  echo "📊 Checking for qualifying contracts..."
  echo ""
  
  response=$(curl -s -X GET "$DEPLOYMENT_URL/api/test/qualifying-contracts" \
    -H "Authorization: Bearer $CRON_SECRET" \
    --max-time 60)
  
  echo "$response" | jq '{
    cached_markets: .stages.cached_markets.count,
    after_filtering: .stages.after_filtering.count,
    after_liquidity: .stages.after_liquidity_check.count,
    qualifying: .summary.qualifying_count
  }' 2>/dev/null || echo "$response"
else
  echo "❌ No markets with pricing found after checking $page_count pages"
  echo "   This may indicate:"
  echo "   - All markets are inactive/unpriced"
  echo "   - Need to check different market filters"
  echo "   - Market data may not be available at this time"
fi

