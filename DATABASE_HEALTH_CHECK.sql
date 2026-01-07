-- ============================================
-- Database Health Check and Verification Script
-- Run this in Supabase Dashboard → SQL Editor
-- Checks all tables and columns exist with correct structure
-- ============================================

-- Check if all required tables exist
DO $$
DECLARE
    table_count INT;
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    required_tables TEXT[] := ARRAY[
        'contracts',
        'trades',
        'ai_decisions',
        'performance_metrics',
        'notification_preferences',
        'daily_reports',
        'stop_loss_events',
        'stop_loss_config',
        'error_logs',
        'monthly_analysis'
    ];
    table_name TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database Health Check';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Check each required table
    FOREACH table_name IN ARRAY required_tables
    LOOP
        SELECT COUNT(*) INTO table_count
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
        AND t.table_name = table_name;
        
        IF table_count = 0 THEN
            missing_tables := array_append(missing_tables, table_name);
            RAISE NOTICE '❌ Missing table: %', table_name;
        ELSE
            RAISE NOTICE '✅ Table exists: %', table_name;
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Missing tables: %', array_to_string(missing_tables, ', ');
    END IF;
END $$;

-- Check contracts table columns
DO $$
DECLARE
    col_name TEXT;
    col_type TEXT;
    missing_cols TEXT[] := ARRAY[]::TEXT[];
    required_cols JSONB := '{
        "market_id": "text",
        "question": "text",
        "end_date": "timestamp without time zone",
        "yes_odds": "numeric",
        "no_odds": "numeric",
        "category": "text",
        "liquidity": "numeric",
        "volume_24h": "numeric",
        "discovered_at": "timestamp without time zone",
        "resolved": "boolean",
        "outcome": "text",
        "final_odds": "numeric",
        "resolved_at": "timestamp without time zone"
    }'::JSONB;
    key TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking contracts table columns';
    RAISE NOTICE '========================================';
    
    FOR key IN SELECT jsonb_object_keys(required_cols)
    LOOP
        SELECT c.column_name INTO col_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name = 'contracts'
        AND c.column_name = key;
        
        IF col_name IS NULL THEN
            missing_cols := array_append(missing_cols, key);
            RAISE NOTICE '❌ Missing column: contracts.%', key;
        ELSE
            -- Check data type
            SELECT c.data_type INTO col_type
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = 'contracts'
            AND c.column_name = key;
            
            RAISE NOTICE '✅ Column exists: contracts.% (type: %)', key, col_type;
        END IF;
    END LOOP;
    
    -- Check for deprecated current_odds column
    SELECT c.column_name INTO col_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name = 'contracts'
    AND c.column_name = 'current_odds';
    
    IF col_name IS NOT NULL THEN
        RAISE NOTICE '';
        RAISE WARNING '⚠️ DEPRECATED column found: contracts.current_odds';
        RAISE NOTICE '   This should be renamed to yes_odds. Run ADD_NO_ODDS_COLUMN.sql';
    END IF;
END $$;

-- Check trades table columns
DO $$
DECLARE
    col_name TEXT;
    required_cols TEXT[] := ARRAY[
        'id', 'contract_id', 'executed_at', 'entry_odds', 'position_size',
        'side', 'contracts_purchased', 'ai_confidence', 'ai_reasoning',
        'risk_factors', 'status', 'exit_odds', 'pnl', 'resolved_at'
    ];
    col TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking trades table columns';
    RAISE NOTICE '========================================';
    
    FOREACH col IN ARRAY required_cols
    LOOP
        SELECT c.column_name INTO col_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name = 'trades'
        AND c.column_name = col;
        
        IF col_name IS NULL THEN
            RAISE NOTICE '❌ Missing column: trades.%', col;
        ELSE
            RAISE NOTICE '✅ Column exists: trades.%', col;
        END IF;
    END LOOP;
END $$;

-- Check all other tables exist
SELECT 
    'Tables Status' as check_type,
    COUNT(*) FILTER (WHERE table_name IN (
        'contracts', 'trades', 'ai_decisions', 'performance_metrics',
        'notification_preferences', 'daily_reports', 'stop_loss_events',
        'stop_loss_config', 'error_logs', 'monthly_analysis'
    )) as existing_count,
    COUNT(*) FILTER (WHERE table_name NOT IN (
        'contracts', 'trades', 'ai_decisions', 'performance_metrics',
        'notification_preferences', 'daily_reports', 'stop_loss_events',
        'stop_loss_config', 'error_logs', 'monthly_analysis'
    )) as other_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- Count records in each table
SELECT 
    'contracts' as table_name,
    COUNT(*) as record_count
FROM contracts
UNION ALL
SELECT 'trades', COUNT(*) FROM trades
UNION ALL
SELECT 'ai_decisions', COUNT(*) FROM ai_decisions
UNION ALL
SELECT 'performance_metrics', COUNT(*) FROM performance_metrics
UNION ALL
SELECT 'notification_preferences', COUNT(*) FROM notification_preferences
UNION ALL
SELECT 'daily_reports', COUNT(*) FROM daily_reports
UNION ALL
SELECT 'stop_loss_events', COUNT(*) FROM stop_loss_events
UNION ALL
SELECT 'stop_loss_config', COUNT(*) FROM stop_loss_config
UNION ALL
SELECT 'error_logs', COUNT(*) FROM error_logs
UNION ALL
SELECT 'monthly_analysis', COUNT(*) FROM monthly_analysis
ORDER BY table_name;

