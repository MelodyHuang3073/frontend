import { test, expect } from '@playwright/test';
import { loginAs } from './test-utils';

test('teacher approves a student leave and student sees approved status', async ({ browser, page }) => {
  const teacherEmail = process.env.E2E_TEACHER_EMAIL || 'melodyhuang114423030@g.ncu.edu.tw';
  const studentEmail = process.env.E2E_STUDENT_EMAIL || 'y920531@gmail.com';
  const password = process.env.E2E_PASSWORD || 'Aa12345678';

  // Teacher logs in and opens leave list
  await loginAs(page, teacherEmail, password);
  // App shows leave list after clicking this button
  await page.getByRole('button', { name: '查看請假紀錄' }).click();
  await page.getByRole('heading', { name: '請假紀錄' }).waitFor({ timeout: 10000 });

 
  // Wait for the table to be present and populated (not only the '尚無請假紀錄' placeholder).
  await page.getByRole('table').waitFor({ timeout: 10000 });

  // Wait until the table has at least one non-placeholder row.
  await page.waitForFunction(() => {
    const table = document.querySelector('table');
    if (!table) return false;
    // prefer tbody if present
    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) return false;
    // If the only row text is '尚無請假紀錄', keep waiting
    return !rows.every(r => /尚無請假紀錄/.test((r.textContent || '').trim()));
  }, { timeout: 10000 });

  // Find a candidate row: prefer email, then student name, then keywords like leave type
  let targetRow = page.locator('tr', { hasText: studentEmail }).first();
  if ((await targetRow.count()) === 0) {
    targetRow = page.locator('tr', { hasText: 'Melody' }).first();
  }
  if ((await targetRow.count()) === 0) {
    targetRow = page.locator('tr', { hasText: '病假' }).first();
  }

  // Fail fast with a helpful screenshot if we still can't find the row
  if ((await targetRow.count()) === 0) {
    await page.screenshot({ path: 'test-results/teacher-find-row-failure.png', fullPage: true });
    throw new Error('Could not find a leave row for the target student — seeder/emulator may not have created data.');
  }

  // Some flows open a details panel first — click the row's icon button (no visible text) to view details, then close.
  const detailsBtn = targetRow.getByRole('button').filter({ hasText: /^$/ }).first();
  if ((await detailsBtn.count()) > 0) {
    await detailsBtn.click();
    // If a detail modal opens, close it before approving (this matches the recording flow)
    const closeBtn = page.getByRole('button', { name: '關閉' });
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
    }
  }

  // Now attempt to approve: prefer an inline approve button in the row, otherwise click modal approve.
  const approveBtn = targetRow.getByRole('button', { name: '核准' });
  if ((await approveBtn.count()) > 0) {
    await approveBtn.click();
  } else {
    const modalApprove = page.getByRole('button', { name: '核准' });
    await modalApprove.click();
  }

  // Wait for status update in the row
  await expect(targetRow).toContainText('已核准', { timeout: 10000 });

  // Verify with a fresh student session (new page)
  const studentPage = await browser.newPage();
  await loginAs(studentPage, studentEmail, password);
  // Student also needs to click the leave-list button to see their records
  await studentPage.getByRole('button', { name: '查看請假紀錄' }).click();
  await studentPage.getByRole('heading', { name: '請假紀錄' }).waitFor({ timeout: 10000 });

  // Verify the student sees '已核准' in their own row after clicking 查看請假紀錄.
  await studentPage.getByRole('table').waitFor({ timeout: 10000 });

  // Prefer locating by display name (Melody) because the table shows name/course/time, not email.
  // Fallbacks: more specific regex (leave-type + course + name), then email as a last resort.
  let studentRow = studentPage.locator('tr', { hasText: 'Melody' }).first();
  if ((await studentRow.count()) === 0) {
    studentRow = studentPage.locator('tr', { hasText: /病假.*軟體工程.*Melody/ }).first();
  }
  if ((await studentRow.count()) === 0) {
    studentRow = studentPage.locator('tr', { hasText: studentEmail }).first();
  }

  if ((await studentRow.count()) === 0) {
    await studentPage.screenshot({ path: 'test-results/student-find-row-failure.png', fullPage: true });
    throw new Error('Student row not found by email nor display name; inspect screenshot test-results/student-find-row-failure.png');
  }

  const approvedInRow = studentRow.getByText('已核准').first();
  await expect(approvedInRow).toBeVisible({ timeout: 10000 });
});
