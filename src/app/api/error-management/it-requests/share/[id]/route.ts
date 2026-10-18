import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID yêu cầu' }, { status: 400 });
        }

        const ticket = await prisma.iTRequest.findUnique({
            where: { id }
        });

        if (!ticket) {
            return NextResponse.json({ error: 'Không tìm thấy phiếu yêu cầu' }, { status: 404 });
        }

        // Lấy tên khoa phòng
        let deptName = ticket.ma_khoa;
        if (ticket.ma_khoa) {
            const dept = await prisma.department.findFirst({
                where: { ma_khoa: ticket.ma_khoa },
                select: { ten_khoa: true }
            });
            if (dept) deptName = dept.ten_khoa;
        }

        // Lấy thông tin kỹ thuật viên phụ trách
        let assigneeName = 'Chưa phân công';
        let assigneePhone = null;
        if (ticket.assigneeId) {
            const assignee = await prisma.user.findUnique({
                where: { id: ticket.assigneeId },
                select: {
                    name: true,
                    username: true,
                    staff: {
                        select: { so_dien_thoai: true }
                    }
                }
            });
            if (assignee) {
                assigneeName = assignee.name || assignee.username;
                assigneePhone = assignee.staff?.so_dien_thoai || null;
            }
        }

        const dynamic = (ticket.dynamicFields as any) || {};
        const nguoiBao = dynamic['Người báo'] || null;
        const sdt = dynamic['SĐT'] || null;
        const dynamicFiles = Array.isArray(dynamic['Tệp đính kèm']) 
            ? dynamic['Tệp đính kèm'] 
            : (Array.isArray(dynamic['Hình ảnh đính kèm']) ? dynamic['Hình ảnh đính kèm'] : []);
        const itImages = Array.isArray(ticket.it_images) ? ticket.it_images : [];

        return NextResponse.json({
            id: ticket.id,
            ten_loi: ticket.ten_loi,
            ma_ba: ticket.ma_ba,
            category: ticket.category,
            status: ticket.status,
            ma_khoa: ticket.ma_khoa,
            ten_khoa: deptName,
            nguoi_bao: nguoiBao,
            sdt: sdt,
            assigneeName,
            assigneePhone,
            vendorName: ticket.vendorName,
            vendorTicketCode: ticket.vendorTicketCode,
            vendorSentAt: ticket.vendorSentAt,
            vendorExpectedReturnAt: ticket.vendorExpectedReturnAt,
            it_note: ticket.it_note,
            dynamicFiles,
            it_images: itImages,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
    } catch (error: any) {
        console.error('Lỗi lấy thông tin phiếu chia sẻ:', error);
        return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
    }
}
