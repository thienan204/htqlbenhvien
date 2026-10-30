import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/actions/auth';
import prisma from '@/lib/prisma';
import { getApiMetrics, getServerRuntimeInfo, checkSslCertificate } from '@/lib/system-monitor-core';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== 'ADMIN' && user.role !== 'CNTT')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const isRefresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true';

        // 1. Kiểm tra kết nối Database & đo độ trễ Ping
        const startDb = Date.now();
        let dbStatus: 'UP' | 'DOWN' = 'UP';
        let dbLatencyMs = 0;
        let dbError: string | null = null;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbLatencyMs = Date.now() - startDb;
        } catch (err: any) {
            dbStatus = 'DOWN';
            dbError = err.message || 'Lỗi kết nối CSDL';
        }

        // 2. Lấy thông tin Server Runtime (Uptime, RAM, OS, Node)
        const serverInfo = getServerRuntimeInfo();

        // 3. Lấy số liệu API Traffic từ bộ đệm In-Memory
        const apiTraffic = getApiMetrics();

        // 4. Kiểm tra chứng chỉ bảo mật HTTPS (SSL/TLS)
        const ssl = await checkSslCertificate({ forceRefresh: isRefresh });

        // 5. Lấy các chỉ số nghiệp vụ vận hành hôm nay
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

        let businessCounters = {
            itRequestsToday: 0,
            itRequestsInProgress: 0,
            itRequestsResolvedToday: 0,
            totalUsers: 0,
            activeRulesCount: 0
        };

        if (dbStatus === 'UP') {
            try {
                const [
                    itRequestsToday,
                    itRequestsInProgress,
                    itRequestsResolvedToday,
                    totalUsers,
                    activeRulesCount
                ] = await Promise.all([
                    prisma.iTRequest.count({ where: { createdAt: { gte: startOfDay } } }),
                    prisma.iTRequest.count({ where: { status: 'IN_PROGRESS' } }),
                    prisma.iTRequest.count({ where: { status: 'RESOLVED', updatedAt: { gte: startOfDay } } }),
                    prisma.user.count({ where: { isActive: true } }),
                    prisma.specializedRule.count({ where: { isActive: true } })
                ]);

                businessCounters = {
                    itRequestsToday,
                    itRequestsInProgress,
                    itRequestsResolvedToday,
                    totalUsers,
                    activeRulesCount
                };
            } catch (bErr) {
                console.error('Lỗi lấy chỉ số nghiệp vụ:', bErr);
            }
        }

        const isSslCriticalOrExpired = ssl.status === 'CRITICAL' || ssl.status === 'EXPIRED';
        const overallStatus = (dbStatus === 'UP' && !isSslCriticalOrExpired) ? 'HEALTHY' : 'DEGRADED';

        const checkedAtFormatted = now.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        return NextResponse.json({
            status: overallStatus,
            checkedAt: checkedAtFormatted,
            timestamp: now.toISOString(),
            database: {
                status: dbStatus,
                latencyMs: dbLatencyMs,
                error: dbError
            },
            server: serverInfo,
            ssl,
            businessCounters,
            apiTraffic
        });
    } catch (error: any) {
        console.error('Lỗi API system-health:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
