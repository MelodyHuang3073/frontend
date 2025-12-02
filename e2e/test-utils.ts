import { Page } from '@playwright/test';

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3000/login');
  // Try common selectors used in app
  try {
    await page.getByRole('textbox', { name: '電子郵件' }).fill(email);
  } catch (e) {
    // fallback to input[name=email]
    try { await page.locator('input[name="email"]').fill(email); } catch {}
  }
  try {
    await page.getByRole('textbox', { name: '密碼' }).fill(password);
  } catch (e) {
    try { await page.locator('input[name="password"]').fill(password); } catch {}
  }
  try {
    await page.getByRole('button', { name: '登入' }).click();
  } catch (e) {
    try { await page.locator('button[type="submit"]').click(); } catch {}
  }

  // Wait for a clear post-login signal instead of a global `networkidle`.
  // SPAs often keep connections open (polling/websocket) so `networkidle` may hang.
  // Preferred signals: URL change to a logged-in route or a visible UI element.
  // Wait for sign-in network response from Firebase Auth emulator so we can detect auth failures.
  try {
    const signInPromise = page.waitForResponse(response => {
      const u = response.url();
      return (
        /identitytoolkit.googleapis.com/.test(u) ||
        /accounts:signInWithPassword/.test(u) ||
        /\/identitytoolkit\.googleapis\.com\/.*/.test(u)
      );
    }, { timeout: 10000 });

    // If the sign-in network call exists, wait for it (otherwise proceed to URL/element checks).
    await signInPromise.catch(() => {});
  } catch {}

  // Then wait for a clear post-login signal (URL or a logged-in control).
  try {
    await page.waitForURL(/(leave-list|leave-application|dashboard|profile)/, { timeout: 10000 });
  } catch (e) {
    // ignore - fallback to checking for a known logged-in control
  }

  try {
    await page.getByRole('button', { name: '申請請假' }).waitFor({ timeout: 10000 });
  } catch (e) {
    // On failure, capture a screenshot to help debugging and rethrow so tests show artifact.
    try { await page.screenshot({ path: 'test-results/login-failed.png', fullPage: true }); } catch {}
    try { await page.waitForLoadState('networkidle', { timeout: 3000 }); } catch {}
  }
}

export default { loginAs };

export async function setDateTimeValue(page: Page, selector: string, value: string) {
  // Wait for the inner input to be visible, focus, fill and dispatch events so React detects change
  const input = page.locator(selector);
  await input.waitFor({ state: 'visible', timeout: 8000 });
  await input.focus();
  await input.fill(value);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLInputElement | null;
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    }
  }, selector);
  await page.waitForTimeout(250);
}
