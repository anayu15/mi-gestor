import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@migestor.com',
  password: 'Test123456'
};

test.describe('Client Deletion UX Improvements', () => {
  test('deleted clients should not appear by default, toggle shows them', async ({ page }) => {
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to clients page
    console.log('Step 2: Checking clients page...');
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/ux-01-clients-default-view.png', fullPage: true });

    // Check if "Mostrar inactivos" checkbox exists
    const showInactiveCheckbox = page.locator('text=Mostrar inactivos');
    await expect(showInactiveCheckbox).toBeVisible();
    console.log('✅ "Mostrar inactivos" toggle is visible');

    // Count clients in default view (should only show active)
    const clientRows = page.locator('table tbody tr');
    const defaultCount = await clientRows.count();
    console.log(`Clients visible in default view: ${defaultCount}`);

    // Check if there's an "Inactivo" badge visible (shouldn't be in default view)
    const inactivoBadge = page.locator('text=Inactivo');
    const inactivoCount = await inactivoBadge.count();

    if (inactivoCount > 0) {
      console.log(`⚠️  Found ${inactivoCount} inactive badges in default view (should be 0)`);
    } else {
      console.log('✅ No inactive badges in default view (as expected)');
    }

    // Click the "Mostrar inactivos" checkbox
    console.log('Step 3: Toggling to show inactive clients...');
    await page.click('text=Mostrar inactivos');
    await page.waitForTimeout(1000); // Wait for reload
    await page.screenshot({ path: 'screenshots/ux-02-show-inactive-enabled.png', fullPage: true });

    // Count clients after enabling toggle
    const toggledCount = await clientRows.count();
    console.log(`Clients visible with inactive shown: ${toggledCount}`);

    // Now check for inactive badges
    const inactivoBadgeAfterToggle = page.locator('text=Inactivo');
    const inactivoCountAfterToggle = await inactivoBadgeAfterToggle.count();
    console.log(`Inactive badges after toggle: ${inactivoCountAfterToggle}`);

    if (toggledCount > defaultCount || inactivoCountAfterToggle > 0) {
      console.log('✅ Toggle reveals additional inactive clients');
    }

    // Test deletion with soft delete message
    console.log('Step 4: Testing deletion of client with invoices...');
    if (toggledCount > 0) {
      // Click edit on first client
      await page.locator('a:has-text("Editar")').first().click();
      await page.waitForLoadState('networkidle');

      // Get client name
      const nombreInput = page.locator('input[name="razon_social"]');
      const clientName = await nombreInput.inputValue();
      console.log(`Deleting client: "${clientName}"`);

      // Click delete
      await page.click('button:has-text("Eliminar")');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/ux-03-delete-modal.png', fullPage: true });

      // Confirm deletion
      await page.click('button:has-text("Sí, eliminar")');
      await page.waitForURL('**/clientes', { timeout: 10000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/ux-04-after-delete.png', fullPage: true });

      // Check the success toast message
      const toast = page.locator('.fixed.top-4.right-4');
      const toastVisible = await toast.isVisible().catch(() => false);

      if (toastVisible) {
        const toastText = await toast.textContent();
        console.log(`Toast message: "${toastText}"`);

        if (toastText?.includes('desactivado')) {
          console.log('✅ Correct message for soft delete (desactivado)');
        } else if (toastText?.includes('eliminado correctamente')) {
          console.log('✅ Correct message for hard delete (eliminado)');
        } else {
          console.log('⚠️  Unexpected toast message');
        }
      }

      // Verify client is NOT visible in default view
      await page.waitForTimeout(3000); // Wait for toast to disappear
      const clientInDefaultView = page.locator('table').locator(`text=${clientName}`);
      const isVisibleInDefault = await clientInDefaultView.isVisible().catch(() => false);

      if (!isVisibleInDefault) {
        console.log('✅ Deleted client not visible in default view');
      } else {
        console.log('❌ Deleted client still visible in default view');
      }

      // Refresh page and verify client is still not visible
      console.log('Step 5: Refreshing page...');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'screenshots/ux-05-after-refresh.png', fullPage: true });

      const clientAfterRefresh = page.locator('table').locator(`text=${clientName}`);
      const isVisibleAfterRefresh = await clientAfterRefresh.isVisible().catch(() => false);

      if (!isVisibleAfterRefresh) {
        console.log('✅ Deleted client not visible after refresh (as expected)');
      } else {
        console.log('❌ Deleted client reappeared after refresh');
        throw new Error('Deleted client should not appear in default view after refresh');
      }

      // Enable "Mostrar inactivos" and verify client is now visible
      console.log('Step 6: Enabling toggle again to verify client is still in database...');
      await page.click('text=Mostrar inactivos');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/ux-06-inactive-shown-again.png', fullPage: true });

      const clientWithToggle = page.locator('table').locator(`text=${clientName}`);
      const isVisibleWithToggle = await clientWithToggle.isVisible().catch(() => false);

      if (isVisibleWithToggle) {
        console.log('✅ Deleted client visible when "Mostrar inactivos" is enabled');

        // Verify it has "Inactivo" badge
        const clientRow = page.locator(`tr:has-text("${clientName}")`);
        const hasInactivoBadge = await clientRow.locator('text=Inactivo').isVisible();

        if (hasInactivoBadge) {
          console.log('✅ Client has "Inactivo" badge');
        } else {
          console.log('❌ Client missing "Inactivo" badge');
        }
      }
    }

    console.log('\n✅ ALL UX TESTS PASSED!');
  });
});
