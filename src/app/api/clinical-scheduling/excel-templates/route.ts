import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/actions/auth';

export async function GET(req: NextRequest) {
    try {
        const templates = await prisma.excelTemplate.findMany({
            include: { mappings: true },
            orderBy: { createdAt: 'desc' }
        });
        
        return NextResponse.json({ success: true, data: templates });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const body = await req.json();
        const { name, isDefault, mappings = [] } = body;
        
        if (!name) {
            return NextResponse.json({ success: false, message: 'Tên mẫu (name) là bắt buộc.' }, { status: 400 });
        }
        
        if (isDefault) {
            await prisma.excelTemplate.updateMany({
                data: { isDefault: false }
            });
        }

        const finalMappings = [...mappings];
        if (user) {
            if (user.ma_khoa) {
                finalMappings.push({ system_field: 'template_ma_khoa', excel_column: user.ma_khoa });
            }
            if (user.ten_khoa) {
                finalMappings.push({ system_field: 'template_ten_khoa', excel_column: user.ten_khoa });
            }
            const creator = user.name || user.username || '';
            if (creator) {
                finalMappings.push({ system_field: 'template_created_by', excel_column: creator });
            }
        }
        
        const template = await prisma.excelTemplate.create({
            data: {
                name,
                isDefault: isDefault || false,
                mappings: {
                    create: finalMappings.map((m: any) => ({
                        system_field: m.system_field,
                        excel_column: m.excel_column
                    }))
                }
            },
            include: { mappings: true }
        });
        
        return NextResponse.json({ success: true, data: template });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const body = await req.json();
        const { id, name, isDefault, mappings = [] } = body;
        
        if (!id) {
            return NextResponse.json({ success: false, message: 'ID mẫu (templateId) là bắt buộc.' }, { status: 400 });
        }

        const existingTemplate = await prisma.excelTemplate.findUnique({
            where: { id },
            include: { mappings: true }
        });

        if (!existingTemplate) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy mẫu.' }, { status: 404 });
        }

        const templateMaKhoa = existingTemplate.mappings.find(m => m.system_field === 'template_ma_khoa')?.excel_column;
        const templateTenKhoa = existingTemplate.mappings.find(m => m.system_field === 'template_ten_khoa')?.excel_column;
        const templateCreatedBy = existingTemplate.mappings.find(m => m.system_field === 'template_created_by')?.excel_column;

        // Phân quyền sửa: Admin sửa được mọi mẫu; Khoa chỉ sửa mẫu do chính khoa mình tạo
        if (user?.role !== 'ADMIN') {
            if (templateMaKhoa && templateMaKhoa !== user?.ma_khoa) {
                return NextResponse.json({ 
                    success: false, 
                    message: `Bạn không có quyền sửa mẫu của ${templateTenKhoa || 'khoa khác'}. Chỉ tài khoản thuộc khoa này hoặc Quản trị viên mới được sửa.` 
                }, { status: 403 });
            }
        }
        
        if (isDefault) {
            await prisma.excelTemplate.updateMany({
                where: { id: { not: id } },
                data: { isDefault: false }
            });
        }
        
        await prisma.excelTemplate.update({
            where: { id },
            data: {
                name,
                isDefault: isDefault || false,
            }
        });
        
        await prisma.excelTemplateMapping.deleteMany({
            where: { templateId: id }
        });

        // Giữ lại thông tin khoa và người tạo
        const finalMappings = mappings.filter((m: any) => 
            !['template_ma_khoa', 'template_ten_khoa', 'template_created_by'].includes(m.system_field)
        );

        if (templateMaKhoa) {
            finalMappings.push({ system_field: 'template_ma_khoa', excel_column: templateMaKhoa });
        } else if (user?.ma_khoa) {
            finalMappings.push({ system_field: 'template_ma_khoa', excel_column: user.ma_khoa });
        }

        if (templateTenKhoa) {
            finalMappings.push({ system_field: 'template_ten_khoa', excel_column: templateTenKhoa });
        } else if (user?.ten_khoa) {
            finalMappings.push({ system_field: 'template_ten_khoa', excel_column: user.ten_khoa });
        }

        if (templateCreatedBy) {
            finalMappings.push({ system_field: 'template_created_by', excel_column: templateCreatedBy });
        } else if (user?.name || user?.username) {
            finalMappings.push({ system_field: 'template_created_by', excel_column: user?.name || user?.username });
        }
        
        if (finalMappings.length > 0) {
            await prisma.excelTemplateMapping.createMany({
                data: finalMappings.map((m: any) => ({
                    templateId: id,
                    system_field: m.system_field,
                    excel_column: m.excel_column
                }))
            });
        }
        
        const updatedTemplate = await prisma.excelTemplate.findUnique({
            where: { id },
            include: { mappings: true }
        });
        
        return NextResponse.json({ success: true, data: updatedTemplate });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ success: false, message: 'ID là bắt buộc.' }, { status: 400 });
        }

        const existingTemplate = await prisma.excelTemplate.findUnique({
            where: { id },
            include: { mappings: true }
        });

        if (!existingTemplate) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy mẫu.' }, { status: 404 });
        }

        const templateMaKhoa = existingTemplate.mappings.find(m => m.system_field === 'template_ma_khoa')?.excel_column;
        const templateTenKhoa = existingTemplate.mappings.find(m => m.system_field === 'template_ten_khoa')?.excel_column;

        // Phân quyền xóa: Admin xóa được mọi mẫu; Khoa chỉ xóa mẫu của chính khoa mình tạo
        if (user?.role !== 'ADMIN') {
            if (templateMaKhoa && templateMaKhoa !== user?.ma_khoa) {
                return NextResponse.json({ 
                    success: false, 
                    message: `Bạn không có quyền xóa mẫu của ${templateTenKhoa || 'khoa khác'}. Chỉ tài khoản thuộc khoa này hoặc Quản trị viên mới có thể xóa.` 
                }, { status: 403 });
            }
        }
        
        await prisma.excelTemplate.delete({
            where: { id }
        });
        
        return NextResponse.json({ success: true, message: 'Đã xóa mẫu thành công.' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
