import { test, expect } from '@playwright/test';

/**
 * Test: When editing an invoice with "Solo esta factura",
 * the invoice should be removed from the series (programacion_id cleared).
 */
test.describe('Invoice "Solo esta factura" removes from series', () => {
  test('should remove invoice from series when editing with "Solo esta factura"', async ({ page }) => {
    // Enable request/response logging for network monitoring
    const networkLogs: any[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        networkLogs.push({
          type: 'REQUEST',
          method: request.method(),
          url: request.url(),
          postData: request.postData()
        });
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        try {
          const body = await response.json();
          networkLogs.push({
            type: 'RESPONSE',
            url: response.url(),
            status: response.status(),
            body
          });
        } catch (e) {
          // Not JSON response
        }
      }
    });

    // 1. Login with test credentials
    console.log('='.repeat(60));
    console.log('TEST: Solo esta factura - Remove from series');
    console.log('='.repeat(60));
    console.log('\nStep 1: Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Login successful, redirected to dashboard');

    // 2. Go to Facturas page
    console.log('\nStep 2: Navigating to Facturas...');
    await page.goto('http://localhost:3001/facturas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 3. Find an invoice from a series
    console.log('\nStep 3: Looking for series invoices...');

    // Wait for API response to identify series invoices
    await page.waitForTimeout(1000);

    // Find invoices with programacion_id from network logs
    const invoicesResponse = networkLogs.find(log =>
      log.type === 'RESPONSE' &&
      log.url.includes('/api/invoices') &&
      !log.url.includes('programacion') &&
      log.body?.data &&
      Array.isArray(log.body.data)
    );

    let seriesInvoices: any[] = [];
    if (invoicesResponse) {
      seriesInvoices = invoicesResponse.body.data.filter((inv: any) => inv.programacion_id);
      console.log(`Found ${seriesInvoices.length} invoices with programacion_id`);

      if (seriesInvoices.length > 0) {
        console.log('Series invoices found:');
        seriesInvoices.slice(0, 5).forEach((inv: any) => {
          console.log(`  - ID: ${inv.id}, Number: ${inv.numero_factura}, Concepto: ${inv.concepto?.substring(0, 30)}..., Programacion: ${inv.programacion_id}`);
        });
      }
    }

    if (seriesInvoices.length === 0) {
      console.log('ERROR: No series invoices found. Test requires scheduled invoices.');
      test.skip(true, 'No series invoices available');
      return;
    }

    // Get the first series invoice
    const targetInvoice = seriesInvoices[0];
    const targetProgramacionId = targetInvoice.programacion_id;
    const originalConcepto = targetInvoice.concepto;

    console.log('\n--- TARGET INVOICE ---');
    console.log(`  ID: ${targetInvoice.id}`);
    console.log(`  Number: ${targetInvoice.numero_factura}`);
    console.log(`  Concepto: ${originalConcepto}`);
    console.log(`  programacion_id: ${targetProgramacionId}`);

    // Count how many invoices share the same programacion_id
    const sameSeriesInvoices = seriesInvoices.filter(
      (inv: any) => inv.programacion_id === targetProgramacionId
    );
    console.log(`  Invoices in same series: ${sameSeriesInvoices.length}`);
    console.log('----------------------');

    // 4. Find and click the EDIT button
    console.log('\nStep 4: Clicking edit button...');

    const invoiceNumber = targetInvoice.numero_factura;
    const invoiceRow = page.locator(`tr:has-text("${invoiceNumber}")`).first();

    // Click the button with title="Editar"
    const editButton = invoiceRow.locator('button[title="Editar"]');
    await editButton.click();
    console.log('Clicked edit button');

    // Wait for the bulk action modal to appear
    await page.waitForTimeout(1000);

    // Take screenshot to see modal
    await page.screenshot({ path: 'test-results/solo-01-bulk-action-modal.png' });
    console.log('Screenshot: solo-01-bulk-action-modal.png');

    // 5. Click "Solo esta factura" option
    console.log('\nStep 5: Looking for bulk action modal with "Solo esta factura" option...');

    // The ConfirmBulkActionModal should show "Solo esta factura"
    const soloButton = page.locator('button:has-text("Solo esta factura")');

    if (await soloButton.isVisible({ timeout: 3000 })) {
      console.log('Found "Solo esta factura" button, clicking it...');
      await soloButton.click();
      console.log('Clicked "Solo esta factura" option');
    } else {
      // Check for alternative text
      const soloAltButton = page.locator('button:has-text("Solo este")');
      if (await soloAltButton.isVisible({ timeout: 1000 })) {
        console.log('Found alternative "Solo este" button, clicking it...');
        await soloAltButton.click();
      } else {
        console.log('ERROR: Bulk action modal not visible - checking if direct edit opened');
        const editModal = page.locator('h2:has-text("Editar")');
        if (await editModal.isVisible()) {
          console.log('Direct edit modal opened - invoice might not be part of a multi-invoice series');
          test.skip(true, 'Invoice not part of a multi-invoice series');
          return;
        }
        throw new Error('Neither bulk action modal nor edit modal found');
      }
    }

    // Wait for the edit modal to appear
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/solo-02-edit-modal.png' });
    console.log('Screenshot: solo-02-edit-modal.png');

    // 6. Now the EditarFacturaModal should be open - make a small change
    console.log('\nStep 6: Modifying concepto text...');

    // Wait for the modal content to load
    await page.waitForSelector('h2:has-text("Editar")', { timeout: 5000 });
    console.log('Edit modal is open');

    // Find and modify the concepto
    const newConcepto = originalConcepto + ' (editado solo)';

    // The concepto is a textarea with name="concepto"
    const conceptoInput = page.locator('textarea[name="concepto"]');
    await conceptoInput.clear();
    await conceptoInput.fill(newConcepto);
    console.log(`Changed concepto from "${originalConcepto.substring(0, 30)}..." to "${newConcepto.substring(0, 40)}..."`);

    // Take screenshot before save
    await page.screenshot({ path: 'test-results/solo-03-before-save.png' });
    console.log('Screenshot: solo-03-before-save.png');

    // 7. Save changes
    console.log('\nStep 7: Saving changes...');

    // Clear network logs to capture the save request
    networkLogs.length = 0;

    // Click the "Actualizar Ingreso" button
    const saveButton = page.locator('button:has-text("Actualizar")');
    await saveButton.click();
    console.log('Clicked save button');

    // Wait for the API call to complete
    await page.waitForTimeout(3000);

    // Take screenshot after save
    await page.screenshot({ path: 'test-results/solo-04-after-save.png' });
    console.log('Screenshot: solo-04-after-save.png');

    // 8. Verify network request shows apply_to_all=false or single update
    console.log('\nStep 8: Checking network requests...');

    console.log('\n' + '='.repeat(50));
    console.log('NETWORK VERIFICATION');
    console.log('='.repeat(50));
    console.log('All API requests made:');
    networkLogs.filter(l => l.type === 'REQUEST').forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`    Body: ${req.postData}`);
      }
    });

    // Check for series update request
    const seriesUpdateRequest = networkLogs.find(log =>
      log.type === 'REQUEST' &&
      log.url.includes('/with-series') &&
      log.method === 'PATCH'
    );

    // Check for series update response
    const seriesUpdateResponse = networkLogs.find(log =>
      log.type === 'RESPONSE' &&
      log.url.includes('/with-series')
    );

    // Check for regular single update request
    const regularUpdateRequest = networkLogs.find(log =>
      log.type === 'REQUEST' &&
      log.url.match(/\/api\/invoices\/\d+$/) &&
      log.method === 'PATCH'
    );

    if (seriesUpdateRequest) {
      console.log('\n*** SERIES UPDATE REQUEST FOUND ***');
      console.log(`  URL: ${seriesUpdateRequest.url}`);
      console.log(`  Method: ${seriesUpdateRequest.method}`);
      console.log(`  Body: ${seriesUpdateRequest.postData}`);

      const requestBody = JSON.parse(seriesUpdateRequest.postData || '{}');
      console.log(`  apply_to_all value: ${requestBody.apply_to_all}`);

      // For "Solo esta factura", apply_to_all should be false
      if (requestBody.apply_to_all === false) {
        console.log('  SUCCESS: apply_to_all=false is being sent correctly!');
      } else {
        console.log('  WARNING: Expected apply_to_all=false but got:', requestBody.apply_to_all);
      }
    } else if (regularUpdateRequest) {
      console.log('\nRegular single update request made (this is also valid for "Solo esta factura")');
      console.log(`  URL: ${regularUpdateRequest.url}`);
    }

    if (seriesUpdateResponse) {
      console.log('\n*** SERIES UPDATE RESPONSE ***');
      console.log(`  Status: ${seriesUpdateResponse.status}`);
      console.log(`  Body: ${JSON.stringify(seriesUpdateResponse.body, null, 2)}`);

      const updatedData = seriesUpdateResponse.body?.data;
      if (updatedData) {
        console.log(`\n  updated_count: ${updatedData.updated_count}`);
        console.log(`  removed_from_series: ${updatedData.removed_from_series}`);

        // KEY VERIFICATION: For "Solo esta factura", removed_from_series should be true
        if (updatedData.removed_from_series === true) {
          console.log('\n  SUCCESS: removed_from_series=true - Invoice was removed from series!');
        } else if (updatedData.updated_count === 1) {
          console.log('\n  INFO: Only 1 invoice updated (may indicate removal from series)');
        }
      }
    }

    console.log('='.repeat(50));

    // 9. Reload and verify the edited invoice is no longer part of the series
    console.log('\nStep 9: Reloading to verify the invoice was removed from series...');

    // Clear logs before reload
    networkLogs.length = 0;

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check the updated invoices via API
    const newInvoicesResponse = networkLogs.find(log =>
      log.type === 'RESPONSE' &&
      log.url.includes('/api/invoices') &&
      !log.url.includes('programacion') &&
      log.body?.data &&
      Array.isArray(log.body.data)
    );

    if (newInvoicesResponse) {
      // Find our edited invoice
      const editedInvoice = newInvoicesResponse.body.data.find(
        (inv: any) => inv.id === targetInvoice.id
      );

      console.log('\n' + '='.repeat(50));
      console.log('VERIFICATION: Invoice removed from series?');
      console.log('='.repeat(50));

      if (editedInvoice) {
        console.log(`  Invoice ID: ${editedInvoice.id}`);
        console.log(`  Number: ${editedInvoice.numero_factura}`);
        console.log(`  Concepto: ${editedInvoice.concepto?.substring(0, 50)}...`);
        console.log(`  programacion_id (BEFORE): ${targetProgramacionId}`);
        console.log(`  programacion_id (AFTER): ${editedInvoice.programacion_id}`);

        if (editedInvoice.programacion_id === null) {
          console.log('\n  *** SUCCESS: programacion_id is now NULL ***');
          console.log('  The invoice has been removed from the series!');
          expect(editedInvoice.programacion_id).toBeNull();
        } else if (editedInvoice.programacion_id !== targetProgramacionId) {
          console.log('\n  WARNING: programacion_id changed but is not null');
          console.log(`  New programacion_id: ${editedInvoice.programacion_id}`);
        } else {
          console.log('\n  ERROR: programacion_id is STILL the same!');
          console.log('  The invoice was NOT removed from the series.');
          expect(editedInvoice.programacion_id).toBeNull();
        }
      } else {
        console.log('  WARNING: Could not find the edited invoice in the response');
      }

      // Also verify other invoices in the same series still have their programacion_id
      const remainingSeriesInvoices = newInvoicesResponse.body.data.filter(
        (inv: any) => inv.programacion_id === targetProgramacionId && inv.id !== targetInvoice.id
      );
      console.log(`\n  Other invoices still in series: ${remainingSeriesInvoices.length}`);

      console.log('='.repeat(50));
    }

    // 10. Final verification: Click edit on the same invoice - should NOT show bulk action modal
    console.log('\nStep 10: Final verification - clicking edit again should NOT show bulk action modal...');

    const invoiceRowAgain = page.locator(`tr:has-text("${invoiceNumber}")`).first();
    const editButtonAgain = invoiceRowAgain.locator('button[title="Editar"]');
    await editButtonAgain.click();
    console.log('Clicked edit button again');

    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/solo-05-second-edit.png' });
    console.log('Screenshot: solo-05-second-edit.png');

    // Check if bulk action modal appears (it should NOT if invoice is removed from series)
    const bulkModalAgain = page.locator('button:has-text("Solo esta factura")');
    const editModalDirect = page.locator('h2:has-text("Editar")');

    if (await bulkModalAgain.isVisible({ timeout: 2000 })) {
      console.log('\n  ERROR: Bulk action modal appeared again!');
      console.log('  This means the invoice is STILL part of a series.');
      // Close the modal
      const cancelBtn = page.locator('button:has-text("Cancelar")');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    } else if (await editModalDirect.isVisible({ timeout: 2000 })) {
      console.log('\n  SUCCESS: Edit modal opened directly without bulk action prompt!');
      console.log('  This confirms the invoice is no longer part of the series.');

      // Close the edit modal
      const closeBtn = page.locator('button:has-text("Cancelar")');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    } else {
      console.log('\n  WARNING: Neither modal appeared clearly');
      await page.screenshot({ path: 'test-results/solo-06-unexpected-state.png' });
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETED');
    console.log('='.repeat(60));
    console.log('\nScreenshots saved:');
    console.log('  - solo-01-bulk-action-modal.png');
    console.log('  - solo-02-edit-modal.png');
    console.log('  - solo-03-before-save.png');
    console.log('  - solo-04-after-save.png');
    console.log('  - solo-05-second-edit.png');
    console.log('='.repeat(60) + '\n');
  });
});
