import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        let pagePath = searchParams.get('pagePath');
        const targetScope = searchParams.get('targetScope');
        const status = searchParams.get('status');
        const feedbackType = searchParams.get('feedbackType');
        const department = searchParams.get('department');
        const search = searchParams.get('search');
        const withStats = searchParams.get('withStats') === 'true';

        const where: any = {};

        if (targetScope && targetScope !== 'ALL') {
            where.targetScope = targetScope;
        }

        if (pagePath) {
            if (pagePath.startsWith('/htqlbenhvien')) {
                pagePath = pagePath.replace('/htqlbenhvien', '');
            }
            if (!pagePath.startsWith('/')) {
                pagePath = `/${pagePath}`;
            }
            where.pagePath = pagePath;
        }

        if (status && status !== 'ALL') {
            where.status = status;
        }

        if (feedbackType && feedbackType !== 'ALL') {
            where.feedbackType = feedbackType;
        }

        if (department && department !== 'ALL') {
            where.department = department;
        }

        if (search && search.trim() !== '') {
            const s = search.trim();
            where.OR = [
                { content: { contains: s, mode: 'insensitive' } },
                { userName: { contains: s, mode: 'insensitive' } },
                { department: { contains: s, mode: 'insensitive' } },
                { featureName: { contains: s, mode: 'insensitive' } },
                { policyTitle: { contains: s, mode: 'insensitive' } },
                { pagePath: { contains: s, mode: 'insensitive' } },
                { adminNote: { contains: s, mode: 'insensitive' } }
            ];
        }

        const feedbacks = await (prisma as any).featureFeedback.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 500
        });

        let stats = null;
        if (withStats) {
            const allFeedbacks = await (prisma as any).featureFeedback.findMany({
                select: { status: true, rating: true, targetScope: true }
            });

            const total = allFeedbacks.length;
            const pending = allFeedbacks.filter((f: any) => f.status === 'PENDING').length;
            const processing = allFeedbacks.filter((f: any) => f.status === 'PROCESSING').length;
            const resolved = allFeedbacks.filter((f: any) => f.status === 'RESOLVED').length;
            const rejected = allFeedbacks.filter((f: any) => f.status === 'REJECTED').length;
            const totalFeature = allFeedbacks.filter((f: any) => f.targetScope === 'FEATURE').length;
            const totalPolicy = allFeedbacks.filter((f: any) => ['POLICY', 'REGULATION', 'INNOVATION'].includes(f.targetScope)).length;
            const totalPatient = allFeedbacks.filter((f: any) => f.targetScope === 'PATIENT' || f.isPatientFeedback).length;

            const ratings = allFeedbacks.map((f: any) => f.rating).filter((r: any) => typeof r === 'number' && r > 0);
            const avgRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : '5.0';

            stats = {
                total,
                pending,
                processing,
                resolved,
                rejected,
                totalFeature,
                totalPolicy,
                totalPatient,
                avgRating
            };
        }

        return NextResponse.json({ success: true, data: feedbacks, stats });
    } catch (error: any) {
        console.error('Error fetching feature feedback:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        const body = await req.json();

        let { 
            targetScope, 
            pagePath, 
            featureName, 
            policyTitle, 
            policyId,
            campaignId,
            isPatientFeedback,
            patientPhone,
            isAnonymous,
            treatmentArea,
            feedbackType, 
            rating, 
            content, 
            imageUrl,
            attachmentUrl,
            attachmentName,
            userName,
            department
        } = body;

        if (!content || content.trim() === '') {
            return NextResponse.json({ success: false, error: 'Vui lòng nhập nội dung góp ý' }, { status: 400 });
        }

        if (pagePath) {
            if (pagePath.startsWith('/htqlbenhvien')) {
                pagePath = pagePath.replace('/htqlbenhvien', '');
            }
            if (!pagePath.startsWith('/')) {
                pagePath = `/${pagePath}`;
            }
        }

        let finalUserName = userName;
        if (isAnonymous) {
            finalUserName = 'Người bệnh ẩn danh';
        } else if (!finalUserName) {
            finalUserName = user?.name || user?.username || (isPatientFeedback ? 'Bệnh nhân / Người nhà' : 'Cán bộ khoa phòng');
        }

        const finalDepartment = department || user?.ten_khoa || treatmentArea || 'Bệnh viện';

        const newFeedback = await (prisma as any).featureFeedback.create({
            data: {
                targetScope: targetScope || (isPatientFeedback ? 'PATIENT' : 'FEATURE'),
                pagePath: pagePath || null,
                featureName: featureName || null,
                policyTitle: policyTitle || null,
                policyId: policyId || null,
                campaignId: campaignId || null,
                isPatientFeedback: Boolean(isPatientFeedback),
                patientPhone: patientPhone?.trim() || null,
                isAnonymous: Boolean(isAnonymous),
                treatmentArea: treatmentArea?.trim() || null,
                userId: user?.id || null,
                userName: finalUserName,
                department: finalDepartment,
                feedbackType: feedbackType || 'SUGGESTION',
                rating: rating !== undefined ? Number(rating) : 5,
                content: content.trim(),
                imageUrl: imageUrl || null,
                attachmentUrl: attachmentUrl || null,
                attachmentName: attachmentName || null,
                status: 'PENDING'
            }
        });

        return NextResponse.json({ success: true, data: newFeedback });
    } catch (error: any) {
        console.error('Error submitting feedback:', error);
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
        const { id, status, adminNote } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Thiếu id bản ghi' }, { status: 400 });
        }

        const updated = await (prisma as any).featureFeedback.update({
            where: { id },
            data: {
                ...(status !== undefined && { status }),
                ...(adminNote !== undefined && { adminNote }),
                respondedBy: user.name || user.username || 'Phòng CNTT',
                respondedAt: new Date(),
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        console.error('Error updating feedback response:', error);
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

        await (prisma as any).featureFeedback.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Đã xóa ý kiến đóng góp thành công' });
    } catch (error: any) {
        console.error('Error deleting feedback:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
