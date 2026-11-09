import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { PREDEFINED_CONFIGS } from '@/lib/systemConfig';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category'); // 'SYSTEM' | 'MODULE'
        const moduleParam = searchParams.get('module');
        const keyParam = searchParams.get('key');

        // 1. Tự động đồng bộ các cấu hình mẫu định nghĩa sẵn nếu CSDL chưa có
        for (const def of PREDEFINED_CONFIGS) {
            const existing = await prisma.systemConfig.findUnique({
                where: { key: def.key }
            });
            if (!existing) {
                await prisma.systemConfig.create({
                    data: {
                        key: def.key,
                        value: def.defaultValue,
                        title: def.title,
                        description: def.description,
                        category: def.category,
                        module: def.module,
                        route: def.route,
                        dataType: def.dataType,
                        options: def.options ? JSON.stringify(def.options) : null,
                        defaultValue: def.defaultValue,
                        order: def.order || 0
                    }
                });
            } else if (!existing.title || !existing.category) {
                // Cập nhật metadata nếu bản ghi cũ chưa có thông tin phong phú
                await prisma.systemConfig.update({
                    where: { key: def.key },
                    data: {
                        title: def.title,
                        description: existing.description || def.description,
                        category: def.category,
                        module: def.module,
                        route: def.route,
                        dataType: def.dataType,
                        options: def.options ? JSON.stringify(def.options) : null,
                        defaultValue: def.defaultValue,
                        order: def.order || 0
                    }
                });
            }
        }

        // 2. Nếu tìm đích danh theo key
        if (keyParam) {
            const item = await prisma.systemConfig.findUnique({
                where: { key: keyParam }
            });
            return NextResponse.json(item || { key: keyParam, value: null });
        }

        // 3. Truy vấn danh sách có bộ lọc
        const whereClause: any = {};
        if (category) {
            whereClause.category = category;
        }
        if (moduleParam) {
            whereClause.module = moduleParam;
        }

        const configs = await prisma.systemConfig.findMany({
            where: whereClause,
            orderBy: [
                { order: 'asc' },
                { updatedAt: 'desc' }
            ]
        });

        // Format options từ JSON string thành array & gắn tooltipOn, tooltipOff, helpText
        const formattedConfigs = configs.map(c => {
            let parsedOptions = null;
            if (c.options) {
                try {
                    parsedOptions = JSON.parse(c.options);
                } catch (e) {}
            }
            const predefined = PREDEFINED_CONFIGS.find(p => p.key === c.key);
            return {
                ...c,
                parsedOptions,
                tooltipOn: predefined?.tooltipOn || null,
                tooltipOff: predefined?.tooltipOff || null,
                helpText: predefined?.helpText || null
            };
        });

        return NextResponse.json({ configs: formattedConfigs });
    } catch (error) {
        console.error('Lỗi lấy danh sách cấu hình:', error);
        return NextResponse.json({ error: 'Không thể tải danh sách cấu hình' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        // Chỉ tài khoản quản trị (ADMIN) mới được thay đổi cấu hình
        if (user.role !== 'ADMIN' && user.userLevel !== 'LEVEL_1_BGD') {
            return NextResponse.json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thay đổi thông số hệ thống' }, { status: 403 });
        }

        const body = await request.json();
        const { key, value } = body;

        if (!key) {
            return NextResponse.json({ error: 'Thiếu mã cấu hình (key)' }, { status: 400 });
        }

        const updated = await prisma.systemConfig.upsert({
            where: { key },
            update: {
                value: String(value)
            },
            create: {
                key,
                value: String(value),
                defaultValue: String(value)
            }
        });

        return NextResponse.json({ success: true, updated });
    } catch (error) {
        console.error('Lỗi lưu cấu hình:', error);
        return NextResponse.json({ error: 'Không thể lưu cấu hình' }, { status: 500 });
    }
}

