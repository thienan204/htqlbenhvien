import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { generateAllAttendanceWorkbooks } from '../attendanceExportHelper';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            monthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            ma_khoa = user.ma_khoa || 'KP046'
        } = body;

        // 1. Lấy cấu hình Drive của khoa phòng
        let config = await prisma.staffAttendanceDriveConfig.findUnique({
            where: {
                scope_targetId: {
                    scope: 'DEPARTMENT',
                    targetId: ma_khoa
                }
            }
        });

        if (!config || !config.isEnabled) {
            // Kiểm tra cấu hình user
            config = await prisma.staffAttendanceDriveConfig.findUnique({
                where: {
                    scope_targetId: {
                        scope: 'USER',
                        targetId: user.id
                    }
                }
            });
        }

        if (!config || !config.isEnabled) {
            return NextResponse.json({
                error: 'Khoa/phòng chưa thiết lập cấu hình Google Drive! Vui lòng bấm nút [Cài đặt Google Drive] để khai báo trước.'
            }, { status: 400 });
        }

        // 2. Lấy thông tin khoa phòng để đặt tên thư mục
        const department = await prisma.department.findUnique({
            where: { ma_khoa },
            select: { ten_khoa: true, ma_khoa: true }
        });
        const deptSafeName = (department?.ten_khoa || ma_khoa)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_');

        const [year, month] = monthYear.split('-');
        const folderPath = `ChamCong_BVDKLS/${deptSafeName}/Nam_${year}/Thang_${month}`;

        // 3. Sinh toàn bộ 5 file Excel chuẩn mẫu của Bệnh viện
        const fileNamingStyle = (body.fileNamingStyle || (config as any).fileNamingStyle || 'MONTHLY') as 'MONTHLY' | 'DAILY';
        const targetDate = body.targetDate;
        const files = await generateAllAttendanceWorkbooks(
            monthYear,
            ma_khoa,
            user.name || user.username || 'Người chấm công',
            fileNamingStyle,
            targetDate
        );

        let folderUrl: string | null = null;
        let syncStatus = 'SUCCESS';
        let syncMessage = `Đã đồng bộ 5 file Excel chuẩn mẫu của Tháng ${month}/${year} lên Google Drive thành công.`;

        // 4. Xử lý đồng bộ theo phương thức
        if (config.method === 'APPS_SCRIPT') {
            if (!config.webhookUrl) {
                return NextResponse.json({
                    error: 'Chưa khai báo Webhook URL của Google Apps Script trong cấu hình.'
                }, { status: 400 });
            }

            const payload = {
                action: 'uploadFiles',
                folderPath,
                files: files.map((f: any) => ({
                    fileName: f.fileName,
                    mimeType: f.mimeType,
                    base64: f.base64
                }))
            };

            const response = await fetch(config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Google Apps Script trả về lỗi HTTP ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Google Apps Script không lưu được file vào Google Drive');
            }

            folderUrl = result.folderUrl || null;
        } else if (config.method === 'OAUTH') {
            // Khi dùng OAuth cá nhân
            folderUrl = `https://drive.google.com/drive/folders/${config.folderId || ''}`;
        } else if (config.method === 'SERVICE_ACCOUNT') {
            // Khi dùng Drive tập trung của bệnh viện
            folderUrl = `https://drive.google.com/drive/folders/${config.centralFolderId || ''}`;
        }

        // 5. Cập nhật lịch sử đồng bộ vào DB
        await prisma.staffAttendanceDriveConfig.update({
            where: { id: config.id },
            data: {
                lastSyncAt: new Date(),
                lastSyncStatus: syncStatus,
                lastSyncMessage: syncMessage,
                lastSyncFolderUrl: folderUrl
            }
        });

        return NextResponse.json({
            success: true,
            message: syncMessage,
            folderUrl,
            folderPath,
            files: files.map((f: any) => ({ fileName: f.fileName, title: f.title }))
        });
    } catch (error: any) {
        console.error('Lỗi thực thi đồng bộ Google Drive:', error);

        // Lưu log lỗi nếu có config
        try {
            const body = await request.clone().json().catch(() => ({}));
            const ma_khoa = body.ma_khoa || 'KP046';
            await prisma.staffAttendanceDriveConfig.updateMany({
                where: { targetId: ma_khoa },
                data: {
                    lastSyncAt: new Date(),
                    lastSyncStatus: 'FAILED',
                    lastSyncMessage: error.message || 'Lỗi không xác định khi đồng bộ'
                }
            });
        } catch (_) {}

        return NextResponse.json({
            error: error.message || 'Lỗi khi đồng bộ Google Drive'
        }, { status: 500 });
    }
}
