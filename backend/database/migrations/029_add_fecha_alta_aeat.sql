-- Migration 029: Add fecha_alta_aeat column
-- This stores the date when the user registered with AEAT (Agencia Tributaria)
-- Fiscal obligations before this date should not be shown in the calendar

-- ============================================================================
-- 1. ADD fecha_alta_aeat COLUMN TO users TABLE
-- ============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS fecha_alta_aeat DATE;

-- ============================================================================
-- 2. ADD COMMENT FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.fecha_alta_aeat IS 'Fecha de alta en la Agencia Tributaria (AEAT). Las obligaciones fiscales anteriores a esta fecha no se mostrarán en el calendario.';
