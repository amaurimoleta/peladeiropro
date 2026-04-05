import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  // Test with authenticated session
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('amauri.moleta@gmail.com')
    await page.getByLabel(/senha/i).fill('123456')
    await page.getByRole('button', { name: /entrar/i }).click()
    await page.waitForURL(/\/dashboard/)
  })

  test('should show group list after login', async ({ page }) => {
    await expect(page.getByText(/futebol/i)).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to group dashboard', async ({ page }) => {
    await page.getByText(/futebol/i).first().click()
    await page.waitForURL(/\/dashboard\/.*/)
    await expect(page.getByText(/resumo/i)).toBeVisible({ timeout: 10000 })
  })
})
