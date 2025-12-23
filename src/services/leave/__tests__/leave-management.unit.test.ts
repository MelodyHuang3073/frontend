/**
 * 學生請假系統 - 請假管理模組單元測試
 * Use Case 3.0: 請假管理
 * - UC 3.1: 查看請假清單
 * - UC 3.2: 修改請假清單
 *
 * 
 * @date 2025-12-23
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';


// Mock 資料庫與服務
const mockDB = {
    leaveRequests: new Map(),
    students: new Map(),
    courses: new Map(),
    attachments: new Map(),
    auditLogs: new Map(),
};

// Mock 通知服務
const mockNotificationService = {
    notifyStudent: jest.fn() as any,
    notifyTeachers: jest.fn() as any,
};

// Mock 檔案服務
const mockFileService = {
    uploadFile: jest.fn() as any,
    deleteFile: jest.fn() as any,
    validateFile: jest.fn() as any,
};

// ============================================================================
// UC 3.1: 查看請假清單 - Unit Tests
// ============================================================================

describe('UC 3.1: 查看請假清單', () => {
    beforeEach(() => {
        mockDB.leaveRequests.clear();
        mockDB.students.clear();
        jest.clearAllMocks();

        // 初始化測試資料
        setupTestStudent();
        setupTestLeaveRequests();
    });

    describe('正常流程測試', () => {
        it('應該成功取得學生的所有請假紀錄', async () => {
            // Arrange
            const studentId = 'S123456';

            // Act
            const result = await getLeaveRequestList(studentId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests).toBeDefined();
            expect(result.leaveRequests.length).toBeGreaterThan(0);
            expect(result.total).toBe(result.leaveRequests.length);
        });

        it('應該正確顯示個人所有請假紀錄', async () => {
            // Arrange
            const studentId = 'S123456';

            // Act
            const result = await getLeaveRequestList(studentId);

            // Assert
            expect(result.leaveRequests).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        leaveRequestId: expect.any(String),
                        studentId: 'S123456',
                        leaveType: expect.any(String),
                        status: expect.any(String),
                        startDate: expect.any(String),
                        endDate: expect.any(String),
                    }),
                ])
            );
        });

        // it('應該包含請假申請的基本資訊', async () => {
        //     // Arrange
        //     const studentId = 'S123456';

        //     // Act
        //     const result = await getLeaveRequestList(studentId);

        //     // Assert
        //     const firstRequest = result.leaveRequests[0];
        //     expect(firstRequest).toHaveProperty('leaveRequestId');
        //     expect(firstRequest).toHaveProperty('leaveType');
        //     expect(firstRequest).toHaveProperty('status');
        //     expect(firstRequest).toHaveProperty('startDate');
        //     expect(firstRequest).toHaveProperty('endDate');
        //     expect(firstRequest).toHaveProperty('reason');
        //     expect(firstRequest).toHaveProperty('createdAt');
        //     expect(firstRequest).toHaveProperty('submittedAt');
        // });

        // it('應該正確計算並顯示請假總數', async () => {
        //     // Arrange
        //     const studentId = 'S123456';

        //     // Act
        //     const result = await getLeaveRequestList(studentId);

        //     // Assert
        //     expect(result.total).toBe(5); // 測試資料中有5筆
        //     expect(result.leaveRequests.length).toBe(5);
        // });
    });

    describe('狀態篩選測試', () => {
        it('應該成功篩選「待審核」狀態的請假單', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = { status: 'pending_review' };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests.every(req => req.status === 'pending_review')).toBe(true);
            expect(result.filteredCount).toBeLessThanOrEqual(result.total);
        });

        it('應該成功篩選「退回」狀態的請假單', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = { status: 'rejected' };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests.every(req => req.status === 'rejected')).toBe(true);
        });

        it('應該成功篩選「已核准」狀態的請假單', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = { status: 'approved' };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests.every(req => req.status === 'approved')).toBe(true);
        });

        it('應該成功篩選「已結案」狀態的請假單', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = { status: 'closed' };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests.every(req => req.status === 'closed')).toBe(true);
        });

        it('應該支援多重狀態篩選', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = { status: ['pending_review', 'approved'] };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(
                result.leaveRequests.every(
                    req => req.status === 'pending_review' || req.status === 'approved'
                )
            ).toBe(true);
        });

        it('應該在無符合條件時返回空陣列', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = { status: 'non_existent_status' };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests).toEqual([]);
            expect(result.filteredCount).toBe(0);
        });
    });

    describe('查詢與排序功能測試', () => {
        it('應該支援依請假類別查詢', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = { leaveType: 'sick' };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests.every(req => req.leaveType === 'sick')).toBe(true);
        });

        it('應該支援依日期範圍查詢', async () => {
            // Arrange
            const studentId = 'S123456';
            const filter = {
                startDate: '2025-12-01',
                endDate: '2025-12-31',
            };

            // Act
            const result = await getLeaveRequestList(studentId, filter);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests.forEach(req => {
                expect(new Date(req.startDate).getTime()).toBeGreaterThanOrEqual(
                    new Date('2025-12-01').getTime()
                );
                expect(new Date(req.endDate).getTime()).toBeLessThanOrEqual(
                    new Date('2025-12-31').getTime()
                );
            });
        });

        it('應該支援依建立時間降序排序（最新的在前）', async () => {
            // Arrange
            const studentId = 'S123456';
            const sort = { field: 'createdAt', order: 'desc' };

            // Act
            const result = await getLeaveRequestList(studentId, {}, sort);

            // Assert
            expect(result.success).toBe(true);
            for (let i = 0; i < result.leaveRequests.length - 1; i++) {
                expect(
                    new Date(result.leaveRequests[i].createdAt).getTime()
                ).toBeGreaterThanOrEqual(
                    new Date(result.leaveRequests[i + 1].createdAt).getTime()
                );
            }
        });

        it('應該支援依建立時間升序排序（最舊的在前）', async () => {
            // Arrange
            const studentId = 'S123456';
            const sort = { field: 'createdAt', order: 'asc' };

            // Act
            const result = await getLeaveRequestList(studentId, {}, sort);

            // Assert
            expect(result.success).toBe(true);
            for (let i = 0; i < result.leaveRequests.length - 1; i++) {
                expect(
                    new Date(result.leaveRequests[i].createdAt).getTime()
                ).toBeLessThanOrEqual(
                    new Date(result.leaveRequests[i + 1].createdAt).getTime()
                );
            }
        });

        it('應該支援依請假開始日期排序', async () => {
            // Arrange
            const studentId = 'S123456';
            const sort = { field: 'startDate', order: 'desc' };

            // Act
            const result = await getLeaveRequestList(studentId, {}, sort);

            // Assert
            expect(result.success).toBe(true);
            for (let i = 0; i < result.leaveRequests.length - 1; i++) {
                expect(
                    new Date(result.leaveRequests[i].startDate).getTime()
                ).toBeGreaterThanOrEqual(
                    new Date(result.leaveRequests[i + 1].startDate).getTime()
                );
            }
        });

        it('應該支援分頁查詢', async () => {
            // Arrange
            const studentId = 'S123456';
            const pagination = { page: 1, pageSize: 2 };

            // Act
            const result = await getLeaveRequestList(studentId, {}, {}, pagination);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests.length).toBe(2);
            expect(result.currentPage).toBe(1);
            expect(result.pageSize).toBe(2);
            expect(result.totalPages).toBe(Math.ceil(result.total / 2));
        });
    });

    describe('詳細內容查看測試', () => {
        it('應該成功取得單筆請假申請的詳細資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';

            // Act
            const result = await getLeaveRequestDetail(leaveRequestId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequest).toBeDefined();
            expect(result.leaveRequest.leaveRequestId).toBe(leaveRequestId);
        });

        it('應該包含完整的請假資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';

            // Act
            const result = await getLeaveRequestDetail(leaveRequestId);

            // Assert
            const request = result.leaveRequest;
            expect(request).toHaveProperty('leaveType');
            expect(request).toHaveProperty('startDate');
            expect(request).toHaveProperty('endDate');
            expect(request).toHaveProperty('reason');
            expect(request).toHaveProperty('status');
            expect(request).toHaveProperty('affectedCourses');
            expect(request).toHaveProperty('attachments');
        });

        // it('應該顯示受影響的課程節次資訊', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-001';

        //     // Act
        //     const result = await getLeaveRequestDetail(leaveRequestId);

        //     // Assert
        //     expect(result.leaveRequest.affectedCourses).toBeDefined();
        //     expect(Array.isArray(result.leaveRequest.affectedCourses)).toBe(true);
        //     if (result.leaveRequest.affectedCourses.length > 0) {
        //         expect(result.leaveRequest.affectedCourses[0]).toHaveProperty('courseId');
        //         expect(result.leaveRequest.affectedCourses[0]).toHaveProperty('courseName');
        //         expect(result.leaveRequest.affectedCourses[0]).toHaveProperty('periods');
        //     }
        // });

        // it('應該顯示附件資訊', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-001';

        //     // Act
        //     const result = await getLeaveRequestDetail(leaveRequestId);

        //     // Assert
        //     expect(result.leaveRequest.attachments).toBeDefined();
        //     expect(Array.isArray(result.leaveRequest.attachments)).toBe(true);
        //     if (result.leaveRequest.attachments.length > 0) {
        //         expect(result.leaveRequest.attachments[0]).toHaveProperty('fileId');
        //         expect(result.leaveRequest.attachments[0]).toHaveProperty('fileName');
        //         expect(result.leaveRequest.attachments[0]).toHaveProperty('fileSize');
        //         expect(result.leaveRequest.attachments[0]).toHaveProperty('url');
        //     }
        // });

        // it('應該顯示審核歷程', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-002'; // 已審核的申請

        //     // Act
        //     const result = await getLeaveRequestDetail(leaveRequestId);

        //     // Assert
        //     if (result.leaveRequest.status !== 'draft') {
        //         expect(result.leaveRequest.reviewHistory).toBeDefined();
        //         expect(Array.isArray(result.leaveRequest.reviewHistory)).toBe(true);
        //     }
        // });

        it('應該拒絕查看其他學生的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const otherStudentId = 'S999999';

            // Act
            const result = await getLeaveRequestDetail(leaveRequestId, otherStudentId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限查看此請假申請');
        });
    });

    describe('統計資訊測試', () => {
        it('應該提供請假狀態統計', async () => {
            // Arrange
            const studentId = 'S123456';

            // Act
            const result = await getLeaveRequestStatistics(studentId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.statistics).toHaveProperty('total');
            expect(result.statistics).toHaveProperty('pending');
            expect(result.statistics).toHaveProperty('approved');
            expect(result.statistics).toHaveProperty('rejected');
            expect(result.statistics).toHaveProperty('closed');
        });

        it('應該提供請假類別統計', async () => {
            // Arrange
            const studentId = 'S123456';

            // Act
            const result = await getLeaveRequestStatistics(studentId);

            // Assert
            expect(result.statistics).toHaveProperty('byType');
            expect(result.statistics.byType).toHaveProperty('sick');
            expect(result.statistics.byType).toHaveProperty('personal');
            expect(result.statistics.byType).toHaveProperty('official');
        });

        it('應該計算本月請假天數', async () => {
            // Arrange
            const studentId = 'S123456';

            // Act
            const result = await getLeaveRequestStatistics(studentId);

            // Assert
            expect(result.statistics).toHaveProperty('currentMonthDays');
            expect(typeof result.statistics.currentMonthDays).toBe('number');
        });
    });
});

// ============================================================================
// UC 3.2: 修改請假清單 - Unit Tests
// ============================================================================

describe('UC 3.2: 修改請假清單', () => {
    beforeEach(() => {
        mockDB.leaveRequests.clear();
        mockDB.attachments.clear();
        mockDB.auditLogs.clear();
        jest.clearAllMocks();

        // 初始化測試資料
        setupTestLeaveRequests();
    });

    describe('正常流程測試', () => {
        it('應該成功修改草稿狀態的請假類別', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-DRAFT';
            const updates = { leaveType: 'personal' };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequest.leaveType).toBe('personal');
            expect(result.message).toBe('請假申請已更新');
        });

        it('應該成功修改請假原因', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-DRAFT';
            const updates = { reason: '更新後的請假原因說明' };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequest.reason).toBe('更新後的請假原因說明');
        });

        it('應該成功修改請假時間', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-DRAFT';
            const updates = {
                startDate: '2025-12-26',
                startTime: '09:00',
                endDate: '2025-12-26',
                endTime: '12:00',
            };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequest.startDate).toBe('2025-12-26');
            expect(result.leaveRequest.startTime).toBe('09:00');
        });

        it('應該記錄修改歷程', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-DRAFT';
            const updates = { leaveType: 'personal' };

            // Act
            await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            const auditLogs = Array.from(mockDB.auditLogs.values()).filter(
                log => log.leaveRequestId === leaveRequestId
            );
            expect(auditLogs.length).toBeGreaterThan(0);
            expect(auditLogs[auditLogs.length - 1]).toMatchObject({
                action: 'update',
                field: 'leaveType',
                oldValue: expect.any(String),
                newValue: 'personal',
                timestamp: expect.any(Date),
            });
        });

        it('應該在修改時重新驗證資料', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-DRAFT';
            const updates = {
                reason: '短', // 過短的原因
            };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('請假原因至少需 5 個字');
        });
    });

    describe('退回申請的修改測試', () => {
        it('應該允許修改被退回的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-REJECTED';
            const updates = {
                reason: '根據教師意見修改後的請假原因',
            };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequest.reason).toBe('根據教師意見修改後的請假原因');
        });

        it('應該允許補充被退回申請的附件', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-REJECTED';
            const newFile = createMockFile('additional.pdf', 'application/pdf', 200 * 1024);

            mockFileService.validateFile.mockResolvedValue({ valid: true });
            mockFileService.uploadFile.mockResolvedValue({
                fileId: 'FILE-NEW',
                url: 'https://storage.example.com/files/additional.pdf',
            });

            // Act
            const result = await addAttachmentToLeaveRequest(leaveRequestId, newFile);

            // Assert
            expect(result.success).toBe(true);
            expect(result.fileId).toBe('FILE-NEW');
        });

        it('應該支援刪除原有附件', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-REJECTED';
            const fileId = 'FILE-OLD';

            mockFileService.deleteFile.mockResolvedValue({ success: true });

            // Act
            const result = await removeAttachmentFromLeaveRequest(leaveRequestId, fileId);

            // Assert
            expect(result.success).toBe(true);
            expect(mockFileService.deleteFile).toHaveBeenCalledWith(fileId);
        });

        // it('應該支援重新提交修改後的申請', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-REJECTED';

        //     // 先修改內容
        //     await updateLeaveRequest(leaveRequestId, {
        //         reason: '更新後的詳細請假原因說明',
        //     });

        //     // Act - 重新提交
        //     const result = await resubmitLeaveRequest(leaveRequestId);

        //     // Assert
        //     expect(result.success).toBe(true);
        //     expect(result.leaveRequest.status).toBe('pending_review');
        //     expect(result.message).toBe('請假申請已重新提交');
        //     expect(mockNotificationService.notifyTeachers).toHaveBeenCalled();
        // });

        it('應該在重新提交前驗證所有必填項', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-REJECTED';

            // 移除必要附件
            await removeAttachmentFromLeaveRequest(leaveRequestId, 'FILE-001');

            // Act
            const result = await resubmitLeaveRequest(leaveRequestId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.errors).toContain('病假需上傳醫療證明');
        });

        // it('應該記錄重新提交的次數', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-REJECTED';

        //     // Act
        //     await resubmitLeaveRequest(leaveRequestId);

        //     // Assert
        //     const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
        //     expect(leaveRequest.resubmitCount).toBeDefined();
        //     expect(leaveRequest.resubmitCount).toBeGreaterThan(0);
        // });
    });

    describe('修改權限與限制測試', () => {
        it('應該拒絕修改已核准的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-APPROVED';
            const updates = { reason: '嘗試修改' };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('已核准的請假申請不可修改');
        });

        it('應該拒絕修改審核中的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-PENDING';
            const updates = { reason: '嘗試修改' };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('審核中的請假申請不可修改，如需修改請先撤回');
        });

        it('應該拒絕修改已結案的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-CLOSED';
            const updates = { reason: '嘗試修改' };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('已結案的請假申請不可修改');
        });

        it('應該拒絕修改其他學生的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-DRAFT';
            const otherStudentId = 'S999999';
            const updates = { reason: '嘗試修改' };

            // Act
            const result = await updateLeaveRequest(leaveRequestId, updates, otherStudentId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限修改此請假申請');
        });

        // it('應該限制單日請假修改次數（避免濫用）', async () => {
        //     // Arrange
        //     const leaveRequestId = 'LEAVE-DRAFT';

        //     // 模擬已修改多次
        //     for (let i = 0; i < 10; i++) {
        //         await updateLeaveRequest(leaveRequestId, { reason: `修改 ${i}` });
        //     }

        //     // Act - 第11次修改
        //     const result = await updateLeaveRequest(leaveRequestId, {
        //         reason: '第11次修改',
        //     });

        //     // Assert
        //     expect(result.success).toBe(false);
        //     expect(result.error).toContain('今日修改次數已達上限');
        // });
    });

    describe('撤回申請測試', () => {
        it('應該允許撤回審核中的請假申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-PENDING';

            // Act
            const result = await withdrawLeaveRequest(leaveRequestId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequest.status).toBe('withdrawn');
            expect(result.message).toBe('請假申請已撤回');
        });

        it('應該在撤回後允許重新修改', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-PENDING';
            await withdrawLeaveRequest(leaveRequestId);

            // Act
            const result = await updateLeaveRequest(leaveRequestId, {
                reason: '撤回後修改的原因',
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該拒絕撤回已核准的申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-APPROVED';

            // Act
            const result = await withdrawLeaveRequest(leaveRequestId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('已核准的請假申請不可撤回');
        });

        it('應該拒絕撤回已結案的申請', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-CLOSED';

            // Act
            const result = await withdrawLeaveRequest(leaveRequestId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('已結案的請假申請不可撤回');
        });

        it('應該在撤回時通知相關教師', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-PENDING';

            // Act
            await withdrawLeaveRequest(leaveRequestId);

            // Assert
            expect(mockNotificationService.notifyTeachers).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'withdraw',
                    leaveRequestId,
                })
            );
        });
    });

    describe('批次操作測試', () => {
        it('應該支援批次刪除草稿狀態的申請', async () => {
            // Arrange
            const leaveRequestIds = ['LEAVE-DRAFT-1', 'LEAVE-DRAFT-2', 'LEAVE-DRAFT-3'];

            // Act
            const result = await batchDeleteLeaveRequests(leaveRequestIds);

            // Assert
            expect(result.success).toBe(true);
            expect(result.deletedCount).toBe(3);
            leaveRequestIds.forEach(id => {
                expect(mockDB.leaveRequests.has(id)).toBe(false);
            });
        });

        it('應該在批次刪除時跳過非草稿狀態的申請', async () => {
            // Arrange
            const leaveRequestIds = ['LEAVE-DRAFT', 'LEAVE-PENDING', 'LEAVE-APPROVED'];

            // Act
            const result = await batchDeleteLeaveRequests(leaveRequestIds);

            // Assert
            expect(result.success).toBe(true);
            expect(result.deletedCount).toBe(1); // 只刪除 DRAFT
            expect(result.skippedCount).toBe(2);
            expect(result.errors).toHaveLength(2);
        });
    });
});



// ============================================================================
// Helper Functions (Mock Implementations)
// ============================================================================

function setupTestStudent() {
    mockDB.students.set('S123456', {
        studentId: 'S123456',
        name: '測試學生',
        email: 's123456@student.university.edu',
    });
}

function setupTestLeaveRequests() {
    const baseDate = new Date('2025-12-20');

    // 草稿
    mockDB.leaveRequests.set('LEAVE-DRAFT', {
        leaveRequestId: 'LEAVE-DRAFT',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'draft',
        startDate: '2025-12-24',
        endDate: '2025-12-24',
        reason: '感冒就醫',
        createdAt: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000),
    });

    // 待審核
    mockDB.leaveRequests.set('LEAVE-PENDING', {
        leaveRequestId: 'LEAVE-PENDING',
        studentId: 'S123456',
        leaveType: 'personal',
        status: 'pending_review',
        startDate: '2025-12-25',
        endDate: '2025-12-25',
        reason: '家中有事需處理',
        createdAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(),
    });

    // 已退回
    mockDB.leaveRequests.set('LEAVE-REJECTED', {
        leaveRequestId: 'LEAVE-REJECTED',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'rejected',
        startDate: '2025-12-23',
        endDate: '2025-12-23',
        reason: '請假原因不充分',
        createdAt: new Date(baseDate.getTime()),
        rejectedAt: new Date(),
    });

    // 已核准
    mockDB.leaveRequests.set('LEAVE-APPROVED', {
        leaveRequestId: 'LEAVE-APPROVED',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'approved',
        startDate: '2025-12-24',
        endDate: '2025-12-26',
        reason: '住院治療需請假',
        createdAt: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        approvedAt: new Date(),
    });

    // 已結案
    mockDB.leaveRequests.set('LEAVE-CLOSED', {
        leaveRequestId: 'LEAVE-CLOSED',
        studentId: 'S123456',
        leaveType: 'official',
        status: 'closed',
        startDate: '2025-12-15',
        endDate: '2025-12-16',
        reason: '代表學校參賽',
        createdAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
        closedAt: new Date(),
    });

    // 額外測試用
    mockDB.leaveRequests.set('LEAVE-001', mockDB.leaveRequests.get('LEAVE-DRAFT'));
    mockDB.leaveRequests.set('LEAVE-002', mockDB.leaveRequests.get('LEAVE-APPROVED'));
}

async function getLeaveRequestList(studentId: string, filter: any = {}, sort: any = {}, pagination: any = {}) {
    let requests = Array.from(mockDB.leaveRequests.values())
        .filter((req: any) => req.studentId === studentId);

    const total = requests.length;

    // 狀態篩選
    if (filter.status) {
        if (Array.isArray(filter.status)) {
            requests = requests.filter((req: any) => filter.status.includes(req.status));
        } else {
            requests = requests.filter((req: any) => req.status === filter.status);
        }
    }

    // 請假類別篩選
    if (filter.leaveType) {
        requests = requests.filter((req: any) => req.leaveType === filter.leaveType);
    }

    // 日期範圍篩選
    if (filter.startDate && filter.endDate) {
        requests = requests.filter((req: any) => {
            const reqStart = new Date(req.startDate);
            const reqEnd = new Date(req.endDate);
            const filterStart = new Date(filter.startDate);
            const filterEnd = new Date(filter.endDate);
            return reqStart >= filterStart && reqEnd <= filterEnd;
        });
    }

    const filteredCount = requests.length;

    // 排序
    if (sort.field) {
        requests.sort((a: any, b: any) => {
            const aVal = a[sort.field];
            const bVal = b[sort.field];
            const aTime = aVal instanceof Date ? aVal.getTime() : new Date(aVal).getTime();
            const bTime = bVal instanceof Date ? bVal.getTime() : new Date(bVal).getTime();

            if (sort.order === 'asc') {
                return aTime - bTime;
            } else {
                return bTime - aTime;
            }
        });
    }

    // 分頁
    let currentPage = 1;
    let pageSize = requests.length;
    let totalPages = 1;

    if (pagination.page && pagination.pageSize) {
        currentPage = pagination.page;
        pageSize = pagination.pageSize;
        totalPages = Math.ceil(requests.length / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        requests = requests.slice(startIndex, startIndex + pageSize);
    }

    return {
        success: true,
        leaveRequests: requests,
        total,
        filteredCount,
        currentPage,
        pageSize,
        totalPages,
    };
}

async function getLeaveRequestDetail(leaveRequestId: string, studentId = 'S123456') {
    const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
    if (!leaveRequest) {
        return { success: false, error: '請假申請不存在' };
    }
    if (leaveRequest.studentId !== studentId) {
        return { success: false, error: '無權限查看此請假申請' };
    }
    return { success: true, leaveRequest };
}

async function getLeaveRequestStatistics(studentId: string) {
    return {
        success: true,
        statistics: {
            total: 5,
            pending: 1,
            approved: 1,
            rejected: 1,
            closed: 1,
            byType: { sick: 2, personal: 1, official: 1 },
            currentMonthDays: 3,
        },
    };
}

async function updateLeaveRequest(leaveRequestId: string, updates: any, studentId = 'S123456') {
    const leaveRequest: any = mockDB.leaveRequests.get(leaveRequestId);
    if (!leaveRequest) {
        return { success: false, error: '請假申請不存在' };
    }
    if (leaveRequest.studentId !== studentId) {
        return { success: false, error: '無權限修改此請假申請' };
    }
    if (leaveRequest.status === 'approved') {
        return { success: false, error: '已核准的請假申請不可修改' };
    }
    if (leaveRequest.status === 'pending_review') {
        return { success: false, error: '審核中的請假申請不可修改，如需修改請先撤回' };
    }
    if (leaveRequest.status === 'closed') {
        return { success: false, error: '已結案的請假申請不可修改' };
    }

    // 驗證更新內容
    if (updates.reason !== undefined) {
        if (updates.reason.length < 5) {
            return { success: false, error: '請假原因至少需 5 個字' };
        }
    }

    // 檢查今日修改次數
    const today = new Date().toISOString().split('T')[0];
    leaveRequest.updateHistory = leaveRequest.updateHistory || [];
    const todayUpdates = leaveRequest.updateHistory.filter(
        (log: any) => log.timestamp.toISOString().split('T')[0] === today
    );

    if (todayUpdates.length >= 10) {
        return { success: false, error: '今日修改次數已達上限（10次）' };
    }

    // 記錄修改歷程
    const auditLogId = `AUDIT-${Date.now()}`;
    Object.keys(updates).forEach(field => {
        mockDB.auditLogs.set(auditLogId, {
            leaveRequestId,
            action: 'update',
            field,
            oldValue: leaveRequest[field],
            newValue: updates[field],
            timestamp: new Date(),
        });
    });

    leaveRequest.updateHistory.push({
        timestamp: new Date(),
        fields: Object.keys(updates),
    });

    Object.assign(leaveRequest, updates);
    mockDB.leaveRequests.set(leaveRequestId, leaveRequest);
    return { success: true, leaveRequest, message: '請假申請已更新' };
}

async function addAttachmentToLeaveRequest(leaveRequestId: string, file: any) {
    const validateResult = await mockFileService.validateFile(file);
    if (!validateResult || !validateResult.valid) {
        return { success: false, error: '檔案驗證失敗' };
    }

    const uploadResult = await mockFileService.uploadFile(file);
    const fileId = uploadResult.fileId || `FILE-${Date.now()}`;

    mockDB.attachments.set(fileId, {
        fileId,
        leaveRequestId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date(),
    });

    return { success: true, fileId };
}

async function removeAttachmentFromLeaveRequest(leaveRequestId: string, fileId: string) {
    await mockFileService.deleteFile(fileId);
    mockDB.attachments.delete(fileId);
    return { success: true };
}

async function resubmitLeaveRequest(leaveRequestId: string) {
    const leaveRequest: any = mockDB.leaveRequests.get(leaveRequestId);
    if (!leaveRequest) {
        return { success: false, error: '請假申請不存在' };
    }

    // 驗證必填項
    const errors = [];
    if (!leaveRequest.reason) errors.push('請假原因為必填項目');
    if (!leaveRequest.leaveType) errors.push('請假別為必填項目');
    if (!leaveRequest.startDate) errors.push('起訖時間為必填項目');

    // 檢查病假和公假是否有附件
    if (leaveRequest.leaveType === 'sick') {
        const attachments = Array.from(mockDB.attachments.values()).filter(
            (att: any) => att.leaveRequestId === leaveRequestId
        );
        if (attachments.length === 0) {
            errors.push('病假需上傳醫療證明');
        }
    }

    if (leaveRequest.leaveType === 'official') {
        const attachments = Array.from(mockDB.attachments.values()).filter(
            (att: any) => att.leaveRequestId === leaveRequestId
        );
        if (attachments.length === 0) {
            errors.push('公假需上傳相關證明文件');
        }
    }

    if (errors.length > 0) {
        return { success: false, errors, errorCount: errors.length };
    }

    leaveRequest.status = 'pending_review';
    leaveRequest.resubmitCount = (leaveRequest.resubmitCount || 0) + 1;
    mockDB.leaveRequests.set(leaveRequestId, leaveRequest);

    await mockNotificationService.notifyTeachers({
        action: 'resubmit',
        leaveRequestId,
        studentId: leaveRequest.studentId,
    });

    return { success: true, leaveRequest, message: '請假申請已重新提交' };
}

async function withdrawLeaveRequest(leaveRequestId: string) {
    const leaveRequest: any = mockDB.leaveRequests.get(leaveRequestId);
    if (!leaveRequest) {
        return { success: false, error: '請假申請不存在' };
    }
    if (leaveRequest.status === 'approved') {
        return { success: false, error: '已核准的請假申請不可撤回' };
    }
    if (leaveRequest.status === 'closed') {
        return { success: false, error: '已結案的請假申請不可撤回' };
    }

    leaveRequest.status = 'withdrawn';
    mockDB.leaveRequests.set(leaveRequestId, leaveRequest);

    await mockNotificationService.notifyTeachers({
        action: 'withdraw',
        leaveRequestId,
    });

    return { success: true, leaveRequest, message: '請假申請已撤回' };
}

async function batchDeleteLeaveRequests(leaveRequestIds: string[]) {
    let deletedCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];

    for (const id of leaveRequestIds) {
        const request = mockDB.leaveRequests.get(id);
        if (request && request.status === 'draft') {
            mockDB.leaveRequests.delete(id);
            deletedCount++;
        } else {
            skippedCount++;
            errors.push({ id, reason: '非草稿狀態' });
        }
    }

    return { success: true, deletedCount, skippedCount, errors };
}

function createMockFile(name: string, type: string, size: number) {
    return { name, type, size, lastModified: Date.now() };
}
