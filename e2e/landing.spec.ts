import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should load landing page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/PeladeiroPro/)
  })

  test('should show hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Agora o seu grupo também pode ser uma SAF')).toBeVisible()
  })

  test('should have navigation links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /entrar/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /criar conta/i })).toBeVisible()
  })

  test('should show features section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Controle de Mensalidades')).toBeVisible()
  })

  test('should show FAQ section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Perguntas frequentes')).toBeVisible()
  })

  test('should navigate to register', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /criar conta/i }).first().click()
    await expect(page).toHaveURL(/\/register/)
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.getByText('Agora o seu grupo também pode ser uma SAF')).toBeVisible()
  })
})
