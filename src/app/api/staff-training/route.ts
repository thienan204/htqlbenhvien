import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authorizeApiRequest } from '@/lib/deleteProtection';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');
        
        const whereClause = staffId ? { staffId } : {};
        
        const trainings = await prisma.staffTraining.findMany({
            where: whereClause,
            include: {
                trainingType: true,
                staff: {
                    include: {
                        department: true,
                        chuc_danh_ref: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        return NextResponse.json(trainings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { staffId, trainingType_id, name, institution, graduationYear } = body;

        if (!staffId || !trainingType_id || !name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const training = await prisma.staffTraining.create({
            data: { staffId, trainingType_id, name, institution, graduationYear }
        });

        return NextResponse.json(training, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, trainingType_id, name, institution, graduationYear } = body;

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const training = await prisma.staffTraining.update({
            where: { id },
            data: { trainingType_id, name, institution, graduationYear }
        });

        return NextResponse.json(training);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await authorizeApiRequest(request, {
            allowedRoles: ['ADMIN', 'PTCCB', 'TCCB', 'CNTT', 'KHOA', 'KHOA_PHONG'],
            menuKeys: ['MENU_STAFF'],
            action: 'DELETE',
        });
        if (auth.errorResponse) return auth.errorResponse;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await prisma.staffTraining.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
