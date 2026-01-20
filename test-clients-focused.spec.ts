import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@migestor.com',
  password: 'Test123456'
};

test.describe('Client Management Testing', () => {
  test('Full client CRUD operations', async ({ page }) => {
    // Login
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to clients page
    console.log('Step 2: Navigating to clients page...');
    await page.goto('http://localhost:3001/clientes');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/01-clientes-list.png', fullPage: true });
    console.log('✅ Clients page loaded');

    // CREATE: Click "Nuevo Cliente" button
    console.log('Step 3: Creating new client...');
    const newClientButton = page.locator('text=Nuevo Cliente').first();
    await expect(newClientButton).toBeVisible({ timeout: 5000 });
    await newClientButton.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/02-new-client-form.png', fullPage: true });

    // Fill in new client form
    const timestamp = Date.now();
    const testClient = {
      razon_social: `Test Client ${timestamp}`,
      cif: `B${timestamp.toString().slice(-7)}1`,
      email: `test${timestamp}@example.com`,
      telefono: '600123456',
      direccion: 'Calle Test 123',
      ciudad: 'Madrid',
      codigo_postal: '28001'
    };

    await page.fill('input[name="razon_social"]', testClient.razon_social);
    await page.fill('input[name="cif"]', testClient.cif);
    await page.fill('input[name="email"]', testClient.email);
    await page.fill('input[name="telefono"]', testClient.telefono);
    await page.fill('input[name="direccion"]', testClient.direccion);
    await page.fill('input[name="ciudad"]', testClient.ciudad);
    await page.fill('input[name="codigo_postal"]', testClient.codigo_postal);

    await page.screenshot({ path: 'screenshots/03-new-client-filled.png', fullPage: true });

    // Submit the form
    await page.click('button[type="submit"]');
    await page.waitForURL('**/clientes', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/04-after-create.png', fullPage: true });

    // Verify client appears in list (look specifically in the table)
    const clientInList = page.locator('table').locator(`text=${testClient.razon_social}`);
    await expect(clientInList).toBeVisible({ timeout: 5000 });
    console.log('✅ Client created successfully');

    // EDIT: Click on "Editar" for the newly created client
    console.log('Step 4: Editing client...');
    const clientRow = page.locator(`tr:has-text("${testClient.razon_social}")`);
    const editLink = clientRow.locator('text=Editar');
    await editLink.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/05-edit-client-form.png', fullPage: true });

    // Verify we're on the edit page
    await expect(page.locator('h2:has-text("Editar Cliente")')).toBeVisible();

    // Modify the client name
    const updatedName = `${testClient.razon_social} UPDATED`;
    await page.fill('input[name="razon_social"]', updatedName);

    // Modify phone number
    await page.fill('input[name="telefono"]', '666999888');

    await page.screenshot({ path: 'screenshots/06-edit-client-modified.png', fullPage: true });

    // Save changes
    await page.click('button[type="submit"]:has-text("Guardar")');
    await page.waitForURL('**/clientes', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/07-after-edit.png', fullPage: true });

    // Verify updated name and phone appear in table
    const updatedRow = page.locator(`tr:has-text("${updatedName}")`);
    await expect(updatedRow).toBeVisible({ timeout: 5000 });
    console.log('✅ Client updated successfully');

    // MODIFY AGAIN: Test marking as inactive
    console.log('Step 5: Testing inactive status...');
    await updatedRow.locator('text=Editar').click();
    await page.waitForLoadState('networkidle');

    // Uncheck "activo"
    const activoCheckbox = page.locator('input[name="activo"]');
    await activoCheckbox.uncheck();
    await page.screenshot({ path: 'screenshots/08-mark-inactive.png', fullPage: true });

    // Save changes
    await page.click('button[type="submit"]:has-text("Guardar")');
    await page.waitForURL('**/clientes', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/09-after-inactive.png', fullPage: true });

    // Verify "Inactivo" badge appears
    const inactiveRow = page.locator(`tr:has-text("${updatedName}")`);
    await expect(inactiveRow.locator('text=Inactivo')).toBeVisible();
    console.log('✅ Client marked as inactive successfully');

    // DELETE: Test deletion
    console.log('Step 6: Deleting client...');
    await inactiveRow.locator('text=Editar').click();
    await page.waitForLoadState('networkidle');

    // Click delete button
    await page.click('button:has-text("Eliminar")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/10-delete-confirmation.png', fullPage: true });

    // Confirm deletion
    await page.click('button:has-text("Sí, eliminar")');
    await page.waitForURL('**/clientes', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/11-after-delete.png', fullPage: true });

    // Verify client is gone from table
    await expect(page.locator('table').locator(`text=${updatedName}`)).not.toBeVisible({ timeout: 3000 });
    console.log('✅ Client deleted successfully');

    console.log('\n✅ ALL TESTS PASSED!');
  });
});
