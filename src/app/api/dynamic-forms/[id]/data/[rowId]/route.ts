import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authorizeApiRequest } from '@/lib/deleteProtection';

const prisma = new PrismaClient();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string, rowId: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, {
      menuKeys: ['MENU_DYNAMIC_FORMS'],
      action: 'DELETE',
    });
    if (auth.errorResponse) return auth.errorResponse;

    const { id, rowId } = await params;
    
    // Xóa record
    await prisma.dynamicFormData.delete({
      where: {
        id: rowId,
        formId: id, // Optional extra safety check
      }
    });

    return NextResponse.json({ success: true, message: 'Đã xóa dữ liệu thành công' });
  } catch (error) {
    console.error('Error deleting data row:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi xóa dữ liệu' }, { status: 500 });
  }
}
