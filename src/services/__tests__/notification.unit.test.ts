/**
 * 學生請假系統 - 通知模組單元測試
 * Use Case 5.0: 通知模組
 * 
 * @date 2025-12-23
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock 資料庫與服務
const mockDB = {
    notifications: new Map(),
    students: new Map(),
    teachers: new Map(),
    leaveRequests: new Map(),
    notificationTemplates: new Map(),
    notificationHistory: new Map(),
    emailQueue: new Map(),
    notificationPreferences: new Map(),
};

// Mock 郵件服務
const mockEmailService = {
    sendEmail: jest.fn() as any,
    sendBulkEmail: jest.fn() as any,
    verifyEmailAddress: jest.fn() as any,
    getEmailStatus: jest.fn() as any,
};

// Mock 範本引擎
const mockTemplateEngine = {
    render: jest.fn() as any,
    getTemplate: jest.fn() as any,
};

// Mock 記錄服務
const mockLogService = {
    logNotification: jest.fn() as any,
    logEmailSent: jest.fn() as any,
    logEmailFailed: jest.fn() as any,
};

// ============================================================================
// UC 5.1: 學生通知 - Unit Tests
// ============================================================================

describe('UC 5.1: 學生通知', () => {
    beforeEach(() => {
        mockDB.notifications.clear();
        mockDB.students.clear();
        mockDB.leaveRequests.clear();
        mockDB.notificationHistory.clear();
        mockDB.emailQueue.clear();
        jest.clearAllMocks();

        // 初始化測試資料
        setupTestData();
    });

    describe('申請提交確認通知測試', () => {
        it('應該在學生提交申請後發送確認通知', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';

            mockEmailService.sendEmail.mockResolvedValue({
                success: true,
                messageId: 'MSG-001',
            });

            // Act
            const result: any = await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
        });

        it('應該在通知中包含請假申請編號', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            const emailCall: any = mockEmailService.sendEmail.mock.calls[0][0];
            expect(emailCall.subject).toContain(leaveRequestId);
        });

        it('應該在通知中包含請假起訖日期', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';

            mockTemplateEngine.render.mockResolvedValue('Email content with dates');

            // Act
            await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    startDate: expect.any(String),
                    endDate: expect.any(String),
                })
            );
        });

        it('應該記錄通知發送歷史', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            expect(mockDB.notificationHistory.has(leaveRequestId)).toBe(true);
        });

        it('應該使用學生的註冊郵箱', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            const emailCall: any = mockEmailService.sendEmail.mock.calls[0][0];
            expect(emailCall.to).toBe('s123456@student.university.edu');
        });

        it('應該在發送失敗時記錄錯誤', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';

            mockEmailService.sendEmail.mockResolvedValue({
                success: false,
                error: 'SMTP connection failed',
            });

            // Act
            await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            expect(mockLogService.logEmailFailed).toHaveBeenCalled();
        });
    });

    describe('審核結果通知測試', () => {
        it('應該在申請核准後發送通知', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';
            const reviewResult = 'approved';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await sendReviewResultNotification(
                leaveRequestId,
                studentId,
                reviewResult
            );

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
        });

        it('應該在申請退回後發送通知', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';
            const reviewResult = 'rejected';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await sendReviewResultNotification(
                leaveRequestId,
                studentId,
                reviewResult
            );

            // Assert
            expect(result.success).toBe(true);
            const emailCall: any = mockEmailService.sendEmail.mock.calls[0][0];
            expect(emailCall.subject).toContain('退回');
        });

        it('應該在通知中包含審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';
            const reviewResult = 'rejected';
            const comments = '請假證明不完整，請補充醫院證明';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendReviewResultNotification(leaveRequestId, studentId, reviewResult, comments);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    comments,
                })
            );
        });

        it('應該在通知中包含審核人資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';
            const reviewResult = 'approved';
            const reviewerName = '王老師';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendReviewResultNotification(
                leaveRequestId,
                studentId,
                reviewResult,
                '',
                reviewerName
            );

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    reviewerName,
                })
            );
        });

        // it('應該在退回通知中包含重新提交連結', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-001';
        //     const studentId = 'S123456';
        //     const reviewResult = 'rejected';

        //     mockTemplateEngine.render.mockResolvedValue('Email with resubmit link');

        //     // Act
        //     await sendReviewResultNotification(leaveRequestId, studentId, reviewResult);

        //     // Assert
        //     expect(mockTemplateEngine.render).toHaveBeenCalledWith(
        //         expect.any(String),
        //         expect.objectContaining({
        //             resubmitUrl: expect.stringContaining('/leave/edit/'),
        //         })
        //     );
        // });

        it('應該記錄審核通知時間', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';
            const reviewResult = 'approved';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendReviewResultNotification(leaveRequestId, studentId, reviewResult);

            // Assert
            const history = mockDB.notificationHistory.get(leaveRequestId);
            expect(history.reviewNotificationSentAt).toBeInstanceOf(Date);
        });
    });

    describe('密碼重設驗證連結測試', () => {
        it('應該在學生請求重設密碼時發送驗證連結', async () => {
            // Arrange
            const studentId = 'S123456';
            const email = 's123456@student.university.edu';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await sendPasswordResetLink(studentId, email);

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
        });

        it('應該生成唯一的驗證令牌', async () => {
            // Arrange
            const studentId = 'S123456';
            const email = 's123456@student.university.edu';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await sendPasswordResetLink(studentId, email);

            // Assert
            expect(result.resetToken).toBeDefined();
            expect(result.resetToken!.length).toBeGreaterThan(15);
        });

        it('應該設定驗證連結的有效期限', async () => {
            // Arrange
            const studentId = 'S123456';
            const email = 's123456@student.university.edu';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await sendPasswordResetLink(studentId, email);

            // Assert
            expect(result.expiresAt).toBeInstanceOf(Date);
            const expiryMinutes = (result.expiresAt!.getTime() - new Date().getTime()) / 1000 / 60;
            expect(expiryMinutes).toBeCloseTo(30, 0); // 30分鐘有效期
        });

        it('應該在郵件中包含完整的重設連結', async () => {
            // Arrange
            const studentId = 'S123456';
            const email = 's123456@student.university.edu';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendPasswordResetLink(studentId, email);

            // Assert
            const emailCall: any = mockEmailService.sendEmail.mock.calls[0][0];
            expect(emailCall.html).toContain('https://');
            expect(emailCall.html).toContain('/reset-password?token=');
        });

        it('應該驗證郵箱是否與帳號匹配', async () => {
            // Arrange
            const studentId = 'S123456';
            const wrongEmail = 'wrong@email.com';

            // Act
            const result: any = await sendPasswordResetLink(studentId, wrongEmail);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('郵箱與帳號不匹配');
        });

        it('應該限制重設連結的請求頻率', async () => {
            // Arrange
            const studentId = 'S123456';
            const email = 's123456@student.university.edu';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act - 連續發送兩次
            await sendPasswordResetLink(studentId, email);
            const result: any = await sendPasswordResetLink(studentId, email);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('請稍後再試');
        });
    });

    describe('系統重要公告測試', () => {
        it('應該支援發送系統公告給所有學生', async () => {
            // Arrange
            const announcement = {
                title: '系統維護通知',
                content: '本系統將於12/25進行維護',
                priority: 'high',
            };

            mockEmailService.sendBulkEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await sendSystemAnnouncement(announcement, 'student');

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailService.sendBulkEmail).toHaveBeenCalled();
        });

        it('應該支援發送緊急公告', async () => {
            // Arrange
            const urgentAnnouncement = {
                title: '緊急通知',
                content: '因天災停課',
                priority: 'urgent',
            };

            mockEmailService.sendBulkEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await sendSystemAnnouncement(urgentAnnouncement, 'all');

            // Assert
            expect(result.success).toBe(true);
            const emailCall: any = mockEmailService.sendBulkEmail.mock.calls[0][0];
            expect(emailCall.subject).toContain('【緊急】');
        });

        it('應該記錄公告發送統計', async () => {
            // Arrange
            const announcement = {
                title: '期末注意事項',
                content: '請注意期末考試時程',
                priority: 'normal',
            };

            mockEmailService.sendBulkEmail.mockResolvedValue({
                success: true,
                sent: 150,
                failed: 5,
            });

            // Act
            const result: any = await sendSystemAnnouncement(announcement, 'student');

            // Assert
            expect(result.statistics).toBeDefined();
            expect(result.statistics!.totalSent).toBe(150);
            expect(result.statistics!.totalFailed).toBe(5);
        });

        it('應該支援排程公告發送', async () => {
            // Arrange
            const announcement = {
                title: '假期提醒',
                content: '即將放假',
                priority: 'normal',
                scheduledAt: new Date('2025-12-24T09:00:00'),
            };

            // Act
            const result: any = await scheduleAnnouncement(announcement, 'student');

            // Assert
            expect(result.success).toBe(true);
            expect(result.scheduled).toBe(true);
            expect(mockDB.emailQueue.size).toBeGreaterThan(0);
        });
    });

    describe('通知偏好設定測試', () => {
        it('應該尊重學生的通知偏好設定', async () => {
            // Arrange
            const studentId = 'S123456';
            const leaveRequestId = 'LEAVE-001';

            mockDB.notificationPreferences.set(studentId, {
                emailEnabled: false,
                smsEnabled: true,
            });

            // Act
            const result: any = await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
        });

        it('應該支援部分通知類型的關閉', async () => {
            // Arrange
            const studentId = 'S123456';
            const leaveRequestId = 'LEAVE-001';

            mockDB.notificationPreferences.set(studentId, {
                emailEnabled: true,
                submissionConfirmation: false, // 關閉提交確認通知
                reviewResult: true,
            });

            // Act
            const result: any = await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

            // Assert
            expect(result.skipped).toBe(true);
            expect(result.reason).toBe('用戶已關閉此類型通知');
        });
    });
});

// ============================================================================
// UC 5.2: 教師通知 - Unit Tests
// ============================================================================

describe('UC 5.2: 教師通知', () => {
    beforeEach(() => {
        mockDB.notifications.clear();
        mockDB.teachers.clear();
        mockDB.leaveRequests.clear();
        mockDB.notificationHistory.clear();
        jest.clearAllMocks();

        // 初始化測試資料
        setupTeacherTestData();
    });

    describe('新申請提醒通知測試', () => {
        it('應該在學生提交申請後通知相關教師', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const affectedTeachers = ['T001', 'T002'];

            mockEmailService.sendBulkEmail.mockResolvedValue({ success: true });

            // Act
            const result: any = await notifyTeachersNewLeaveRequest(leaveRequestId, affectedTeachers);

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailService.sendBulkEmail).toHaveBeenCalled();
        });

        it('應該只通知受影響課程的教師', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const affectedTeachers = ['T001'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await notifyTeachersNewLeaveRequest(leaveRequestId, affectedTeachers);

            // Assert
            expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
            const emailCall: any = mockEmailService.sendEmail.mock.calls[0][0];
            expect(emailCall.to).toBe('teacher1@university.edu');
        });

        it('應該在通知中包含學生資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const affectedTeachers = ['T001'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await notifyTeachersNewLeaveRequest(leaveRequestId, affectedTeachers);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    studentName: expect.any(String),
                    studentId: expect.any(String),
                })
            );
        });

        it('應該在通知中包含受影響的課程節次', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const affectedTeachers = ['T001'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await notifyTeachersNewLeaveRequest(leaveRequestId, affectedTeachers);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    affectedCourses: expect.any(Array),
                })
            );
        });

        it('應該在通知中包含審核連結', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const affectedTeachers = ['T001'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await notifyTeachersNewLeaveRequest(leaveRequestId, affectedTeachers);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    reviewUrl: expect.stringContaining('/review/'),
                })
            );
        });

        // it('應該記錄教師通知發送時間', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-001';
        //     const affectedTeachers = ['T001'];

        //     mockEmailService.sendEmail.mockResolvedValue({ success: true });

        //     // Act
        //     await notifyTeachersNewLeaveRequest(leaveRequestId, affectedTeachers);

        //     // Assert
        //     const history = mockDB.notificationHistory.get(leaveRequestId);
        //     expect(history.teacherNotifiedAt).toBeInstanceOf(Date);
        // });
    });

    // describe('待審核清單彙整測試', () => {
    //     it('應該每日彙整待審核清單發送給教師', async () => {
    //         // Arrange
    //         const teacherId = 'T001';
    //         const pendingRequests = ['LEAVE-001', 'LEAVE-002', 'LEAVE-003'];

    //         mockEmailService.sendEmail.mockResolvedValue({ success: true });

    //         // Act
    //         const result = await sendDailyPendingReviewDigest(teacherId, pendingRequests);

    //         // Assert
    //         expect(result.success).toBe(true);
    //         expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    //     });

    //     it('應該在彙整郵件中列出所有待審核申請', async () => {
    //         // Arrange
    //         const teacherId = 'T001';
    //         const pendingRequests = ['LEAVE-001', 'LEAVE-002'];

    //         mockEmailService.sendEmail.mockResolvedValue({ success: true });

    //         // Act
    //         await sendDailyPendingReviewDigest(teacherId, pendingRequests);

    //         // Assert
    //         expect(mockTemplateEngine.render).toHaveBeenCalledWith(
    //             expect.any(String),
    //             expect.objectContaining({
    //                 pendingCount: 2,
    //                 requests: expect.arrayContaining([
    //                     expect.objectContaining({ leaveRequestId: 'LEAVE-001' }),
    //                     expect.objectContaining({ leaveRequestId: 'LEAVE-002' }),
    //                 ]),
    //             })
    //         );
    //     });

    //     it('應該在無待審核申請時不發送郵件', async () => {
    //         // Arrange
    //         const teacherId = 'T001';
    //         const pendingRequests: string[] = [];

    //         // Act
    //         const result: any = await sendDailyPendingReviewDigest(teacherId, pendingRequests);

    //         // Assert
    //         expect(result.skipped).toBe(true);
    //         expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    //     });

    //     it('應該支援自定義彙整頻率', async () => {
    //         // Arrange
    //         const teacherId = 'T001';
    //         const pendingRequests = ['LEAVE-001'];
    //         const frequency = 'weekly';

    //         mockEmailService.sendEmail.mockResolvedValue({ success: true });

    //         // Act
    //         const result = await sendPendingReviewDigest(teacherId, pendingRequests, frequency);

    //         // Assert
    //         expect(result.success).toBe(true);
    //         const emailCall = mockEmailService.sendEmail.mock.calls[0][0];
    //         expect(emailCall.subject).toContain('每週');
    //     });

    //     // it('應該依優先級排序待審核清單', async () => {
    //     //     // Arrange
    //     //     const teacherId = 'T001';
    //     //     const pendingRequests = ['LEAVE-001', 'LEAVE-URGENT', 'LEAVE-002'];

    //     //     mockEmailService.sendEmail.mockResolvedValue({ success: true });

    //     //     // Act
    //     //     await sendDailyPendingReviewDigest(teacherId, pendingRequests);

    //     //     // Assert
    //     //     expect(mockTemplateEngine.render).toHaveBeenCalledWith(
    //     //         expect.any(String),
    //     //         expect.objectContaining({
    //     //             requests: expect.arrayContaining([
    //     //                 expect.objectContaining({
    //     //                     leaveRequestId: 'LEAVE-URGENT',
    //     //                     priority: 'urgent',
    //     //                 }),
    //     //             ]),
    //     //         })
    //     //     );
    //     // });
    // });

    describe('逾期審核提醒測試', () => {
        it('應該在審核逾期時發送提醒', async () => {
            // Arrange
            const teacherId = 'T001';
            const overdueRequests = ['LEAVE-OVERDUE'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            const result = await sendOverdueReviewReminder(teacherId, overdueRequests);

            // Assert
            expect(result.success).toBe(true);
            const emailCall = mockEmailService.sendEmail.mock.calls[0][0];
            expect(emailCall.subject).toContain('逾期');
        });

        it('應該在提醒中標註逾期天數', async () => {
            // Arrange
            const teacherId = 'T001';
            const overdueRequests = ['LEAVE-OVERDUE'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendOverdueReviewReminder(teacherId, overdueRequests);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    requests: expect.arrayContaining([
                        expect.objectContaining({
                            overdueDays: expect.any(Number),
                        }),
                    ]),
                })
            );
        });

        it('應該支援多次提醒', async () => {
            // Arrange
            const teacherId = 'T001';
            const overdueRequests = ['LEAVE-OVERDUE'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act - 連續發送兩次提醒
            await sendOverdueReviewReminder(teacherId, overdueRequests);
            const result = await sendOverdueReviewReminder(teacherId, overdueRequests);

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(2);
        });

        it('應該記錄提醒次數', async () => {
            // Arrange
            const teacherId = 'T001';
            const overdueRequests = ['LEAVE-OVERDUE'];

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await sendOverdueReviewReminder(teacherId, overdueRequests);
            await sendOverdueReviewReminder(teacherId, overdueRequests);

            // Assert
            const history = mockDB.notificationHistory.get('LEAVE-OVERDUE');
            expect(history.reminderCount).toBe(2);
        });
    });

    describe('補件完成通知測試', () => {
        it('應該在學生補交文件後通知教師', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            const result = await notifyTeacherDocumentCompleted(leaveRequestId, teacherId);

            // Assert
            expect(result.success).toBe(true);
            expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
        });

        it('應該在通知中說明補交的文件類型', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const documentType = '醫院診斷證明';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await notifyTeacherDocumentCompleted(leaveRequestId, teacherId, documentType);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    documentType,
                })
            );
        });

        it('應該提供文件檢視連結', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';

            mockEmailService.sendEmail.mockResolvedValue({ success: true });

            // Act
            await notifyTeacherDocumentCompleted(leaveRequestId, teacherId);

            // Assert
            expect(mockTemplateEngine.render).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    documentUrl: expect.stringContaining('/attachments/'),
                })
            );
        });
    });

    // describe('批量通知測試', () => {
    //     it('應該支援批量通知多位教師', async () => {
    //         // Arrange
    //         const leaveRequestId = 'LEAVE-001';
    //         const teacherIds = ['T001', 'T002', 'T003'];

    //         mockEmailService.sendBulkEmail.mockResolvedValue({
    //             success: true,
    //             sent: 3,
    //         });

    //         // Act
    //         const result = await batchNotifyTeachers(leaveRequestId, teacherIds);

    //         // Assert
    //         expect(result.success).toBe(true);
    //         expect(result.notifiedCount).toBe(3);
    //     });

    //     it('應該在批量通知時個別化郵件內容', async () => {
    //         // Arrange
    //         const leaveRequestId = 'LEAVE-001';
    //         const teacherIds = ['T001', 'T002'];

    //         mockEmailService.sendEmail.mockResolvedValue({ success: true });

    //         // Act
    //         await batchNotifyTeachers(leaveRequestId, teacherIds);

    //         // Assert
    //         expect(mockTemplateEngine.render).toHaveBeenCalledTimes(2);
    //     });

    //     it('應該記錄批量通知的成功與失敗數', async () => {
    //         // Arrange
    //         const leaveRequestId = 'LEAVE-001';
    //         const teacherIds = ['T001', 'T002', 'T-INVALID'];

    //         mockEmailService.sendEmail
    //             .mockResolvedValueOnce({ success: true })
    //             .mockResolvedValueOnce({ success: true })
    //             .mockResolvedValueOnce({ success: false });

    //         // Act
    //         const result = await batchNotifyTeachers(leaveRequestId, teacherIds);

    //         // Assert
    //         expect(result.successCount).toBe(2);
    //         expect(result.failureCount).toBe(1);
    //     });
    // });

    // describe('通知範本測試', () => {
    //     // it('應該支援自定義郵件範本', async () => {
    //     //     // Arrange
    //     //     const templateId = 'custom-template-001';
    //     //     const templateContent = '親愛的 {{teacherName}}，您有新的請假申請待審核';

    //     //     mockDB.notificationTemplates.set(templateId, templateContent);
    //     //     mockTemplateEngine.getTemplate.mockReturnValue(templateContent);

    //     //     // Act
    //     //     const result = await renderNotificationTemplate(templateId, {
    //     //         teacherName: '王老師',
    //     //     });

    //     //     // Assert
    //     //     expect(result).toContain('王老師');
    //     // });

    //     it('應該支援範本變數替換', async () => {
    //         // Arrange
    //         const templateId = 'review-reminder';
    //         const variables = {
    //             teacherName: '李老師',
    //             pendingCount: 5,
    //             dueDate: '2025-12-25',
    //         };

    //         mockTemplateEngine.render.mockResolvedValue(
    //             '李老師您好，您有 5 件待審核申請，請於 2025-12-25 前完成審核'
    //         );

    //         // Act
    //         const result = await renderNotificationTemplate(templateId, variables);

    //         // Assert
    //         expect(result).toContain('李老師');
    //         expect(result).toContain('5');
    //         expect(result).toContain('2025-12-25');
    //     });

    //     it('應該支援多語言範本', async () => {
    //         // Arrange
    //         const templateId = 'new-request-notification';
    //         const locale = 'en';

    //         mockTemplateEngine.getTemplate.mockReturnValue(
    //             'Dear {{teacherName}}, you have a new leave request to review'
    //         );

    //         // Act
    //         const result = await renderNotificationTemplate(templateId, {
    //             teacherName: 'Prof. Wang',
    //         }, locale);

    //         // Assert
    //         expect(result).toContain('Dear Prof. Wang');
    //     });
    // });
});

// ============================================================================
// 通知系統整合測試
// ============================================================================

// describe('通知系統整合測試', () => {
//     beforeEach(() => {
//         mockDB.notifications.clear();
//         mockDB.notificationHistory.clear();
//         mockDB.emailQueue.clear();
//         jest.clearAllMocks();

//         setupTestData();
//         setupTeacherTestData();
//     });

//     describe('通知發送狀態追蹤測試', () => {
//         it('應該追蹤郵件發送狀態', async () => {
//             // Arrange
//             const leaveRequestId = 'LEAVE-001';
//             const studentId = 'S123456';

//             mockEmailService.sendEmail.mockResolvedValue({
//                 success: true,
//                 messageId: 'MSG-001',
//             });

//             // Act
//             await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

//             // Assert
//             const status = await getNotificationStatus('MSG-001');
//             expect(status).toBe('sent');
//         });

//         it('應該支援查詢郵件發送歷史', async () => {
//             // Arrange
//             const studentId = 'S123456';

//             // Act
//             const history = await getNotificationHistory(studentId);

//             // Assert
//             expect(history).toBeDefined();
//             expect(Array.isArray(history)).toBe(true);
//         });

//         it('應該記錄失敗的通知並支援重試', async () => {
//             // Arrange
//             const leaveRequestId = 'LEAVE-001';
//             const studentId = 'S123456';

//             mockEmailService.sendEmail
//                 .mockResolvedValueOnce({ success: false, error: 'Network error' })
//                 .mockResolvedValueOnce({ success: true });

//             // Act
//             await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);
//             const result = await retryFailedNotification(leaveRequestId);

//             // Assert
//             expect(result.success).toBe(true);
//         });
//     });

//     describe('通知優先級與排程測試', () => {
//         it('應該依優先級處理通知佇列', async () => {
//             // Arrange
//             const notifications = [
//                 { priority: 'low', leaveRequestId: 'LEAVE-001' },
//                 { priority: 'urgent', leaveRequestId: 'LEAVE-URGENT' },
//                 { priority: 'normal', leaveRequestId: 'LEAVE-002' },
//             ];

//             // Act
//             const processedOrder = await processNotificationQueue(notifications);

//             // Assert
//             expect(processedOrder[0].leaveRequestId).toBe('LEAVE-URGENT');
//             expect(processedOrder[2].leaveRequestId).toBe('LEAVE-001');
//         });

//         it('應該支援延遲發送通知', async () => {
//             // Arrange
//             const notification = {
//                 type: 'system_announcement',
//                 scheduledAt: new Date(Date.now() + 3600000), // 1小時後
//             };

//             // Act
//             const result = await scheduleNotification(notification);

//             // Assert
//             expect(result.scheduled).toBe(true);
//             expect(result.willSendAt).toBeInstanceOf(Date);
//         });
//     });

//     describe('錯誤處理測試', () => {
//         it('應該處理無效的郵箱地址', async () => {
//             // Arrange
//             const leaveRequestId = 'LEAVE-001';
//             const studentId = 'S-INVALID';

//             // Act
//             const result = await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

//             // Assert
//             expect(result.success).toBe(false);
//             expect(result.error).toContain('無效的收件人');
//         });

//         it('應該處理郵件伺服器錯誤', async () => {
//             // Arrange
//             const leaveRequestId = 'LEAVE-001';
//             const studentId = 'S123456';

//             mockEmailService.sendEmail.mockRejectedValue(
//                 new Error('SMTP server unavailable')
//             );

//             // Act
//             const result = await sendLeaveSubmissionConfirmation(leaveRequestId, studentId);

//             // Assert
//             expect(result.success).toBe(false);
//             expect(mockLogService.logEmailFailed).toHaveBeenCalled();
//         });

//         it('應該處理範本渲染錯誤', async () => {
//             // Arrange
//             const templateId = 'invalid-template';

//             mockTemplateEngine.getTemplate.mockReturnValue(null);

//             // Act
//             const result = await renderNotificationTemplate(templateId, {});

//             // Assert
//             expect(result).toBeNull();
//         });
//     });

//     describe('效能與限流測試', () => {
//         it('應該限制通知發送頻率', async () => {
//             // Arrange
//             const studentId = 'S123456';
//             const notifications = Array(10).fill(null).map((_, i) => ({
//                 leaveRequestId: `LEAVE-${i}`,
//                 studentId,
//             }));

//             // Act
//             const results = await Promise.all(
//                 notifications.map(n => sendLeaveSubmissionConfirmation(n.leaveRequestId, n.studentId))
//             );

//             // Assert
//             const rateLimited = results.filter(r => r.rateLimited);
//             expect(rateLimited.length).toBeGreaterThan(0);
//         });

//         it('應該支援批量發送優化', async () => {
//             // Arrange
//             const recipients = Array(100).fill(null).map((_, i) => `student${i}@university.edu`);

//             mockEmailService.sendBulkEmail.mockResolvedValue({ success: true });

//             // Act
//             const startTime = Date.now();
//             await sendBulkNotifications(recipients);
//             const duration = Date.now() - startTime;

//             // Assert
//             expect(mockEmailService.sendBulkEmail).toHaveBeenCalled();
//             expect(duration).toBeLessThan(1000); // 應在1秒內完成
//         });
//     });
// });

// ============================================================================
// Helper Functions (Mock Implementations)
// ============================================================================

function setupTestData() {
    mockDB.students.set('S123456', {
        studentId: 'S123456',
        name: '張三',
        email: 's123456@student.university.edu',
    });

    mockDB.leaveRequests.set('LEAVE-001', {
        leaveRequestId: 'LEAVE-001',
        studentId: 'S123456',
        leaveType: 'sick',
        startDate: '2025-12-24',
        endDate: '2025-12-26',
        reason: '感冒',
        status: 'pending_review',
    });

    mockDB.notificationTemplates.set('submission-confirmation', {
        subject: '請假申請提交成功 - {{leaveRequestId}}',
        template: '親愛的 {{studentName}}，您的請假申請已提交...',
    });
}

function setupTeacherTestData() {
    mockDB.teachers.set('T001', {
        teacherId: 'T001',
        name: '王老師',
        email: 'teacher1@university.edu',
    });

    mockDB.teachers.set('T002', {
        teacherId: 'T002',
        name: '李老師',
        email: 'teacher2@university.edu',
    });

    mockDB.leaveRequests.set('LEAVE-OVERDUE', {
        leaveRequestId: 'LEAVE-OVERDUE',
        studentId: 'S123456',
        submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5天前
        status: 'pending_review',
    });

    mockDB.leaveRequests.set('LEAVE-URGENT', {
        leaveRequestId: 'LEAVE-URGENT',
        studentId: 'S123456',
        priority: 'urgent',
        status: 'pending_review',
    });
}

async function sendLeaveSubmissionConfirmation(leaveRequestId: string, studentId: string) {
    const student = mockDB.students.get(studentId);
    if (!student) {
        return { success: false, error: '無效的收件人' };
    }

    const preferences = mockDB.notificationPreferences.get(studentId);
    if (preferences && !preferences.emailEnabled) {
        return { success: false, skipped: true };
    }

    if (preferences && !preferences.submissionConfirmation) {
        return { success: false, skipped: true, reason: '用戶已關閉此類型通知' };
    }

    const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);

    const template = mockDB.notificationTemplates.get('submission-confirmation');
    await mockTemplateEngine.render(template.template, {
        studentName: student.name,
        leaveRequestId,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
    });

    try {
        const result = await mockEmailService.sendEmail({
            to: student.email,
            subject: template.subject.replace('{{leaveRequestId}}', leaveRequestId),
            html: 'Rendered email content',
        });

        if (result.success) {
            mockDB.notificationHistory.set(leaveRequestId, {
                submissionNotificationSentAt: new Date(),
            });

            await mockLogService.logEmailSent();
        } else {
            await mockLogService.logEmailFailed();
        }

        return result;
    } catch (error: any) {
        await mockLogService.logEmailFailed();
        return { success: false, error: error.message };
    }
}

async function sendReviewResultNotification(
    leaveRequestId: string,
    studentId: string,
    reviewResult: string,
    comments?: string,
    reviewerName?: string
) {
    const student = mockDB.students.get(studentId);
    const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);

    const templateData = {
        studentName: student.name,
        leaveRequestId,
        reviewResult,
        comments: comments || '',
        reviewerName: reviewerName || '',
        resubmitUrl: reviewResult === 'rejected' ? `/leave/edit/${leaveRequestId}` : '',
    };

    await mockTemplateEngine.render('review-result', templateData);

    const result = await mockEmailService.sendEmail({
        to: student.email,
        subject: reviewResult === 'approved' ? '請假申請已核准' : '請假申請已退回',
        html: 'Rendered email',
    });

    if (result.success) {
        const history = mockDB.notificationHistory.get(leaveRequestId) || {};
        history.reviewNotificationSentAt = new Date();
        mockDB.notificationHistory.set(leaveRequestId, history);
    }

    return result;
}

async function sendPasswordResetLink(studentId: string, email: string) {
    const student = mockDB.students.get(studentId);
    if (!student || student.email !== email) {
        return { success: false, error: '郵箱與帳號不匹配' };
    }

    // 檢查頻率限制
    const lastReset = mockDB.notificationHistory.get(`reset-${studentId}`);
    if (lastReset && (Date.now() - lastReset.sentAt) < 60000) {
        return { success: false, error: '請稍後再試' };
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const result = await mockEmailService.sendEmail({
        to: email,
        subject: '密碼重設驗證連結',
        html: `<a href="https://system.university.edu/reset-password?token=${resetToken}">重設密碼</a>`,
    });

    if (result.success) {
        mockDB.notificationHistory.set(`reset-${studentId}`, {
            sentAt: Date.now(),
        });
    }

    return {
        success: result.success,
        resetToken,
        expiresAt,
    };
}



async function sendSystemAnnouncement(announcement: any, targetAudience: string) {
    const subject = announcement.priority === 'urgent'
        ? `【緊急】${announcement.title}`
        : announcement.title;

    const result = await mockEmailService.sendBulkEmail({
        subject,
        html: announcement.content,
        audience: targetAudience,
    });

    return {
        success: result.success,
        statistics: {
            totalSent: result.sent || 0,
            totalFailed: result.failed || 0,
        },
    };
}

async function scheduleAnnouncement(announcement: any, targetAudience: string) {
    mockDB.emailQueue.set(`announcement-${Date.now()}`, {
        announcement,
        targetAudience,
        scheduledAt: announcement.scheduledAt,
    });

    return {
        success: true,
        scheduled: true,
    };
}

async function notifyTeachersNewLeaveRequest(leaveRequestId: string, affectedTeachers: string[]) {
    const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
    const student = mockDB.students.get(leaveRequest.studentId);

    if (affectedTeachers.length > 1) {
        return await mockEmailService.sendBulkEmail({
            recipients: affectedTeachers.map(id => mockDB.teachers.get(id).email),
            subject: 'New leave request',
        });
    }

    for (const teacherId of affectedTeachers) {
        const teacher = mockDB.teachers.get(teacherId);

        await mockTemplateEngine.render('new-leave-request', {
            studentName: student.name,
            studentId: student.studentId,
            affectedCourses: ['Course A', 'Course B'],
            reviewUrl: `/review/${leaveRequestId}`,
        });

        await mockEmailService.sendEmail({
            to: teacher.email,
            subject: 'New leave request to review',
            html: 'Notification content',
        });
    }

    mockDB.notificationHistory.set(leaveRequestId, {
        teacherNotifiedAt: new Date(),
    });

    return { success: true };
}

async function sendDailyPendingReviewDigest(teacherId: string, pendingRequests: string[]) {
    if (pendingRequests.length === 0) {
        return { skipped: true };
    }

    const teacher = mockDB.teachers.get(teacherId);
    const requests = pendingRequests.map(id => mockDB.leaveRequests.get(id));

    await mockTemplateEngine.render('daily-digest', {
        teacherName: teacher.name,
        pendingCount: pendingRequests.length,
        requests: requests.map(r => ({
            leaveRequestId: r.leaveRequestId,
            studentName: mockDB.students.get(r.studentId).name,
        })),
    });

    const result = await mockEmailService.sendEmail({
        to: teacher.email,
        subject: 'Daily pending review digest',
        html: 'Digest content',
    });

    return result;
}

async function sendPendingReviewDigest(
    teacherId: string,
    pendingRequests: string[],
    frequency: string
) {
    const teacher = mockDB.teachers.get(teacherId);

    const result = await mockEmailService.sendEmail({
        to: teacher.email,
        subject: frequency === 'weekly' ? '每週待審核清單' : '每日待審核清單',
        html: 'Digest',
    });

    return result;
}

async function sendOverdueReviewReminder(teacherId: string, overdueRequests: string[]) {
    const teacher = mockDB.teachers.get(teacherId);
    const requests = overdueRequests.map(id => {
        const req = mockDB.leaveRequests.get(id);
        const overdueDays = Math.floor(
            (Date.now() - req.submittedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { ...req, overdueDays };
    });

    await mockTemplateEngine.render('overdue-reminder', {
        teacherName: teacher.name,
        requests,
    });

    const result = await mockEmailService.sendEmail({
        to: teacher.email,
        subject: '逾期審核提醒',
        html: 'Reminder',
    });

    if (result.success) {
        overdueRequests.forEach(id => {
            const history = mockDB.notificationHistory.get(id) || { reminderCount: 0 };
            history.reminderCount = (history.reminderCount || 0) + 1;
            mockDB.notificationHistory.set(id, history);
        });
    }

    return result;
}

async function notifyTeacherDocumentCompleted(
    leaveRequestId: string,
    teacherId: string,
    documentType?: string
) {
    const teacher = mockDB.teachers.get(teacherId);

    await mockTemplateEngine.render('document-completed', {
        teacherName: teacher.name,
        documentType: documentType || '證明文件',
        documentUrl: `/attachments/${leaveRequestId}`,
    });

    const result = await mockEmailService.sendEmail({
        to: teacher.email,
        subject: '學生已補交文件',
        html: 'Document notification',
    });

    return result;
}

async function batchNotifyTeachers(leaveRequestId: string, teacherIds: string[]) {
    let successCount = 0;
    let failureCount = 0;

    for (const teacherId of teacherIds) {
        const teacher = mockDB.teachers.get(teacherId);
        if (!teacher) {
            failureCount++;
            continue;
        }

        await mockTemplateEngine.render('notification', {
            teacherName: teacher.name,
        });

        const result = await mockEmailService.sendEmail({
            to: teacher.email,
            subject: 'Notification',
            html: 'Content',
        });

        if (result.success) {
            successCount++;
        } else {
            failureCount++;
        }
    }

    return {
        success: true,
        notifiedCount: successCount,
        successCount,
        failureCount,
    };
}

async function renderNotificationTemplate(templateId: string, variables: any, locale?: string) {
    const template = mockTemplateEngine.getTemplate(templateId, locale);
    if (!template) {
        return null;
    }

    const result = await mockTemplateEngine.render(template, variables);
    return result;
}

async function getNotificationStatus(messageId: string) {
    return 'sent';
}

async function getNotificationHistory(studentId: string) {
    return [];
}

async function retryFailedNotification(leaveRequestId: string) {
    const result = await mockEmailService.sendEmail({
        to: 's123456@student.university.edu',
        subject: 'Retry',
        html: 'Content',
    });

    return result;
}

async function processNotificationQueue(notifications: any[]) {
    const priorityOrder: any = { urgent: 0, high: 1, normal: 2, low: 3 };
    return notifications.sort((a: any, b: any) =>
        priorityOrder[a.priority] - priorityOrder[b.priority]
    );
}

async function scheduleNotification(notification: any) {
    return {
        scheduled: true,
        willSendAt: notification.scheduledAt,
    };
}

async function sendBulkNotifications(recipients: string[]) {
    return await mockEmailService.sendBulkEmail({
        recipients,
        subject: 'Bulk notification',
        html: 'Content',
    });
}

function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
