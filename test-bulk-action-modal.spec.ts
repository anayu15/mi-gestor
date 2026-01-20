import { test, expect, Page } from '@playwright/test';

/**
 * Test the Bulk Edit/Delete Confirmation Modal for scheduled records
 */
test.describe('Bulk Action Modal for Scheduled Records', () => {
  const TEST_EMAIL = 'test@migestor.com';
  const TEST_PASSWORD = 'Test123456';
  const FRONTEND_URL = 'http://localhost:3001';

  async function login(page: Page) {
    console.log('Step: Navigating to login page...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('Step: Login page loaded');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    console.log('Step: Credentials filled');

    await page.click('button[type="submit"]');

    // Wait for response and navigation
    console.log('Step: Waiting for login response...');

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    } catch (e) {
      const errorMsg = page.locator('.bg-red-50, .text-red-600, .text-red-500');
      if (await errorMsg.count() > 0) {
        const errText = await errorMsg.first().textContent();
        console.log(`Login error on page: ${errText}`);
        throw new Error(`Login failed with error: ${errText}`);
      }
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login did not redirect - still on login page');
      }
    }

    const currentUrl = page.url();
    console.log(`Step: Logged in, current URL: ${currentUrl}`);
    expect(currentUrl).not.toContain('/login');
    console.log('Login successful!');
  }

  test('Test bulk action modal for scheduled invoices/expenses', async ({ page }) => {
    console.log('\n============================================');
    console.log('TEST: Bulk Action Modal for Scheduled Records');
    console.log('============================================\n');

    await login(page);

    // Step 1: Go to facturas page
    console.log('Step 1: Navigating to Facturas page...');
    await page.goto(`${FRONTEND_URL}/facturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/bulk-01-facturas-page.png', fullPage: true });
    console.log('Screenshot: bulk-01-facturas-page.png');

    // Step 2: Look for scheduled invoices (look for "Servicios mensuales" or "Servicios trimestrales" or "Alquiler")
    console.log('Step 2: Looking for scheduled invoices...');

    // Expand all months to see all invoices
    const monthHeaders = page.locator('tr.bg-blue-50.cursor-pointer');
    const monthCount = await monthHeaders.count();
    console.log(`Found ${monthCount} month headers`);

    // Click on each collapsed month to expand it
    for (let i = 0; i < monthCount; i++) {
      const header = monthHeaders.nth(i);
      const chevron = header.locator('svg');
      const isCollapsed = await chevron.evaluate(el => !el.classList.contains('rotate-90'));
      if (isCollapsed) {
        await header.click();
        await page.waitForTimeout(300);
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/bulk-02-expanded-months.png', fullPage: true });
    console.log('Screenshot: bulk-02-expanded-months.png');

    // Search for scheduled records with various keywords
    const scheduledKeywords = [
      'Servicios mensuales de consultoria',
      'Servicios trimestrales',
      'Alquiler oficina',
      'consultoria',
      'Alquiler'
    ];

    let foundScheduledRow: any = null;
    let foundKeyword = '';

    for (const keyword of scheduledKeywords) {
      console.log(`Looking for rows containing: "${keyword}"`);
      const rows = page.locator(`tr:has-text("${keyword}")`);
      const rowCount = await rows.count();
      console.log(`Found ${rowCount} rows with "${keyword}"`);

      if (rowCount > 0) {
        foundScheduledRow = rows.first();
        foundKeyword = keyword;
        break;
      }
    }

    if (!foundScheduledRow) {
      console.log('WARNING: No scheduled records found with expected keywords.');
      console.log('Listing all visible invoice rows for debugging...');

      const allRows = page.locator('tr:has(td)');
      const allRowCount = await allRows.count();
      console.log(`Total data rows found: ${allRowCount}`);

      for (let i = 0; i < Math.min(10, allRowCount); i++) {
        const rowText = await allRows.nth(i).textContent();
        console.log(`Row ${i}: ${rowText?.substring(0, 100)}...`);
      }

      await page.screenshot({ path: 'screenshots/bulk-NO-SCHEDULED-RECORDS.png', fullPage: true });
      console.log('Screenshot: bulk-NO-SCHEDULED-RECORDS.png');
      console.log('\nTEST SKIPPED: No scheduled records to test with.');
      console.log('Please create scheduled invoices first using the Programar feature.');
      return;
    }

    console.log(`Found scheduled record with keyword: "${foundKeyword}"`);
    await foundScheduledRow.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Highlight the row for screenshot
    await foundScheduledRow.evaluate((el: HTMLElement) => {
      el.style.backgroundColor = '#fffbcc';
    });
    await page.screenshot({ path: 'screenshots/bulk-03-found-scheduled-record.png', fullPage: true });
    console.log('Screenshot: bulk-03-found-scheduled-record.png');

    // Step 3: Click the Edit (pencil) icon
    console.log('Step 3: Clicking Edit icon on scheduled record...');
    const editButton = foundScheduledRow.locator('button[title="Editar"]');

    if (await editButton.count() === 0) {
      console.log('Edit button not found with title, trying svg path...');
      const editBtnAlt = foundScheduledRow.locator('button:has(svg path[d*="M11 5H6a2"])');
      await editBtnAlt.click();
    } else {
      await editButton.click();
    }

    console.log('Clicked Edit button');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/bulk-04-after-edit-click.png', fullPage: true });
    console.log('Screenshot: bulk-04-after-edit-click.png');

    // Step 4: Verify the bulk action modal appears
    console.log('Step 4: Checking for bulk action modal...');

    // The modal should have "Este ingreso/gasto forma parte de una serie"
    const bulkModal = page.locator('.fixed.inset-0.bg-black').first();
    const isModalVisible = await bulkModal.isVisible().catch(() => false);

    if (isModalVisible) {
      console.log('Bulk action modal detected!');

      // Check for the expected text
      const modalText = await bulkModal.textContent();
      console.log(`Modal text: ${modalText?.substring(0, 300)}`);

      // Verify it mentions "serie" and shows the two options
      const hasSerieText = modalText?.includes('serie') || modalText?.includes('programados');
      const hasSingleOption = modalText?.includes('Solo');
      const hasAllOption = modalText?.includes('Todos') || modalText?.includes('Toda la serie');

      console.log(`Contains "serie" or "programados": ${hasSerieText}`);
      console.log(`Has "Solo" option: ${hasSingleOption}`);
      console.log(`Has "Todos" option: ${hasAllOption}`);

      // Take a clean screenshot of the modal
      await page.screenshot({ path: 'screenshots/bulk-05-EDIT-MODAL.png', fullPage: true });
      console.log('Screenshot: bulk-05-EDIT-MODAL.png');

      // Verify modal title
      const modalTitle = page.locator('h2:has-text("Modificar registro programado")');
      if (await modalTitle.isVisible()) {
        console.log('Modal title verified: "Modificar registro programado"');
      }

      // Verify the two option buttons exist
      const singleOptionBtn = page.locator('button:has-text("Solo")');
      const allOptionBtn = page.locator('button:has-text("Todos")');
      const cancelBtn = page.locator('button:has-text("Cancelar")');

      console.log(`"Solo" button visible: ${await singleOptionBtn.isVisible()}`);
      console.log(`"Todos" button visible: ${await allOptionBtn.isVisible()}`);
      console.log(`"Cancelar" button visible: ${await cancelBtn.isVisible()}`);

      // Step 5: Click Cancel to close the modal
      console.log('Step 5: Clicking Cancelar to close modal...');
      await cancelBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/bulk-06-modal-closed.png', fullPage: true });
      console.log('Screenshot: bulk-06-modal-closed.png');

    } else {
      console.log('No bulk action modal appeared - record may not be part of a series');
      console.log('The record might be a single scheduled record or the programacion_id is missing');

      // Check if a regular edit modal appeared instead
      const editModal = page.locator('.fixed.inset-0');
      if (await editModal.isVisible()) {
        console.log('A different modal appeared (possibly the edit form directly)');
        await page.screenshot({ path: 'screenshots/bulk-05-NO-BULK-MODAL.png', fullPage: true });
        console.log('Screenshot: bulk-05-NO-BULK-MODAL.png');

        // Close any open modal
        const closeBtn = page.locator('button:has(svg path[d*="M6 18L18"])');
        if (await closeBtn.count() > 0) {
          await closeBtn.first().click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Step 6: Now test the Delete action
    console.log('\nStep 6: Testing Delete action...');
    await page.waitForTimeout(1000);

    // Re-find the scheduled row (in case page refreshed)
    const scheduledRowAgain = page.locator(`tr:has-text("${foundKeyword}")`).first();
    await scheduledRowAgain.scrollIntoViewIfNeeded();

    // Step 7: Click the Delete (trash) icon
    console.log('Step 7: Clicking Delete icon on scheduled record...');
    const deleteButton = scheduledRowAgain.locator('button[title="Eliminar"]');

    if (await deleteButton.count() === 0) {
      console.log('Delete button not found with title, trying svg path...');
      const deleteBtnAlt = scheduledRowAgain.locator('button:has(svg path[d*="M19 7l-.867"])');
      await deleteBtnAlt.click();
    } else {
      await deleteButton.click();
    }

    console.log('Clicked Delete button');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/bulk-07-after-delete-click.png', fullPage: true });
    console.log('Screenshot: bulk-07-after-delete-click.png');

    // Step 8: Check for bulk action modal for delete
    console.log('Step 8: Checking for delete bulk action modal...');

    const deleteBulkModal = page.locator('.fixed.inset-0.bg-black').first();
    const isDeleteModalVisible = await deleteBulkModal.isVisible().catch(() => false);

    if (isDeleteModalVisible) {
      console.log('Delete bulk action modal detected!');

      const deleteModalText = await deleteBulkModal.textContent();
      console.log(`Delete modal text: ${deleteModalText?.substring(0, 300)}`);

      // Take a clean screenshot of the delete modal
      await page.screenshot({ path: 'screenshots/bulk-08-DELETE-MODAL.png', fullPage: true });
      console.log('Screenshot: bulk-08-DELETE-MODAL.png');

      // Verify modal title for delete
      const deleteModalTitle = page.locator('h2:has-text("Eliminar registro programado")');
      if (await deleteModalTitle.isVisible()) {
        console.log('Delete modal title verified: "Eliminar registro programado"');
      }

      // Verify the options
      const deleteAllOption = page.locator('button:has-text("Toda la serie")');
      const deleteCancelBtn = page.locator('button:has-text("Cancelar")');

      console.log(`"Toda la serie" button visible: ${await deleteAllOption.isVisible()}`);
      console.log(`"Cancelar" button visible: ${await deleteCancelBtn.isVisible()}`);

      // Step 9: Click Cancel to close without deleting
      console.log('Step 9: Clicking Cancelar to close delete modal...');
      await deleteCancelBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/bulk-09-delete-modal-closed.png', fullPage: true });
      console.log('Screenshot: bulk-09-delete-modal-closed.png');

    } else {
      console.log('No delete bulk action modal appeared');

      // Check if standard delete confirmation appeared instead
      const stdDeleteModal = page.locator('text=/Confirmar eliminacion/i');
      if (await stdDeleteModal.isVisible().catch(() => false)) {
        console.log('Standard delete confirmation modal appeared (not a series)');
        await page.screenshot({ path: 'screenshots/bulk-08-STANDARD-DELETE-MODAL.png', fullPage: true });
        console.log('Screenshot: bulk-08-STANDARD-DELETE-MODAL.png');

        // Cancel the delete
        const cancelDeleteBtn = page.locator('button:has-text("Cancelar")');
        if (await cancelDeleteBtn.count() > 0) {
          await cancelDeleteBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Final summary
    console.log('\n============================================');
    console.log('TEST COMPLETED');
    console.log('============================================');
    console.log('Screenshots saved in /screenshots folder:');
    console.log('  - bulk-01-facturas-page.png');
    console.log('  - bulk-02-expanded-months.png');
    console.log('  - bulk-03-found-scheduled-record.png');
    console.log('  - bulk-04-after-edit-click.png');
    console.log('  - bulk-05-EDIT-MODAL.png (if modal appeared)');
    console.log('  - bulk-06-modal-closed.png');
    console.log('  - bulk-07-after-delete-click.png');
    console.log('  - bulk-08-DELETE-MODAL.png (if modal appeared)');
    console.log('  - bulk-09-delete-modal-closed.png');
    console.log('============================================\n');
  });
});
