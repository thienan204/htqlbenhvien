import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { errors } = body; 
        
        if (!Array.isArray(errors)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const createData = errors.map((e: any) => {
            const safeDate = (d: any) => {
                if (!d) return null;
                // handle weird date strings
                if (typeof d === 'string' && d.length === 12 && !d.includes('-')) {
                    // YYYYMMDDHHmm
                    const y = d.substring(0,4);
                    const m = d.substring(4,6);
                    const day = d.substring(6,8);
                    const h = d.substring(8,10);
                    const min = d.substring(10,12);
                    return new Date(`${y}-${m}-${day}T${h}:${min}:00`);
                }
                const parsed = new Date(d);
                return isNaN(parsed.getTime()) ? null : parsed;
            };

            return {
                ma_lk: e.ma_lk || null,
                ma_bn: e.ma_bn || null,
                ma_khoa: e.ma_khoa || null,
                ho_ten: e.ho_ten || null,
                ma_the: e.ma_the || null,
                ngay_vao: safeDate(e.ngay_vao),
                ngay_ra: safeDate(e.ngay_ra),
                ngay_yl: safeDate(e.ngay_yl),
                ngay_th_yl: safeDate(e.ngay_th_yl),
                ngay_kq: safeDate(e.ngay_kq),
                ngay_vao_noi_tru: safeDate(e.ngay_vao_noi_tru),
                ma_dv: e.ma_dv || null,
                ten_dv: e.ten_dv || null,
                ma_doituong_kcb: e.ma_doituong_kcb || null,
                don_gia_bh: e.don_gia_bh || null,
                ma_may: e.ma_may || null,
                ma_bac_si: e.ma_bac_si || null,
                ten_bac_si: e.ten_bac_si || null,
                nguoi_th: e.nguoi_th || null,
                ten_nguoi_th: e.ten_nguoi_th || null,
                ten_khoa: e.ten_khoa || null,
                chi_tiet_loi: e.chi_tiet_loi || null,
                khoang_thoi_gian_trung: e.khoang_thoi_gian_trung || null,
                sourceType: e.sourceType || 'XML',
                status: 'PENDING',
            };
        });

        const maLks = createData.map(d => d.ma_lk).filter(Boolean);
        const existingErrors = await prisma.xmlErrorRecord.findMany({
            where: { ma_lk: { in: maLks } },
            select: { ma_lk: true, ma_bn: true, ma_dv: true, chi_tiet_loi: true }
        });

        const existingSet = new Set(existingErrors.map(e => `${e.ma_lk}_${e.ma_bn}_${e.ma_dv}_${e.chi_tiet_loi}`));
        
        const newErrors = createData.filter(d => {
            const sig = `${d.ma_lk}_${d.ma_bn}_${d.ma_dv}_${d.chi_tiet_loi}`;
            if (existingSet.has(sig)) return false;
            // Không add ngược lại vào set để cho phép lưu nhiều dòng lỗi giống nhau trên cùng 1 hồ sơ
            return true;
        });

        if (newErrors.length === 0) {
            return NextResponse.json({ success: true, count: 0, duplicateCount: createData.length, message: 'Tất cả các lỗi này đã được lưu trước đó' });
        }

        const result = await prisma.xmlErrorRecord.createMany({
            data: newErrors,
            skipDuplicates: true
        });

        return NextResponse.json({ success: true, count: result.count, duplicateCount: createData.length - newErrors.length });
    } catch (error: any) {
        console.error("Save XML errors failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = req.nextUrl.searchParams;
        const sourceType = searchParams.get('sourceType');

        let whereClause: any = {};
        
        // Phân quyền hiển thị theo khoa phòng: Không phải Admin/CNTT thì chỉ thấy lỗi của khoa mình
        if (user.role !== 'ADMIN' && user.role !== 'CNTT') {
            if (user.ma_khoa) {
                whereClause.ma_khoa = {
                    contains: user.ma_khoa
                };
            } else {
                // Không có mã khoa thì không thấy gì
                whereClause.ma_khoa = 'NONE';
            }
        }

        if (sourceType) {
            whereClause.sourceType = sourceType;
        }

        const errors = await prisma.xmlErrorRecord.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(errors);
    } catch (error: any) {
        console.error("Fetch XML errors failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, status, departmentNote, adminNote } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const existing = await prisma.xmlErrorRecord.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Phân quyền update
        if (user.role !== 'ADMIN' && user.role !== 'CNTT') {
            if (!user.ma_khoa || (existing.ma_khoa && !existing.ma_khoa.includes(user.ma_khoa))) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        
        if (user.role !== 'ADMIN' && user.role !== 'CNTT' && departmentNote !== undefined) {
            updateData.departmentNote = departmentNote;
        }
        
        if ((user.role === 'ADMIN' || user.role === 'CNTT')) {
            if (adminNote !== undefined) updateData.adminNote = adminNote;
            if (departmentNote !== undefined) updateData.departmentNote = departmentNote;
        }

        const updated = await prisma.xmlErrorRecord.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Update XML error failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Support passing ?id=123 or a body with { ids: ['123', '456'] }
        let idsToDelete: string[] = [];
        
        const urlId = req.nextUrl.searchParams.get('id');
        if (urlId) {
            idsToDelete.push(urlId);
        } else {
            const body = await req.json();
            if (body.ids && Array.isArray(body.ids)) {
                idsToDelete = body.ids;
            }
        }

        if (idsToDelete.length === 0) {
            return NextResponse.json({ error: 'No IDs provided for deletion' }, { status: 400 });
        }

        const deleted = await prisma.xmlErrorRecord.deleteMany({
            where: {
                id: { in: idsToDelete }
            }
        });

        return NextResponse.json({ success: true, count: deleted.count });
    } catch (error: any) {
        console.error("Delete XML errors failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
