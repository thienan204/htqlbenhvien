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

        const certs = await prisma.practicingCertificate.findMany({
            where: {
                so_cchn: { in: uniqueCchns as string[] },
                isActive: true
            },
            include: {
                staff: {
                    select: { 
                        ho_ten: true,
                        department: { select: { ten_khoa: true } }
                    }
                }
            }
        });

        const certMap = new Map();
        certs.forEach(cert => certMap.set(cert.so_cchn, cert));

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

            const cert = certMap.get(cchn);
            if (!cert) {
                errors.push({ ...check, ten_bac_si: 'Không có dữ liệu nhân sự', ten_khoa: '', reason: 'CCHN không tồn tại hoặc chưa được kích hoạt trong hệ thống' });
                continue;
            }

            const tenBacSi = cert.staff?.ho_ten || 'Không xác định';
            const tenKhoa = cert.staff?.department?.ten_khoa || '';

            let isValid = false;

            // Check Exceptions (dich_vu_ky_thuat in PracticingCertificate)
            if (cert.dich_vu_ky_thuat) {
                const exceptions = cert.dich_vu_ky_thuat.split(';').map((s: string) => s.trim()).filter(Boolean);
                if (exceptions.includes(ma_dich_vu)) {
                    isValid = true;
                }
            }

            // Check Scope (pham_vi_hanh_nghe)
            if (!isValid && cert.pham_vi_hanh_nghe) {
                const scopeScopes = cert.pham_vi_hanh_nghe.split(';').map((s: string) => s.trim()).filter(Boolean);
                for (const s of scopeScopes) {
                    // Cấu trúc chuỗi có thể là "123 - Bác sỹ chuyên khoa Hóa sinh" -> Lấy "123"
                    const scopeCode = s.split(' - ')[0].trim();
                    const services = scopeServicesMap.get(scopeCode);
                    if (services && services.has(ma_dich_vu)) {
                        isValid = true;
                        break;
                    }
                }
            }

            if (!isValid) {
                errors.push({ ...check, ten_bac_si: tenBacSi, ten_khoa: tenKhoa, reason: 'Dịch vụ Vượt phạm vi chuyên môn hoặc chưa được phân quyền ngoại lệ' });
            }
        }

        return NextResponse.json({ errors });

    } catch (error: any) {
        console.error('Error validating CCHN:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
