import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Lấy toàn bộ nhân sự và chứng chỉ hành nghề của họ
        const staffList = await prisma.staff.findMany({
            include: {
                certificates: {
                    include: {
                        scopes: true
                    }
                },
                department: true
            }
        });

        // 2. Lấy toàn bộ phạm vi chuyên môn và dịch vụ được phép
        const allScopeMappings = await prisma.scopeServiceMapping.findMany({
            include: {
                ScopeOfPracticeCatalog: true
            }
        });

        // Xây dựng map: ma_pham_vi -> Set(ma_dich_vu)
        const scopeAllowedServicesMap = new Map<string, Set<string>>();
        allScopeMappings.forEach(mapping => {
            if (!scopeAllowedServicesMap.has(mapping.ma_pham_vi)) {
                scopeAllowedServicesMap.set(mapping.ma_pham_vi, new Set());
            }
            scopeAllowedServicesMap.get(mapping.ma_pham_vi)?.add(mapping.ma_dich_vu);
        });

        // 3. Xây dựng map: so_cchn -> Set(ma_dich_vu được phép)
        const cchnAllowedServicesMap = new Map<string, Set<string>>();
        const staffByCchnMap = new Map<string, any>(); // Lưu lại thông tin nhân sự theo CCHN để gán vào kết quả

        staffList.forEach(staff => {
            staff.certificates.forEach(cert => {
                if (cert.so_cchn) {
                    staffByCchnMap.set(cert.so_cchn, {
                        ma_nv: staff.ma_nv,
                        ho_ten: staff.ho_ten,
                        khoa_phong: staff.department?.ten_khoa || staff.ma_khoa || 'Không rõ'
                    });

                    const allowedSet = new Set<string>();
                    cert.scopes.forEach(scope => {
                        const servicesInScope = scopeAllowedServicesMap.get(scope.ma_pham_vi);
                        if (servicesInScope) {
                            servicesInScope.forEach(srv => allowedSet.add(srv));
                        }
                    });
                    cchnAllowedServicesMap.set(cert.so_cchn, allowedSet);
                }
            });
        });

        // 4. Lấy toàn bộ dịch vụ đã thực hiện (từ XML)
        const performedServices = await prisma.doctorServiceMapping.findMany();

        // 5. Đối chiếu và trả về
        const complianceResults = performedServices.map(service => {
            const allowedSet = cchnAllowedServicesMap.get(service.cchn);
            const isAllowed = allowedSet ? allowedSet.has(service.ma_dich_vu) : false;
            const staffInfo = staffByCchnMap.get(service.cchn) || { ma_nv: 'N/A', ho_ten: 'Không xác định', khoa_phong: 'Không rõ' };

            return {
                id: service.id,
                cchn: service.cchn,
                ma_dich_vu: service.ma_dich_vu,
                ten_dich_vu: service.ten_dich_vu,
                source: service.source,
                status: service.status,
                isChiDinh: service.isChiDinh,
                isThucHien: service.isThucHien,
                isAllowed,
                ma_nv: staffInfo.ma_nv,
                ho_ten: staffInfo.ho_ten,
                khoa_phong: staffInfo.khoa_phong
            };
        });

        return NextResponse.json({
            results: complianceResults,
            totalPerformed: complianceResults.length,
            totalViolations: complianceResults.filter(r => !r.isAllowed).length
        });

    } catch (error: any) {
        console.error('Error fetching global compliance:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
