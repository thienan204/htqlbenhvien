import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { checks } = body; // Array of { cchn, ma_dich_vu }

        if (!checks || !Array.isArray(checks)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Extract unique CCHNs to fetch data efficiently
        const uniqueCchns = Array.from(new Set(checks.map(c => c.cchn).filter(Boolean)));

        const staffs = await prisma.staff.findMany({
            where: {
                OR: [
                    { ma_nv: { in: uniqueCchns as string[] } },
                    { certificates: { some: { so_cchn: { in: uniqueCchns as string[] }, isActive: true } } }
                ]
            },
            include: {
                department: { select: { ten_khoa: true } },
                certificates: { 
                    where: { isActive: true },
                    include: { scopes: { include: { scope: true } } }
                }
            }
        });

        // Create a map to quickly find staff by any of the 3 identifiers
        const staffMap = new Map();
        staffs.forEach(staff => {
            if (staff.ma_nv) staffMap.set(staff.ma_nv, staff);
            staff.certificates.forEach(cert => {
                if (cert.so_cchn) staffMap.set(cert.so_cchn, staff);
            });
        });

        // 2. Fetch all Scope mappings
        const scopeMappings = await prisma.scopeServiceMapping.findMany();

        const scopeServicesMap = new Map();
        scopeMappings.forEach(mapping => {
            if (!scopeServicesMap.has(mapping.ma_pham_vi)) {
                scopeServicesMap.set(mapping.ma_pham_vi, new Set());
            }
            scopeServicesMap.get(mapping.ma_pham_vi).add(mapping.ma_dich_vu);
        });

        // 3. Validate
        const errors = [];

        for (const check of checks) {
            const { cchn, ma_dich_vu } = check;
            if (!cchn || !ma_dich_vu) continue;

            const staff = staffMap.get(cchn);
            if (!staff) {
                errors.push({ ...check, ten_bac_si: 'Không có dữ liệu nhân sự', ten_khoa: '', reason: 'Không tìm thấy nhân viên hoặc CCHN trong hệ thống' });
                continue;
            }

            const tenBacSi = staff.ho_ten || 'Không xác định';
            const tenKhoa = staff.department?.ten_khoa || '';
            const staffId = staff.id;
            
            if (!staff.certificates || staff.certificates.length === 0) {
                 errors.push({ ...check, ten_bac_si: tenBacSi, ten_khoa: tenKhoa, staff_id: staffId, reason: 'Nhân viên chưa có CCHN nào được kích hoạt' });
                 continue;
            }

            let isValid = false;
            let allScopes: string[] = [];

            for (const cert of staff.certificates) {
                // Collect scopes for frontend Quick Assign button
                if (cert.scopes) {
                    cert.scopes.forEach((s: any) => {
                        if (s.scope?.ma_pham_vi) allScopes.push(s.scope.ma_pham_vi);
                    });
                }
                if (cert.pham_vi_hanh_nghe) {
                    const scopeScopes = cert.pham_vi_hanh_nghe.split(';').map((s: string) => s.trim()).filter(Boolean);
                    scopeScopes.forEach((s: string) => {
                        const scopeCode = s.split(' - ')[0].trim();
                        if (scopeCode && !allScopes.includes(scopeCode)) allScopes.push(scopeCode);
                    });
                }

                // Check exceptions
                if (cert.dich_vu_ky_thuat) {
                    const exceptions = cert.dich_vu_ky_thuat.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
                    const isMatch = exceptions.some((allowedCode: string) => {
                        return allowedCode === ma_dich_vu || ma_dich_vu.startsWith(allowedCode);
                    });
                    if (isMatch) {
                        isValid = true;
                        break;
                    }
                }
            }

            // Check Scopes if not yet valid
            if (!isValid) {
                for (const scopeCode of allScopes) {
                    const services = scopeServicesMap.get(scopeCode);
                    if (services && services.has(ma_dich_vu)) {
                        isValid = true;
                        break;
                    }
                }
            }

            if (!isValid) {
                errors.push({ 
                    ...check, 
                    ten_bac_si: tenBacSi, 
                    ten_khoa: tenKhoa, 
                    staff_id: staffId, 
                    scopes: Array.from(new Set(allScopes)), 
                    reason: 'Dịch vụ Vượt phạm vi chuyên môn hoặc chưa được phân quyền ngoại lệ' 
                });
            }
        }

        return NextResponse.json({ errors });

    } catch (error: any) {
        console.error('Error validating CCHN:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
