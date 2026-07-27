import { test, expect } from '@playwright/test'

test('KaTeX formulas render without parse errors on every page that uses them', async ({ page }) => {
  // Regression test: this project's bundler (Vite 8 / rolldown) was found to corrupt KaTeX's
  // tokenizer when it processes the module normally -- any multi-letter LaTeX command
  // (\bmod, \alpha, \text, ...) rendered as a red error glyph followed by leftover plain
  // text, in both dev and the production build. Fixed by loading KaTeX as an unbundled
  // global script (index.html) instead of importing it through the bundler (vite.config.ts's
  // `katex` alias). KaTeX renders parse errors as inline text colored #cc0000 rather than
  // throwing, so a failure here wouldn't show up as a console error or a thrown exception --
  // this check has to look at the rendered output itself.
  for (const path of ['/rsa', '/quantum-fundamentals', '/qft']) {
    await page.goto(path)
    await expect(page.locator('.katex').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[style*="cc0000"]')).toHaveCount(0)
  }
})

test('guide page explains site navigation and is reachable from the palette and nav', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('/')
  await page.keyboard.type('how to use')
  await expect(page.getByRole('dialog', { name: 'Command palette' }).getByText('How to Use This Site')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('heading', { name: 'How to Use This Site' })).toBeVisible()
  await expect(page.getByText('Factor n = 3233')).toBeVisible()
})

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Shor's Algorithm vs RSA" })).toBeVisible()
  await expect(page.getByText('Educational demonstration only')).toBeVisible()
})

test('user generates an RSA key, encrypts, and decrypts a message', async ({ page }) => {
  await page.goto('/rsa')
  await page.getByRole('button', { name: 'Generate keypair' }).click()
  await expect(page.getByText('N = p·q')).toBeVisible()
  await expect(page.getByText('p', { exact: true })).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Encrypt' }).click()
  await expect(page.getByText('Ciphertext blocks')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Decrypt' }).click()
  await expect(page.getByText('Recovered plaintext:')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('matches the original message')).toBeVisible()
})

test('user runs a classical attack', async ({ page }) => {
  await page.goto('/classical-attacks')
  await page.getByRole('button', { name: 'Run all four attacks' }).click()
  await expect(page.getByText(/Results for n =/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('cell', { name: "Fermat's method" })).toBeVisible()
})

test('user runs a supported Shor demonstration', async ({ page }) => {
  await page.goto('/shor')
  await expect(page.getByRole('button', { name: "Run Shor's algorithm" })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: "Run Shor's algorithm" }).click()
  await expect(page.getByText('Attempt log')).toBeVisible({ timeout: 20_000 })
})

test('charts render on the classical benchmark page', async ({ page }) => {
  await page.goto('/classical-benchmark')
  await expect(page.locator('.recharts-responsive-container')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.recharts-line')).toHaveCount(2)
})

test('invalid RSA input produces a readable error, not a crash', async ({ page }) => {
  await page.goto('/rsa')
  const bitsInput = page.getByLabel('Modulus size (bits)')
  await bitsInput.fill('99999')
  await bitsInput.dispatchEvent('input') // React controlled input: fill() alone can miss the change event on <input type=number>
  await page.getByRole('button', { name: 'Generate keypair' }).click()
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
})

test('mobile navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle navigation menu' }).click()
  const navDrawer = page.locator('#nav-drawer')
  await navDrawer.getByRole('link', { name: 'RSA Laboratory' }).click()
  await expect(page).toHaveURL(/\/rsa$/)
  await expect(page.getByRole('heading', { name: 'RSA Laboratory' })).toBeVisible()
})

test('command palette opens with "/", filters, and navigates with Enter', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('/')
  const dialog = page.getByRole('dialog', { name: 'Command palette' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('RSA Laboratory')).toBeVisible()

  await page.keyboard.type('shor')
  await expect(dialog.getByText('Shor\'s Algorithm Lab')).toBeVisible()
  await expect(dialog.getByText('RSA Laboratory')).not.toBeVisible()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/shor$/)
  await expect(dialog).not.toBeVisible()
})

test('command palette offers a "factor n" quick action for a typed number and runs it', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('/')
  await page.keyboard.type('3233')
  const dialog = page.getByRole('dialog', { name: 'Command palette' })
  await expect(dialog.getByText('Factor n = 3233')).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/classical-attacks\?n=3233$/)
  await expect(page.getByText('Results for n = 3233')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('cell', { name: '53 × 61' }).first()).toBeVisible()
})

test('command palette closes on Escape without navigating', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('/')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).not.toBeVisible()
  await expect(page).toHaveURL('http://localhost:5173/')
})

test('documentation page renders markdown from the repository', async ({ page }) => {
  await page.goto('/security')
  await expect(page.getByRole('heading', { name: 'Security', exact: true })).toBeVisible({ timeout: 10_000 })
})

test('user runs the malleability and block-substitution attacks', async ({ page }) => {
  await page.goto('/malleability-lab')
  await page.getByRole('button', { name: 'Generate keypair' }).click()
  await expect(page.getByText(/^N=/)).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Run attack' }).click()
  await expect(page.getByText(/exactly as predicted/)).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Splice forged block' }).click()
  await expect(page.getByText('Decrypted after splicing (no error raised)')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Corrupt last block & decrypt' }).click()
  await expect(page.getByText(/Rejected cleanly|happened to still look like valid padding/)).toBeVisible({
    timeout: 10_000,
  })
})

test('security dashboard shows live headers and trips the rate limiter', async ({ page }) => {
  await page.goto('/security-dashboard')
  await expect(page.getByText('Content-Security-Policy')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('X-Frame-Options').first()).toBeVisible()

  await page.getByRole('button', { name: 'Fire 8 requests' }).click()
  await expect(page.getByText(/request 8:/)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/429 blocked/).first()).toBeVisible()
})
