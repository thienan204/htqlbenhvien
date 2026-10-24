import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const onlyActive = searchParams.get('onlyActive') === 'true';
        const key = searchParams.get('key');
        const id = searchParams.get('id');
        const search = searchParams.get('search');

        if (key) {
            const campaign = await (prisma as any).patientFeedbackCampaign.findUnique({
                where: { qrCodeKey: key }
            });
            return NextResponse.json({ success: true, data: campaign });
        }

        if (id) {
            const campaign = await (prisma as any).patientFeedbackCampaign.findUnique({
                where: { id }
            });
            return NextResponse.json({ success: true, data: campaign });
        }

        const where: any = {};

        if (onlyActive) {
            where.isActive = true;
            where.OR = [
                { endDate: null },
                { endDate: { gte: new Date() } }
            ];
        }

        if (search && search.trim() !== '') {
            const s = search.trim();
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { name: { contains: s, mode: 'insensitive' } },
                        { department: { contains: s, mode: 'insensitive' } },
                        { location: { contains: s, mode: 'insensitive' } }
                    ]
                }
            ];
        }

        const campaigns = await (prisma as any).patientFeedbackCampaign.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, data: campaigns });
    } catch (error: any) {
        console.error('Error fetching patient campaigns:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Chỉ Quản trị viên mới có quyền tạo điểm/đợt góp ý bệnh nhân' }, { status: 403 });
        }

        const body = await req.json();
        const {
            name,
            department,
            location,
            description,
            startDate,
            endDate,
            isActive
        } = body;

        if (!name || name.trim() === '') {
            return NextResponse.json({ success: false, error: 'Vui lòng nhập tên điểm / đợt góp ý' }, { status: 400 });
        }

        const newCampaign = await (prisma as any).patientFeedbackCampaign.create({
            data: {
                name: name.trim(),
                department: department?.trim() || null,
                location: location?.trim() || null,
                description: description?.trim() || null,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
                createdBy: user.name || user.username || 'Phòng QLCL'
            }
        });

        return NextResponse.json({ success: true, data: newCampaign });
    } catch (error: any) {
        console.error('Error creating patient feedback campaign:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Quyền Quản trị viên cần thiết' }, { status: 403 });
        }

        const body = await req.json();
        const { id, isActive, name, department, location, description, endDate } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Thiếu id bản ghi' }, { status: 400 });
        }

        const updateData: any = {};
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        if (name !== undefined) updateData.name = name;
        if (department !== undefined) updateData.department = department;
        if (location !== undefined) updateData.location = location;
        if (description !== undefined) updateData.description = description;
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

        const updated = await (prisma as any).patientFeedbackCampaign.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        console.error('Error updating patient feedback campaign:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const user = await getCurrentUser();
        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Quyền Quản trị viên cần thiết' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Thiếu id bản ghi' }, { status: 400 });
        }

        await (prisma as any).patientFeedbackCampaign.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Đã xóa điểm góp ý bệnh nhân' });
    } catch (error: any) {
        console.error('Error deleting patient campaign:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
