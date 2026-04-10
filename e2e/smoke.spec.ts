import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'starter-local' })).toBeVisible()
})

test('about page loads', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
})
