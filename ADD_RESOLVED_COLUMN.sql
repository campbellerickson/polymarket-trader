-- Add missing columns to contracts table
-- Run this in Supabase Dashboard → SQL Editor

-- Add resolved column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contracts' 
        AND column_name = 'resolved'
    ) THEN
        ALTER TABLE contracts ADD COLUMN resolved BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added resolved column to contracts table';
    ELSE
        RAISE NOTICE 'resolved column already exists';
    END IF;
END $$;

-- Add final_odds column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contracts' 
        AND column_name = 'final_odds'
    ) THEN
        ALTER TABLE contracts ADD COLUMN final_odds DECIMAL(5,4);
        RAISE NOTICE 'Added final_odds column to contracts table';
    ELSE
        RAISE NOTICE 'final_odds column already exists';
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_contracts_resolved ON contracts(resolved);
CREATE INDEX IF NOT EXISTS idx_contracts_discovered_at ON contracts(discovered_at) WHERE resolved = false;

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'contracts' 
AND column_name IN ('resolved', 'final_odds')
ORDER BY column_name;

