import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { 
    encryptField, 
    decryptField, 
    generateBlindIndex, 
    isEncrypted, 
    SENSITIVE_STAFF_FIELDS, 
    DEFAULT_ENCRYPTED_FIELDS,
    SensitiveStaffField
} from '@/lib/staffCrypto';
import { getSystemConfig } from '@/lib/systemConfig';

const FIELD_METADATA: Record<string, { label: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; category: string }> = {
    cccd: { label: 'Số Căn cước công dân (CCCD)', severity: 'HIGH', category: 'Định danh cốt lõi' },
    so_dien_thoai: { label: 'Số điện thoại di động', severity: 'HIGH', category: 'Liên lạc cá nhân' },
    ma_bhxh: { label: 'Mã số Bảo hiểm xã hội', severity: 'HIGH', category: 'An sinh xã hội' },
    dia_chi: { label: 'Địa chỉ thường trú chi tiết', severity: 'MEDIUM', category: 'Nơi cư trú' },
    ma_ho_gia_dinh: { label: 'Mã hộ gia đình', severity: 'LOW', category: 'Hộ khẩu' },
    noi_sinh_thon: { label: 'Thôn/xóm nơi sinh', severity: 'LOW', category: 'Nguyên quán' },
    que_quan_thon: { label: 'Thôn/xóm quê quán', severity: 'LOW', category: 'Nguyên quán' },
    noi_o_thon: { label: 'Thôn/xóm nơi ở hiện tại', severity: 'LOW', category: 'Nơi cư trú' }
};

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền truy cập.' }, { status: 403 });
        }

        const totalStaff = await prisma.staff.count();

        // Lấy cấu hình hệ thống
        const encConfigStr = await getSystemConfig('STAFF_PII_ENCRYPTION_ENABLED', 'true');
        const maskConfigStr = await getSystemConfig('STAFF_PII_MASKING_ENABLED', 'true');
        const allowUnmaskStr = await getSystemConfig('STAFF_PII_ALLOW_UNMASK_BUTTON', 'true');
        const activeFieldsStr = await getSystemConfig('STAFF_PII_ENCRYPTED_FIELDS', DEFAULT_ENCRYPTED_FIELDS.join(','));

        const activeFields = activeFieldsStr.split(',').map(s => s.trim()).filter(Boolean);

        // Lấy mẫu hoặc toàn bộ bản ghi để thống kê (Staff viện chỉ ~870 người, duyệt rất nhanh)
        const allStaff = await prisma.staff.findMany({
            select: {
                id: true,
                cccd: true,
                so_dien_thoai: true,
                ma_bhxh: true,
                dia_chi: true,
                ma_ho_gia_dinh: true,
                noi_sinh_thon: true,
                que_quan_thon: true,
                noi_o_thon: true,
                cccd_hash: true
            }
        });

        const fieldStats = SENSITIVE_STAFF_FIELDS.map(fieldName => {
            const meta = FIELD_METADATA[fieldName] || { label: fieldName, severity: 'LOW', category: 'Khác' };
            let totalWithData = 0;
            let encryptedCount = 0;

            for (const s of allStaff) {
                const val = (s as any)[fieldName];
                if (val && String(val).trim()) {
                    totalWithData++;
                    if (isEncrypted(val)) {
                        encryptedCount++;
                    }
                }
            }

            const plaintextCount = totalWithData - encryptedCount;
            const percentage = totalWithData > 0 ? Math.round((encryptedCount / totalWithData) * 100) : 100;

            return {
                field: fieldName,
                label: meta.label,
                severity: meta.severity,
                category: meta.category,
                totalWithData,
                encryptedCount,
                plaintextCount,
                percentage,
                isActive: activeFields.includes(fieldName)
            };
        });

        return NextResponse.json({
            success: true,
            totalStaff,
            encryptionEnabled: encConfigStr === 'true',
            maskingEnabled: maskConfigStr === 'true',
            allowUnmask: allowUnmaskStr === 'true',
            activeFields,
            fieldStats,
            serverKeyConfigured: Boolean(process.env.STAFF_ENCRYPTION_KEY)
        });
    } catch (error: any) {
        console.error('Lỗi API GET encryption status:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền thao tác.' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { action } = body;

        // --- 1. MÃ HÓA HÀNG LOẠT TOÀN BỘ CSDL (ENCRYPT ALL) ---
        if (action === 'encrypt_all') {
            const activeFieldsStr = await getSystemConfig('STAFF_PII_ENCRYPTED_FIELDS', DEFAULT_ENCRYPTED_FIELDS.join(','));
            const activeFields = activeFieldsStr.split(',').map(s => s.trim()).filter(Boolean);

            const allStaff = await prisma.staff.findMany({
                select: {
                    id: true,
                    cccd: true,
                    so_dien_thoai: true,
                    ma_bhxh: true,
                    dia_chi: true,
                    ma_ho_gia_dinh: true,
                    noi_sinh_thon: true,
                    que_quan_thon: true,
                    noi_o_thon: true,
                    cccd_hash: true,
                    so_dien_thoai_hash: true
                }
            });

            let updatedCount = 0;

            // Xử lý từng nhân viên
            for (const staff of allStaff) {
                const updateData: any = {};
                let needUpdate = false;

                for (const field of activeFields) {
                    const currentVal = (staff as any)[field];
                    if (currentVal && typeof currentVal === 'string' && !isEncrypted(currentVal)) {
                        updateData[field] = encryptField(currentVal);
                        needUpdate = true;
                    }
                }

                // Luôn đảm bảo cccd_hash và so_dien_thoai_hash được cập nhật
                if (staff.cccd) {
                    const plainCccd = isEncrypted(staff.cccd) ? decryptField(staff.cccd) : staff.cccd;
                    const targetHash = generateBlindIndex(plainCccd);
                    if (staff.cccd_hash !== targetHash) {
                        updateData.cccd_hash = targetHash;
                        needUpdate = true;
                    }
                }

                if (staff.so_dien_thoai) {
                    const plainPhone = isEncrypted(staff.so_dien_thoai) ? decryptField(staff.so_dien_thoai) : staff.so_dien_thoai;
                    const targetHash = generateBlindIndex(plainPhone);
                    if (staff.so_dien_thoai_hash !== targetHash) {
                        updateData.so_dien_thoai_hash = targetHash;
                        needUpdate = true;
                    }
                }

                if (needUpdate) {
                    await prisma.staff.update({
                        where: { id: staff.id },
                        data: updateData
                    });
                    updatedCount++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `Đã mã hóa an toàn thành công ${updatedCount} cán bộ nhân viên trong CSDL.`,
                updatedCount,
                totalStaff: allStaff.length
            });
        }

        // --- 2. GIẢI MÃ HOÀN NGUYÊN VỀ CHỮ THƯỜNG (ROLLBACK / DECRYPT ALL) ---
        if (action === 'decrypt_all') {
            const allStaff = await prisma.staff.findMany({
                select: {
                    id: true,
                    cccd: true,
                    so_dien_thoai: true,
                    ma_bhxh: true,
                    dia_chi: true,
                    ma_ho_gia_dinh: true,
                    noi_sinh_thon: true,
                    que_quan_thon: true,
                    noi_o_thon: true
                }
            });

            let revertedCount = 0;

            for (const staff of allStaff) {
                const updateData: any = {};
                let needUpdate = false;

                for (const field of SENSITIVE_STAFF_FIELDS) {
                    const currentVal = (staff as any)[field];
                    if (currentVal && typeof currentVal === 'string' && isEncrypted(currentVal)) {
                        updateData[field] = decryptField(currentVal);
                        needUpdate = true;
                    }
                }

                if (needUpdate) {
                    await prisma.staff.update({
                        where: { id: staff.id },
                        data: updateData
                    });
                    revertedCount++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `Đã hoàn nguyên giải mã ${revertedCount} cán bộ nhân viên về dạng văn bản ban đầu.`,
                revertedCount,
                totalStaff: allStaff.length
            });
        }

        // --- 3. CẬP NHẬT DANH SÁCH CÁC TRƯỜNG ĐƯỢC CHỌN (CHECKBOX UPDATE) ---
        if (action === 'update_active_fields') {
            const { activeFields } = body;
            if (!Array.isArray(activeFields)) {
                return NextResponse.json({ error: 'activeFields phải là một mảng chuỗi.' }, { status: 400 });
            }

            const cleanFields = activeFields.filter(f => SENSITIVE_STAFF_FIELDS.includes(f as any));
            const newFieldsValue = cleanFields.join(',');

            // Lưu vào SystemConfig
            await prisma.systemConfig.upsert({
                where: { key: 'STAFF_PII_ENCRYPTED_FIELDS' },
                update: { value: newFieldsValue },
                create: {
                    key: 'STAFF_PII_ENCRYPTED_FIELDS',
                    value: newFieldsValue,
                    title: 'Danh sách các trường áp dụng mã hóa tự động',
                    description: 'Danh sách các cột trong bảng Staff được áp dụng mã hóa.',
                    category: 'MODULE',
                    module: 'NHAN_SU',
                    route: '/staff',
                    dataType: 'STRING',
                    defaultValue: DEFAULT_ENCRYPTED_FIELDS.join(',')
                }
            });

            return NextResponse.json({
                success: true,
                message: `Đã cập nhật danh sách trường mã hóa: ${newFieldsValue}`,
                activeFields: cleanFields
            });
        }

        return NextResponse.json({ error: 'Hành động (action) không hợp lệ.' }, { status: 400 });
    } catch (error: any) {
        console.error('Lỗi API POST encryption control:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

