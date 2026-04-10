import { test, expect } from '@playwright/test'

test('app loads and shows Cantor brand name', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Cantor')).toBeVisible()
})

test('all four tabs are visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Live' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Backtest' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Journal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Performance' })).toBeVisible()
})
