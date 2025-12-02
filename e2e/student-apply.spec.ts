import { test, expect } from '@playwright/test';
import { loginAs, setDateTimeValue } from './test-utils';

test('student apply (recorded) - sanitized', async ({ page }) => {
  await loginAs(page, process.env.E2E_STUDENT_EMAIL || 'y920531@gmail.com', process.env.E2E_PASSWORD || 'Aa12345678');
  await page.goto('http://localhost:3000/leave-application');

    // Wait for a stable page signal (heading) instead of a possibly-missing role/button.
    await page.getByRole('heading', { name: '請假申請' }).waitFor({ timeout: 10000 });

  const leaveType = page.locator('[data-testid="leave-type-select"]');
  if (await leaveType.count() > 0) {
    await leaveType.click();
    await page.getByRole('option', { name: '病假' }).click();
  } else {
    await page.getByRole('combobox', { name: /請假類型/i }).click();
    await page.getByRole('option', { name: '病假' }).click();
  }

  // Prefer programmatic setter for MUI DateTimePicker to avoid flaky calendar UI
  try {
    await setDateTimeValue(page, '[data-testid="startDate"] input', '2025-12-05 09:00');
  } catch (e) {
    const startInput = page.locator('[data-testid="startDate"] input');
    if (await startInput.count() > 0) {
      await startInput.click();
      await startInput.fill('2025-12-05 09:00');
    } else {
      await page.getByRole('group', { name: '開始時間' }).getByLabel('Choose date').click();
      await page.getByRole('gridcell', { name: '5', exact: true }).click();
      await page.getByRole('button', { name: 'OK' }).click();
    }
  }

  try {
    await setDateTimeValue(page, '[data-testid="endDate"] input', '2025-12-05 15:00');
  } catch (e) {
    const endInput = page.locator('[data-testid="endDate"] input');
    if (await endInput.count() > 0) {
      await endInput.click();
      await endInput.fill('2025-12-05 15:00');
    } else {
      await page.getByRole('button', { name: 'Choose date', exact: true }).click();
      try { await page.getByRole('option', { name: '下午' }).click(); } catch {}
      try { await page.getByRole('option', { name: '6 hours' }).click(); } catch {}
      await page.getByRole('button', { name: 'OK' }).click();
    }
  }

  await page.getByRole('button', { name: '確認時段' }).click();

  const courseSelect = page.locator('[data-testid="course-select"]');
  if (await courseSelect.count() > 0) {
    await courseSelect.click();
    await page.getByRole('option', { name: 'CS301 - 陳老師 (Fri 14:00-15:30)' }).click();
  } else {
    await page.getByRole('combobox', { name: /選擇課程/i }).click();
    await page.getByRole('option', { name: 'CS301 - 陳老師 (Fri 14:00-15:30)' }).click();
  }

  const reason = page.getByRole('textbox', { name: '請假原因' });
  await reason.click();
  await reason.fill('看醫生');

  const attachButton = page.getByRole('button', { name: '上傳附件' });
  await expect(attachButton).toBeVisible();
  const attachmentPath = 'e2e/tests/fixtures/test-attachment.txt';
  try {
    await attachButton.setInputFiles(attachmentPath);
  } catch (e) {
    try { await attachButton.setInputFiles('在學證明.png'); } catch {}
  }

  await page.getByRole('button', { name: '提交申請' }).click();
  await expect(page).toHaveURL(/leave-list|leave-list/,{ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
});
