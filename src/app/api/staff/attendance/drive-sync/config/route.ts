import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const ma_khoa = searchParams.get('ma_khoa') || user.ma_khoa || 'KP046';

        // Lấy cấu hình theo khoa phòng
        let config = await prisma.staffAttendanceDriveConfig.findUnique({
            where: {
                scope_targetId: {
                    scope: 'DEPARTMENT',
                    targetId: ma_khoa
                }
            }
        });

        // Nếu chưa có cấu hình theo khoa, kiểm tra cấu hình cá nhân user
        if (!config) {
            config = await prisma.staffAttendanceDriveConfig.findUnique({
                where: {
                    scope_targetId: {
                        scope: 'USER',
                        targetId: user.id
                    }
                }
            });
        }

        // Kiểm tra xem hệ thống có cấu hình Service Account / Drive chung toàn viện không
        const systemDriveRule = await prisma.specializedRule.findUnique({
            where: { slug: 'hospital-google-drive-config' }
        });

        return NextResponse.json({
            config: config || null,
            hasSystemDrive: Boolean(systemDriveRule?.logicConfig)
        });
    } catch (error: any) {
        console.error('Lỗi lấy cấu hình Google Drive:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await request.json();
        const {
            scope = 'DEPARTMENT',
            targetId,
            method = 'APPS_SCRIPT',
            isEnabled = true,
            webhookUrl,
            oauthEmail,
            folderId,
            centralFolderId,
            notifyEmail,
            autoSyncOnLock = true
        } = body;

        const effectiveTargetId = targetId || (scope === 'DEPARTMENT' ? (user.ma_khoa || 'KP046') : user.id);

        const updated = await prisma.staffAttendanceDriveConfig.upsert({
            where: {
                scope_targetId: {
                    scope,
                    targetId: effectiveTargetId
                }
            },
            update: {
                method,
                isEnabled,
                webhookUrl: webhookUrl ? webhookUrl.trim() : null,
                oauthEmail: oauthEmail ? oauthEmail.trim() : null,
                folderId: folderId ? folderId.trim() : null,
                centralFolderId: centralFolderId ? centralFolderId.trim() : null,
                notifyEmail: notifyEmail ? notifyEmail.trim() : null,
                autoSyncOnLock
            },
            create: {
                scope,
                targetId: effectiveTargetId,
                method,
                isEnabled,
                webhookUrl: webhookUrl ? webhookUrl.trim() : null,
                oauthEmail: oauthEmail ? oauthEmail.trim() : null,
                folderId: folderId ? folderId.trim() : null,
                centralFolderId: centralFolderId ? centralFolderId.trim() : null,
                notifyEmail: notifyEmail ? notifyEmail.trim() : null,
                autoSyncOnLock
            }
        });

        return NextResponse.json({ success: true, config: updated });
    } catch (error: any) {
        console.error('Lỗi lưu cấu hình Google Drive:', error);
        return NextResponse.json({ error: error.message || 'Lỗi server' }, { status: 500 });
    }
}

