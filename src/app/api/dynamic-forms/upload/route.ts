import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    let file: File | null = null;
    for (const value of formData.values()) {
        if (typeof value === 'object' && value !== null && 'arrayBuffer' in value) {
            file = value as File;
            break;
        }
    }

    if (!file) {
        return NextResponse.json({ 
            success: false, 
            error: 'No file uploaded',
        }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'dynamic-forms');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const originalName = typeof file.name === 'string' ? file.name : 'image.png';
    const ext = originalName.split('.').pop() || 'png';
    const filename = `${uniqueSuffix}.${ext}`;
    
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);

    // Return the public URL including basePath
    const fileUrl = `/htqlbenhvien/uploads/dynamic-forms/${filename}`;
    
    return NextResponse.json({ 
        success: true,
        url: fileUrl,
    });
  } catch (error: any) {
    console.error('Error uploading image for form:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
