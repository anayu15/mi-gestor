import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@migestor.com',
  password: 'Test123456'
};

const BASE_URL = 'http://localhost:3001';

test.describe('Client Deletion Verification - Simple Test', () => {
  test('should verify client deletion behavior and refresh persistence', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Login
    console.log('Step 1: Logging in...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('Login successful');

    // Navigate to clients page
    console.log('Step 2: Navigating to clients page...');
    await page.goto(`${BASE_URL}/clientes`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/test-simple-1-initial-clients.png', fullPage: true });

    // Count clients before any action
    const clientRowsBefore = page.locator('table tbody tr');
    const countBefore = await clientRowsBefore.count().catch(() => 0);
    console.log(`Initial client count: ${countBefore}`);

    // Check if empty state is shown
    const emptyState = page.locator('text=No tienes clientes registrados');
    const isEmptyInitially = await emptyState.isVisible().catch(() => false);

    if (isEmptyInitially) {
      console.log('No clients exist - creating a test client first');

      // Create a test client
      await page.click('text=Crear primer cliente');
      await page.waitForLoadState('networkidle');

      const timestamp = Date.now();
      await page.fill('input[name="razon_social"]', `Test Client ${timestamp}`);
      await page.fill('input[name="cif"]', `B${String(timestamp).slice(-8)}`);
      await page.fill('input[name="email"]', `test${timestamp}@test.com`);

      await page.click('button[type="submit"]');
      await page.waitForURL('**/clientes?success=**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      console.log('Test client created');
    }

    // Refresh and count again
    await page.goto(`${BASE_URL}/clientes`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/test-simple-2-before-deletion.png', fullPage: true });

    // Get first client info
    const clientRows = page.locator('table tbody tr');
    const clientCountBeforeDelete = await clientRows.count();
    console.log(`Clients before deletion: ${clientCountBeforeDelete}`);

    if (clientCountBeforeDelete === 0) {
      console.log('No clients to delete');
      return;
    }

    // Get first client name
    const firstClientName = await clientRows.first().locator('td').first().locator('.font-medium.text-gray-900').textContent();
    console.log(`Will delete client: ${firstClientName}`);

    // Check if client has "Inactivo" badge before deletion
    const firstClientRow = clientRows.first();
    const inactiveBadgeBefore = firstClientRow.locator('text=Inactivo');
    const wasInactiveBefore = await inactiveBadgeBefore.isVisible().catch(() => false);
    console.log(`Client was inactive before deletion: ${wasInactiveBefore}`);

    // Navigate to edit page to delete
    await firstClientRow.locator('text=Editar').click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/test-simple-3-edit-page.png', fullPage: true });

    // Click delete button
    await page.click('button:has-text("Eliminar")');
    await page.waitForSelector('text=Confirmar eliminacion', { timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'screenshots/test-simple-4-delete-modal.png', fullPage: true });

    // Confirm deletion (note: "Sí" has accent)
    await page.click('button:has-text("Sí, eliminar")');
    await page.waitForURL('**/clientes?success=**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/test-simple-5-after-deletion.png', fullPage: true });

    // Check if success toast appeared
    const successToast = page.locator('text=/eliminado correctamente/');
    const toastVisible = await successToast.isVisible().catch(() => false);
    console.log(`Success toast visible: ${toastVisible}`);

    // Count clients after deletion
    const clientCountAfterDelete = await clientRows.count().catch(() => 0);
    console.log(`Clients after deletion: ${clientCountAfterDelete}`);

    // Check if the deleted client is still visible
    const deletedClientStillVisible = await page.locator(`text=${firstClientName}`).first().isVisible().catch(() => false);
    console.log(`Deleted client still visible: ${deletedClientStillVisible}`);

    // If visible, check if it now has "Inactivo" badge
    if (deletedClientStillVisible) {
      const clientRowWithName = page.locator(`tr:has-text("${firstClientName}")`).first();
      const inactiveBadgeAfter = clientRowWithName.locator('text=Inactivo');
      const isInactiveAfter = await inactiveBadgeAfter.isVisible().catch(() => false);
      console.log(`Deleted client now marked as Inactivo: ${isInactiveAfter}`);
    }

    // CRITICAL: Refresh the page
    console.log('Step 3: Refreshing page to verify persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/test-simple-6-after-refresh.png', fullPage: true });

    // Check client count after refresh
    const clientCountAfterRefresh = await clientRows.count().catch(() => 0);
    console.log(`Clients after refresh: ${clientCountAfterRefresh}`);

    // Check if deleted client is visible after refresh
    const deletedClientVisibleAfterRefresh = await page.locator(`text=${firstClientName}`).first().isVisible().catch(() => false);
    console.log(`Deleted client visible after refresh: ${deletedClientVisibleAfterRefresh}`);

    // Check if empty state appears
    const emptyStateAfterRefresh = await emptyState.isVisible().catch(() => false);
    console.log(`Empty state visible after refresh: ${emptyStateAfterRefresh}`);

    // Report findings
    console.log('\n=== TEST RESULTS ===');
    console.log(`Clients before deletion: ${clientCountBeforeDelete}`);
    console.log(`Clients after deletion (no refresh): ${clientCountAfterDelete}`);
    console.log(`Clients after refresh: ${clientCountAfterRefresh}`);
    console.log(`Deleted client "${firstClientName}" still visible: ${deletedClientVisibleAfterRefresh}`);

    if (deletedClientVisibleAfterRefresh) {
      console.log('\nPOTENTIAL ISSUE: Deleted client is still visible after refresh.');
      console.log('This may be because:');
      console.log('1. The delete is a soft-delete (sets activo=false) and the page shows all clients');
      console.log('2. There is a bug in the deletion logic');
    }

    if (consoleErrors.length > 0) {
      console.log('\nConsole errors detected:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/test-simple-7-final.png', fullPage: true });
  });
});
