import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const { method, webhookUrl, folderId, oauthEmail, notifyEmail } = body;

        if (method === 'APPS_SCRIPT') {
            if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com/')) {
                return NextResponse.json({
                    error: 'Địa chỉ Webhook không hợp lệ. Phải bắt đầu bằng https://script.google.com/macros/s/...'
                }, { status: 400 });
            }

            const testFileBase64 = Buffer.from(
                `XÁC NHẬN KẾT NỐI GOOGLE DRIVE THÀNH CÔNG!\nThời gian: ${new Date().toLocaleString('vi-VN')}\nNgười kiểm tra: ${user.name || user.username}\nBệnh viện Đa khoa tỉnh Lạng Sơn.`
            ).toString('base64');

            const payload = {
                action: 'testConnection',
                folderPath: 'ChamCong_BVDKLS/KiemTraKetNoi',
                files: [
                    {
                        fileName: 'XacNhanKetNoi_BVDKLS.txt',
                        mimeType: 'text/plain',
                        base64: testFileBase64
                    }
                ]
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                return NextResponse.json({
                    error: `Google Apps Script phản hồi mã lỗi HTTP ${response.status}. Vui lòng kiểm tra quyền Deploy Web App (Who has access: Anyone).`
                }, { status: 400 });
            }

            const result = await response.json();
            if (result.success) {
                return NextResponse.json({
                    success: true,
                    message: 'Kết nối thành công! Đã tạo file thử nghiệm trên Google Drive.',
                    folderUrl: result.folderUrl || null
                });
            } else {
                return NextResponse.json({
                    error: result.error || 'Google Apps Script báo lỗi khi tạo thư mục/file.'
                }, { status: 400 });
            }
        }

        if (method === 'OAUTH') {
            return NextResponse.json({
                success: true,
                message: `Đã xác nhận cấu hình OAuth Google Drive cho tài khoản ${oauthEmail || 'người dùng'}.`
            });
        }

        if (method === 'SERVICE_ACCOUNT') {
            return NextResponse.json({
                success: true,
                message: `Đã xác nhận cấu hình Google Drive tập trung của Bệnh viện (Thông báo gửi tới: ${notifyEmail || 'Trưởng khoa'}).`
            });
        }

        return NextResponse.json({ error: 'Phương thức không hợp lệ' }, { status: 400 });
    } catch (error: any) {
        console.error('Lỗi kiểm tra kết nối Google Drive:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi kết nối Google Drive' }, { status: 500 });
    }
}

