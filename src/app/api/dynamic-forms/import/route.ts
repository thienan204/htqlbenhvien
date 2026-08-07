import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST: Import multiple rows of data from Excel
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { formId, rows } = body;

    if (!formId || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'formId and rows array are required' }, { status: 400 });
    }

    const form = await prisma.dynamicForm.findUnique({
      where: { id: formId }
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Bulk insert the rows
    const createData = rows.map((row: any) => ({
      formId,
      data: row
    }));

    const result = await prisma.dynamicFormData.createMany({
      data: createData
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error importing Excel data:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
