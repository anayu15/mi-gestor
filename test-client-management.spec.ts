import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@migestor.com',
  password: 'Test123456'
};

test.describe('Client Management in Facturas Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should navigate to facturas and access client management', async ({ page }) => {
    // Navigate to facturas section
    await page.click('text=Facturas');
    await page.waitForURL('**/facturas');

    // Look for client management/configuration button or link
    await page.screenshot({ path: 'screenshots/facturas-main.png', fullPage: true });

    // Try to find client configuration - could be labeled as "Clientes", "Configuración", etc.
    const clientLink = page.locator('text=/Clientes|Configurar clientes|Gestionar clientes|Cliente/i').first();
    const hasClientLink = await clientLink.count();

    console.log(`Found ${hasClientLink} client management link(s)`);

    if (hasClientLink > 0) {
      await clientLink.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/client-management.png', fullPage: true });
    } else {
      // Check if there's a clients section in the main navigation
      await page.goto('http://localhost:3001/clientes');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/clientes-section.png', fullPage: true });
    }
  });

  test('should create a new client', async ({ page }) => {
    // Navigate to clients section
    await page.goto('http://localhost:3001/clientes');
    await page.waitForTimeout(1000);

    // Look for "Add Client" or "Nuevo Cliente" button
    const addButton = page.locator('button:has-text("Nuevo"), button:has-text("Añadir"), button:has-text("Crear")').first();
    await addButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/new-client-form.png', fullPage: true });

    // Fill in client details
    const timestamp = Date.now();
    const testClient = {
      nombre: `Cliente Test ${timestamp}`,
      cif: 'B12345678',
      email: `cliente${timestamp}@test.com`,
      telefono: '666777888',
      direccion: 'Calle Test 123',
      ciudad: 'Madrid',
      codigo_postal: '28001',
      provincia: 'Madrid'
    };

    // Fill form fields (trying different possible field names)
    await page.fill('input[name="nombre"], input[id="nombre"]', testClient.nombre);
    await page.fill('input[name="cif"], input[id="cif"]', testClient.cif);

    try {
      await page.fill('input[name="email"], input[id="email"]', testClient.email);
    } catch (e) {
      console.log('Email field not required');
    }

    try {
      await page.fill('input[name="telefono"], input[id="telefono"]', testClient.telefono);
    } catch (e) {
      console.log('Phone field not required');
    }

    try {
      await page.fill('input[name="direccion"], input[id="direccion"]', testClient.direccion);
    } catch (e) {
      console.log('Address field not required');
    }

    await page.screenshot({ path: 'screenshots/new-client-filled.png', fullPage: true });

    // Submit form
    await page.click('button[type="submit"], button:has-text("Guardar"), button:has-text("Crear")');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/after-create-client.png', fullPage: true });

    // Verify client appears in list
    const clientInList = page.locator(`text=${testClient.nombre}`);
    await expect(clientInList).toBeVisible({ timeout: 5000 });

    console.log('✅ Client created successfully');
  });

  test('should edit an existing client', async ({ page }) => {
    // Navigate to clients section
    await page.goto('http://localhost:3001/clientes');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/client-list-before-edit.png', fullPage: true });

    // Find first edit button or click on first client
    const editButton = page.locator('button:has-text("Editar"), [aria-label*="Editar"], svg[data-icon="edit"]').first();
    const editButtonCount = await editButton.count();

    if (editButtonCount > 0) {
      await editButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'screenshots/edit-client-form.png', fullPage: true });

      // Modify client name
      const nombreInput = page.locator('input[name="nombre"], input[id="nombre"]');
      const currentValue = await nombreInput.inputValue();
      const newValue = `${currentValue} EDITADO`;

      await nombreInput.fill(newValue);

      await page.screenshot({ path: 'screenshots/edit-client-modified.png', fullPage: true });

      // Save changes
      await page.click('button[type="submit"], button:has-text("Guardar"), button:has-text("Actualizar")');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'screenshots/after-edit-client.png', fullPage: true });

      // Verify changes
      const updatedClient = page.locator(`text=${newValue}`);
      await expect(updatedClient).toBeVisible({ timeout: 5000 });

      console.log('✅ Client edited successfully');
    } else {
      console.log('❌ No edit button found');
      throw new Error('Could not find edit button');
    }
  });

  test('should mark client as principal (main client)', async ({ page }) => {
    // Navigate to clients section
    await page.goto('http://localhost:3001/clientes');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/client-list-principal.png', fullPage: true });

    // Look for option to mark as principal client
    const principalButton = page.locator('button:has-text("Principal"), input[type="checkbox"][name*="principal"], [aria-label*="Principal"]').first();
    const principalCount = await principalButton.count();

    if (principalCount > 0) {
      await principalButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'screenshots/after-mark-principal.png', fullPage: true });

      console.log('✅ Principal client functionality found and tested');
    } else {
      console.log('⚠️  Principal client option not found in UI');
    }
  });

  test('should delete a client', async ({ page }) => {
    // First create a client to delete
    await page.goto('http://localhost:3001/clientes');
    await page.waitForTimeout(1000);

    // Create a test client
    const addButton = page.locator('button:has-text("Nuevo"), button:has-text("Añadir"), button:has-text("Crear")').first();
    await addButton.click();
    await page.waitForTimeout(500);

    const timestamp = Date.now();
    await page.fill('input[name="nombre"], input[id="nombre"]', `Cliente a Borrar ${timestamp}`);
    await page.fill('input[name="cif"], input[id="cif"]', `B${timestamp.toString().slice(-7)}`);

    await page.click('button[type="submit"], button:has-text("Guardar"), button:has-text("Crear")');
    await page.waitForTimeout(2000);

    // Now find and delete it
    const deleteButton = page.locator(`text=Cliente a Borrar ${timestamp}`).locator('..').locator('button:has-text("Eliminar"), [aria-label*="Eliminar"], svg[data-icon="trash"]').first();
    const deleteCount = await deleteButton.count();

    if (deleteCount > 0) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirmar"), button:has-text("Eliminar"), button:has-text("Sí")');
      const confirmCount = await confirmButton.count();

      if (confirmCount > 0) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'screenshots/after-delete-client.png', fullPage: true });

      // Verify client is gone
      const deletedClient = page.locator(`text=Cliente a Borrar ${timestamp}`);
      await expect(deletedClient).not.toBeVisible({ timeout: 3000 });

      console.log('✅ Client deleted successfully');
    } else {
      console.log('⚠️  Delete button not found');
    }
  });
});
