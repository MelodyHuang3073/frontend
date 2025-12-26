import { test, expect } from '@playwright/test';
import { loginAs } from '../test-utils';

test.describe('Leave Application Flow', () => {
  const studentEmail = 'y920531@gmail.com';
  const studentPassword = 'Aa12345678';
  const teacherEmail = 'm101450924@gmail.com';
  const teacherPassword = 'Aa12345678';

  test('Student applies for leave and Teacher approves it', async ({ page }) => {
    // --- 1. Student Applies for Leave ---
    await loginAs(page, studentEmail, studentPassword);
    
    // Navigate to Leave Application
    await page.getByRole('button', { name: '請假申請' }).click();
    await expect(page).toHaveURL(/.*\/leave-application/);

    // Fill out the form
    await page.getByLabel('請假類型').click();
    await page.getByRole('option', { name: '病假' }).click();
    
    await page.getByLabel('開始日期').fill('2025-12-27');
    await page.getByLabel('結束日期').fill('2025-12-27');
    
    await page.getByLabel('請假原因').fill('E2E Test: Feeling unwell');
    
    // Select a course (assuming courses are loaded)
    // Note: This might need adjustment based on your actual UI for course selection
    // await page.getByLabel('課程').click();
    // await page.getByRole('option').first().click();

    // Submit
    await page.getByRole('button', { name: '送出申請' }).click();

    // Verify success message or redirection
    await expect(page.getByText('申請成功')).toBeVisible();
    
    // Logout
    await page.getByRole('button', { name: '登出' }).click();

    // --- 2. Teacher Approves Leave ---
    await loginAs(page, teacherEmail, teacherPassword);

    // Navigate to Leave Approval
    await page.getByRole('button', { name: '請假審核' }).click();
    await expect(page).toHaveURL(/.*\/leave-approval/);

    // Find the leave request (simplified selector)
    const leaveRow = page.getByRole('row', { name: 'E2E Test: Feeling unwell' });
    await expect(leaveRow).toBeVisible();

    // Click Approve
    await leaveRow.getByRole('button', { name: '核准' }).click();

    // Confirm dialog if any
    // await page.getByRole('button', { name: '確認' }).click();

    // Verify status change
    await expect(page.getByText('已核准')).toBeVisible();
  });
});
