import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Test script to verify the Modelo 036 upload functionality
 * This test will:
 * 1. Login to the application
 * 2. Navigate to the fiscal settings
 * 3. Upload a Modelo 036 PDF document
 * 4. Capture any errors that occur
 */

test.describe('Modelo 036 Upload Test', () => {
  test.setTimeout(120000); // 2 minutes timeout for Vision API processing

  test('should upload and analyze Modelo 036 document', async ({ page }) => {
    // Enable console logging to capture errors
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(`[PAGE ERROR] ${error.message}`);
    });

    // Capture network responses for debugging
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/') && !response.ok()) {
        try {
          const body = await response.text();
          networkErrors.push(`[${response.status()}] ${url}: ${body}`);
        } catch (e) {
          networkErrors.push(`[${response.status()}] ${url}: Could not read body`);
        }
      }
    });

    console.log('=== Step 1: Navigate to Login Page ===');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/test-results/01-login-page.png',
      fullPage: true
    });

    console.log('=== Step 2: Fill Login Credentials ===');
    await page.fill('input[type="email"]', 'test@migestor.com');
    await page.fill('input[type="password"]', 'Test123456');

    // Take screenshot before clicking login
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/test-results/02-login-filled.png',
      fullPage: true
    });

    console.log('=== Step 3: Submit Login ===');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('Login successful - now on dashboard');

    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/test-results/03-dashboard.png',
      fullPage: true
    });

    console.log('=== Step 4: Navigate to Fiscal Calendar ===');
    await page.goto('http://localhost:3001/fiscal/calendario');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/test-results/04-fiscal-calendario.png',
      fullPage: true
    });

    console.log('=== Step 5: Open Fiscal Settings ===');
    // Look for the settings/gear button and click it
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /configurar|ajustes/i }).first();

    // Try different ways to find the settings button
    let foundSettings = false;

    // Option 1: Look for a button with gear icon (cog)
    const gearButtons = await page.locator('button svg[stroke="currentColor"]').all();
    console.log(`Found ${gearButtons.length} buttons with SVG icons`);

    // Option 2: Look for any settings-related element
    const settingsElements = await page.locator('[class*="settings"], [aria-label*="settings"], [aria-label*="configurar"]').all();
    console.log(`Found ${settingsElements.length} settings-related elements`);

    // Option 3: Look for the actual settings modal trigger in the fiscal page
    // According to the code, FiscalSettings is shown via some UI mechanism
    // Let's check for a button that might open it

    // Looking at the FiscalCalendario or fiscal page structure
    // The FiscalSettings component might be in a modal or sidebar

    // For now, let's try to directly render the settings by navigating to a URL that shows it
    // or by clicking the most likely button

    const allButtons = await page.locator('button').all();
    console.log(`Found ${allButtons.length} total buttons on the page`);

    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const buttonText = await allButtons[i].textContent();
      console.log(`  Button ${i}: "${buttonText?.trim()}"`);
    }

    // Try to find a button with settings icon or text
    const configButton = page.locator('button:has(svg)').filter({ hasText: '' }).first();

    // Let's look for any element that might open settings
    const possibleSettingsButtons = await page.locator('button:has(svg path[d*="M10.3"])').all(); // gear icon path
    console.log(`Found ${possibleSettingsButtons.length} possible gear icon buttons`);

    // Try clicking the first icon button that looks like settings
    if (possibleSettingsButtons.length > 0) {
      await possibleSettingsButtons[0].click();
      foundSettings = true;
    } else {
      // Try looking for any settings trigger
      const settingsTrigger = page.locator('[data-testid*="settings"], [aria-label*="settings"], [aria-label*="Configurar"]').first();
      if (await settingsTrigger.isVisible()) {
        await settingsTrigger.click();
        foundSettings = true;
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: '/Users/anayusta/workspace/mi-gestor/test-results/05-after-settings-click.png',
      fullPage: true
    });

    console.log('=== Step 6: Look for Modelo 036 Upload Section ===');

    // Check if FiscalSettings component is visible
    const modelo036Section = page.locator('text=Modelo 036').first();
    const isModelo036Visible = await modelo036Section.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isModelo036Visible) {
      console.log('Modelo 036 section not immediately visible, looking for tabs or triggers...');

      // Try to find and click the "Agencia Tributaria" tab
      const aeatTab = page.locator('button:has-text("Agencia Tributaria")');
      if (await aeatTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await aeatTab.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/test-results/06-looking-for-036.png',
        fullPage: true
      });
    }

    console.log('=== Step 7: Upload Modelo 036 Document ===');

    // Find the file input (it's hidden, used by the upload dropzone)
    const fileInput = page.locator('input[type="file"][accept*=".pdf"]');

    if (await fileInput.count() > 0) {
      console.log('Found file input, uploading document...');

      const pdfPath = '/Users/anayusta/workspace/mi-gestor/test-modelo-036.pdf';

      // Set up a listener for the API response BEFORE uploading
      const uploadPromise = page.waitForResponse(
        response => response.url().includes('/modelo-036/upload'),
        { timeout: 90000 }
      ).catch(e => {
        console.error('No upload response captured:', e.message);
        return null;
      });

      // Upload the file
      await fileInput.setInputFiles(pdfPath);

      console.log('File selected, waiting for upload and analysis...');

      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/test-results/07-uploading.png',
        fullPage: true
      });

      // Wait for the API response
      const response = await uploadPromise;

      if (response) {
        const status = response.status();
        console.log(`Upload response status: ${status}`);

        try {
          const responseBody = await response.text();
          console.log('Upload response body:', responseBody);

          if (status !== 200 && status !== 201) {
            console.error('=== UPLOAD ERROR ===');
            console.error(`Status: ${status}`);
            console.error(`Body: ${responseBody}`);
          }
        } catch (e) {
          console.error('Could not read response body:', e);
        }
      }

      // Wait a bit and take a final screenshot
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/test-results/08-after-upload.png',
        fullPage: true
      });
    } else {
      console.error('File input not found on the page!');
      await page.screenshot({
        path: '/Users/anayusta/workspace/mi-gestor/test-results/07-no-file-input.png',
        fullPage: true
      });
    }

    console.log('=== Final Report ===');
    console.log('\n--- Console Errors ---');
    for (const error of consoleErrors) {
      console.log(error);
    }

    console.log('\n--- Network Errors ---');
    for (const error of networkErrors) {
      console.log(error);
    }

    console.log('\n--- All Console Logs (last 50) ---');
    for (const log of consoleLogs.slice(-50)) {
      console.log(log);
    }
  });
});
