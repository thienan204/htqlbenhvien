import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const menus = await prisma.menu.findMany({
            orderBy: [
                { parentId: 'asc' },
                { order: 'asc' },
            ],
        });
        return NextResponse.json(menus);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await req.json();
        
        // Ensure no empty strings for optional fields
        if (data.permissionCode === '') data.permissionCode = null;
        if (data.path === '') data.path = null;
        if (data.targetPath === '') data.targetPath = null;
        if (data.icon === '') data.icon = null;
        if (data.parentId === '') data.parentId = null;
        if (data.isSpecialGroup === '') data.isSpecialGroup = null;

        const newMenu = await prisma.menu.create({
            data: {
                title: data.title,
                path: data.path,
                targetPath: data.targetPath,
                icon: data.icon,
                parentId: data.parentId,
                order: data.order || 0,
                permissionCode: data.permissionCode,
                isActive: data.isActive !== undefined ? data.isActive : true,
                isAdminOnly: data.isAdminOnly !== undefined ? Boolean(data.isAdminOnly) : false,
                status: data.status || 'OFFICIAL',
                isSpecialGroup: data.isSpecialGroup,
                showInPaths: data.showInPaths || [],
            } as any
        });

        // Tự động tạo Tài liệu Hướng dẫn sử dụng & Nhật ký thay đổi v1.0 nếu có path
        if (data.path && data.path.trim() !== '') {
            const pagePath = data.path.trim();
            const instructionContent = data.initialInstruction || `<h3>Hướng dẫn sử dụng: ${data.title}</h3>
<p>Chức năng được khởi tạo phục vụ công tác chuyên môn tại Bệnh viện Đa khoa Lạng Sơn.</p>
<h4>I. Mục đích & Phạm vi:</h4>
<p>Hỗ trợ khoa phòng thực hiện các nghiệp vụ liên quan đến ${data.title}.</p>
<h4>II. Các bước thao tác:</h4>
<ol>
  <li>Truy cập vào menu <strong>${data.title}</strong> trên thanh điều hướng.</li>
  <li>Xem thông tin hoặc nhập dữ liệu theo yêu cầu biểu mẫu.</li>
  <li>Bấm nút xác nhận / lưu để hoàn thành.</li>
</ol>
<h4>III. Hỗ trợ kỹ thuật:</h4>
<p>Mọi vướng mắc xin liên hệ Phòng Công nghệ Thông tin (Ext: 115).</p>`;

            try {
                // Upsert PageInstruction
                await prisma.pageInstruction.upsert({
                    where: { pageId: pagePath },
                    update: {
                        title: `Hướng dẫn: ${data.title}`,
                        content: instructionContent,
                        showOnPage: true
                    },
                    create: {
                        pageId: pagePath,
                        title: `Hướng dẫn: ${data.title}`,
                        content: instructionContent,
                        showOnPage: true
                    }
                });

                // Tạo bản ghi FeatureChangeLog khởi tạo đầu tiên
                await (prisma as any).featureChangeLog.create({
                    data: {
                        pagePath,
                        version: 'v1.0.0',
                        title: `Khởi tạo chức năng mới: ${data.title}`,
                        changeType: 'FEATURE',
                        status: data.status || 'OFFICIAL',
                        content: `Hệ thống chính thức khởi tạo chức năng ${data.title} kèm tài liệu hướng dẫn sử dụng ban đầu.`,
                        reason: 'Triển khai mới theo danh mục chức năng bệnh viện',
                        author: user.name || user.username || 'Phòng CNTT',
                        appliedAt: new Date()
                    }
                });
            } catch (instError) {
                console.error('Lỗi khi tự động khởi tạo tài liệu cho menu mới:', instError);
            }
        }
        
        return NextResponse.json(newMenu);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Batch update for reordering / drag and drop
export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await req.json();
        
        if (Array.isArray(data)) {
            // Batch update
            for (const item of data) {
                await prisma.menu.update({
                    where: { id: item.id },
                    data: {
                        parentId: item.parentId,
                        order: item.order,
                    }
                });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid data format, expected array of {id, parentId, order}' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
