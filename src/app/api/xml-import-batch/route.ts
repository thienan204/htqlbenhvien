import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { parseXmlContent, getXmlDataList } from '@/lib/xml';
import fs from 'fs';

function log(msg: string) {
    fs.appendFileSync('import-batch-debug.log', new Date().toISOString() + ' - ' + msg + '\n');
}

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
        log('--- API BATCH STARTED ---');
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        
        if (!files || files.length === 0) {
            log('No files uploaded');
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        log(`Received ${files.length} files`);
        const importBatchId = `batch_xml_${Date.now()}`;
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // Process files sequentially (it's a small chunk anyway, e.g. 50 files)
        for (const file of files) {
            try {
                const xmlContent = await file.text();
                const parsedData = parseXmlContent(xmlContent);

                for (const hoso of parsedData.records) {
                    const maLk = hoso.id;
                    
                    const xmlDataMap: Record<string, any[]> = {};
                    hoso.groups.forEach(g => {
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
                    
                    let finalMaKhoa = xml1Data.MA_KHOA;
                    
                    if (xmlDataMap['XML7'] && xmlDataMap['XML7'].length > 0) {
                        const xml7Records = xmlDataMap['XML7'];
                        for (let j = xml7Records.length - 1; j >= 0; j--) {
                            if (xml7Records[j].MA_KHOA_RV) {
                                finalMaKhoa = String(xml7Records[j].MA_KHOA_RV);
                                break;
                            }
                        }
                    }
                    
                    if (!finalMaKhoa && rawXml1Data.MA_KHOA_RV) {
                        finalMaKhoa = String(rawXml1Data.MA_KHOA_RV);
                    }
                    
                    xml1Data.MA_KHOA = finalMaKhoa;
                    
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
                            const dataToInsert = xmlDataMap[type].map((item: any) => {
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
                }

            } catch (err: any) {
                log(`Error processing file ${file.name}: ${err.message}`);
                console.error(`Error processing file ${file.name}:`, err);
                errorCount++;
            }
        }

        log(`API BATCH Finished. Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`);

        return NextResponse.json({ 
            success: true, 
            message: `Xử lý lô thành công: ${successCount} mới/cập nhật, ${skipCount} trùng, ${errorCount} lỗi.`,
            stats: { successCount, skipCount, errorCount }
        });

    } catch (error: any) {
        log('Import batch error: ' + error.message);
        console.error('Import batch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
