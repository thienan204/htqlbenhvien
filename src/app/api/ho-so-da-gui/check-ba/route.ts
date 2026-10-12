import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code')?.trim();

        if (!code) {
            return NextResponse.json({ exists: false });
        }

        const codeUpper = code.toUpperCase();
        const searchConditions: any[] = [
            { maLienKet: { equals: code, mode: 'insensitive' } },
            { maBN: { equals: code, mode: 'insensitive' } },
        ];

        // Nếu người dùng nhập dãy số không có chữ BA, tìm cả trường hợp có BA
        if (!codeUpper.startsWith('BA')) {
            searchConditions.push({ maBN: { equals: `BA${codeUpper}`, mode: 'insensitive' } });
        } else {
            // Nếu người dùng nhập có chữ BA, tìm cả trường hợp maLienKet là phần số
            const numPart = codeUpper.replace(/^BA/, '');
            if (numPart) {
                searchConditions.push({ maLienKet: { equals: numPart, mode: 'insensitive' } });
            }
        }

        // Tìm kiếm theo maLienKet hoặc maBN trong bảng HoSoDaGui không phân biệt hoa thường
        const record = await prisma.hoSoDaGui.findFirst({
            where: {
                OR: searchConditions
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

        if (record) {
            return NextResponse.json({
                exists: true,
                data: record
            });
        }

        return NextResponse.json({ exists: false });
    } catch (error: any) {
        console.error('Lỗi khi tra cứu mã bệnh án trong HoSoDaGui:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
