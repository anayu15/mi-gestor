-- Migration: Simplify user registration
-- Allow registration with just name, email, and password

-- Make nif nullable and remove uniqueness for null values
ALTER TABLE users ALTER COLUMN nif DROP NOT NULL;

-- Make fecha_alta_autonomo nullable
ALTER TABLE users ALTER COLUMN fecha_alta_autonomo DROP NOT NULL;

-- Update the unique constraint on nif to allow multiple null values
-- (PostgreSQL already allows multiple NULLs in unique columns by default)
