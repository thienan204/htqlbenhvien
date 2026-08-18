import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { parseXmlContent, getXmlDataList } from '@/lib/xml';
import fs from 'fs';

function log(msg: string) {
    fs.appendFileSync('import-debug.log', new Date().toISOString() + ' - ' + msg + '\n');
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
            // Stringify value just in case
            result[validFieldsLower.get(cleanKey)] = value !== null && value !== undefined ? String(value) : null;
        }
    }
    return result;
}



function calculateChecksum(recordData: any) {
    const hash = crypto.createHash('sha256');
    // Ensure consistent JSON stringification
    hash.update(JSON.stringify(recordData));
    return hash.digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        log('--- API STARTED ---');
        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) {
            log('No file uploaded');
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        log(`Received file: ${file.name}, size: ${file.size}`);
        const arrayBuffer = await file.arrayBuffer();
        log('ArrayBuffer read');
        const buffer = Buffer.from(arrayBuffer);
        log('Buffer created');
        const zip = new AdmZip(buffer);
        log('Zip opened');
        const zipEntries = zip.getEntries();
        log(`Zip contains ${zipEntries.length} entries`);

        const importBatchId = `batch_${Date.now()}`;
        
        // Background processing
        const processZip = async () => {
            let successCount = 0;
            let skipCount = 0;
            let errorCount = 0;

            // Process entries
            for (const entry of zipEntries) {
                if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.xml')) {
                    continue;
                }

                try {
                    const xmlContent = entry.getData().toString('utf8');
                    const parsedData = parseXmlContent(xmlContent);

                    for (const hoso of parsedData.records) {
                        const maLk = hoso.id;
                        
                        // Prepare data maps
                        const xmlDataMap: Record<string, any[]> = {};
                        hoso.groups.forEach(g => {
                            xmlDataMap[g.type] = getXmlDataList(g);
                        });
                        
                        // If no XML1, it's not a valid profile for us to save
                        if (!xmlDataMap['XML1'] || xmlDataMap['XML1'].length === 0) {
                            continue;
                        }

                        const checksum = calculateChecksum(xmlDataMap);

                        // Check if identical checksum already exists for this MA_LK
                        const existingLatest = await (prisma as any).xml1.findFirst({
                            where: { MA_LK: String(maLk) },
                            orderBy: { createdAt: 'desc' },
                            select: { checksum: true, id: true, version: true }
                        });

                        if (existingLatest && existingLatest.checksum === checksum) {
                            skipCount++;
                            continue;
                        }

                        // Insert new version
                        const rawXml1Data = xmlDataMap['XML1'][0];
                        const xml1Data = normalizeDataForModel(rawXml1Data, 'Xml1');
                        
                        // Lấy MA_KHOA chuẩn (Ưu tiên XML7 MA_KHOA_RV -> XML1 MA_KHOA_RV -> XML1 MA_KHOA)
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

                        // Insert related XML2..15
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
                    }

                } catch (err: any) {
                    log(`Error processing entry ${entry.entryName}: ${err.message}`);
                    console.error(`Error processing entry ${entry.entryName}:`, err);
                    errorCount++;
                }
            }

            log(`Background API Finished. Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`);
        };

        // Fire and forget background process
        processZip().catch(error => {
            log('Background import error: ' + error.message);
            console.error('Background import error:', error);
        });

        // Return immediately
        return NextResponse.json({ 
            success: true, 
            message: `Hệ thống đang xử lý ngầm ${zipEntries.length} file. Vui lòng tải lại trang sau ít phút.` 
        });

    } catch (error: any) {
        log('Import error: ' + error.message);
        console.error('Import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
