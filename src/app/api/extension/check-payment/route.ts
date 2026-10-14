import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// CORS Headers cho phép Extension trên HIS gọi Cross-Origin mà không bị chặn
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// In-memory Server Cache để phản hồi siêu tốc (< 2ms) cho Extension
interface CacheEntry {
    timestamp: number;
    data: any;
}
const serverCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 phút cho hồ sơ tìm thấy
const NEGATIVE_CACHE_TTL_MS = 20 * 1000; // 20 giây cho mã không tìm thấy
const MAX_CACHE_SIZE = 2000;

// Hàm tạo danh sách các biến thể mã có thể có trên HIS
function generateCodeCandidates(rawInput: string): string[] {
    const trimmed = rawInput.trim();
    const upper = trimmed.toUpperCase();
    const digitsOnly = upper.replace(/\D/g, '');
    const strippedZeros = digitsOnly.replace(/^0+/, '');

    const candidatesSet = new Set<string>();
    candidatesSet.add(trimmed);
    candidatesSet.add(upper);
    candidatesSet.add(trimmed.toLowerCase());

    if (digitsOnly) {
        candidatesSet.add(digitsOnly);
        candidatesSet.add(`BA${digitsOnly}`);
        candidatesSet.add(`ba${digitsOnly}`);

        // Đệm số 0 ở đầu cho đủ 8, 9, 10 ký tự số (dạng phổ biến trên HIS: BA000123456)
        for (const len of [8, 9, 10]) {
            if (digitsOnly.length < len) {
                const padded = digitsOnly.padStart(len, '0');
                candidatesSet.add(padded);
                candidatesSet.add(`BA${padded}`);
                candidatesSet.add(`ba${padded}`);
            }
        }
    }

    if (strippedZeros && strippedZeros !== digitsOnly) {
        candidatesSet.add(strippedZeros);
        candidatesSet.add(`BA${strippedZeros}`);
        candidatesSet.add(`ba${strippedZeros}`);

        for (const len of [8, 9, 10]) {
            if (strippedZeros.length < len) {
                const padded = strippedZeros.padStart(len, '0');
                candidatesSet.add(padded);
                candidatesSet.add(`BA${padded}`);
                candidatesSet.add(`ba${padded}`);
            }
        }
    }

    // Trường hợp có ký tự phân tách như BA.12345 hoặc BA-12345
    const cleanPrefix = upper.replace(/[^A-Z0-9]/g, '');
    if (cleanPrefix) {
        candidatesSet.add(cleanPrefix);
    }

    return Array.from(candidatesSet);
}

// Xử lý truy vấn HoSoDaGui
async function lookupPaymentStatus(code: string) {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length < 2) {
        return {
            success: false,
            exists: false,
            isDaDeNghiTT: false,
            statusTag: 'MA_KHONG_HOP_LE',
            message: 'Mã tra cứu không hợp lệ (tối thiểu 2 ký tự).'
        };
    }

    const cacheKey = trimmed.toUpperCase();
    const now = Date.now();

    // 1. Kiểm tra Cache
    const cached = serverCache.get(cacheKey);
    if (cached && now - cached.timestamp < (cached.data.exists ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS)) {
        return cached.data;
    }

    // 2. Tạo danh sách biến thể mã
    const candidates = generateCodeCandidates(trimmed);

    // 3. Truy vấn bảng HoSoDaGui trong CSDL (Khớp nhanh bằng B-tree index IN)
    const selectFields = {
        id: true,
        maLienKet: true,
        maBN: true,
        maThe: true,
        hoTen: true,
        ngaySinh: true,
        gioiTinh: true,
        ngayVao: true,
        ngayRa: true,
        chanDoan: true,
        tongChi: true,
        benhNhanTT: true,
        baoHiemTT: true,
        ngayTT: true,
        ngayGuiHS: true,
        ngayDeNghiTT: true,
        trangThaiTT: true,
        trangThaiHS: true,
        loaiHS: true
    };

    let record = await prisma.hoSoDaGui.findFirst({
        where: {
            OR: [
                { maBN: { in: candidates } },
                { maLienKet: { in: candidates } }
            ]
        },
        select: selectFields,
        orderBy: {
            createdAt: 'desc'
        }
    });

    // Fallback: Nếu chưa tìm thấy và chuỗi số có độ dài >= 6, thử tìm endsWith
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (!record && digitsOnly.length >= 6) {
        record = await prisma.hoSoDaGui.findFirst({
            where: {
                OR: [
                    { maBN: { endsWith: digitsOnly } },
                    { maLienKet: { endsWith: digitsOnly } }
                ]
            },
            select: selectFields,
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    let result: any;

    if (record) {
        const isDaDeNghiTT = Boolean(
            (record.ngayDeNghiTT && record.ngayDeNghiTT.trim() !== '') ||
            (record.trangThaiTT && /đề nghị thanh toán|đã thanh toán|quyết toán/i.test(record.trangThaiTT))
        );

        if (isDaDeNghiTT) {
            result = {
                success: true,
                exists: true,
                isDaDeNghiTT: true,
                statusTag: 'DA_DE_NGHI_TT',
                message: `⚠️ Bệnh án ĐÃ ĐỀ NGHỊ THANH TOÁN BHYT${record.ngayDeNghiTT ? ` vào ngày ${record.ngayDeNghiTT}` : ''}. Cần lưu bản snapshot trước khi sửa đổi trên HIS!`,
                data: record
            };
        } else {
            result = {
                success: true,
                exists: true,
                isDaDeNghiTT: false,
                statusTag: 'CHUA_DE_NGHI_TT',
                message: `✅ Bệnh án CHƯA ĐỀ NGHỊ THANH TOÁN trên Cổng BHYT (Trạng thái: ${record.trangThaiTT || 'Chưa gửi ĐNTT'}). Có thể chỉnh sửa nội bộ trên HIS.`,
                data: record
            };
        }
    } else {
        result = {
            success: true,
            exists: false,
            isDaDeNghiTT: false,
            statusTag: 'KHONG_TIM_THAY',
            message: `ℹ️ Không tìm thấy dữ liệu cho mã "${trimmed}" trong danh sách Hồ sơ đã gửi BHYT (HoSoDaGui).`
        };
    }

    // 4. Lưu Cache Server
    if (serverCache.size >= MAX_CACHE_SIZE) {
        const firstKey = serverCache.keys().next().value;
        if (firstKey) serverCache.delete(firstKey);
    }
    serverCache.set(cacheKey, { timestamp: now, data: result });

    return result;
}

// OPTIONS: Xử lý Preflight Request cho Cross-Origin từ Extension HIS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

// GET: Kiểm tra qua Query Parameters (Ví dụ: /api/extension/check-payment?code=BA001031236)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code') || searchParams.get('ma_ba') || searchParams.get('ma_lk') || searchParams.get('maBN');

        if (!code) {
            return NextResponse.json({
                success: false,
                exists: false,
                isDaDeNghiTT: false,
                statusTag: 'THIEU_THAM_SO',
                message: 'Vui lòng cung cấp mã cần kiểm tra qua tham số ?code=... hoặc ?ma_ba=... hoặc ?ma_lk=...'
            }, { 
                status: 400,
                headers: corsHeaders 
            });
        }

        const result = await lookupPaymentStatus(code);
        return NextResponse.json(result, { headers: corsHeaders });
    } catch (error: any) {
        console.error('Lỗi API check-payment (GET):', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { 
            status: 500,
            headers: corsHeaders 
        });
    }
}

// POST: Kiểm tra qua JSON Body (Hỗ trợ cả kiểm tra đơn lẻ hoặc hàng loạt)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const singleCode = body.code || body.ma_ba || body.ma_lk || body.maBN;
        const codesList = body.codes;

        // Nếu gửi kiểm tra hàng loạt dạng { codes: ['BA01', 'BA02'] }
        if (Array.isArray(codesList) && codesList.length > 0) {
            const results: Record<string, any> = {};
            for (const c of codesList) {
                if (typeof c === 'string' && c.trim()) {
                    results[c.trim()] = await lookupPaymentStatus(c.trim());
                }
            }
            return NextResponse.json({
                success: true,
                total: codesList.length,
                results
            }, { headers: corsHeaders });
        }

        if (!singleCode) {
            return NextResponse.json({
                success: false,
                exists: false,
                isDaDeNghiTT: false,
                statusTag: 'THIEU_THAM_SO',
                message: 'Vui lòng truyền mã cần kiểm tra vào body JSON (code, ma_ba, hoặc ma_lk).'
            }, { 
                status: 400,
                headers: corsHeaders 
            });
        }

        const result = await lookupPaymentStatus(String(singleCode));
        return NextResponse.json(result, { headers: corsHeaders });
    } catch (error: any) {
        console.error('Lỗi API check-payment (POST):', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { 
            status: 500,
            headers: corsHeaders 
        });
    }
}
