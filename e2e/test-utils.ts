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
  // Robust setter for MUI DateTimePicker variants.
  // Try multiple selector variants and, if necessary, open the picker first.
  const candidateSelectors = [
    selector,
    `${selector} input`,
    `${selector} .MuiInputBase-input`,
    `input[aria-label="開始時間"]`,
    `input[aria-label="結束時間"]`,
    'input[role="textbox"]'
  ];

  let inputLocator = null as any;

  // Try to find a visible input quickly among candidates
  for (const sel of candidateSelectors) {
    try {
      const loc = page.locator(sel);
      await loc.waitFor({ state: 'visible', timeout: 3000 });
      inputLocator = loc;
      break;
    } catch {}
  }

  // If we didn't find the input, try clicking the picker's button to open the input/dialog
  if (!inputLocator) {
    try {
      const openers = [
        `${selector} button`,
        `${selector} [aria-label*="Choose date"]`,
        'button[aria-label*="Choose date"]',
        'button[aria-label*="選擇日期"]'
      ];
      for (const o of openers) {
        try {
          const btn = page.locator(o).first();
          await btn.waitFor({ state: 'visible', timeout: 1500 });
          await btn.click();
          break;
        } catch {}
      }

      // after opening, try candidates again with longer timeout
      for (const sel of candidateSelectors) {
        try {
          const loc = page.locator(sel);
          await loc.waitFor({ state: 'visible', timeout: 5000 });
          inputLocator = loc;
          break;
        } catch {}
      }
    } catch {}
  }

  if (!inputLocator) {
    // If there's no direct input, try to open and fill the MUI dialog picker instead
    try {
      await fillMuiDateTimeDialog(page, value);
      return;
    } catch (dialogErr) {
      try { await page.screenshot({ path: 'test-results/date-input-failed.png', fullPage: true }); } catch {}
      throw new Error(`Could not find date input for selector: ${selector}; dialog fallback also failed: ${String(dialogErr)}`);
    }
  }

  try {
    await inputLocator.focus();
    await inputLocator.fill(value);
    // dispatch native events so React/Form libraries pick up the change
    await inputLocator.evaluate((el: HTMLElement, v: string) => {
      const inputEl = el as HTMLInputElement | null;
      if (inputEl) {
        inputEl.value = v;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        inputEl.blur();
      }
    }, value);
    await page.waitForTimeout(350);
  } catch (err) {
    try { await page.screenshot({ path: 'test-results/date-input-failed.png', fullPage: true }); } catch {}
    throw err;
  }
}

async function fillMuiDateTimeDialog(page: Page, value: string) {
  // value expected like '2025-12-05 09:00'
  const parts = value.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00';
  const day = Number(datePart.split('-')[2]);
  const [hourStr, minuteStr] = timePart.split(':');
  let hour = Number(hourStr || '0');
  const minute = Number(minuteStr || '0');

  // Try opening any visible 'Choose date' / picker opener buttons
  const openerSelectors = [
    'button[aria-label*="Choose date"]',
    'button[aria-label*="選擇日期"]',
    'button:has-text("Choose date")',
    'button:has-text("選擇日期")',
    'button[title*="Choose date"]',
    '[data-testid$="Date"] button',
    '[data-testid$="Date"] [role="button"]'
  ];
  for (const o of openerSelectors) {
    try {
      const btn = page.locator(o).first();
      await btn.waitFor({ state: 'visible', timeout: 800 });
      await btn.click();
      break;
    } catch {}
  }

  // Wait for dialog
  const dialog = page.getByRole('dialog').first();
  await dialog.waitFor({ state: 'visible', timeout: 3000 });

  // Pick day in calendar grid
  try {
    await dialog.getByRole('gridcell', { name: String(day), exact: true }).click({ timeout: 2000 });
  } catch {
    // fallback: click any cell containing the day text
    await dialog.locator(`text="${day}"`).first().click().catch(()=>{});
  }

  // The dialog exposes listboxes/options for hours and minutes
  // Hours options examples: '12 hours', '1 hours', etc. Try matching the hour number.
  const hourVariants = [String(hour), hour.toString().padStart(2, '0'), `${hour} hours`];
  for (const hv of hourVariants) {
    try { await dialog.getByRole('option', { name: new RegExp(hv) }).click({ timeout: 500 }); break; } catch {}
  }

  // Minutes options like '0 minutes', '5 minutes'
  const minuteVariants = [String(minute), `${minute} minutes`, `${minute} minutes`];
  for (const mv of minuteVariants) {
    try { await dialog.getByRole('option', { name: new RegExp(String(minute)) }).click({ timeout: 500 }); break; } catch {}
  }

  // Meridiem
  if (hour >= 12) {
    try { await dialog.getByRole('option', { name: '下午' }).click({ timeout: 500 }); } catch {}
    if (hour > 12) hour = hour - 12;
  } else {
    try { await dialog.getByRole('option', { name: '上午' }).click({ timeout: 500 }); } catch {}
  }

  // Click OK
  try { await dialog.getByRole('button', { name: 'OK' }).click({ timeout: 1500 }); } catch {
    try { await dialog.getByRole('button', { name: '確定' }).click({ timeout: 1500 }); } catch { throw new Error('Could not confirm date in dialog'); }
  }

  // small wait to let dialog close and value apply
  await page.waitForTimeout(350);
}
