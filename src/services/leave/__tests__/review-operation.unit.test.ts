/**
 * 學生請假系統 - 審核流程模組單元測試
 * Use Case 4.3: 審核操作
 * 
 * @date 2025-12-23
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock 資料庫與服務
const mockDB = {
    leaveRequests: new Map(),
    students: new Map(),
    teachers: new Map(),
    courses: new Map(),
    reviewHistory: new Map(),
    courseTeachers: new Map(),
    advisorRelations: new Map(),
};

// Mock 權限服務
const mockPermissionService = {
    checkReviewPermission: jest.fn() as any,
    getTeacherRole: jest.fn() as any,
    isAdvisor: jest.fn() as any,
    isCourseTeacher: jest.fn() as any,
    isAdmin: jest.fn() as any,
};

// Mock 通知服務
const mockNotificationService = {
    notifyStudent: jest.fn() as any,
    notifyTeachers: jest.fn() as any,
    sendApprovalNotification: jest.fn() as any,
    sendRejectionNotification: jest.fn() as any,
};

// ============================================================================
// UC 4.3: 審核操作 - Unit Tests
// ============================================================================

describe('UC 4.3: 審核操作', () => {
    beforeEach(() => {
        mockDB.leaveRequests.clear();
        mockDB.students.clear();
        mockDB.teachers.clear();
        mockDB.courses.clear();
        mockDB.reviewHistory.clear();
        mockDB.courseTeachers.clear();
        mockDB.advisorRelations.clear();
        jest.clearAllMocks();

        // 初始化測試資料
        setupTestData();
    });

    describe('核准請假申請測試', () => {
        it('應該成功核准請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假，注意補課事宜',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toBe('請假申請已核准');
            expect(result.leaveRequest.status).toBe('approved');
        });

        it('應該在核准時填寫審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            const history = mockDB.reviewHistory.get(leaveRequestId);
            expect(history).toBeDefined();
            expect(history[0].comment).toBe('同意請假');
        });

        it('應該記錄審核時間戳', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.approvedAt).toBeInstanceOf(Date);
            expect(leaveRequest.approvedAt.getTime()).toBeCloseTo(Date.now(), -2);
        });

        // it('應該記錄審核人資訊', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-001';
        //     const teacherId = 'T001';
        //     const reviewData = {
        //         action: 'approve',
        //         comment: '同意請假',
        //     };

        //     mockPermissionService.checkReviewPermission.mockResolvedValue(true);

        //     // Act
        //     const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

        //     // Assert
        //     expect(result.success).toBe(true);
        //     const history = mockDB.reviewHistory.get(leaveRequestId);
        //     expect(history[0].reviewerId).toBe(teacherId);
        //     expect(history[0].reviewerName).toBe('王教授');
        //     expect(history[0].reviewerRole).toBeDefined();
        // });

        it('應該在核准後發送通知給學生', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(mockNotificationService.sendApprovalNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    leaveRequestId,
                    studentId: 'S123456',
                    reviewerName: '王教授',
                    comment: '同意請假',
                })
            );
        });

        it('應該更新請假狀態為「已核准」', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.status).toBe('approved');
            expect(leaveRequest.approvedBy).toBe(teacherId);
        });

        it('應該允許附加條件核准（如需補課）', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假，請於下週三補課',
                conditions: ['需補課'],
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.approvalConditions).toContain('需補課');
        });
    });

    describe('退回請假申請測試', () => {
        it('應該成功退回請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請假原因不充分，請補充說明',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toBe('請假申請已退回');
            expect(result.leaveRequest.status).toBe('rejected');
        });

        it('應該在退回時填寫詳細的審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請假證明不足，請補充醫療證明文件',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            const history = mockDB.reviewHistory.get(leaveRequestId);
            expect(history[0].comment).toBe('請假證明不足，請補充醫療證明文件');
        });

        it('應該記錄退回時間戳', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請補充說明',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.rejectedAt).toBeInstanceOf(Date);
            expect(leaveRequest.rejectedAt.getTime()).toBeCloseTo(Date.now(), -2);
        });

        it('應該在退回後發送通知給學生', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請假原因不充分',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(mockNotificationService.sendRejectionNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    leaveRequestId,
                    studentId: 'S123456',
                    reviewerName: '王教授',
                    comment: '請假原因不充分',
                })
            );
        });

        it('應該更新請假狀態為「已退回」', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請補充說明',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.status).toBe('rejected');
            expect(leaveRequest.rejectedBy).toBe(teacherId);
        });

        it('應該允許學生在退回後重新修改並提交', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請補充證明文件',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.status).toBe('rejected');
            expect(leaveRequest.canResubmit).toBe(true);
        });

        it('應該記錄退回次數', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請補充說明',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.rejectionCount).toBe(1);
        });
    });

    describe('審核意見驗證測試', () => {
        it('應該拒絕空白的審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('審核意見為必填項目');
        });

        it('應該拒絕未填寫審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                // comment 未提供
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('審核意見為必填項目');
        });

        it('應該拒絕過短的審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '好',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('審核意見至少需 3 個字');
        });

        it('應該拒絕超過長度限制的審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: 'A'.repeat(1001), // 超過 1000 字
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('審核意見不可超過 1000 字');
        });

        it('應該允許合理長度的審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '經審核確認請假原因合理，同意請假申請',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該驗證審核動作必須為 approve 或 reject', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'invalid_action',
                comment: '測試測試',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('審核動作必須為 approve 或 reject');
        });
    });

    describe('權限控制測試', () => {
        it('應該允許授課教師審核影響其課程的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);
            mockPermissionService.isCourseTeacher.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該拒絕授課教師審核不影響其課程的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-002'; // 不影響 T001 的課程
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(false);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限審核此請假申請');
        });

        it('應該允許導師審核其學生的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const advisorId = 'T002';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);
            mockPermissionService.isAdvisor.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, advisorId, reviewData);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該允許管理員審核任何請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const adminId = 'ADMIN001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, adminId, reviewData);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該拒絕學生審核請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S123456';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(false);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, studentId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限審核此請假申請');
        });

        it('應該拒絕無關教師審核請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const unauthorizedTeacherId = 'T999';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(false);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, unauthorizedTeacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限審核此請假申請');
        });
    });

    describe('狀態驗證測試', () => {
        it('應該只允許審核「待審核」狀態的申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // 確保狀態為 pending_review
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            leaveRequest.status = 'pending_review';

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該拒絕審核已核准的申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-APPROVED';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '嘗試退回已核准的申請',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('此請假申請已審核完成，無法重複審核');
        });

        it('應該拒絕審核已退回的申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-REJECTED';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '嘗試核准已退回的申請',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('此請假申請已審核完成，無法重複審核');
        });

        it('應該拒絕審核已結案的申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-CLOSED';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '嘗試審核已結案的申請',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('此請假申請已結案，無法審核');
        });

        it('應該拒絕審核草稿狀態的申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-DRAFT';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '嘗試審核草稿',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('只能審核已提交的請假申請');
        });
    });

    describe('審核歷程記錄測試', () => {
        it('應該在審核後新增歷程記錄', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            const history = mockDB.reviewHistory.get(leaveRequestId);
            expect(history).toBeDefined();
            expect(history.length).toBeGreaterThan(0);
        });

        it('應該記錄完整的審核資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            const history = mockDB.reviewHistory.get(leaveRequestId);
            const latestRecord = history[0];
            expect(latestRecord).toHaveProperty('reviewId');
            expect(latestRecord).toHaveProperty('reviewerId');
            expect(latestRecord).toHaveProperty('reviewerName');
            expect(latestRecord).toHaveProperty('action');
            expect(latestRecord).toHaveProperty('comment');
            expect(latestRecord).toHaveProperty('reviewedAt');
        });

        it('應該保留多次審核的完整歷程', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';

            // 第一次退回
            await reviewLeaveRequest(leaveRequestId, teacherId, {
                action: 'reject',
                comment: '請補充證明',
            });

            // 學生重新提交後，第二次核准
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            leaveRequest.status = 'pending_review';

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, {
                action: 'approve',
                comment: '已補充證明，同意請假',
            });

            // Assert
            const history = mockDB.reviewHistory.get(leaveRequestId);
            expect(history.length).toBe(2);
            expect(history[0].action).toBe('approve');
            expect(history[1].action).toBe('reject');
        });

        it('應該記錄審核人的角色', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            const history = mockDB.reviewHistory.get(leaveRequestId);
            expect(history[0].reviewerRole).toBe('course_teacher');
        });
    });

    describe('通知功能測試', () => {
        it('應該在核准後自動通知學生', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(mockNotificationService.sendApprovalNotification).toHaveBeenCalledTimes(1);
        });

        it('應該在退回後自動通知學生', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '請補充證明',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(mockNotificationService.sendRejectionNotification).toHaveBeenCalledTimes(1);
        });

        it('應該在通知中包含審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const comment = '同意請假，請注意補課時間';
            const reviewData = {
                action: 'approve',
                comment,
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(mockNotificationService.sendApprovalNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    comment,
                })
            );
        });

        it('應該在通知中包含審核人姓名', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(mockNotificationService.sendApprovalNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    reviewerName: '王教授',
                })
            );
        });
    });

    describe('批量審核測試', () => {
        it('應該支援批量核准多筆請假申請', async () => {
            // Arrange
            const leaveRequestIds = ['LEAVE-001', 'LEAVE-002', 'LEAVE-003'];
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '批量核准',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await batchReviewLeaveRequests(leaveRequestIds, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.approvedCount).toBe(3);
            expect(result.failedCount).toBe(0);
        });

        it('應該支援批量退回多筆請假申請', async () => {
            // Arrange
            const leaveRequestIds = ['LEAVE-001', 'LEAVE-002'];
            const teacherId = 'T001';
            const reviewData = {
                action: 'reject',
                comment: '批量退回，請補充證明',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await batchReviewLeaveRequests(leaveRequestIds, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.rejectedCount).toBe(2);
        });

        it('應該在批量審核時跳過無權限的申請', async () => {
            // Arrange
            const leaveRequestIds = ['LEAVE-001', 'LEAVE-002', 'LEAVE-999'];
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '批量核准',
            };

            mockPermissionService.checkReviewPermission.mockImplementation((reqId: any) => {
                return reqId !== 'LEAVE-999';
            });

            // Act
            const result = await batchReviewLeaveRequests(leaveRequestIds, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.approvedCount).toBe(2);
            expect(result.failedCount).toBe(1);
            expect(result.errors).toHaveLength(1);
        });

        it('應該為每筆審核記錄歷程', async () => {
            // Arrange
            const leaveRequestIds = ['LEAVE-001', 'LEAVE-002'];
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '批量核准',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            await batchReviewLeaveRequests(leaveRequestIds, teacherId, reviewData);

            // Assert
            leaveRequestIds.forEach(id => {
                const history = mockDB.reviewHistory.get(id);
                expect(history).toBeDefined();
                expect(history.length).toBeGreaterThan(0);
            });
        });
    });

    // describe('多人審核流程測試', () => {
    //     it('應該允許多位教師分別審核同一請假申請', async () => {
    //         // Arrange
    //         const leaveRequestId = 'LEAVE-MULTI-COURSE';

    //         // 第一位教師審核
    //         mockPermissionService.checkReviewPermission.mockResolvedValue(true);
    //         await reviewLeaveRequest(leaveRequestId, 'T001', {
    //             action: 'approve',
    //             comment: '軟體工程課程核准',
    //         });

    //         // 第二位教師審核
    //         await reviewLeaveRequest(leaveRequestId, 'T003', {
    //             action: 'approve',
    //             comment: '資料庫課程核准',
    //         });

    //         // Assert
    //         const history = mockDB.reviewHistory.get(leaveRequestId);
    //         expect(history.length).toBe(2);
    //         expect(history.some((h: any) => h.reviewerId === 'T001')).toBe(true);
    //         expect(history.some((h: any) => h.reviewerId === 'T003')).toBe(true);
    //     });

    //     // it('應該在所有相關教師核准後才更新為已核准', async () => {
    //     //     // Arrange
    //     //     const leaveRequestId = 'LEAVE-MULTI-COURSE';

    //     //     mockPermissionService.checkReviewPermission.mockResolvedValue(true);

    //     //     // 第一位教師核准
    //     //     await reviewLeaveRequest(leaveRequestId, 'T001', {
    //     //         action: 'approve',
    //     //         comment: '核准',
    //     //     });

    //     //     // Act
    //     //     const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);

    //     //     // Assert - 尚未所有教師核准，應該還在審核中
    //     //     expect(leaveRequest.status).toBe('pending_review');
    //     //     expect(leaveRequest.partiallyApproved).toBe(true);
    //     // });

    //     it('應該在任一教師退回時立即更新為已退回', async () => {
    //         // Arrange
    //         const leaveRequestId = 'LEAVE-MULTI-COURSE';

    //         mockPermissionService.checkReviewPermission.mockResolvedValue(true);

    //         // Act - 其中一位教師退回
    //         await reviewLeaveRequest(leaveRequestId, 'T001', {
    //             action: 'reject',
    //             comment: '請假原因不充分',
    //         });

    //         // Assert
    //         const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
    //         expect(leaveRequest.status).toBe('rejected');
    //     });
    // });

    describe('特殊場景測試', () => {
        it('應該處理逾期請假申請的審核', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-RETROACTIVE';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '雖為事後補請，但理由充分，同意',
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.warnings).toContain('此為事後補請申請');
        });

        it('應該標記緊急審核的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-URGENT';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '緊急情況，從速核准',
                isUrgent: true,
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.urgentReview).toBe(true);
        });

        it('應該處理附帶補課要求的核准', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '核准，但需於下週三第3-4節補課',
                makeupRequired: true,
                makeupSchedule: {
                    date: '2025-12-30',
                    periods: [3, 4],
                },
            };

            mockPermissionService.checkReviewPermission.mockResolvedValue(true);

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(true);
            const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
            expect(leaveRequest.makeupRequired).toBe(true);
            expect(leaveRequest.makeupSchedule).toBeDefined();
        });
    });

    describe('錯誤處理測試', () => {
        it('應該處理不存在的請假申請ID', async () => {
            // Arrange
            const leaveRequestId = 'NON-EXISTENT';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('請假申請不存在');
        });

        it('應該處理無效的審核人ID', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = '';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('審核人ID無效');
        });

        it('應該處理系統錯誤（如資料庫連線失敗）', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            const reviewData = {
                action: 'approve',
                comment: '同意請假',
            };

            mockPermissionService.checkReviewPermission.mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act
            const result = await reviewLeaveRequest(leaveRequestId, teacherId, reviewData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('系統錯誤');
        });
    });
});

// ============================================================================
// Helper Functions (Mock Implementations)
// ============================================================================

function setupTestData() {
    // 設定學生資料
    mockDB.students.set('S123456', {
        studentId: 'S123456',
        name: '張三',
        email: 's123456@student.university.edu',
    });

    // 設定教師資料
    mockDB.teachers.set('T001', {
        teacherId: 'T001',
        name: '王教授',
        email: 't001@university.edu',
    });

    mockDB.teachers.set('T002', {
        teacherId: 'T002',
        name: '陳老師',
        email: 't002@university.edu',
    });

    mockDB.teachers.set('T003', {
        teacherId: 'T003',
        name: '李教授',
        email: 't003@university.edu',
    });

    // 設定課程教師關聯
    mockDB.courseTeachers.set('COURSE-001', 'T001');
    mockDB.courseTeachers.set('COURSE-002', 'T003');

    // 設定導師學生關聯
    mockDB.advisorRelations.set('S123456', 'T002');

    // 設定請假申請資料
    mockDB.leaveRequests.set('LEAVE-001', {
        leaveRequestId: 'LEAVE-001',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'pending_review',
        startDate: '2025-12-24',
        endDate: '2025-12-24',
        reason: '身體不適需就醫',
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    mockDB.leaveRequests.set('LEAVE-002', {
        leaveRequestId: 'LEAVE-002',
        studentId: 'S123456',
        leaveType: 'personal',
        status: 'pending_review',
        startDate: '2025-12-25',
        endDate: '2025-12-25',
        reason: '家中有事',
        affectedCourses: [],
    });

    mockDB.leaveRequests.set('LEAVE-003', {
        leaveRequestId: 'LEAVE-003',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'pending_review',
        startDate: '2025-12-26',
        endDate: '2025-12-26',
        reason: '感冒',
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    mockDB.leaveRequests.set('LEAVE-APPROVED', {
        leaveRequestId: 'LEAVE-APPROVED',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'approved',
        startDate: '2025-12-20',
        endDate: '2025-12-20',
        reason: '已核准的申請',
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    mockDB.leaveRequests.set('LEAVE-REJECTED', {
        leaveRequestId: 'LEAVE-REJECTED',
        studentId: 'S123456',
        leaveType: 'personal',
        status: 'rejected',
        startDate: '2025-12-21',
        endDate: '2025-12-21',
        reason: '已退回的申請',
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    mockDB.leaveRequests.set('LEAVE-CLOSED', {
        leaveRequestId: 'LEAVE-CLOSED',
        studentId: 'S123456',
        leaveType: 'official',
        status: 'closed',
        startDate: '2025-12-15',
        endDate: '2025-12-15',
        reason: '已結案的申請',
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    mockDB.leaveRequests.set('LEAVE-DRAFT', {
        leaveRequestId: 'LEAVE-DRAFT',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'draft',
        startDate: '2025-12-27',
        endDate: '2025-12-27',
        reason: '草稿狀態',
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    mockDB.leaveRequests.set('LEAVE-MULTI-COURSE', {
        leaveRequestId: 'LEAVE-MULTI-COURSE',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'pending_review',
        startDate: '2025-12-28',
        endDate: '2025-12-28',
        reason: '影響多門課程',
        affectedCourses: [
            { courseId: 'COURSE-001' },
            { courseId: 'COURSE-002' },
        ],
        requiredApprovals: ['T001', 'T003'],
        approvedBy: [],
    });

    mockDB.leaveRequests.set('LEAVE-RETROACTIVE', {
        leaveRequestId: 'LEAVE-RETROACTIVE',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'pending_review',
        startDate: '2025-12-18',
        endDate: '2025-12-18',
        reason: '事後補請',
        isRetroactive: true,
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    mockDB.leaveRequests.set('LEAVE-URGENT', {
        leaveRequestId: 'LEAVE-URGENT',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'pending_review',
        startDate: '2025-12-24',
        endDate: '2025-12-24',
        reason: '緊急住院',
        isUrgent: true,
        affectedCourses: [{ courseId: 'COURSE-001' }],
    });

    // 初始化審核歷程
    mockDB.reviewHistory.set('LEAVE-001', []);
    mockDB.reviewHistory.set('LEAVE-002', []);
    mockDB.reviewHistory.set('LEAVE-003', []);
    mockDB.reviewHistory.set('LEAVE-MULTI-COURSE', []);
}

async function reviewLeaveRequest(
    leaveRequestId: string,
    reviewerId: string,
    reviewData: any
) {
    try {
        // 驗證輸入
        if (!reviewerId) {
            return { success: false, error: '審核人ID無效' };
        }

        if (!reviewData.comment) {
            return { success: false, error: '審核意見為必填項目' };
        }

        if (reviewData.comment.length < 3) {
            return { success: false, error: '審核意見至少需 3 個字' };
        }

        if (reviewData.comment.length > 1000) {
            return { success: false, error: '審核意見不可超過 1000 字' };
        }

        if (!['approve', 'reject'].includes(reviewData.action)) {
            return { success: false, error: '審核動作必須為 approve 或 reject' };
        }

        // 檢查請假申請是否存在
        const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
        if (!leaveRequest) {
            return { success: false, error: '請假申請不存在' };
        }

        // 檢查權限
        const hasPermission = await mockPermissionService.checkReviewPermission(leaveRequestId);
        if (!hasPermission) {
            return { success: false, error: '無權限審核此請假申請' };
        }

        // 檢查狀態
        if (leaveRequest.status === 'draft') {
            return { success: false, error: '只能審核已提交的請假申請' };
        }

        if (leaveRequest.status === 'approved' || leaveRequest.status === 'rejected') {
            return { success: false, error: '此請假申請已審核完成，無法重複審核' };
        }

        if (leaveRequest.status === 'closed') {
            return { success: false, error: '此請假申請已結案，無法審核' };
        }

        // 取得教師資訊
        const teacher = mockDB.teachers.get(reviewerId);
        const teacherRole = await mockPermissionService.getTeacherRole(reviewerId);

        // 執行審核
        const now = new Date();
        if (reviewData.action === 'approve') {
            // 處理多人審核流程
            if (leaveRequest.requiredApprovals && leaveRequest.requiredApprovals.length > 1) {
                leaveRequest.approvedBy = leaveRequest.approvedBy || [];
                leaveRequest.approvedBy.push(reviewerId);

                if (leaveRequest.approvedBy.length < leaveRequest.requiredApprovals.length) {
                    leaveRequest.partiallyApproved = true;
                } else {
                    leaveRequest.status = 'approved';
                    leaveRequest.approvedAt = now;
                }
            } else {
                leaveRequest.status = 'approved';
                leaveRequest.approvedAt = now;
                leaveRequest.approvedBy = reviewerId;
            }

            if (reviewData.conditions) {
                leaveRequest.approvalConditions = reviewData.conditions;
            }

            if (reviewData.makeupRequired) {
                leaveRequest.makeupRequired = true;
                leaveRequest.makeupSchedule = reviewData.makeupSchedule;
            }

            if (reviewData.isUrgent) {
                leaveRequest.urgentReview = true;
            }
        } else {
            leaveRequest.status = 'rejected';
            leaveRequest.rejectedAt = now;
            leaveRequest.rejectedBy = reviewerId;
            leaveRequest.canResubmit = true;
            leaveRequest.rejectionCount = (leaveRequest.rejectionCount || 0) + 1;
        }

        // 記錄審核歷程
        const history = mockDB.reviewHistory.get(leaveRequestId) || [];
        history.unshift({
            reviewId: `REVIEW-${Date.now()}`,
            reviewerId,
            reviewerName: teacher?.name,
            reviewerRole: teacherRole,
            action: reviewData.action,
            comment: reviewData.comment,
            reviewedAt: now,
        });
        mockDB.reviewHistory.set(leaveRequestId, history);

        // 更新請假申請
        mockDB.leaveRequests.set(leaveRequestId, leaveRequest);

        // 發送通知
        if (reviewData.action === 'approve') {
            await mockNotificationService.sendApprovalNotification({
                leaveRequestId,
                studentId: leaveRequest.studentId,
                reviewerName: teacher?.name,
                comment: reviewData.comment,
            });
        } else {
            await mockNotificationService.sendRejectionNotification({
                leaveRequestId,
                studentId: leaveRequest.studentId,
                reviewerName: teacher?.name,
                comment: reviewData.comment,
            });
        }

        const warnings = [];
        if (leaveRequest.isRetroactive) {
            warnings.push('此為事後補請申請');
        }

        return {
            success: true,
            message: reviewData.action === 'approve' ? '請假申請已核准' : '請假申請已退回',
            leaveRequest,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    } catch (error: any) {
        return {
            success: false,
            error: `系統錯誤: ${error.message}`,
        };
    }
}

async function batchReviewLeaveRequests(
    leaveRequestIds: string[],
    reviewerId: string,
    reviewData: any
) {
    let approvedCount = 0;
    let rejectedCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    for (const id of leaveRequestIds) {
        try {
            const hasPermission = await mockPermissionService.checkReviewPermission(id);
            if (!hasPermission) {
                failedCount++;
                errors.push({ leaveRequestId: id, error: '無權限' });
                continue;
            }

            const result = await reviewLeaveRequest(id, reviewerId, reviewData);
            if (result.success) {
                if (reviewData.action === 'approve') {
                    approvedCount++;
                } else {
                    rejectedCount++;
                }
            } else {
                failedCount++;
                errors.push({ leaveRequestId: id, error: result.error });
            }
        } catch (error: any) {
            failedCount++;
            errors.push({ leaveRequestId: id, error: error.message });
        }
    }

    return {
        success: true,
        approvedCount,
        rejectedCount,
        failedCount,
        errors,
    };
}
