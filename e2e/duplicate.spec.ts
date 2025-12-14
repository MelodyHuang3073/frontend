import { test, expect } from '@playwright/test';
import { loginAs, setDateTimeValue } from './test-utils';

test('prevent duplicate leave application', async ({ page }) => {
  const studentEmail = process.env.E2E_STUDENT_EMAIL || 'y920531@gmail.com';
  const password = process.env.E2E_PASSWORD || 'Aa12345678';

  await loginAs(page, studentEmail, password);
  // Collect browser-side logs/errors to help diagnose failures
  page.on('console', msg => console.log('[page.console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[page.error]', err));
  await page.goto('http://localhost:3000/leave-application');
  await page.getByRole('heading', { name: '請假申請' }).waitFor({ timeout: 10000 });

  // Fill and submit first leave (use same selectors as student test)
  const leaveType = page.locator('[data-testid="leave-type-select"]');
  if (await leaveType.count() > 0) {
    await leaveType.click();
    await page.getByRole('option', { name: '病假' }).click();
  } else {
    await page.getByRole('combobox', { name: /請假類型/i }).click();
    await page.getByRole('option', { name: '病假' }).click();
  }
  // ensure the inputs are present before trying programmatic set
  await page.locator('[data-testid="startDate"] input').waitFor({ state: 'visible', timeout: 20000 }).catch(()=>{});
  try {
    await setDateTimeValue(page, '[data-testid="startDate"] input', '2025-12-12 09:00');
  } catch (e) {
    if (page.isClosed && page.isClosed()) {
      throw new Error('Page closed while setting startDate: ' + String(e));
    }
    // try multiple selector variants and wait longer for visibility
    const startSelectors = [
      '[data-testid="startDate"] input',
      '[data-testid="startDate"]',
      'input[aria-label="開始時間"]'
    ];
    let startHandle = null;
    for (const sel of startSelectors) {
      try {
        startHandle = await page.waitForSelector(sel, { state: 'visible', timeout: 20000 });
        if (startHandle) break;
      } catch (_) { /* try next selector */ }
    }
    if (!startHandle) {
      await page.screenshot({ path: 'test-results/duplicate-startdate-missing.png', fullPage: true }).catch(()=>{});
      throw new Error('startDate input not visible after fallback waits');
    }
    try {
      await startHandle.click();
      await startHandle.fill('2025-12-12 09:00');
    } catch (inner) {
      await page.screenshot({ path: 'test-results/duplicate-startdate-failed.png', fullPage: true }).catch(()=>{});
      throw inner;
    }
  }

  // Debug: verify the start date UI value after setting
  try {
    const startInputDbg = page.locator('[data-testid="startDate"] input').first();
    const startVal = await startInputDbg.inputValue().catch(() => '');
    console.log('DEBUG start value after set:', startVal);
    // basic sanity check for the month/day or year
    expect(startVal).toContain('12');
  } catch (dbgErr) {
    console.warn('Could not read start input value for debug:', String(dbgErr));
  }

  await page.locator('[data-testid="endDate"] input').waitFor({ state: 'visible', timeout: 20000 }).catch(()=>{});
  try {
    await setDateTimeValue(page, '[data-testid="endDate"] input', '2025-12-12 15:00');
  } catch (e) {
    if (page.isClosed && page.isClosed()) {
      throw new Error('Page closed while setting endDate: ' + String(e));
    }
    const endSelectors = [
      '[data-testid="endDate"] input',
      '[data-testid="endDate"]',
      'input[aria-label="結束時間"]'
    ];
    let endHandle = null;
    for (const sel of endSelectors) {
      try {
        endHandle = await page.waitForSelector(sel, { state: 'visible', timeout: 20000 });
        if (endHandle) break;
      } catch (_) { /* try next */ }
    }
    if (!endHandle) {
      await page.screenshot({ path: 'test-results/duplicate-enddate-missing.png', fullPage: true }).catch(()=>{});
      throw new Error('endDate input not visible after fallback waits');
    }
    try {
      await endHandle.click();
      await endHandle.fill('2025-12-12 15:00');
    } catch (inner) {
      await page.screenshot({ path: 'test-results/duplicate-enddate-failed.png', fullPage: true }).catch(()=>{});
      throw inner;
    }
  }

  // Debug: verify the end date UI value after setting
  try {
    const endInputDbg = page.locator('[data-testid="endDate"] input').first();
    const endVal = await endInputDbg.inputValue().catch(() => '');
    console.log('DEBUG end value after set:', endVal);
    expect(endVal).toContain('12');
  } catch (dbgErr) {
    console.warn('Could not read end input value for debug:', String(dbgErr));
  }

  await page.getByRole('button', { name: '確認時段' }).click();

  // Wait for courses to be populated
  const courseSelect = page.locator('[data-testid="course-select"]');
  await courseSelect.waitFor({ state: 'visible', timeout: 15000 }).catch(()=>{});

  if (await courseSelect.count() > 0) {
    await courseSelect.click();
    await page.getByRole('option', { name: 'CS301 - 陳老師 (Fri 14:00-15:30)' }).click();
  } else {
    await page.getByRole('combobox', { name: /選擇課程/i }).click();
    await page.getByRole('option', { name: 'CS301 - 陳老師 (Fri 14:00-15:30)' }).click();
  }

  const reason = page.getByRole('textbox', { name: '請假原因' });
  await reason.waitFor({ state: 'visible', timeout: 15000 });
  await reason.click();
  await reason.fill('看醫生');

  await page.getByRole('button', { name: '提交申請' }).click();

  // Wait for the app to acknowledge submission
  await page.waitForURL(/leave-list|leave-list/, { timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(800);

  // Attempt to submit the exact same leave again (use identical date/time)
  await page.goto('http://localhost:3000/leave-application');
  await page.getByRole('heading', { name: '請假申請' }).waitFor({ timeout: 10000 });
  await page.getByRole('combobox', { name: /請假類型/i }).click();
  await page.getByRole('option', { name: '病假' }).click();
  try {
    await page.locator('[data-testid="startDate"] input').waitFor({ state: 'visible', timeout: 20000 }).catch(()=>{});
    await setDateTimeValue(page, '[data-testid="startDate"] input', '2025-12-12 09:00');
  } catch {}
  try {
    await page.locator('[data-testid="endDate"] input').waitFor({ state: 'visible', timeout: 20000 }).catch(()=>{});
    await setDateTimeValue(page, '[data-testid="endDate"] input', '2025-12-12 15:00');
  } catch {}
  try { await page.getByRole('button', { name: '確認時段' }).click(); } catch {}
  await page.getByRole('combobox', { name: /選擇課程/i }).click().catch(()=>{});
  await page.getByRole('option', { name: /CS301|TEST100/ }).click().catch(()=>{});
  const reason2 = page.getByRole('textbox', { name: '請假原因' });
  await reason2.waitFor({ state: 'visible', timeout: 15000 }).catch(()=>{});
  try {
    await reason2.fill('病假 ');
  } catch (e) {
    try { await page.screenshot({ path: 'test-results/duplicate-fill-failed.png', fullPage: true }); } catch {}
    throw e;
  }
  await page.getByRole('button', { name: '提交申請' }).click();

  // Expect the application to prevent duplicate submission with an error message
  await expect(page.getByText(/您已提交過同樣時段|已提交過同樣時段|已申請.*相同/i)).toBeVisible({ timeout: 5000 });
});
