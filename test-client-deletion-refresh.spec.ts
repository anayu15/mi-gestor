import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@migestor.com',
  password: 'Test123456'
};

const BASE_URL = 'http://localhost:3001';

test.describe('Client Deletion and Refresh Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console logs for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR]: ${msg.text()}`);
      }
    });

    // Login
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Use type selectors since there's no name attribute
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('Login successful');
  });

  test('should delete all clients and verify empty state after refresh', async ({ page }) => {
    // Navigate to clients page
    console.log('Navigating to clients page...');
    await page.goto(`${BASE_URL}/clientes`);
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/clients-before-deletion.png', fullPage: true });
    console.log('Took screenshot: clients-before-deletion.png');

    // Check if there are any clients in the list
    const clientRows = page.locator('table tbody tr');
    let clientCount = await clientRows.count();
    console.log(`Found ${clientCount} clients in the list`);

    // Check if we see the empty state message
    const emptyStateMessage = page.locator('text=No tienes clientes registrados');
    const hasEmptyState = await emptyStateMessage.isVisible().catch(() => false);

    if (hasEmptyState) {
      console.log('No clients to delete - empty state is already showing');
      await page.screenshot({ path: 'screenshots/clients-empty-initial.png', fullPage: true });

      // Verify empty state after refresh
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'screenshots/clients-empty-after-refresh.png', fullPage: true });

      const emptyStateAfterRefresh = await emptyStateMessage.isVisible();
      expect(emptyStateAfterRefresh).toBe(true);
      console.log('Empty state verified after refresh');
      return;
    }

    // Delete clients one by one
    let deletedCount = 0;
    while (clientCount > 0) {
      // Get the first client row
      const firstClientRow = clientRows.first();
      const clientName = await firstClientRow.locator('td').first().locator('.font-medium').textContent();
      console.log(`Deleting client: ${clientName}`);

      // Click on "Editar" to go to the edit page where delete button is
      const editLink = firstClientRow.locator('text=Editar');
      await editLink.click();
      await page.waitForURL('**/clientes/**');
      await page.waitForLoadState('networkidle');

      // Take screenshot of edit page
      await page.screenshot({ path: `screenshots/client-edit-before-delete-${deletedCount + 1}.png`, fullPage: true });

      // Click the delete button
      const deleteButton = page.locator('button:has-text("Eliminar")');
      await deleteButton.click();

      // Wait for confirmation modal
      const confirmModal = page.locator('text=Confirmar eliminación');
      await expect(confirmModal).toBeVisible({ timeout: 5000 });

      // Take screenshot of confirmation modal
      await page.screenshot({ path: `screenshots/delete-confirmation-${deletedCount + 1}.png`, fullPage: true });

      // Confirm deletion
      const confirmDeleteButton = page.locator('button:has-text("Sí, eliminar")');
      await confirmDeleteButton.click();

      // Wait for redirect back to clients list
      await page.waitForURL('**/clientes?success=**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      deletedCount++;
      console.log(`Deleted client ${deletedCount}: ${clientName}`);

      // Take screenshot after deletion
      await page.screenshot({ path: `screenshots/after-delete-${deletedCount}.png`, fullPage: true });

      // Re-check client count
      clientCount = await clientRows.count().catch(() => 0);
      console.log(`Remaining clients: ${clientCount}`);
    }

    console.log(`Total clients deleted: ${deletedCount}`);

    // Take screenshot before refresh
    await page.screenshot({ path: 'screenshots/clients-all-deleted-before-refresh.png', fullPage: true });

    // Verify empty state message is visible
    const emptyMessageVisible = await emptyStateMessage.isVisible();
    console.log(`Empty state visible before refresh: ${emptyMessageVisible}`);
    expect(emptyMessageVisible).toBe(true);

    // CRITICAL TEST: Refresh the page and verify clients don't reappear
    console.log('Refreshing page to verify deletions persist...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Take screenshot after refresh
    await page.screenshot({ path: 'screenshots/clients-after-refresh.png', fullPage: true });

    // Check for any console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Verify empty state is still showing
    const emptyAfterRefresh = await emptyStateMessage.isVisible();
    console.log(`Empty state visible after refresh: ${emptyAfterRefresh}`);

    // Check if any clients reappeared
    const clientsAfterRefresh = await clientRows.count().catch(() => 0);
    console.log(`Clients after refresh: ${clientsAfterRefresh}`);

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/clients-final-state.png', fullPage: true });

    // Report findings
    if (clientsAfterRefresh > 0) {
      console.error('BUG DETECTED: Deleted clients reappeared after refresh!');
      // Get the names of reappeared clients
      const reappearedClients: string[] = [];
      for (let i = 0; i < clientsAfterRefresh; i++) {
        const name = await clientRows.nth(i).locator('td').first().locator('.font-medium').textContent();
        reappearedClients.push(name || 'Unknown');
      }
      console.error(`Reappeared clients: ${reappearedClients.join(', ')}`);
    }

    expect(emptyAfterRefresh).toBe(true);
    expect(clientsAfterRefresh).toBe(0);

    if (consoleErrors.length > 0) {
      console.warn('Console errors detected:', consoleErrors);
    }

    console.log('Test completed successfully - all clients deleted and empty state persists after refresh');
  });

  test('should verify "Crear primer cliente" button appears in empty state', async ({ page }) => {
    // Navigate to clients page
    await page.goto(`${BASE_URL}/clientes`);
    await page.waitForLoadState('networkidle');

    // Check if empty state is showing
    const emptyStateMessage = page.locator('text=No tienes clientes registrados');
    const hasEmptyState = await emptyStateMessage.isVisible().catch(() => false);

    if (!hasEmptyState) {
      console.log('Clients exist - skipping empty state button verification');
      return;
    }

    // Verify "Crear primer cliente" button is visible
    const createFirstClientButton = page.locator('text=Crear primer cliente');
    await expect(createFirstClientButton).toBeVisible();

    // Verify the button links to /clientes/nuevo
    const buttonLink = createFirstClientButton.locator('..');
    const href = await buttonLink.getAttribute('href');
    expect(href).toBe('/clientes/nuevo');

    console.log('Empty state with "Crear primer cliente" button verified');
    await page.screenshot({ path: 'screenshots/empty-state-with-button.png', fullPage: true });
  });
});
