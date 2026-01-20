import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@migestor.com',
  password: 'Test123456'
};

test('diagnostic - check client management UI', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  console.log('✅ Login successful');

  // Navigate to clientes
  await page.goto('http://localhost:3001/clientes');
  await page.waitForTimeout(2000);

  const pageContent = await page.content();
  console.log('Page URL:', page.url());
  console.log('Page title:', await page.title());

  // Check what's on the page
  const h1 = await page.locator('h1').first().textContent().catch(() => 'No H1');
  const h2 = await page.locator('h2').first().textContent().catch(() => 'No H2');
  console.log('H1:', h1);
  console.log('H2:', h2);

  // Look for buttons
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} buttons`);
  for (let i = 0; i < Math.min(buttons.length, 10); i++) {
    const text = await buttons[i].textContent();
    console.log(`  Button ${i}: "${text}"`);
  }

  // Take screenshot
  await page.screenshot({ path: 'screenshots/client-diagnostic.png', fullPage: true });

  // Try to find "Nuevo Cliente" or similar
  const newClientButton = page.locator('button').filter({ hasText: /nuevo|añadir|crear/i });
  const count = await newClientButton.count();
  console.log(`Found ${count} "new client" button(s)`);

  if (count > 0) {
    console.log('✅ Found new client button');
    await newClientButton.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/new-client-form-diagnostic.png', fullPage: true });

    // Check form fields
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input fields in form`);
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const type = await input.getAttribute('type');
      console.log(`  Input - name: ${name}, id: ${id}, type: ${type}`);
    }
  } else {
    console.log('❌ No new client button found');
  }
});
