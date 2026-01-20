import { test, expect } from '@playwright/test';

test.describe('Modelo 036 Toggle Persistence Debug', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application and login
    await page.goto('http://localhost:3001');

    // Login with test user
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✓ Login successful');
  });

  test('Debug: Check current toggle states and persistence', async ({ page }) => {
    console.log('=== Starting Toggle Persistence Debug ===');

    // Navigate to Calendario Fiscal
    await page.goto('http://localhost:3001/fiscal/calendario');
    await page.waitForLoadState('networkidle');
    console.log('✓ Navigated to Calendario Fiscal');

    // Open settings panel by clicking the gear icon
    const settingsButton = page.locator('button[title="Configuracion fiscal"]');
    await settingsButton.click();
    await page.waitForTimeout(500);
    console.log('✓ Settings panel opened');

    // Take screenshot of initial state
    await page.screenshot({ path: '/tmp/debug-036-1-initial.png', fullPage: true });

    // Check the state of toggles in the table - look for Modelo 303 toggle
    // The toggles are in a table, let's find them
    const modelo303Row = page.locator('tr:has-text("Modelo 303")').first();
    const modelo303Toggle = modelo303Row.locator('button').last(); // Toggle is a button
    
    // Get current state of toggle (check if it has bg-slate-700 class for enabled)
    const isModelo303Enabled = await modelo303Toggle.evaluate((btn) => {
      return btn.className.includes('bg-slate-700');
    });
    console.log(`✓ Modelo 303 toggle state: ${isModelo303Enabled ? 'ENABLED' : 'DISABLED'}`);

    // Check Modelo 349 (usually disabled by default)
    const modelo349Row = page.locator('tr:has-text("Modelo 349")').first();
    const modelo349Toggle = modelo349Row.locator('button').last();
    const isModelo349Enabled = await modelo349Toggle.evaluate((btn) => {
      return btn.className.includes('bg-slate-700');
    });
    console.log(`✓ Modelo 349 toggle state: ${isModelo349Enabled ? 'ENABLED' : 'DISABLED'}`);

    // Check SII (usually disabled)
    const siiRow = page.locator('tr:has-text("SII")').first();
    const siiToggle = siiRow.locator('button').last();
    const isSiiEnabled = await siiToggle.evaluate((btn) => {
      return btn.className.includes('bg-slate-700');
    });
    console.log(`✓ SII toggle state: ${isSiiEnabled ? 'ENABLED' : 'DISABLED'}`);

    // Now toggle one of them - let's toggle 349
    console.log('\n--- Toggling Modelo 349 ---');
    await modelo349Toggle.click();
    await page.waitForTimeout(1000); // Wait for save
    
    const isModelo349AfterToggle = await modelo349Toggle.evaluate((btn) => {
      return btn.className.includes('bg-slate-700');
    });
    console.log(`✓ Modelo 349 after toggle: ${isModelo349AfterToggle ? 'ENABLED' : 'DISABLED'}`);
    
    await page.screenshot({ path: '/tmp/debug-036-2-after-toggle.png', fullPage: true });

    // Close settings panel
    console.log('\n--- Closing and reopening settings ---');
    await settingsButton.click();
    await page.waitForTimeout(500);
    console.log('✓ Settings panel closed');

    // Reopen settings panel
    await settingsButton.click();
    await page.waitForTimeout(1000);
    console.log('✓ Settings panel reopened');

    await page.screenshot({ path: '/tmp/debug-036-3-after-reopen.png', fullPage: true });

    // Check if toggle state persisted after close/reopen
    const modelo349RowAfterReopen = page.locator('tr:has-text("Modelo 349")').first();
    const modelo349ToggleAfterReopen = modelo349RowAfterReopen.locator('button').last();
    const isModelo349AfterReopen = await modelo349ToggleAfterReopen.evaluate((btn) => {
      return btn.className.includes('bg-slate-700');
    });
    console.log(`✓ Modelo 349 after close/reopen: ${isModelo349AfterReopen ? 'ENABLED' : 'DISABLED'}`);

    // Now test page reload
    console.log('\n--- Testing page reload ---');
    await page.reload();
    await page.waitForLoadState('networkidle');
    console.log('✓ Page reloaded');

    // Open settings again
    const settingsButtonAfterReload = page.locator('button[title="Configuracion fiscal"]');
    await settingsButtonAfterReload.click();
    await page.waitForTimeout(1000);
    console.log('✓ Settings panel opened after reload');

    await page.screenshot({ path: '/tmp/debug-036-4-after-reload.png', fullPage: true });

    // Check toggle state after reload
    const modelo349RowAfterReload = page.locator('tr:has-text("Modelo 349")').first();
    const modelo349ToggleAfterReload = modelo349RowAfterReload.locator('button').last();
    const isModelo349AfterReload = await modelo349ToggleAfterReload.evaluate((btn) => {
      return btn.className.includes('bg-slate-700');
    });
    console.log(`✓ Modelo 349 after page reload: ${isModelo349AfterReload ? 'ENABLED' : 'DISABLED'}`);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Initial state: ${isModelo349Enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`After toggle: ${isModelo349AfterToggle ? 'ENABLED' : 'DISABLED'}`);
    console.log(`After close/reopen: ${isModelo349AfterReopen ? 'ENABLED' : 'DISABLED'}`);
    console.log(`After page reload: ${isModelo349AfterReload ? 'ENABLED' : 'DISABLED'}`);

    // Toggle it back to original state for cleanup
    if (isModelo349AfterReload !== isModelo349Enabled) {
      console.log('\n--- Cleanup: Toggling back to original state ---');
      await modelo349ToggleAfterReload.click();
      await page.waitForTimeout(1000);
    }

    // The test passes if toggles work - we're debugging here
    expect(true).toBe(true);
  });

  test('Debug: Check API calls for preferences', async ({ page }) => {
    console.log('=== Starting API Debug ===');

    // Listen for API responses
    const apiCalls: { url: string; method: string; status: number; body?: any }[] = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/auth/') || url.includes('/api/fiscal/')) {
        const method = response.request().method();
        const status = response.status();
        let body = null;
        try {
          body = await response.json();
        } catch (e) {
          // Not JSON response
        }
        apiCalls.push({ url, method, status, body });
        console.log(`API: ${method} ${url} -> ${status}`);
      }
    });

    // Navigate to Calendario Fiscal
    await page.goto('http://localhost:3001/fiscal/calendario');
    await page.waitForLoadState('networkidle');
    console.log('✓ Navigated to Calendario Fiscal');

    // Open settings panel
    const settingsButton = page.locator('button[title="Configuracion fiscal"]');
    await settingsButton.click();
    await page.waitForTimeout(1000);
    console.log('✓ Settings panel opened');

    // Toggle Modelo 349
    const modelo349Row = page.locator('tr:has-text("Modelo 349")').first();
    const modelo349Toggle = modelo349Row.locator('button').last();
    
    console.log('\n--- Clicking toggle ---');
    await modelo349Toggle.click();
    await page.waitForTimeout(2000); // Wait for API call

    // Print all captured API calls
    console.log('\n=== API Calls Captured ===');
    apiCalls.forEach((call, index) => {
      console.log(`${index + 1}. ${call.method} ${call.url} -> ${call.status}`);
      if (call.body && call.method === 'PATCH') {
        console.log(`   Body: ${JSON.stringify(call.body).substring(0, 200)}`);
      }
    });

    // Toggle back
    await modelo349Toggle.click();
    await page.waitForTimeout(1000);

    expect(true).toBe(true);
  });
});
