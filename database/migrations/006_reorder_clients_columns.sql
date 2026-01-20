-- Migration: Reorder clientes table columns to place direccion after cif
-- This migration recreates the clientes table with direccion positioned right after cif

BEGIN;

-- Drop foreign key constraints from tables that reference clientes
ALTER TABLE facturas_emitidas DROP CONSTRAINT IF EXISTS facturas_emitidas_cliente_id_fkey;
ALTER TABLE recurring_invoice_templates DROP CONSTRAINT IF EXISTS recurring_invoice_templates_cliente_id_fkey;

-- Create a new table with the desired column order
CREATE TABLE clientes_new (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    cif VARCHAR(20) NOT NULL,
    direccion TEXT,
    email VARCHAR(255),
    telefono VARCHAR(50),
    ciudad VARCHAR(100),
    codigo_postal VARCHAR(10),
    es_cliente_principal BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    provincia VARCHAR(100),
    persona_contacto VARCHAR(255),
    CONSTRAINT fk_clientes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_cif_per_user UNIQUE (user_id, cif)
);

-- Copy data from old table to new table
INSERT INTO clientes_new (
    id, user_id, nombre, cif, direccion, email, telefono,
    ciudad, codigo_postal, es_cliente_principal, activo,
    created_at, updated_at, provincia, persona_contacto
)
SELECT
    id, user_id, nombre, cif, direccion, email, telefono,
    ciudad, codigo_postal, es_cliente_principal, activo,
    created_at, updated_at, provincia, persona_contacto
FROM clientes;

-- Update the sequence to continue from the last id
SELECT setval('clientes_new_id_seq', (SELECT MAX(id) FROM clientes_new));

-- Drop the old table
DROP TABLE clientes;

-- Rename the new table to the original name
ALTER TABLE clientes_new RENAME TO clientes;

-- Recreate indexes
CREATE INDEX idx_clientes_user_id ON clientes(user_id);
CREATE INDEX idx_clientes_cif ON clientes(cif);
CREATE INDEX idx_clientes_principal ON clientes(user_id, es_cliente_principal) WHERE es_cliente_principal = true;

-- Recreate partial unique constraint for principal client
CREATE UNIQUE INDEX unique_principal_per_user ON clientes(user_id, es_cliente_principal) WHERE es_cliente_principal = true;

-- Recreate foreign key constraints that reference clientes
ALTER TABLE facturas_emitidas
    ADD CONSTRAINT facturas_emitidas_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

ALTER TABLE recurring_invoice_templates
    ADD CONSTRAINT recurring_invoice_templates_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

COMMIT;
