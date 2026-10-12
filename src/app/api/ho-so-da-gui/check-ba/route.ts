import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// In-memory Server Cache để phản hồi tức thì (0ms - 1ms)
interface CacheEntry {
    timestamp: number;
    data: any;
}
const serverCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
const NEGATIVE_CACHE_TTL_MS = 30 * 1000; // 30 giây cho mã không tìm thấy
const MAX_CACHE_SIZE = 1000;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code')?.trim();

        if (!code || code.length < 3) {
            return NextResponse.json({ exists: false });
        }

        const cacheKey = code.toUpperCase();
        const now = Date.now();

        // 1. Kiểm tra cache trên Server
        const cached = serverCache.get(cacheKey);
        if (cached && now - cached.timestamp < (cached.data.exists ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS)) {
            return NextResponse.json(cached.data);
        }

        // 2. Tạo danh sách các biến thể mã khả dĩ
        const codeUpper = cacheKey;
        const digitsOnly = codeUpper.replace(/\D/g, '');
        const strippedZeros = digitsOnly.replace(/^0+/, '');

        const candidatesSet = new Set<string>();
        candidatesSet.add(code);
        candidatesSet.add(codeUpper);
        candidatesSet.add(code.toLowerCase());

        if (digitsOnly) {
            candidatesSet.add(digitsOnly);
            candidatesSet.add(`BA${digitsOnly}`);
            candidatesSet.add(`ba${digitsOnly}`);
        }
        if (strippedZeros && strippedZeros !== digitsOnly) {
            candidatesSet.add(strippedZeros);
            candidatesSet.add(`BA${strippedZeros}`);
            candidatesSet.add(`ba${strippedZeros}`);
        }

        const candidates = Array.from(candidatesSet);

        // 3. Truy vấn bảng HoSoDaGui dùng toán tử IN để tận dụng B-tree Index (thời gian ~ 1-3ms)
        const record = await prisma.hoSoDaGui.findFirst({
            where: {
                OR: [
                    { maLienKet: { in: candidates } },
                    { maBN: { in: candidates } }
                ]
            },
            select: {
                id: true,
                maLienKet: true,
                maBN: true,
                hoTen: true,
                ngayRa: true,
                ngayDeNghiTT: true,
                trangThaiTT: true,
                trangThaiHS: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        let result: any;
        if (record) {
            const hasPaymentRequest = Boolean(
                (record.ngayDeNghiTT && record.ngayDeNghiTT.trim() !== '') ||
                (record.trangThaiTT && /đề nghị thanh toán|đã thanh toán|quyết toán/i.test(record.trangThaiTT))
            );

            result = {
                exists: true,
                data: record,
                hasPaymentRequest
            };
        } else {
            result = { exists: false };
        }

        // 4. Lưu Cache Server (dọn bớt nếu vượt dung lượng)
        if (serverCache.size >= MAX_CACHE_SIZE) {
            const firstKey = serverCache.keys().next().value;
            if (firstKey) serverCache.delete(firstKey);
        }
        serverCache.set(cacheKey, { timestamp: now, data: result });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Lỗi khi tra cứu mã bệnh án trong HoSoDaGui:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

