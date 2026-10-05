import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Helper to recursively scan an object for special characters
function scanObject(obj: any, path: string, results: { path: string, value: string, char: string }[]) {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'string') {
        // Regex for special characters: @, #, $, ^, ~, {, }, |, <, >, \, and non-printable control chars
        // Added some others that are usually not in names/addresses/medical text.
        // We will exclude basic punctuation like . , ; : - _ / ( ) [ ] + = % & ! ? ' "
        const regex = /[@#$^~{}|<>\\]|[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
        let match;
        while ((match = regex.exec(obj)) !== null) {
            results.push({
                path: path,
                value: obj,
                char: match[0]
            });
            break; // Just record once per string to avoid spam
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            scanObject(item, `${path}[${index}]`, results);
        });
    } else if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            // Skip metadata fields
            if (['id', 'createdAt', 'updatedAt', 'importBatchId', 'xml1Id', 'checksum', 'errorCount', 'hasError', 'isLatest'].includes(key)) continue;
            
            scanObject(value, path ? `${path}.${key}` : key, results);
        }
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const maLk = searchParams.get('maLk');

        if (!maLk) {
            return NextResponse.json({ error: 'Thiếu mã liên kết (MA_LK)' }, { status: 400 });
        }

        const includeQueries: any = {};
        for (let i = 2; i <= 15; i++) {
            includeQueries[`xml${i}Records`] = true;
        }

        const data = await (prisma as any).xml1.findFirst({
            where: { MA_LK: maLk },
            include: includeQueries
        });

        if (!data) {
            return NextResponse.json({ error: 'Không tìm thấy hồ sơ với Mã LK này' }, { status: 404 });
        }

        const results: { path: string, value: string, char: string }[] = [];
        
        // Scan XML1
        scanObject(data, 'XML1', results);

        // Scan XML2 to XML15
        for (let i = 2; i <= 15; i++) {
            const records = data[`xml${i}Records`];
            if (records && records.length > 0) {
                scanObject(records, `XML${i}`, results);
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
