---
name: test-credentials
description: Provides test user credentials for mi-gestor project. Use when you need to log in, run tests with authentication, test the login flow, or access the application with test users.
allowed-tools: Read, Bash
---

# Test User Credentials for mi-gestor

## Test User Account

**Email:** test@migestor.com
**Password:** Test123456
**User ID:** 2
**Full Name:** Test User TRADE
**Type:** es_trade = true (TRADE user)

## Usage Examples

### Frontend Login
```javascript
await page.fill('input[name="email"]', 'test@migestor.com');
await page.fill('input[name="password"]', 'Test123456');
await page.click('button[type="submit"]');
```

### API Authentication
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@migestor.com","password":"Test123456"}'
```

### Playwright Tests
```typescript
await page.goto('http://localhost:3001/login');
await page.fill('input[name="email"]', 'test@migestor.com');
await page.fill('input[name="password"]', 'Test123456');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
```

## Pre-generated JWT Token

This token is valid for quick testing (expires after a few days):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0QG1pZ2VzdG9yLmNvbSIsIm5vbWJyZV9jb21wbGV0byI6IlRlc3QgVXNlciBUUkFERSIsImVzX3RyYWRlIjp0cnVlLCJpYXQiOjE3NjgwODQyMTIsImV4cCI6MTc2ODY4OTAxMn0.L6kHrb5A8Azhrex6Av33TR1Af1KoQXrnSFDWOXPWI9g
```

Usage:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0QG1pZ2VzdG9yLmNvbSIsIm5vbWJyZV9jb21wbGV0byI6IlRlc3QgVXNlciBUUkFERSIsImVzX3RyYWRlIjp0cnVlLCJpYXQiOjE3NjgwODQyMTIsImV4cCI6MTc2ODY4OTAxMn0.L6kHrb5A8Azhrex6Av33TR1Af1KoQXrnSFDWOXPWI9g"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/invoices
```

## Application URLs

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Login page: http://localhost:3001/login
- Dashboard: http://localhost:3001/dashboard

## Important Notes

- Use these credentials **only for development and testing**
- This user has full TRADE permissions
- Can create invoices, expenses, clients, and view fiscal models
- Database is pre-seeded with this user
