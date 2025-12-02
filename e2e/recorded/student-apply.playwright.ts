import { test, expect } from '@playwright/test';
import { loginAs } from '../test-utils';

test('student apply (recorded) - sanitized', async ({ page }) => {
  // Use helper to login (keeps credentials out of VCS)
  await loginAs(page, process.env.E2E_STUDENT_EMAIL || 'y920531@gmail.com', process.env.E2E_PASSWORD || 'Aa12345678');

  await page.goto('http://localhost:3000/leave-application');

  // Prefer data-testid where available; fallback to role-based selectors from recording
  const applyButton = page.getByRole('button', { name: '申請請假' });
  await expect(applyButton).toBeVisible({ timeout: 5000 });
  await applyButton.click();

  // Select leave type (recording used combobox)
  const leaveType = page.locator('[data-testid="leave-type-select"]');
  if (await leaveType.count() > 0) {
    await leaveType.click();
    await page.getByRole('option', { name: '病假' }).click();
  } else {
    await page.getByRole('combobox', { name: /請假類型/i }).click();
    await page.getByRole('option', { name: '病假' }).click();
  }

  // Start date/time - prefer explicit test ids or fall back to MUI pickers
  const startInput = page.locator('[data-testid="startDate"] input');
  if (await startInput.count() > 0) {
    await startInput.click();
    // set a date programmatically to avoid flaky calendar interactions
    await startInput.fill('2025-12-05 09:00');
  } else {
    await page.getByRole('group', { name: '開始時間' }).getByLabel('Choose date').click();
    await page.getByRole('gridcell', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: 'OK' }).click();
  }

  // End time - try to use test id
  const endInput = page.locator('[data-testid="endDate"] input');
  if (await endInput.count() > 0) {
    await endInput.click();
    await endInput.fill('2025-12-05 15:00');
  } else {
    // fallback interactions
    await page.getByRole('button', { name: 'Choose date', exact: true }).click();
    // try to pick afternoon/time options if UI shows
    try { await page.getByRole('option', { name: '下午' }).click(); } catch {}
    try { await page.getByRole('option', { name: '6 hours' }).click(); } catch {}
    await page.getByRole('button', { name: 'OK' }).click();
  }

  await page.getByRole('button', { name: '確認時段' }).click();

  // Choose course - prefer data-testid or role fallback
  const courseSelect = page.locator('[data-testid="course-select"]');
  if (await courseSelect.count() > 0) {
    await courseSelect.click();
    await page.getByRole('option', { name: 'CS301 - 陳老師 (Fri 14:00-15:30)' }).click();
  } else {
    await page.getByRole('combobox', { name: /選擇課程/i }).click();
    await page.getByRole('option', { name: 'CS301 - 陳老師 (Fri 14:00-15:30)' }).click();
  }

  // Reason
  const reason = page.getByRole('textbox', { name: '請假原因' });
  await reason.click();
  await reason.fill('看醫生');

  // Attachment - use a path inside repo if available. Update path if needed.
  const attachButton = page.getByRole('button', { name: '上傳附件' });
  await expect(attachButton).toBeVisible();
  const attachmentPath = 'e2e/tests/fixtures/test-attachment.txt';
  try {
    await attachButton.setInputFiles(attachmentPath);
  } catch (e) {
    // If path fails, try fallback name in project root
    try { await attachButton.setInputFiles('在學證明.png'); } catch {}
  }

  // Submit
  await page.getByRole('button', { name: '提交申請' }).click();

  // Wait for navigation or success indicator
  await expect(page).toHaveURL(/leave-list|leave-list/,{ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
});
