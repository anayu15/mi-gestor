import { test, expect } from '@playwright/test';

test.describe('miGestor Application Validation', () => {
  test('Backend health check should be working', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  test('Frontend should load without errors', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors (but ignore resource loading errors)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore 404 resource errors, focus on JavaScript errors
        if (!text.includes('Failed to load resource') && !text.includes('404')) {
          errors.push(text);
        }
      }
    });

    // Capture page errors (JavaScript errors)
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // Navigate to the homepage
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Check for JavaScript errors (not resource loading errors)
    if (errors.length > 0) {
      console.error('JavaScript errors detected:', errors);
      throw new Error(`Page has ${errors.length} JavaScript errors: ${errors.join(', ')}`);
    }

    // Verify page title
    await expect(page).toHaveTitle(/miGestor/);

    // Verify page is interactive (no critical crash)
    const bodyVisible = await page.isVisible('body');
    expect(bodyVisible).toBeTruthy();
  });

  test('API authentication endpoint should be accessible', async ({ request }) => {
    // Test that the login endpoint exists (should return 400 for missing credentials)
    const response = await request.post('http://localhost:3000/api/auth/login', {
      data: {}
    });

    // Should get 400 for missing credentials, not 404 or 500
    expect([400, 401]).toContain(response.status());
  });

  test('Recurring templates API endpoint should exist', async ({ request }) => {
    // Test that the recurring templates endpoint exists (should return 401 for unauthenticated)
    const response = await request.get('http://localhost:3000/api/recurring-templates');

    // Should get 401 unauthorized, not 404
    expect(response.status()).toBe(401);
  });

  test('New backfill endpoints should exist', async ({ request }) => {
    // Test that the new backfill endpoints exist (should return 401 for unauthenticated)
    const missingInvoicesResponse = await request.get('http://localhost:3000/api/recurring-templates/test-id/missing-invoices');
    expect(missingInvoicesResponse.status()).toBe(401);

    const backfillResponse = await request.post('http://localhost:3000/api/recurring-templates/test-id/backfill');
    expect(backfillResponse.status()).toBe(401);
  });
});
