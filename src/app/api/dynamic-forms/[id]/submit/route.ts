import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST: End user submits data (updates their specific row after verification)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { verificationKey, verificationValue, updatedData } = body;

    // 1. Fetch the form configuration to check the verification key field
    const form = await prisma.dynamicForm.findUnique({
      where: { id }
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // In a real implementation, we should check form.config to ensure
    // 'verificationKey' is actually marked as a verification key by the admin.
    // For now, we trust the client request to provide the field name (e.g. 'Số CCCD').
    
    if (!verificationKey) {
      // 2. INSERT NEW ROW (Public Survey Mode)
      // When no verification key is configured, the form acts as a public survey
      // where anyone can submit a new record.
      const newRow = await prisma.dynamicFormData.create({
        data: {
          formId: id,
          data: updatedData,
          lastUpdatedBy: 'Public Submit',
        }
      });
      return NextResponse.json({ success: true, row: newRow });
    }

    // 3. Find the row that matches the verification key
    // Since 'data' is JSON, we can query it using Prisma's JSON filtering for PostgreSQL.
    // However, data from Excel imports might be stored as numbers, while user input is a string.
    // We check both string and numeric types to ensure a match.
    const numericValue = !isNaN(Number(verificationValue)) ? Number(verificationValue) : null;
    const whereConditions: any[] = [
      {
        data: {
          path: [verificationKey],
          equals: verificationValue, // String match
        }
      }
    ];

    if (numericValue !== null) {
      whereConditions.push({
        data: {
          path: [verificationKey],
          equals: numericValue, // Numeric match
        }
      });
    }

    const matchingRows = await prisma.dynamicFormData.findMany({
      where: {
        formId: id,
        OR: whereConditions
      }
    });

    if (matchingRows.length === 0) {
      return NextResponse.json({ error: 'Mã xác thực không tồn tại trong hệ thống. Vui lòng kiểm tra lại.' }, { status: 404 });
    }

    if (matchingRows.length > 1) {
      return NextResponse.json({ error: 'Thông tin xác thực bị trùng lặp trên nhiều dòng, vui lòng báo lại cho Admin' }, { status: 400 });
    }

    const rowToUpdate = matchingRows[0];
    const currentData = rowToUpdate.data as any;

    // 4. Merge the updatedData into currentData
    // NOTE: In production, we should filter 'updatedData' to ONLY include fields
    // that are marked as 'editable' in form.config.
    const newData = { ...currentData, ...updatedData };

    // 5. Save the update
    const updatedRow = await prisma.dynamicFormData.update({
      where: { id: rowToUpdate.id },
      data: {
        data: newData,
        lastUpdatedBy: verificationValue,
      }
    });

    return NextResponse.json({ success: true, row: updatedRow });
  } catch (error) {
    console.error('Error submitting form data:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi cập nhật dữ liệu' }, { status: 500 });
  }
}
