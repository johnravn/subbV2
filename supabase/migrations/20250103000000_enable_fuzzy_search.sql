-- Enable pg_trgm extension for fuzzy search (trigram similarity)
-- This allows fuzzy matching using similarity() and the % operator

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a function to perform fuzzy search on text columns
-- Uses trigram similarity with a threshold (default 0.3 = 30% similarity)
CREATE OR REPLACE FUNCTION fuzzy_search_text(
  search_term TEXT,
  text_to_search TEXT,
  similarity_threshold REAL DEFAULT 0.2
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Return true if similarity is above threshold
  -- Also check for exact match or ilike match for exact queries
  RETURN 
    search_term ILIKE '%' || text_to_search || '%' OR
    text_to_search ILIKE '%' || search_term || '%' OR
    similarity(search_term, text_to_search) >= similarity_threshold;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to search multiple fields with fuzzy matching
-- This helps with OR conditions across multiple columns
CREATE OR REPLACE FUNCTION fuzzy_search_multi(
  search_term TEXT,
  fields TEXT[],
  similarity_threshold REAL DEFAULT 0.2
)
RETURNS BOOLEAN AS $$
DECLARE
  field TEXT;
BEGIN
  -- If no fields provided, return false
  IF array_length(fields, 1) IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check each field for fuzzy match
  FOREACH field IN ARRAY fields
  LOOP
    IF fuzzy_search_text(search_term, COALESCE(field, ''), similarity_threshold) THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

