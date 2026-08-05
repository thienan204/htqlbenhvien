import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        
        // Debugging: Log all keys Jodit sends
        const keys = Array.from(formData.keys());
        console.log('Upload API received keys:', keys);
        
        // Find the first File object in the FormData regardless of its key
        let file: File | null = null;
        for (const value of formData.values()) {
            if (typeof value === 'object' && value !== null && 'arrayBuffer' in value) {
                file = value as File;
                break;
            }
        }

        if (!file) {
            console.error('Upload failed: no file found in keys', keys);
            return NextResponse.json({ 
                success: false, 
                error: 'No file uploaded',
                data: { messages: ['No file uploaded'], error: 1 }
            }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure directory exists
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'instructions');
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const originalName = typeof file.name === 'string' ? file.name : 'image.png';
        const ext = originalName.split('.').pop() || 'png';
        const filename = `${uniqueSuffix}.${ext}`;
        
        const path = join(uploadDir, filename);
        await writeFile(path, buffer);

        // Return the public URL including basePath
        const fileUrl = `/htqlbenhvien/uploads/instructions/${filename}`;
        
        return NextResponse.json({ 
            success: true,
            url: fileUrl, // for our own legacy upload if needed
            data: {
                baseurl: '',
                messages: [],
                isImages: [true],
                code: 220,
                files: [fileUrl],
                path: ''
            }
        });
    } catch (error: any) {
        console.error('Error uploading image:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message, stack: error.stack }, { status: 500 });
    }
}
