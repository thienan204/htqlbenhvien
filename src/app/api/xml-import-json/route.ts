import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getXmlDataList } from '@/lib/xml';

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
        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const jsonContent = await file.text();
        const records = JSON.parse(jsonContent);

        if (!Array.isArray(records)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const importBatchId = `batch_filtered_${Date.now()}`;
        
        // Background processing
        const processJson = async () => {
            let successCount = 0;
            let skipCount = 0;
            let errorCount = 0;

            for (const hoso of records) {
                try {
                    const maLk = hoso.id || hoso.summary?.MA_LK;
                    
                    const xmlDataMap: Record<string, any[]> = {};
                    hoso.groups.forEach((g: any) => {
                        xmlDataMap[g.type] = getXmlDataList(g);
                    });
                    
                    if (!xmlDataMap['XML1'] || xmlDataMap['XML1'].length === 0) {
                        continue;
                    }

                    const checksum = calculateChecksum(xmlDataMap);

                    const existingLatest = await (prisma as any).xml1.findFirst({
                        where: { MA_LK: String(maLk) },
                        orderBy: { createdAt: 'desc' },
                        select: { checksum: true, id: true, version: true }
                    });

                    if (existingLatest && existingLatest.checksum === checksum) {
                        skipCount++;
                        continue;
                    }

                    const rawXml1Data = xmlDataMap['XML1'][0];
                    const xml1Data = normalizeDataForModel(rawXml1Data, 'Xml1');
                    
                    const newXml1 = await (prisma as any).xml1.create({
                        data: {
                            importBatchId,
                            checksum: checksum,
                            version: existingLatest ? existingLatest.version + 1 : 1,
                            ...xml1Data
                        }
                    });

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
                    
                    successCount++;
                } catch (err: any) {
                    console.error(`Error processing record ${hoso.id}:`, err);
                    errorCount++;
                }
            }
            console.log(`JSON Background API Finished. Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`);
            return { successCount, skipCount, errorCount };
        };

        const result = await processJson();

        if (result.successCount === 0 && result.skipCount > 0) {
            return NextResponse.json({ 
                success: true, 
                count: 0,
                duplicateCount: result.skipCount,
                message: `Tất cả ${result.skipCount} hồ sơ đã tồn tại trong CSDL, không có dữ liệu mới để lưu.`
            });
        }

        return NextResponse.json({ 
            success: true, 
            count: result.successCount,
            duplicateCount: result.skipCount,
            message: `Đã lưu thành công ${result.successCount} hồ sơ mới (bỏ qua ${result.skipCount} hồ sơ đã tồn tại).` 
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
