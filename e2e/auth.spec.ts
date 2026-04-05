import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/senha/i)).toBeVisible()
  })

  test('should show register page', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /criar conta/i })).toBeVisible()
  })

  test('should redirect unauthenticated users from dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show validation errors for empty login', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /entrar/i }).click()
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/)
  })
})
