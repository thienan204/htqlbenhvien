import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getXmlDataList } from '@/lib/xml';
import { getCurrentUser } from '@/actions/auth';

function normalizeDataForModel(data: any, modelName: string) {
    const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName);
    if (!model) return data;
    
    const validFieldsLower = new Map();
    model.fields.forEach(f => validFieldsLower.set(f.name.toLowerCase().replace(/_/g, ''), f.name));

    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
        if (key === '__cdata' || typeof value === 'object') continue;
        const cleanKey = key.toLowerCase().replace(/_/g, '');
        if (validFieldsLower.has(cleanKey)) {
            result[validFieldsLower.get(cleanKey)] = value !== null && value !== undefined ? String(value) : null;
        }
    }
    return result;
}

function calculateChecksum(recordData: any) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(recordData));
    return hash.digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        // 1. Phân quyền người dùng
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const allowedRoles = ['ADMIN', 'CNTT', 'BHYT'];
        const hasRoleAccess = allowedRoles.includes(user.role) || (user.permissions && (user.permissions as any)['MENU_XML_SUA_BA']);
        if (!hasRoleAccess) {
            return NextResponse.json({ error: 'Bạn không có quyền lưu bản XML trước sửa bệnh án' }, { status: 403 });
        }

        // 2. Parse dữ liệu đầu vào
        let body: any;
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const file = formData.get('file') as File;
            const extraDataStr = formData.get('extraData') as string;
            const parsedExtra = extraDataStr ? JSON.parse(extraDataStr) : {};
            if (file) {
                const text = await file.text();
                body = { records: JSON.parse(text), ...parsedExtra };
            } else {
                body = parsedExtra;
            }
        } else {
            body = await req.json();
        }

        const { records, editReason, editDept, paymentStatuses = {}, allowNonPayment = false } = body;

        if (!Array.isArray(records) || records.length === 0) {
            return NextResponse.json({ error: 'Không có dữ liệu hồ sơ để lưu' }, { status: 400 });
        }

        // 3. Nếu chưa có paymentStatuses truyền kèm, tự động truy vấn HoSoDaGui để xác minh
        const maLkList = records.map((r: any) => String(r.id || r.summary?.MA_LK)).filter(Boolean);
        const resolvedPaymentStatuses: Record<string, any> = { ...paymentStatuses };

        const missingMalks = maLkList.filter(mlk => !resolvedPaymentStatuses[mlk]);
        if (missingMalks.length > 0) {
            const hsList = await prisma.hoSoDaGui.findMany({
                where: { maLienKet: { in: missingMalks } },
                select: {
                    maLienKet: true,
                    ngayDeNghiTT: true,
                    trangThaiTT: true,
                    trangThaiHS: true
                }
            });
            hsList.forEach(hs => {
                const isDaDeNghiTT = Boolean(
                    (hs.ngayDeNghiTT && hs.ngayDeNghiTT.trim() !== '') ||
                    (hs.trangThaiTT && /đề nghị thanh toán|đã thanh toán|quyết toán/i.test(hs.trangThaiTT))
                );
                resolvedPaymentStatuses[hs.maLienKet] = {
                    exists: true,
                    daDeNghiTT: isDaDeNghiTT,
                    ngayDeNghiTT: hs.ngayDeNghiTT,
                    trangThaiTT: hs.trangThaiTT
                };
            });
        }

        // 4. Lọc và lưu hồ sơ
        let savedCount = 0;
        let skippedNonPaymentCount = 0;
        let alreadySavedCount = 0;
        let errorCount = 0;
        const savedMaLks: string[] = [];
        const importBatchId = `batch_pre_edit_${Date.now()}`;

        for (const hoso of records) {
            try {
                const maLk = String(hoso.id || hoso.summary?.MA_LK);
                const paymentInfo = resolvedPaymentStatuses[maLk];
                const isDaDeNghiTT = Boolean(paymentInfo?.daDeNghiTT);

                // Bỏ qua nếu hồ sơ CHƯA ĐỀ NGHỊ THANH TOÁN và không bật allowNonPayment
                if (!isDaDeNghiTT && !allowNonPayment) {
                    skippedNonPaymentCount++;
                    continue;
                }

                // Gom dữ liệu XML1 - XML15
                const xmlDataMap: Record<string, any[]> = {};
                hoso.groups?.forEach((g: any) => {
                    const list = getXmlDataList(g);
                    if (list && list.length > 0) {
                        xmlDataMap[g.type] = list;
                    }
                });

                // Fallback nếu XML1 không có qua getXmlDataList nhưng có summary
                if ((!xmlDataMap['XML1'] || xmlDataMap['XML1'].length === 0) && hoso.summary) {
                    xmlDataMap['XML1'] = [hoso.summary];
                }

                if (!xmlDataMap['XML1'] || xmlDataMap['XML1'].length === 0) {
                    console.warn(`Hồ sơ ${maLk} không tìm thấy dữ liệu XML1, bỏ qua`);
                    continue;
                }

                const checksum = calculateChecksum(xmlDataMap);

                // Kiểm tra xem đã có bản ghi isPreEdit = true với checksum tương tự chưa
                const existingPreEdit = await (prisma as any).xml1.findFirst({
                    where: { 
                        MA_LK: maLk,
                        isPreEdit: true
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, checksum: true }
                });

                if (existingPreEdit && existingPreEdit.checksum === checksum) {
                    alreadySavedCount++;
                    continue;
                }

                const rawXml1Data = xmlDataMap['XML1'][0];
                const xml1Data = normalizeDataForModel(rawXml1Data, 'Xml1');

                // Ưu tiên lấy mã khoa ra viện từ XML7 (MA_KHOA_RV), nếu không có mới lấy XML1 (MA_KHOA)
                const rawXml7Data = xmlDataMap['XML7']?.[0];
                const defaultDept = rawXml7Data?.MA_KHOA_RV || rawXml7Data?.ma_khoa_rv || rawXml1Data.MA_KHOA || null;

                const newXml1 = await (prisma as any).xml1.create({
                    data: {
                        importBatchId,
                        checksum,
                        version: 1,
                        isPreEdit: true,
                        daDeNghiTT: isDaDeNghiTT,
                        ngayDeNghiTT: paymentInfo?.ngayDeNghiTT || null,
                        trangThaiTT: paymentInfo?.trangThaiTT || (isDaDeNghiTT ? 'Đã đề nghị thanh toán' : 'Chưa đề nghị thanh toán (Lưu chủ động)'),
                        editReason: editReason || 'Xin sửa bệnh án',
                        editDept: editDept || defaultDept,
                        preEditSavedBy: user.name || user.username,
                        ...xml1Data
                    }
                });

                // Lưu các bảng chi tiết XML2 - XML15
                for (let i = 2; i <= 15; i++) {
                    const type = `XML${i}`;
                    if (xmlDataMap[type] && xmlDataMap[type].length > 0) {
                        const dataToInsert = xmlDataMap[type].map(item => {
                            const normalized = normalizeDataForModel(item, `Xml${i}`);
                            normalized.xml1Id = newXml1.id;
                            return normalized;
                        });

                        await (prisma as any)[`xml${i}`].createMany({
                            data: dataToInsert
                        });
                    }
                }

                savedCount++;
                savedMaLks.push(maLk);
            } catch (err: any) {
                console.error(`Lỗi lưu bản trước sửa hồ sơ ${hoso.id}:`, err);
                errorCount++;
            }
        }

        const messages: string[] = [];
        if (savedCount > 0) messages.push(`Đã lưu thành công ${savedCount} hồ sơ làm bản XML gốc trước sửa`);
        if (alreadySavedCount > 0) messages.push(`${alreadySavedCount} hồ sơ đã được lưu trước đó`);
        if (skippedNonPaymentCount > 0) messages.push(`Bỏ qua ${skippedNonPaymentCount} hồ sơ chưa ĐNTT`);
        if (errorCount > 0) messages.push(`${errorCount} hồ sơ bị lỗi khi lưu`);

        return NextResponse.json({
            success: true,
            savedCount,
            skippedNonPaymentCount,
            alreadySavedCount,
            errorCount,
            savedMaLks,
            message: messages.join('; ') || 'Hoàn tất quá trình lưu hồ sơ.'
        });

    } catch (error: any) {
        console.error('Lỗi API save-pre-edit:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
