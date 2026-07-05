import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/actions/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                staffId: true,
                staff: {
                    select: {
                        certificates: {
                            include: {
                                scopes: true
                            }
                        }
                    }
                }
            }
        });

        if (!userData || !userData.staff || !userData.staff.certificates) {
            return NextResponse.json({ certificates: [], allowedServices: [], performedServices: [] });
        }

        const certificates = userData.staff.certificates;
        const cchnNumbers = certificates.map(c => c.so_cchn).filter(Boolean);
        const scopeCodes = certificates.flatMap(c => c.scopes.map(s => s.ma_pham_vi)).filter(Boolean);

        const scopesInfo = await prisma.scopeOfPracticeCatalog.findMany({
            where: {
                ma_pham_vi: {
                    in: scopeCodes as string[]
                }
            }
        });
        const scopeMap = new Map();
        scopesInfo.forEach(s => scopeMap.set(s.ma_pham_vi, s.ten_chuc_danh));

        const enrichedCertificates = certificates.map(c => {
            return {
                ...c,
                scopes: c.scopes.map(s => ({
                    ma_pham_vi: s.ma_pham_vi,
                    ten_pham_vi: scopeMap.get(s.ma_pham_vi) || ''
                }))
            };
        });

        // Fetch allowed services based on Scope
        const allowedServices = await prisma.scopeServiceMapping.findMany({
            where: {
                ma_pham_vi: {
                    in: scopeCodes as string[]
                }
            },
            include: {
                ScopeOfPracticeCatalog: true
            }
        });

        // We can optionally attach the service name from Mau05Catalog if needed, but doing a manual join
        // might be expensive. For now we will fetch names for these service codes.
        const allowedServiceCodes = allowedServices.map(s => s.ma_dich_vu);
        const serviceNames = await prisma.mau05Catalog.findMany({
            where: {
                MA_DICH_VU: {
                    in: allowedServiceCodes
                }
            },
            select: {
                MA_DICH_VU: true,
                TEN_DICH_VU: true
            },
            distinct: ['MA_DICH_VU']
        });

        const serviceNameMap = new Map();
        serviceNames.forEach(s => {
            if (s.MA_DICH_VU) {
                serviceNameMap.set(s.MA_DICH_VU, s.TEN_DICH_VU);
            }
        });

        const enrichedAllowedServices = allowedServices.map(s => ({
            ...s,
            ten_dich_vu: serviceNameMap.get(s.ma_dich_vu) || 'Không xác định'
        }));

        // Fetch actual performed services based on CCHN
        const performedServices = await prisma.doctorServiceMapping.findMany({
            where: {
                cchn: {
                    in: cchnNumbers as string[]
                }
            }
        });

        return NextResponse.json({
            certificates: enrichedCertificates,
            allowedServices: enrichedAllowedServices,
            performedServices
        });

    } catch (error: any) {
        console.error('Error fetching profile services:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
