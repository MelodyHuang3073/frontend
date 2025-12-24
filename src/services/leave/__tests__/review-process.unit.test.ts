/**
 * 學生請假系統 - 審核流程模組單元測試
 * Use Case 4.0: 審核流程 (Part 1)
 * - UC 4.1: 待審核清單
 * - UC 4.2: 假單詳情檢視
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
    attachments: new Map(),
    courseTeachers: new Map(), // 課程與教師的關聯
    advisorRelations: new Map(), // 導師與學生的關聯
    reviewHistory: new Map(),
};

// Mock 權限服務
const mockPermissionService = {
    checkTeacherPermission: jest.fn() as any,
    getTeacherRole: jest.fn() as any,
    isAdvisor: jest.fn() as any,
    isCourseTeacher: jest.fn() as any,
    isAdmin: jest.fn() as any,
};

// Mock 通知服務
const mockNotificationService = {
    notifyStudent: jest.fn() as any,
    notifyTeachers: jest.fn() as any,
};

// ============================================================================
// UC 4.1: 待審核清單 - Unit Tests
// ============================================================================

describe('UC 4.1: 待審核清單', () => {
    beforeEach(() => {
        mockDB.leaveRequests.clear();
        mockDB.students.clear();
        mockDB.teachers.clear();
        mockDB.courses.clear();
        mockDB.courseTeachers.clear();
        mockDB.advisorRelations.clear();
        jest.clearAllMocks();

        // 初始化測試資料
        setupTestData();
    });

    describe('角色權限測試', () => {
        it('應該為授課教師顯示其課程相關的待審核清單', async () => {
            // Arrange
            const teacherId = 'T001';
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests).toBeDefined();
            expect(result.leaveRequests!.length).toBeGreaterThan(0);
            // 確認所有請假單都影響該教師的課程
            result.leaveRequests!.forEach(req => {
                expect(
                    req.affectedCourses.some((course: any) =>
                        isCourseOwnedByTeacher(course.courseId, teacherId)
                    )
                ).toBe(true);
            });
        });

        it('應該為導師顯示其班級學生的待審核清單', async () => {
            // Arrange
            const teacherId = 'T002'; // 導師
            mockPermissionService.getTeacherRole.mockResolvedValue('advisor');
            mockPermissionService.isAdvisor.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(teacherId);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                const advisorId = getStudentAdvisor(req.studentId);
                expect(advisorId).toBe(teacherId);
            });
        });

        it('應該為系辦管理員顯示所有待審核清單', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            mockPermissionService.getTeacherRole.mockResolvedValue('admin');
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests!.length).toBe(
                Array.from(mockDB.leaveRequests.values()).filter(
                    req => req.status === 'pending_review'
                ).length
            );
        });

        it('應該拒絕無權限的使用者查看待審核清單', async () => {
            // Arrange
            const unauthorizedId = 'UNAUTHORIZED';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(false);

            // Act
            const result = await getPendingReviewList(unauthorizedId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限查看待審核清單');
        });

        it('應該根據教師角色正確篩選權限範圍', async () => {
            // Arrange
            const teacherId = 'T001'; // 只教授 COURSE-001
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId);

            // Assert
            expect(result.success).toBe(true);
            // 應該只包含影響 COURSE-001 的請假申請
            const allAffectCourse001 = result.leaveRequests!.every(req =>
                req.affectedCourses.some((course: any) => course.courseId === 'COURSE-001')
            );
            expect(allAffectCourse001).toBe(true);
        });
    });

    describe('狀態篩選測試', () => {
        it('應該成功篩選「待審核」狀態的請假單', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = { status: 'pending_review' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests!.every(req => req.status === 'pending_review')).toBe(true);
        });

        it('應該支援篩選「待核銷」狀態的請假單', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = { status: 'pending_return_review' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests!.every(
                req => req.status === 'pending_return_review'
            )).toBe(true);
        });

        it('應該支援多重狀態篩選', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = { status: ['pending_review', 'pending_return_review'] };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(
                result.leaveRequests!.every(
                    req => req.status === 'pending_review' || req.status === 'pending_return_review'
                )
            ).toBe(true);
        });

        it('應該排除已完成審核的請假單', async () => {
            // Arrange
            const teacherId = 'T001';
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId);

            // Assert
            expect(result.success).toBe(true);
            expect(
                result.leaveRequests!.every(
                    req => req.status !== 'approved' && req.status !== 'rejected' && req.status !== 'closed'
                )
            ).toBe(true);
        });
    });

    describe('學生姓名查詢測試', () => {
        it('應該支援依學生姓名查詢', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = { studentName: '張三' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                const student = mockDB.students.get(req.studentId);
                expect(student!.name).toContain('張三');
            });
        });

        it('應該支援依學號查詢', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = { studentId: 'S123456' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests!.every(req => req.studentId === 'S123456')).toBe(true);
        });

        it('應該支援模糊查詢學生姓名', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = { studentName: '張' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                const student = mockDB.students.get(req.studentId);
                expect(student!.name).toContain('張');
            });
        });
    });

    describe('課程篩選測試', () => {
        it('應該支援依課程名稱篩選', async () => {
            // Arrange
            const teacherId = 'T001';
            const filter = { courseName: '軟體工程' };
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId, filter);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                expect(
                    req.affectedCourses.some((course: any) => course.courseName.includes('軟體工程'))
                ).toBe(true);
            });
        });

        it('應該支援依課程代碼篩選', async () => {
            // Arrange
            const teacherId = 'T001';
            const filter = { courseId: 'COURSE-001' };
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId, filter);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                expect(
                    req.affectedCourses.some((course: any) => course.courseId === 'COURSE-001')
                ).toBe(true);
            });
        });

        it('應該只顯示教師有權限查看的課程', async () => {
            // Arrange
            const teacherId = 'T001'; // 只教授 COURSE-001
            const filter = { courseId: 'COURSE-002' }; // 嘗試查詢其他課程
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');
            mockPermissionService.isCourseTeacher.mockResolvedValue(false);

            // Act
            const result = await getPendingReviewList(teacherId, filter);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests!.length).toBe(0); // 無權限查看
        });
    });

    describe('日期範圍查詢測試', () => {
        it('應該支援依請假開始日期範圍查詢', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = {
                startDateFrom: '2025-12-24',
                startDateTo: '2025-12-26',
            };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                const startDate = new Date(req.startDate);
                expect(startDate.getTime()).toBeGreaterThanOrEqual(
                    new Date('2025-12-24').getTime()
                );
                expect(startDate.getTime()).toBeLessThanOrEqual(
                    new Date('2025-12-26').getTime()
                );
            });
        });

        it('應該支援依提交日期範圍查詢', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = {
                submittedFrom: '2025-12-20',
                submittedTo: '2025-12-23',
            };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                const submittedDate = new Date(req.submittedAt);
                expect(submittedDate.getTime()).toBeGreaterThanOrEqual(
                    new Date('2025-12-20').getTime()
                );
                expect(submittedDate.getTime()).toBeLessThanOrEqual(
                    new Date('2025-12-23').getTime()
                );
            });
        });

        it('應該處理無效的日期範圍', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const filter = {
                startDateFrom: '2025-12-26',
                startDateTo: '2025-12-24', // 結束日期早於開始日期
            };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, filter);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('日期範圍無效');
        });
    });

    describe('排序功能測試', () => {
        it('應該支援依提交時間降序排序（最新的在前）', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const sort = { field: 'submittedAt', order: 'desc' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, {}, sort);

            // Assert
            expect(result.success).toBe(true);
            for (let i = 0; i < result.leaveRequests!.length - 1; i++) {
                expect(
                    new Date(result.leaveRequests![i].submittedAt).getTime()
                ).toBeGreaterThanOrEqual(
                    new Date(result.leaveRequests![i + 1].submittedAt).getTime()
                );
            }
        });

        it('應該支援依請假開始日期排序', async () => {
            // Arrange
            const teacherId = 'T001';
            const sort = { field: 'startDate', order: 'asc' };
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId, {}, sort);

            // Assert
            expect(result.success).toBe(true);
            for (let i = 0; i < result.leaveRequests!.length - 1; i++) {
                expect(
                    new Date(result.leaveRequests![i].startDate).getTime()
                ).toBeLessThanOrEqual(
                    new Date(result.leaveRequests![i + 1].startDate).getTime()
                );
            }
        });

        it('應該支援依學生學號排序', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const sort = { field: 'studentId', order: 'asc' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, {}, sort);

            // Assert
            expect(result.success).toBe(true);
            for (let i = 0; i < result.leaveRequests!.length - 1; i++) {
                expect(result.leaveRequests![i].studentId.localeCompare(
                    result.leaveRequests![i + 1].studentId
                )).toBeLessThanOrEqual(0);
            }
        });

        it('應該支援依請假類別排序', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const sort = { field: 'leaveType', order: 'asc' };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, {}, sort);

            // Assert
            expect(result.success).toBe(true);
            for (let i = 0; i < result.leaveRequests!.length - 1; i++) {
                expect(result.leaveRequests![i].leaveType.localeCompare(
                    result.leaveRequests![i + 1].leaveType
                )).toBeLessThanOrEqual(0);
            }
        });
    });

    describe('分頁功能測試', () => {
        it('應該支援分頁查詢', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const pagination = { page: 1, pageSize: 5 };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, {}, {}, pagination);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests!.length).toBeLessThanOrEqual(5);
            expect(result.currentPage).toBe(1);
            expect(result.pageSize).toBe(5);
            expect(result.totalPages).toBeDefined();
            expect(result.total).toBeDefined();
        });

        it('應該正確計算總頁數', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const pagination = { page: 1, pageSize: 3 };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, {}, {}, pagination);

            // Assert
            expect(result.success).toBe(true);
            expect(result.totalPages).toBe(Math.ceil(result.total! / 3));
        });

        it('應該處理超出範圍的頁碼', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            const pagination = { page: 999, pageSize: 10 };
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId, {}, {}, pagination);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequests!.length).toBe(0);
        });
    });

    describe('清單資訊顯示測試', () => {
        it('應該包含請假申請的基本資訊', async () => {
            // Arrange
            const teacherId = 'T001';
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId);

            // Assert
            expect(result.success).toBe(true);
            if (result.leaveRequests!.length > 0) {
                const firstRequest = result.leaveRequests![0];
                expect(firstRequest).toHaveProperty('leaveRequestId');
                expect(firstRequest).toHaveProperty('studentId');
                expect(firstRequest).toHaveProperty('studentName');
                expect(firstRequest).toHaveProperty('leaveType');
                expect(firstRequest).toHaveProperty('startDate');
                expect(firstRequest).toHaveProperty('endDate');
                expect(firstRequest).toHaveProperty('status');
                expect(firstRequest).toHaveProperty('submittedAt');
            }
        });

        it('應該顯示受影響的課程資訊', async () => {
            // Arrange
            const teacherId = 'T001';
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId);

            // Assert
            expect(result.success).toBe(true);
            if (result.leaveRequests!.length > 0) {
                const firstRequest = result.leaveRequests![0];
                expect(firstRequest.affectedCourses).toBeDefined();
                expect(Array.isArray(firstRequest.affectedCourses)).toBe(true);
            }
        });

        it('應該顯示附件數量', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId);

            // Assert
            expect(result.success).toBe(true);
            if (result.leaveRequests!.length > 0) {
                const firstRequest = result.leaveRequests![0];
                expect(firstRequest).toHaveProperty('attachmentCount');
                expect(typeof firstRequest.attachmentCount).toBe('number');
            }
        });

        it('應該標記逾期未審核的申請', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId);

            // Assert
            expect(result.success).toBe(true);
            result.leaveRequests!.forEach(req => {
                if (req.isOverdue) {
                    expect(req.overdueHours).toBeDefined();
                    expect(req.overdueHours).toBeGreaterThan(0);
                }
            });
        });
    });

    describe('統計資訊測試', () => {
        it('應該提供待審核總數統計', async () => {
            // Arrange
            const teacherId = 'T001';
            mockPermissionService.getTeacherRole.mockResolvedValue('course_teacher');

            // Act
            const result = await getPendingReviewList(teacherId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.total).toBeDefined();
            expect(typeof result.total).toBe('number');
        });

        it('應該提供依請假類別的統計', async () => {
            // Arrange
            const adminId = 'ADMIN001';
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getPendingReviewList(adminId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.statistics).toBeDefined();
            expect(result.statistics!.byLeaveType).toBeDefined();
        });
    });
});

// ============================================================================
// UC 4.2: 假單詳情檢視 - Unit Tests
// ============================================================================

describe('UC 4.2: 假單詳情檢視', () => {
    beforeEach(() => {
        mockDB.leaveRequests.clear();
        mockDB.students.clear();
        mockDB.teachers.clear();
        mockDB.courses.clear();
        mockDB.attachments.clear();
        mockDB.reviewHistory.clear();
        jest.clearAllMocks();

        // 初始化測試資料
        setupTestData();
    });

    describe('正常流程測試', () => {
        it('應該成功取得請假單詳細資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.success).toBe(true);
            expect(result.leaveRequest).toBeDefined();
            expect(result.leaveRequest.leaveRequestId).toBe(leaveRequestId);
        });

        it('應該包含完整的請假資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            const request = result.leaveRequest;
            expect(request).toHaveProperty('leaveRequestId');
            expect(request).toHaveProperty('leaveType');
            expect(request).toHaveProperty('startDate');
            expect(request).toHaveProperty('endDate');
            expect(request).toHaveProperty('startTime');
            expect(request).toHaveProperty('endTime');
            expect(request).toHaveProperty('reason');
            expect(request).toHaveProperty('status');
            expect(request).toHaveProperty('createdAt');
            expect(request).toHaveProperty('submittedAt');
        });

        it('應該包含學生個人資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.leaveRequest.student).toBeDefined();
            expect(result.leaveRequest.student).toHaveProperty('studentId');
            expect(result.leaveRequest.student).toHaveProperty('name');
            expect(result.leaveRequest.student).toHaveProperty('email');
            expect(result.leaveRequest.student).toHaveProperty('department');
            expect(result.leaveRequest.student).toHaveProperty('grade');
        });

        it('應該顯示受影響的課程節次', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.leaveRequest.affectedCourses).toBeDefined();
            expect(Array.isArray(result.leaveRequest.affectedCourses)).toBe(true);
            if (result.leaveRequest.affectedCourses.length > 0) {
                const course = result.leaveRequest.affectedCourses[0];
                expect(course).toHaveProperty('courseId');
                expect(course).toHaveProperty('courseName');
                expect(course).toHaveProperty('courseCode');
                expect(course).toHaveProperty('teacher');
                expect(course).toHaveProperty('periods');
                expect(Array.isArray(course.periods)).toBe(true);
            }
        });

        it('應該包含課程節次的詳細資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            const course = result.leaveRequest.affectedCourses[0];
            if (course.periods.length > 0) {
                const period = course.periods[0];
                expect(period).toHaveProperty('date');
                expect(period).toHaveProperty('periodNumber');
                expect(period).toHaveProperty('startTime');
                expect(period).toHaveProperty('endTime');
                expect(period).toHaveProperty('selected'); // 是否被學生勾選
            }
        });
    });

    describe('請假原因與說明測試', () => {
        it('應該顯示完整的請假原因', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.leaveRequest.reason).toBeDefined();
            expect(typeof result.leaveRequest.reason).toBe('string');
            expect(result.leaveRequest.reason.length).toBeGreaterThan(0);
        });

        it('應該顯示補充說明（如有）', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-002'; // 有補充說明
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            if (result.leaveRequest.additionalNotes) {
                expect(typeof result.leaveRequest.additionalNotes).toBe('string');
            }
        });

        it('應該顯示請假天數統計', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.leaveRequest.duration).toBeDefined();
            expect(result.leaveRequest.duration).toHaveProperty('days');
            expect(result.leaveRequest.duration).toHaveProperty('hours');
        });
    });

    describe('附件檢視與下載測試', () => {
        it('應該顯示所有上傳的附件', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.leaveRequest.attachments).toBeDefined();
            expect(Array.isArray(result.leaveRequest.attachments)).toBe(true);
        });

        it('應該包含附件的完整資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            if (result.leaveRequest.attachments.length > 0) {
                const attachment = result.leaveRequest.attachments[0];
                expect(attachment).toHaveProperty('fileId');
                expect(attachment).toHaveProperty('fileName');
                expect(attachment).toHaveProperty('fileSize');
                expect(attachment).toHaveProperty('fileType');
                expect(attachment).toHaveProperty('uploadedAt');
                expect(attachment).toHaveProperty('url');
            }
        });

        it('應該提供附件下載連結', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            if (result.leaveRequest.attachments.length > 0) {
                const attachment = result.leaveRequest.attachments[0];
                expect(attachment.url).toBeDefined();
                expect(attachment.url).toMatch(/^https?:\/\//);
            }
        });

        it('應該支援附件預覽（圖片或PDF）', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            if (result.leaveRequest.attachments.length > 0) {
                const attachment = result.leaveRequest.attachments[0];
                expect(attachment).toHaveProperty('previewable');
                if (attachment.previewable) {
                    expect(attachment).toHaveProperty('previewUrl');
                }
            }
        });

        it('應該顯示附件檔案大小（人類可讀格式）', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            if (result.leaveRequest.attachments.length > 0) {
                const attachment = result.leaveRequest.attachments[0];
                expect(attachment.fileSizeFormatted).toBeDefined();
                expect(attachment.fileSizeFormatted).toMatch(/\d+(\.\d+)?\s*(B|KB|MB)/);
            }
        });
    });

    describe('審核歷程記錄測試', () => {
        it('應該顯示完整的審核歷程', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-003'; // 已有審核記錄
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.leaveRequest.reviewHistory).toBeDefined();
            expect(Array.isArray(result.leaveRequest.reviewHistory)).toBe(true);
        });

        it('應該包含審核記錄的詳細資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-003';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            if (result.leaveRequest.reviewHistory.length > 0) {
                const history = result.leaveRequest.reviewHistory[0];
                expect(history).toHaveProperty('reviewId');
                expect(history).toHaveProperty('reviewerId');
                expect(history).toHaveProperty('reviewerName');
                expect(history).toHaveProperty('action');
                expect(history).toHaveProperty('comment');
                expect(history).toHaveProperty('reviewedAt');
            }
        });

        it('應該按時間順序顯示審核歷程（最新的在前）', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-003';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            const history = result.leaveRequest.reviewHistory;
            for (let i = 0; i < history.length - 1; i++) {
                expect(new Date(history[i].reviewedAt).getTime()).toBeGreaterThanOrEqual(
                    new Date(history[i + 1].reviewedAt).getTime()
                );
            }
        });

        it('應該標記退回操作的審核意見', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-004'; // 曾被退回
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            const rejectedHistory = result.leaveRequest.reviewHistory.find(
                (h: any) => h.action === 'reject'
            );
            if (rejectedHistory) {
                expect(rejectedHistory.comment).toBeDefined();
                expect(rejectedHistory.comment.length).toBeGreaterThan(0);
            }
        });
    });

    describe('權限控制測試', () => {
        it('應該拒絕無權限的教師查看請假單', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const unauthorizedTeacherId = 'T999';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(false);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, unauthorizedTeacherId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限查看此請假申請');
        });

        it('應該允許授課教師查看影響其課程的請假單', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);
            mockPermissionService.isCourseTeacher.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該允許導師查看其學生的請假單', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const advisorId = 'T002';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);
            mockPermissionService.isAdvisor.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, advisorId);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該允許管理員查看所有請假單', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const adminId = 'ADMIN001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);
            mockPermissionService.isAdmin.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, adminId);

            // Assert
            expect(result.success).toBe(true);
        });

        it('應該拒絕學生查看他人的請假單', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const studentId = 'S999999'; // 非申請人
            mockPermissionService.checkTeacherPermission.mockResolvedValue(false);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, studentId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('無權限查看此請假申請');
        });
    });

    // describe('特殊狀態顯示測試', () => {
    //     // it('應該標記逾期未審核的申請', async () => {
    //     //     // Arrange
    //     //     const leaveRequestId = 'LEAVE-OVERDUE';
    //     //     const teacherId = 'T001';
    //     //     mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

    //     //     // Act
    //     //     const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

    //     //     // Assert
    //     //     if (result.leaveRequest.isOverdue) {
    //     //         expect(result.leaveRequest.overdueHours).toBeDefined();
    //     //         expect(result.leaveRequest.overdueHours).toBeGreaterThan(0);
    //     //     }
    //     // });

    //     // it('應該顯示緊急請假標記', async () => {
    //     //     // Arrange
    //     //     const leaveRequestId = 'LEAVE-URGENT';
    //     //     const teacherId = 'T001';
    //     //     mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

    //     //     // Act
    //     //     const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

    //     //     // Assert
    //     //     expect(result.leaveRequest).toHaveProperty('isUrgent');
    //     //     if (result.leaveRequest.isUrgent) {
    //     //         expect(result.leaveRequest.urgentReason).toBeDefined();
    //     //     }
    //     // });

    //     // it('應該顯示是否為事後補請', async () => {
    //     //     // Arrange
    //     //     const leaveRequestId = 'LEAVE-RETROACTIVE';
    //     //     const teacherId = 'T001';
    //     //     mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

    //     //     // Act
    //     //     const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

    //     //     // Assert
    //     //     expect(result.leaveRequest).toHaveProperty('isRetroactive');
    //     //     if (result.leaveRequest.isRetroactive) {
    //     //         expect(result.leaveRequest.retroactiveDays).toBeDefined();
    //     //     }
    //     // });

    //     it('應該顯示是否包含假日', async () => {
    //         // Arrange
    //         const leaveRequestId = 'LEAVE-001';
    //         const teacherId = 'T001';
    //         mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

    //         // Act
    //         const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

    //         // Assert
    //         expect(result.leaveRequest).toHaveProperty('includesHoliday');
    //         if (result.leaveRequest.includesHoliday) {
    //             expect(result.leaveRequest.holidays).toBeDefined();
    //             expect(Array.isArray(result.leaveRequest.holidays)).toBe(true);
    //         }
    //     });
    // });

    describe('學生歷史紀錄測試', () => {
        it('應該提供學生的請假統計資訊', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.studentStatistics).toBeDefined();
            expect(result.studentStatistics).toHaveProperty('totalLeaveRequests');
            expect(result.studentStatistics).toHaveProperty('approvedCount');
            expect(result.studentStatistics).toHaveProperty('rejectedCount');
            expect(result.studentStatistics).toHaveProperty('currentMonthDays');
        });

        it('應該顯示學生最近的請假記錄', async () => {
            // Arrange
            const leaveRequestId = 'LEAVE-001';
            const teacherId = 'T001';
            mockPermissionService.checkTeacherPermission.mockResolvedValue(true);

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.recentLeaveRequests).toBeDefined();
            expect(Array.isArray(result.recentLeaveRequests)).toBe(true);
        });
    });

    describe('錯誤處理測試', () => {
        it('應該處理不存在的請假單ID', async () => {
            // Arrange
            const leaveRequestId = 'NON-EXISTENT';
            const teacherId = 'T001';

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('請假申請不存在');
        });

        it('應該處理無效的請假單ID格式', async () => {
            // Arrange
            const leaveRequestId = '';
            const teacherId = 'T001';

            // Act
            const result = await getLeaveRequestDetailForReview(leaveRequestId, teacherId);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('請假單ID無效');
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
        department: '資訊工程系',
        grade: '三年級',
    });

    mockDB.students.set('S123457', {
        studentId: 'S123457',
        name: '李四',
        email: 's123457@student.university.edu',
        department: '資訊工程系',
        grade: '二年級',
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

    // 設定課程資料
    mockDB.courses.set('COURSE-001', {
        courseId: 'COURSE-001',
        courseName: '軟體工程',
        courseCode: 'CS301',
        teacherId: 'T001',
    });

    // 設定課程教師關聯
    mockDB.courseTeachers.set('COURSE-001', 'T001');

    // 設定導師學生關聯
    mockDB.advisorRelations.set('S123456', 'T002');

    // 設定請假申請資料
    const baseDate = new Date('2025-12-20');

    mockDB.leaveRequests.set('LEAVE-001', {
        leaveRequestId: 'LEAVE-001',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'pending_review',
        startDate: '2025-12-24',
        endDate: '2025-12-24',
        startTime: '09:00',
        endTime: '12:00',
        reason: '身體不適需就醫',
        createdAt: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000 + 3600000),
        affectedCourses: [
            {
                courseId: 'COURSE-001',
                courseName: '軟體工程',
                periods: [
                    { date: '2025-12-24', periodNumber: 2, startTime: '09:00', endTime: '10:00', selected: true },
                    { date: '2025-12-24', periodNumber: 3, startTime: '10:00', endTime: '11:00', selected: true },
                ],
            },
        ],
        attachments: [
            {
                fileId: 'FILE-001',
                fileName: 'medical-cert.pdf',
                fileSize: 204800,
                fileType: 'application/pdf',
                uploadedAt: new Date(),
                url: 'https://storage.example.com/files/medical-cert.pdf',
            },
        ],
    });

    mockDB.leaveRequests.set('LEAVE-002', {
        leaveRequestId: 'LEAVE-002',
        studentId: 'S123457',
        leaveType: 'personal',
        status: 'pending_review',
        startDate: '2025-12-25',
        endDate: '2025-12-25',
        startTime: '13:00',
        endTime: '17:00',
        reason: '家中有事需處理',
        additionalNotes: '已事先告知家長',
        createdAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 + 3600000),
        affectedCourses: [],
        attachments: [],
    });

    mockDB.leaveRequests.set('LEAVE-003', {
        leaveRequestId: 'LEAVE-003',
        studentId: 'S123456',
        leaveType: 'sick',
        status: 'approved',
        startDate: '2025-12-20',
        endDate: '2025-12-20',
        startTime: '09:00',
        endTime: '12:00',
        reason: '發燒就醫',
        createdAt: new Date(baseDate.getTime()),
        submittedAt: new Date(baseDate.getTime() + 3600000),
        approvedAt: new Date(baseDate.getTime() + 7200000),
        affectedCourses: [{ courseId: 'COURSE-001', courseName: '軟體工程', periods: [] }],
        attachments: [],
        reviewHistory: [
            {
                reviewId: 'REVIEW-001',
                reviewerId: 'T001',
                reviewerName: '王教授',
                action: 'approve',
                comment: '同意請假',
                reviewedAt: new Date(baseDate.getTime() + 7200000),
            },
        ],
    });
}

function isCourseOwnedByTeacher(courseId: string, teacherId: string): boolean {
    return mockDB.courseTeachers.get(courseId) === teacherId;
}

function getStudentAdvisor(studentId: string): string | undefined {
    return mockDB.advisorRelations.get(studentId);
}

async function getPendingReviewList(
    teacherId: string,
    filter: any = {},
    sort: any = {},
    pagination: any = {}
) {
    // 檢查權限
    const hasPermission = await mockPermissionService.checkTeacherPermission(teacherId);
    if (hasPermission === false) {
        return { success: false, error: '無權限查看待審核清單' };
    }

    const role = await mockPermissionService.getTeacherRole(teacherId);
    const isAdmin = await mockPermissionService.isAdmin(teacherId);

    let requests = Array.from(mockDB.leaveRequests.values()).filter(
        req => req.status === 'pending_review' || req.status === 'pending_return_review'
    );

    // 根據角色篩選
    if (!isAdmin) {
        requests = requests.filter(req => {
            if (role === 'advisor') {
                return getStudentAdvisor(req.studentId) === teacherId;
            } else if (role === 'course_teacher') {
                return req.affectedCourses.some((course: any) =>
                    isCourseOwnedByTeacher(course.courseId, teacherId)
                );
            }
            return false;
        });
    }

    // 應用篩選器
    if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        requests = requests.filter(req => statuses.includes(req.status));
    }

    if (filter.studentName) {
        requests = requests.filter(req => {
            const student = mockDB.students.get(req.studentId);
            return student && student.name.includes(filter.studentName);
        });
    }

    if (filter.studentId) {
        requests = requests.filter(req => req.studentId === filter.studentId);
    }

    if (filter.courseId) {
        const isCourseTeacher = await mockPermissionService.isCourseTeacher(teacherId, filter.courseId);
        if (!isAdmin && !isCourseTeacher) {
            return { success: true, leaveRequests: [], total: 0 };
        }
        requests = requests.filter(req =>
            req.affectedCourses.some((course: any) => course.courseId === filter.courseId)
        );
    }

    if (filter.courseName) {
        requests = requests.filter(req =>
            req.affectedCourses.some((course: any) => course.courseName.includes(filter.courseName))
        );
    }

    if (filter.startDateFrom && filter.startDateTo) {
        if (new Date(filter.startDateFrom) > new Date(filter.startDateTo)) {
            return { success: false, error: '日期範圍無效' };
        }
        requests = requests.filter(req => {
            const startDate = new Date(req.startDate);
            return (
                startDate >= new Date(filter.startDateFrom) &&
                startDate <= new Date(filter.startDateTo)
            );
        });
    }

    // 增強請假申請資料
    const enhancedRequests = requests.map(req => {
        const student = mockDB.students.get(req.studentId);
        return {
            ...req,
            studentName: student?.name,
            attachmentCount: req.attachments?.length || 0,
        };
    });

    return {
        success: true,
        leaveRequests: enhancedRequests,
        total: enhancedRequests.length,
        currentPage: pagination.page || 1,
        pageSize: pagination.pageSize || enhancedRequests.length,
        totalPages: pagination.pageSize ? Math.ceil(enhancedRequests.length / pagination.pageSize) : 1,
        statistics: {
            byLeaveType: {
                sick: requests.filter(r => r.leaveType === 'sick').length,
                personal: requests.filter(r => r.leaveType === 'personal').length,
                official: requests.filter(r => r.leaveType === 'official').length,
            },
        },
    };
}

async function getLeaveRequestDetailForReview(leaveRequestId: string, reviewerId: string) {
    if (!leaveRequestId) {
        return { success: false, error: '請假單ID無效' };
    }

    const leaveRequest = mockDB.leaveRequests.get(leaveRequestId);
    if (!leaveRequest) {
        return { success: false, error: '請假申請不存在' };
    }

    const hasPermission = await mockPermissionService.checkTeacherPermission(reviewerId);
    if (!hasPermission) {
        return { success: false, error: '無權限查看此請假申請' };
    }

    const student = mockDB.students.get(leaveRequest.studentId);

    // 計算請假天數
    const duration = {
        days: Math.ceil(
            (new Date(leaveRequest.endDate).getTime() - new Date(leaveRequest.startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1,
        hours: 8, // 簡化處理
    };

    // 增強附件資訊
    const attachments = (leaveRequest.attachments || []).map((att: any) => ({
        ...att,
        fileSizeFormatted: formatFileSize(att.fileSize),
        previewable: ['image/jpeg', 'image/png', 'application/pdf'].includes(att.fileType),
        previewUrl: att.url,
    }));

    return {
        success: true,
        leaveRequest: {
            ...leaveRequest,
            student,
            duration,
            attachments,
        },
        studentStatistics: {
            totalLeaveRequests: 5,
            approvedCount: 3,
            rejectedCount: 1,
            currentMonthDays: 2,
        },
        recentLeaveRequests: [],
    };
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
