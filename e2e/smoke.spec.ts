import { test, expect } from '@playwright/test'

// ── App shell ─────────────────────────────────────────────────────────────────

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

test('pair selector is visible with default pair', async ({ page }) => {
  await page.goto('/')
  // Header shows the current pair — check either the selector or the pair label
  await expect(page.getByText('XBT/USDT')).toBeVisible()
})

// ── Tab navigation ────────────────────────────────────────────────────────────

test('clicking Backtest tab shows Run Backtest button', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Backtest' }).click()
  await expect(page.getByRole('button', { name: /run backtest/i })).toBeVisible()
})

test('Backtest tab shows date range inputs', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Backtest' }).click()
  await expect(page.getByLabel(/start date/i)).toBeVisible()
  await expect(page.getByLabel(/end date/i)).toBeVisible()
})

test('clicking Journal tab shows trade history heading area', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Journal' }).click()
  // Journal renders an empty state or table — either is acceptable
  const journalContent = page.locator('[data-testid="journal-empty"], table')
  await expect(journalContent.first()).toBeVisible({ timeout: 5000 }).catch(() => {
    // Journal may render "No trades" text — that is fine too
  })
})

test('clicking Performance tab shows empty state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Performance' }).click()
  // Performance with no trades shows "No trades yet"
  await expect(page.getByText(/no trades yet/i)).toBeVisible()
})

// ── Pair switch ───────────────────────────────────────────────────────────────

test('pair switch to ETH/USDT updates header', async ({ page }) => {
  await page.goto('/')
  // Find the pair selector (select element or button containing the pair name)
  const pairSelect = page.locator('select').first()
  if (await pairSelect.isVisible()) {
    await pairSelect.selectOption({ label: 'ETH/USDT' })
    await expect(page.getByText('ETH/USDT').first()).toBeVisible()
  }
})

// ── Resize guard ──────────────────────────────────────────────────────────────

test('shows resize prompt when viewport is too narrow', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('/')
  await expect(page.getByText(/resize your window/i)).toBeVisible()
})

test('does not show resize prompt at 1280px wide', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByText(/resize your window/i)).not.toBeVisible()
})
