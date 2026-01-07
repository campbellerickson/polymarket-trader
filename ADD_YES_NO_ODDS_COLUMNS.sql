-- ============================================
-- Add yes_odds and no_odds columns to contracts table
-- This allows tracking both sides of the market separately
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Add yes_odds column (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contracts' AND column_name = 'yes_odds'
    ) THEN
        ALTER TABLE contracts ADD COLUMN yes_odds DECIMAL(5,4);
        RAISE NOTICE 'Added yes_odds column';
    ELSE
        RAISE NOTICE 'yes_odds column already exists';
    END IF;
END $$;

-- Add no_odds column (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contracts' AND column_name = 'no_odds'
    ) THEN
        ALTER TABLE contracts ADD COLUMN no_odds DECIMAL(5,4);
        RAISE NOTICE 'Added no_odds column';
    ELSE
        RAISE NOTICE 'no_odds column already exists';
    END IF;
END $$;

-- Migrate existing current_odds data to yes_odds
-- This ensures backward compatibility
DO $$
BEGIN
    -- Only migrate if yes_odds is NULL and current_odds has data
    UPDATE contracts
    SET yes_odds = current_odds
    WHERE yes_odds IS NULL AND current_odds IS NOT NULL;

    RAISE NOTICE 'Migrated existing current_odds to yes_odds';
END $$;

-- Calculate no_odds from yes_odds (if yes_odds exists)
DO $$
BEGIN
    UPDATE contracts
    SET no_odds = 1 - yes_odds
    WHERE no_odds IS NULL AND yes_odds IS NOT NULL;

    RAISE NOTICE 'Calculated no_odds from yes_odds';
END $$;

-- Verify the migration
DO $$
DECLARE
    total_rows INT;
    with_yes_odds INT;
    with_no_odds INT;
    with_current_odds INT;
BEGIN
    SELECT COUNT(*) INTO total_rows FROM contracts;
    SELECT COUNT(*) INTO with_yes_odds FROM contracts WHERE yes_odds IS NOT NULL;
    SELECT COUNT(*) INTO with_no_odds FROM contracts WHERE no_odds IS NOT NULL;
    SELECT COUNT(*) INTO with_current_odds FROM contracts WHERE current_odds IS NOT NULL;

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE 'Total contracts: %', total_rows;
    RAISE NOTICE 'With current_odds: %', with_current_odds;
    RAISE NOTICE 'With yes_odds: %', with_yes_odds;
    RAISE NOTICE 'With no_odds: %', with_no_odds;
    RAISE NOTICE '===========================================';
END $$;

-- Note: We keep current_odds column for backward compatibility
-- New code should use yes_odds/no_odds, but old code will still work
