import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sdt = searchParams.get('sdt');
        const cccd = searchParams.get('cccd');
        const maCoQuan = searchParams.get('maCoQuan');
        
        if (sdt) {
            const whereClause: any = { sdtBenhNhan: sdt };
            if (cccd) {
                whereClause.cccd = cccd;
            }
            if (maCoQuan) {
                whereClause.maCoQuan = maCoQuan;
            }
            
            const record = await prisma.kskToanDan.findFirst({
                where: whereClause
            });
            if (record) {
                return NextResponse.json(record);
            } else {
                return NextResponse.json({ error: 'Không tìm thấy dữ liệu hồ sơ' }, { status: 404 });
            }
        }

        const whereMany: any = {};
        if (maCoQuan) {
            whereMany.maCoQuan = maCoQuan;
        }

        const records = await prisma.kskToanDan.findMany({
            where: whereMany,
            orderBy: { createdAt: 'desc' }
        });
        
        return NextResponse.json(records);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        
        if (!data.sdtBenhNhan) {
             return NextResponse.json({ error: 'Số điện thoại là bắt buộc' }, { status: 400 });
        }
        
        // Cập nhật nếu đã có (trường hợp import từ Excel hoặc Tự sửa qua POST)
        const existing = await prisma.kskToanDan.findFirst({
            where: { sdtBenhNhan: data.sdtBenhNhan }
        });
        
        if (existing) {
             const updated = await prisma.kskToanDan.update({
                 where: { id: existing.id },
                 data: data
             });
             return NextResponse.json(updated);
        } else {
            const created = await prisma.kskToanDan.create({
                data: data
            });
            return NextResponse.json(created);
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { id, ...updateData } = data;
        
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const updated = await prisma.kskToanDan.update({
            where: { id },
            data: updateData
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.kskToanDan.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
