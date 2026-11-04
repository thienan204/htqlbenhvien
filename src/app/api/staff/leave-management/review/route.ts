import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

/**
 * API: Thẩm tra, Duyệt đơn & Chỉnh sửa số ngày nghỉ của Phòng TCCB / Trưởng khoa
 * PUT /api/staff/leave-management/review
 */
export async function PUT(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            requestId,
            action, // 'DEPT_APPROVE' | 'DEPT_REJECT' | 'TCCB_REVIEW' | 'TCCB_REJECT'
            deptComment,
            rejectReasonType, // 'THIEU_NHAN_LUC' | 'LY_DO_KHAC'
            rejectNote,
            // Dành cho TCCB điều chỉnh:
            approvedDays,
            approvedStartDate,
            approvedEndDate,
            tccbNote
        } = body;

        if (!requestId || !action) {
            return NextResponse.json({ error: 'Thiếu thông tin yêu cầu' }, { status: 400 });
        }

        const leaveReq = await prisma.staffLeaveRequest.findUnique({
            where: { id: requestId },
            include: { staff: true }
        });

        if (!leaveReq) {
            return NextResponse.json({ error: 'Không tìm thấy đơn nghỉ phép' }, { status: 404 });
        }

        const updateData: any = {};

        // 1. Lãnh đạo Khoa duyệt ý kiến
        if (action === 'DEPT_APPROVE') {
            updateData.status = 'PENDING_TCCB';
            updateData.deptApproverId = currentUser.staffId || currentUser.id;
            updateData.deptApprovedAt = new Date();
            updateData.deptComment = deptComment || 'Đồng ý cho nghỉ phép theo kế hoạch khoa';
        } else if (action === 'DEPT_REJECT') {
            updateData.status = 'REJECTED';
            updateData.deptApproverId = currentUser.staffId || currentUser.id;
            updateData.deptApprovedAt = new Date();
            updateData.deptComment = deptComment || rejectNote || 'Khoa không bố trí được người thay thế';
            updateData.rejectReasonType = rejectReasonType || 'LY_DO_KHAC';
            updateData.rejectNote = rejectNote || deptComment;
            // Nếu từ chối do thiếu nhân lực chuyên môn -> Đánh dấu đủ điều kiện xem xét trả tiền
            if (rejectReasonType === 'THIEU_NHAN_LUC') {
                updateData.isEligibleForCashPayout = true;
            }
        } 
        // 2. Phòng TCCB thẩm tra & có quyền chỉnh sửa số ngày được nghỉ
        else if (action === 'TCCB_REVIEW') {
            updateData.status = 'PENDING_DIRECTOR'; // Đã thẩm tra xong, sẵn sàng in mẫu trình Lãnh đạo ký
            updateData.tccbApproverId = currentUser.staffId || currentUser.id;
            updateData.tccbApprovedAt = new Date();
            updateData.tccbNote = tccbNote || null;
            
            // Số ngày và khoảng thời gian do TCCB điều chỉnh (nếu có, không thì lấy mặc định ban đầu)
            updateData.approvedDays = typeof approvedDays === 'number' ? approvedDays : leaveReq.requestedDays;
            updateData.approvedStartDate = approvedStartDate || leaveReq.requestedStartDate;
            updateData.approvedEndDate = approvedEndDate || leaveReq.requestedEndDate;
        } else if (action === 'TCCB_REJECT') {
            updateData.status = 'REJECTED';
            updateData.tccbApproverId = currentUser.staffId || currentUser.id;
            updateData.tccbApprovedAt = new Date();
            updateData.tccbNote = tccbNote || rejectNote || 'Phòng TCCB không phê duyệt đơn';
            updateData.rejectReasonType = rejectReasonType || 'LY_DO_KHAC';
            updateData.rejectNote = rejectNote || tccbNote;
            if (rejectReasonType === 'THIEU_NHAN_LUC') {
                updateData.isEligibleForCashPayout = true;
            }
        }

        const updated = await prisma.staffLeaveRequest.update({
            where: { id: requestId },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            request: updated
        });
    } catch (error: any) {
        console.error('Lỗi PUT review leave-management:', error);
        return NextResponse.json({ error: error.message || 'Lỗi xử lý đơn' }, { status: 500 });
    }
}
