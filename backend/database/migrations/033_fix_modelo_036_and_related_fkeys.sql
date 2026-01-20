-- Migration: Fix foreign keys in modelo_036_analysis, alta_ss_analysis, and related tables
-- Date: 2026-01-16
-- Description: Several tables were created referencing usuarios(id), but the application 
--              uses the users table. This migration fixes all affected FK constraints.

-- ============================================================================
-- 1. FIX modelo_036_analysis TABLE
-- ============================================================================
ALTER TABLE modelo_036_analysis DROP CONSTRAINT IF EXISTS modelo_036_analysis_user_id_fkey;

-- Delete any orphaned records that don't have valid user references
DELETE FROM modelo_036_analysis WHERE user_id NOT IN (SELECT id FROM users);

-- Add the correct foreign key constraint referencing users(id)
ALTER TABLE modelo_036_analysis ADD CONSTRAINT modelo_036_analysis_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. FIX alta_ss_analysis TABLE  
-- ============================================================================
ALTER TABLE alta_ss_analysis DROP CONSTRAINT IF EXISTS alta_ss_analysis_user_id_fkey;

-- Delete any orphaned records
DELETE FROM alta_ss_analysis WHERE user_id NOT IN (SELECT id FROM users);

-- Add the correct foreign key constraint
ALTER TABLE alta_ss_analysis ADD CONSTRAINT alta_ss_analysis_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- 3. FIX fiscal_obligation_documents TABLE
-- ============================================================================
ALTER TABLE fiscal_obligation_documents DROP CONSTRAINT IF EXISTS fiscal_obligation_documents_user_id_fkey;

-- Delete any orphaned records
DELETE FROM fiscal_obligation_documents WHERE user_id NOT IN (SELECT id FROM users);

-- Add the correct foreign key constraint
ALTER TABLE fiscal_obligation_documents ADD CONSTRAINT fiscal_obligation_documents_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. FIX documents TABLE
-- ============================================================================
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;

-- Delete any orphaned records
DELETE FROM documents WHERE user_id NOT IN (SELECT id FROM users);

-- Add the correct foreign key constraint
ALTER TABLE documents ADD CONSTRAINT documents_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. FIX ai_document_suggestions TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_document_suggestions') THEN
    ALTER TABLE ai_document_suggestions DROP CONSTRAINT IF EXISTS ai_document_suggestions_user_id_fkey;
    DELETE FROM ai_document_suggestions WHERE user_id NOT IN (SELECT id FROM users);
    ALTER TABLE ai_document_suggestions ADD CONSTRAINT ai_document_suggestions_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6. FIX alta_autonomo_progress TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alta_autonomo_progress') THEN
    ALTER TABLE alta_autonomo_progress DROP CONSTRAINT IF EXISTS alta_autonomo_progress_user_id_fkey;
    DELETE FROM alta_autonomo_progress WHERE user_id NOT IN (SELECT id FROM users);
    ALTER TABLE alta_autonomo_progress ADD CONSTRAINT alta_autonomo_progress_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 7. FIX document_versions TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_versions') THEN
    ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS document_versions_creado_por_user_id_fkey;
    DELETE FROM document_versions WHERE creado_por_user_id NOT IN (SELECT id FROM users);
    ALTER TABLE document_versions ADD CONSTRAINT document_versions_creado_por_user_id_fkey 
      FOREIGN KEY (creado_por_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 8. FIX document_shares TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_shares') THEN
    ALTER TABLE document_shares DROP CONSTRAINT IF EXISTS document_shares_user_id_fkey;
    DELETE FROM document_shares WHERE user_id NOT IN (SELECT id FROM users);
    ALTER TABLE document_shares ADD CONSTRAINT document_shares_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Verification comments
COMMENT ON CONSTRAINT modelo_036_analysis_user_id_fkey ON modelo_036_analysis IS 'FK fixed to reference users(id) instead of usuarios(id)';
COMMENT ON CONSTRAINT alta_ss_analysis_user_id_fkey ON alta_ss_analysis IS 'FK fixed to reference users(id) instead of usuarios(id)';
COMMENT ON CONSTRAINT fiscal_obligation_documents_user_id_fkey ON fiscal_obligation_documents IS 'FK fixed to reference users(id) instead of usuarios(id)';
COMMENT ON CONSTRAINT documents_user_id_fkey ON documents IS 'FK fixed to reference users(id) instead of usuarios(id)';
