import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'xml-dictionary.json');

// Helper function to read data
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return empty template
            return Array.from({ length: 15 }, (_, i) => `XML${i + 1}`).reduce((acc: any, key) => {
                acc[key] = [];
                return acc;
            }, {});
        }
        throw error;
    }
}

export async function GET() {
    try {
        const data = await readData();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const newData = await req.json(); // Expected to be the full Record<string, XmlDictionaryItem[]>
        
        // Ensure data directory exists
        const dataDir = path.dirname(DATA_FILE);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }

        // Write the full updated data object to file
        await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), 'utf8');
        
        return NextResponse.json({ success: true, message: 'Saved successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
