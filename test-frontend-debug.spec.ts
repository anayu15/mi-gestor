import { test, expect } from '@playwright/test';

test('Debug frontend loading issue', async ({ page }) => {
  const errors: Array<{type: string, message: string}> = [];
  const consoleLogs: Array<{type: string, message: string}> = [];

  // Capture all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, message: text });

    if (type === 'error') {
      console.error(`[CONSOLE ERROR] ${text}`);
    } else if (type === 'warning') {
      console.warn(`[CONSOLE WARNING] ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    const message = error.message;
    errors.push({ type: 'pageerror', message });
    console.error(`[PAGE ERROR] ${message}`);
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    const url = request.url();
    const failure = request.failure();
    console.error(`[REQUEST FAILED] ${url}: ${failure?.errorText}`);
  });

  console.log('Navigating to homepage...');

  // Navigate to the homepage
  await page.goto('http://localhost:3001/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  console.log('Page loaded, waiting for content...');

  // Wait a bit
  await page.waitForTimeout(5000);

  // Get page HTML
  const html = await page.content();
  console.log('\n=== PAGE HTML (first 500 chars) ===');
  console.log(html.substring(0, 500));

  // Check what's visible
  const bodyText = await page.locator('body').textContent();
  console.log('\n=== VISIBLE TEXT ===');
  console.log(bodyText);

  // Check for loading indicator
  const hasLoading = bodyText?.includes('Cargando');
  console.log(`\n=== HAS "Cargando" TEXT: ${hasLoading} ===`);

  // Try to find specific elements
  const loadingDiv = await page.locator('text=Cargando').count();
  console.log(`Loading divs found: ${loadingDiv}`);

  // Get current URL
  const currentUrl = page.url();
  console.log(`\nCurrent URL: ${currentUrl}`);

  // Print all errors
  if (errors.length > 0) {
    console.log('\n=== PAGE ERRORS ===');
    errors.forEach(err => console.log(`${err.type}: ${err.message}`));
  }

  // Print error console logs
  const errorLogs = consoleLogs.filter(log => log.type === 'error');
  if (errorLogs.length > 0) {
    console.log('\n=== CONSOLE ERRORS ===');
    errorLogs.forEach(log => console.log(log.message));
  }

  // Take a screenshot
  await page.screenshot({ path: 'debug-loading-page.png', fullPage: true });
  console.log('\nScreenshot saved to: debug-loading-page.png');

  // Check network activity
  console.log('\n=== CHECKING API CONNECTIVITY ===');
  try {
    const response = await page.request.get('http://localhost:3000/health');
    console.log(`Backend health check: ${response.status()}`);
    const body = await response.json();
    console.log('Backend response:', body);
  } catch (e) {
    console.error('Backend health check failed:', e);
  }
});
