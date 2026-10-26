// Module giám sát sức khỏe hệ thống & lưu lượng API (In-Memory Singleton)
// Thiết kế độc lập, không phụ thuộc CSDL, chạy an toàn trên cả Node.js và Edge Runtime

export interface ApiHitRecord {
    id: string;
    timestamp: string;
    timeStr: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    ip?: string;
    userAgent?: string;
}

export interface EndpointStat {
    path: string;
    method: string;
    hitCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    lastHitAt: string;
}

interface MonitorStore {
    startTime: number;
    currentDateStr: string;
    totalRequestsToday: number;
    totalRequestsAllTime: number;
    byMethod: Record<string, number>;
    byStatusGroup: {
        success2xx: number;
        clientError4xx: number;
        serverError5xx: number;
        other: number;
    };
    hourlyDistribution: number[]; // 24 khung giờ
    endpointsMap: Record<string, EndpointStat>;
    recentLogs: ApiHitRecord[];
}

const getTodayDateStr = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const createInitialStore = (): MonitorStore => ({
    startTime: Date.now(),
    currentDateStr: getTodayDateStr(),
    totalRequestsToday: 0,
    totalRequestsAllTime: 0,
    byMethod: { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 },
    byStatusGroup: {
        success2xx: 0,
        clientError4xx: 0,
        serverError5xx: 0,
        other: 0
    },
    hourlyDistribution: new Array(24).fill(0),
    endpointsMap: {},
    recentLogs: []
});

declare global {
    var __SYSTEM_MONITOR_STORE__: MonitorStore | undefined;
}

const getStore = (): MonitorStore => {
    if (!globalThis.__SYSTEM_MONITOR_STORE__) {
        globalThis.__SYSTEM_MONITOR_STORE__ = createInitialStore();
    }
    
    // Tự động kiểm tra sang ngày mới để làm mới thống kê trong ngày
    const today = getTodayDateStr();
    if (globalThis.__SYSTEM_MONITOR_STORE__.currentDateStr !== today) {
        globalThis.__SYSTEM_MONITOR_STORE__.currentDateStr = today;
        globalThis.__SYSTEM_MONITOR_STORE__.totalRequestsToday = 0;
        globalThis.__SYSTEM_MONITOR_STORE__.hourlyDistribution = new Array(24).fill(0);
        globalThis.__SYSTEM_MONITOR_STORE__.byMethod = { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 };
        globalThis.__SYSTEM_MONITOR_STORE__.byStatusGroup = {
            success2xx: 0,
            clientError4xx: 0,
            serverError5xx: 0,
            other: 0
        };
        // Reset hit count hàng ngày của các endpoint
        Object.values(globalThis.__SYSTEM_MONITOR_STORE__.endpointsMap).forEach(ep => {
            ep.hitCount = 0;
            ep.totalDurationMs = 0;
            ep.avgDurationMs = 0;
            ep.status2xx = 0;
            ep.status4xx = 0;
            ep.status5xx = 0;
        });
    }

    return globalThis.__SYSTEM_MONITOR_STORE__;
};

/**
 * Ghi nhận một lượt gọi API (cực nhanh, không chặn luồng)
 */
export function recordApiHit(data: {
    method: string;
    path: string;
    status?: number;
    durationMs?: number;
    ip?: string;
    userAgent?: string;
}) {
    try {
        const store = getStore();
        const now = new Date();
        const hour = now.getHours();
        const method = (data.method || 'GET').toUpperCase();
        const path = data.path || '/';
        const status = data.status || 200;
        const duration = Math.max(1, Math.round(data.durationMs || 10));

        store.totalRequestsToday++;
        store.totalRequestsAllTime++;

        // Phương thức HTTP
        store.byMethod[method] = (store.byMethod[method] || 0) + 1;

        // Mã phản hồi HTTP
        if (status >= 200 && status < 300) store.byStatusGroup.success2xx++;
        else if (status >= 400 && status < 500) store.byStatusGroup.clientError4xx++;
        else if (status >= 500) store.byStatusGroup.serverError5xx++;
        else store.byStatusGroup.other++;

        // Phân bổ theo giờ
        if (hour >= 0 && hour < 24) {
            store.hourlyDistribution[hour] = (store.hourlyDistribution[hour] || 0) + 1;
        }

        // Thống kê theo endpoint
        // Chuẩn hóa path: rút gọn các ID dạng cuid/uuid ở cuối để gom nhóm
        const cleanPath = path.replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:id');
        const epKey = `${method} ${cleanPath}`;
        if (!store.endpointsMap[epKey]) {
            store.endpointsMap[epKey] = {
                path: cleanPath,
                method,
                hitCount: 0,
                totalDurationMs: 0,
                avgDurationMs: 0,
                status2xx: 0,
                status4xx: 0,
                status5xx: 0,
                lastHitAt: now.toLocaleTimeString('vi-VN')
            };
        }

        const ep = store.endpointsMap[epKey];
        ep.hitCount++;
        ep.totalDurationMs += duration;
        ep.avgDurationMs = Math.round(ep.totalDurationMs / ep.hitCount);
        if (status >= 200 && status < 300) ep.status2xx++;
        else if (status >= 400 && status < 500) ep.status4xx++;
        else if (status >= 500) ep.status5xx++;
        ep.lastHitAt = now.toLocaleTimeString('vi-VN');

        // Lưu bản ghi nhật ký gần nhất (giữ tối đa 100 bản ghi)
        const logItem: ApiHitRecord = {
            id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: now.toISOString(),
            timeStr: now.toLocaleTimeString('vi-VN'),
            method,
            path,
            status,
            durationMs: duration,
            ip: data.ip || '127.0.0.1',
            userAgent: (data.userAgent || '').slice(0, 80)
        };

        store.recentLogs.unshift(logItem);
        if (store.recentLogs.length > 300) {
            store.recentLogs.pop();
        }
    } catch (err) {
        // Không bao giờ để lỗi giám sát làm ảnh hưởng ứng dụng
    }
}

/**
 * Lấy toàn bộ số liệu giám sát API
 */
export function getApiMetrics() {
    const store = getStore();
    const totalToday = store.totalRequestsToday;
    const successCount = store.byStatusGroup.success2xx;
    const successRatePercent = totalToday > 0 
        ? Math.round((successCount / totalToday) * 1000) / 10 
        : 100;

    // Sắp xếp các endpoint theo số lượt gọi (hỗ trợ hiển thị đầy đủ lên đến 100 endpoint)
    const topEndpoints = Object.values(store.endpointsMap)
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, 100);

    // Tính tốc độ trung bình toàn hệ thống
    const totalDuration = topEndpoints.reduce((sum, ep) => sum + ep.totalDurationMs, 0);
    const totalHits = topEndpoints.reduce((sum, ep) => sum + ep.hitCount, 0);
    const avgLatencyMs = totalHits > 0 ? Math.round(totalDuration / totalHits) : 15;

    return {
        totalRequestsToday: totalToday,
        totalRequestsAllTime: store.totalRequestsAllTime,
        successRatePercent,
        avgLatencyMs,
        byMethod: store.byMethod,
        byStatusGroup: store.byStatusGroup,
        hourlyDistribution: store.hourlyDistribution,
        topEndpoints,
        recentLogs: store.recentLogs
    };
}

/**
 * Lấy thông tin Uptime và RAM của máy chủ
 */
export function getServerRuntimeInfo() {
    const store = getStore();
    const uptimeSeconds = Math.floor((Date.now() - store.startTime) / 1000);

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    let uptimeFormatted = '';
    if (days > 0) uptimeFormatted += `${days} ngày `;
    if (hours > 0 || days > 0) uptimeFormatted += `${hours} giờ `;
    uptimeFormatted += `${minutes} phút ${seconds} giây`;

    // Thông tin bộ nhớ RAM
    let memory = {
        heapUsedMB: 0,
        heapTotalMB: 0,
        heapLimitMB: 4096,
        rssMB: 0,
        percentHeapUsed: 0
    };

    if (typeof process !== 'undefined' && process.memoryUsage) {
        const mem = process.memoryUsage();
        const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
        const heapUsedMB = toMB(mem.heapUsed);
        const heapTotalMB = toMB(mem.heapTotal);
        
        let heapLimitMB = 4096;
        try {
            // Lấy giới hạn bộ nhớ tối đa từ V8 Engine
            const v8 = require('v8');
            const stats = v8.getHeapStatistics();
            if (stats && stats.heap_size_limit) {
                heapLimitMB = Math.round(stats.heap_size_limit / 1024 / 1024);
            }
        } catch (e) {}

        const percentHeapUsed = heapLimitMB > 0 
            ? Math.round((heapUsedMB / heapLimitMB) * 1000) / 10 
            : 0;

        memory = {
            heapUsedMB,
            heapTotalMB,
            heapLimitMB,
            rssMB: toMB(mem.rss),
            percentHeapUsed
        };
    }

    return {
        uptimeSeconds,
        uptimeFormatted,
        startTime: new Date(store.startTime).toLocaleString('vi-VN'),
        nodeVersion: typeof process !== 'undefined' ? process.version : 'Node.js',
        platform: typeof process !== 'undefined' ? `${process.platform} (${process.arch})` : 'Server',
        pid: typeof process !== 'undefined' ? process.pid : 0,
        memory
    };
}
