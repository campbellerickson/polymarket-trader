#!/bin/bash

# Test script to trigger all cron jobs sequentially
# This simulates a full trading day cycle

DEPLOYMENT_URL="${DEPLOYMENT_URL:-https://polymarket-trader.vercel.app}"
CRON_SECRET="${CRON_SECRET:-2FYlg42wajLvnRlktyZieGgESkNWEFQtqZfI/rfK0Is=}"

echo "🚀 Starting Cron Job Test Sequence"
echo "=================================="
echo "Deployment: $DEPLOYMENT_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to call an endpoint and log results
call_endpoint() {
    local name=$1
    local path=$2
    local method=${3:-GET}
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}▶ Running: $name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
            "$DEPLOYMENT_URL$path" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET \
            "$DEPLOYMENT_URL$path" \
            -H "Authorization: Bearer $CRON_SECRET")
    fi
    
    http_code=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Success (HTTP $http_code)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ Failed (HTTP $http_code)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    
    echo ""
    sleep 2  # Brief pause between calls
}

# 1. Refresh markets first (ensure we have fresh data)
echo -e "${BLUE}Step 1: Refreshing Market Cache${NC}"
call_endpoint "Refresh Markets" "/api/cron/refresh-markets"

# Wait a bit longer after market refresh
echo "⏳ Waiting 5 seconds for markets to cache..."
sleep 5

# 2. Daily scan (main trading logic - invests up to $100)
echo -e "${BLUE}Step 2: Daily Scan & Trade Execution${NC}"
echo -e "${YELLOW}This will execute trades with a $100 daily budget${NC}"
call_endpoint "Trading" "/api/cron/trading"

# 3. Check resolutions
echo -e "${BLUE}Step 3: Checking Market Resolutions${NC}"
call_endpoint "Check Resolutions" "/api/cron/check-resolutions"

# 4. Stop loss check
echo -e "${BLUE}Step 4: Stop Loss Monitoring${NC}"
call_endpoint "Stop Loss Check" "/api/cron/stop-loss"

# 5. Morning report
echo -e "${BLUE}Step 5: Generating Morning Report${NC}"
call_endpoint "Morning Report" "/api/cron/morning-report"

# 6. Cleanup resolved markets
echo -e "${BLUE}Step 6: Cleaning Up Resolved Markets${NC}"
call_endpoint "Cleanup Resolved" "/api/cron/cleanup-resolved"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All cron jobs completed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Check Vercel logs for detailed execution logs:"
echo "   https://vercel.com/dashboard"
echo ""

