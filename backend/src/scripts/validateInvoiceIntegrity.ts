import { query } from '../config/database';

/**
 * Data Integrity Validation Script for Invoices
 * Checks for common data integrity issues in the facturas_emitidas table
 */

interface IntegrityIssue {
  check: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  data?: any[];
}

async function validateIntegrity(): Promise<void> {
  console.log('🔍 Running Invoice Data Integrity Checks...\n');
  console.log('=' .repeat(60));

  const issues: IntegrityIssue[] = [];

  try {
    // Check 1: Duplicate invoice numbers within same user
    console.log('\n📋 Check 1: Duplicate invoice numbers within same user...');
    const duplicates = await query(`
      SELECT user_id, numero_factura, COUNT(*) as count
      FROM facturas_emitidas
      GROUP BY user_id, numero_factura
      HAVING COUNT(*) > 1
      ORDER BY user_id, numero_factura
    `);

    if (duplicates.rows.length > 0) {
      issues.push({
        check: 'Duplicate Invoice Numbers',
        status: 'FAIL',
        message: `Found ${duplicates.rows.length} duplicate invoice numbers within users`,
        data: duplicates.rows,
      });
      console.log(`❌ FAIL: Found ${duplicates.rows.length} duplicates`);
      console.table(duplicates.rows);
    } else {
      issues.push({
        check: 'Duplicate Invoice Numbers',
        status: 'PASS',
        message: 'No duplicate invoice numbers within users',
      });
      console.log('✅ PASS: No duplicates found');
    }

    // Check 2: Invoice calculation accuracy
    console.log('\n📋 Check 2: Invoice calculation accuracy (IVA, IRPF, Total)...');
    const miscalculated = await query(`
      SELECT
        id,
        numero_factura,
        base_imponible,
        tipo_iva,
        cuota_iva,
        tipo_irpf,
        cuota_irpf,
        total_factura,
        ROUND((base_imponible * tipo_iva / 100)::numeric, 2) as expected_iva,
        ROUND((base_imponible * tipo_irpf / 100)::numeric, 2) as expected_irpf,
        ROUND((base_imponible + cuota_iva - cuota_irpf)::numeric, 2) as expected_total
      FROM facturas_emitidas
      WHERE
        ABS(cuota_iva - ROUND((base_imponible * tipo_iva / 100)::numeric, 2)) > 0.01
        OR ABS(cuota_irpf - ROUND((base_imponible * tipo_irpf / 100)::numeric, 2)) > 0.01
        OR ABS(total_factura - ROUND((base_imponible + cuota_iva - cuota_irpf)::numeric, 2)) > 0.01
      LIMIT 10
    `);

    if (miscalculated.rows.length > 0) {
      issues.push({
        check: 'Invoice Calculations',
        status: 'FAIL',
        message: `Found ${miscalculated.rows.length} invoices with calculation errors`,
        data: miscalculated.rows,
      });
      console.log(`❌ FAIL: Found ${miscalculated.rows.length} calculation errors`);
      console.table(miscalculated.rows.slice(0, 5));
    } else {
      issues.push({
        check: 'Invoice Calculations',
        status: 'PASS',
        message: 'All invoice calculations are correct',
      });
      console.log('✅ PASS: All calculations correct');
    }

    // Check 3: Orphaned invoices (client deleted)
    console.log('\n📋 Check 3: Orphaned invoices (client deleted)...');
    const orphaned = await query(`
      SELECT i.id, i.numero_factura, i.cliente_id, i.concepto
      FROM facturas_emitidas i
      LEFT JOIN clientes c ON i.cliente_id = c.id
      WHERE c.id IS NULL
      LIMIT 10
    `);

    if (orphaned.rows.length > 0) {
      issues.push({
        check: 'Orphaned Invoices',
        status: 'WARN',
        message: `Found ${orphaned.rows.length} orphaned invoices (client deleted)`,
        data: orphaned.rows,
      });
      console.log(`⚠️  WARN: Found ${orphaned.rows.length} orphaned invoices`);
      console.table(orphaned.rows);
    } else {
      issues.push({
        check: 'Orphaned Invoices',
        status: 'PASS',
        message: 'No orphaned invoices',
      });
      console.log('✅ PASS: No orphaned invoices');
    }

    // Check 4: Invoice number sequence gaps
    console.log('\n📋 Check 4: Invoice number sequence gaps (informational)...');
    const gaps = await query(`
      WITH numbered AS (
        SELECT
          user_id,
          numero_factura,
          SPLIT_PART(numero_factura, '-', 1) as year,
          CAST(SPLIT_PART(numero_factura, '-', 2) AS INTEGER) as num,
          LAG(CAST(SPLIT_PART(numero_factura, '-', 2) AS INTEGER))
            OVER (PARTITION BY user_id, SPLIT_PART(numero_factura, '-', 1) ORDER BY numero_factura) as prev_num
        FROM facturas_emitidas
        WHERE numero_factura ~ '^[0-9]{4}-[0-9]+$'
      )
      SELECT user_id, year, numero_factura, num, prev_num, (num - prev_num) as gap
      FROM numbered
      WHERE prev_num IS NOT NULL AND (num - prev_num) > 1
      ORDER BY user_id, year, num
      LIMIT 10
    `);

    if (gaps.rows.length > 0) {
      issues.push({
        check: 'Invoice Number Gaps',
        status: 'WARN',
        message: `Found ${gaps.rows.length} gaps in invoice numbering (may be due to deletions)`,
        data: gaps.rows,
      });
      console.log(`⚠️  WARN: Found ${gaps.rows.length} gaps in numbering`);
      console.table(gaps.rows);
    } else {
      issues.push({
        check: 'Invoice Number Gaps',
        status: 'PASS',
        message: 'No gaps in invoice numbering',
      });
      console.log('✅ PASS: No gaps in numbering');
    }

    // Check 5: Invoice-PDF sync (skip if columns don't exist)
    console.log('\n📋 Check 5: Invoice-PDF sync (pdf_generado vs pdf_url)...');
    try {
      const missingPDF = await query(`
        SELECT id, numero_factura, pdf_generado, pdf_url
        FROM facturas_emitidas
        WHERE (pdf_generado = true AND (pdf_url IS NULL OR pdf_url = ''))
           OR (pdf_generado = false AND pdf_url IS NOT NULL AND pdf_url != '')
        LIMIT 10
      `);

      if (missingPDF.rows.length > 0) {
        issues.push({
          check: 'Invoice-PDF Sync',
          status: 'WARN',
          message: `Found ${missingPDF.rows.length} invoices with PDF sync issues`,
          data: missingPDF.rows,
        });
        console.log(`⚠️  WARN: Found ${missingPDF.rows.length} PDF sync issues`);
        console.table(missingPDF.rows);
      } else {
        issues.push({
          check: 'Invoice-PDF Sync',
          status: 'PASS',
          message: 'Invoice-PDF sync is correct',
        });
        console.log('✅ PASS: PDF sync correct');
      }
    } catch (pdfError: any) {
      if (pdfError.message?.includes('does not exist')) {
        issues.push({
          check: 'Invoice-PDF Sync',
          status: 'WARN',
          message: 'PDF columns (pdf_generado, pdf_url) do not exist in table - skipping check',
        });
        console.log('⚠️  WARN: PDF columns not found - skipping check');
      } else {
        throw pdfError;
      }
    }

    // Check 6: Database constraint verification
    console.log('\n📋 Check 6: Database constraint verification...');
    const constraints = await query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'facturas_emitidas'::regclass
      AND conname LIKE '%numero%'
    `);

    const hasUserScopedConstraint = constraints.rows.some(
      row => row.conname === 'facturas_emitidas_user_numero_unique'
    );

    if (hasUserScopedConstraint) {
      issues.push({
        check: 'Database Constraint',
        status: 'PASS',
        message: 'User-scoped UNIQUE constraint is correctly configured',
        data: constraints.rows,
      });
      console.log('✅ PASS: Constraint correctly configured');
      console.log('Current constraints:');
      constraints.rows.forEach(row => {
        console.log(`   - ${row.conname}: ${row.definition}`);
      });
    } else {
      issues.push({
        check: 'Database Constraint',
        status: 'FAIL',
        message: 'User-scoped UNIQUE constraint NOT found! Migration 013 may not have run.',
        data: constraints.rows,
      });
      console.log('❌ FAIL: User-scoped constraint not found');
      console.log('⚠️  Run migration 013: npm run migrate:invoice-constraint');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY\n');

    const passed = issues.filter(i => i.status === 'PASS').length;
    const warnings = issues.filter(i => i.status === 'WARN').length;
    const failed = issues.filter(i => i.status === 'FAIL').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failed}`);

    console.log('\nDetailed Results:');
    issues.forEach(issue => {
      const icon = issue.status === 'PASS' ? '✅' : issue.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${icon} ${issue.check}: ${issue.message}`);
    });

    console.log('\n' + '='.repeat(60));

    if (failed > 0) {
      console.log('\n❌ Integrity check FAILED. Please address the issues above.');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️  Integrity check completed with warnings.');
      process.exit(0);
    } else {
      console.log('\n✅ All integrity checks PASSED!');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('\n💥 Integrity check failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run validation
console.log('🚀 Invoice Data Integrity Validation Tool');
console.log('Database: migestor');
console.log('Table: facturas_emitidas\n');

validateIntegrity();
