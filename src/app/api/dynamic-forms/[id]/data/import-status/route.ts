import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { data } = body;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Payload data rỗng hoặc không hợp lệ' }, { status: 400 });
    }

    // Lấy cấu hình form để biết trường nào là khoá chính (isVerificationKey)
    const form = await prisma.dynamicForm.findUnique({
      where: { id: id },
    });

    if (!form || !form.config) {
      return NextResponse.json({ error: 'Không tìm thấy cấu hình form' }, { status: 404 });
    }

    const config = form.config as any[];
    const verificationKeyField = config.find(f => f.isVerificationKey);

    if (!verificationKeyField) {
      return NextResponse.json({ error: 'Form này chưa được thiết lập trường khoá xác thực (isVerificationKey)' }, { status: 400 });
    }

    const verificationKey = verificationKeyField.name;
    const verificationLabel = verificationKeyField.label;

    let updatedCount = 0;

    // Chạy tuần tự để dễ xử lý logic
    for (const row of data) {
      let isDone = true; // Mặc định là true khi import trạng thái
      let lastUpdatedBy = 'Excel Import Trạng Thái';

      // Lấy trạng thái nếu có cột "Trạng thái"
      if (row['Trạng thái']) {
        isDone = row['Trạng thái'].toString().trim().toLowerCase() === 'đã xong';
      }

      // Lấy người cập nhật nếu có
      if (row['Cập nhật lần cuối bởi']) {
        lastUpdatedBy = String(row['Cập nhật lần cuối bởi']);
      }

      // Lấy giá trị của khoá xác thực từ dòng hiện tại
      const verificationValue = row[verificationLabel];

      if (!verificationValue) {
        continue; // Bỏ qua nếu dòng không có khoá xác thực
      }

      // Tìm xem dòng này đã có trong database chưa
      const strVal = String(verificationValue).trim();
      const numVal = !isNaN(Number(strVal)) ? Number(strVal) : null;
      
      const whereConditions: any[] = [
        {
          data: {
            path: [verificationKey],
            equals: strVal,
          }
        }
      ];

      if (numVal !== null) {
        whereConditions.push({
          data: {
            path: [verificationKey],
            equals: numVal,
          }
        });
      }

      const existingRows = await prisma.dynamicFormData.findMany({
        where: {
          formId: id,
          OR: whereConditions
        }
      });

      if (existingRows.length > 0) {
        // Chỉ cập nhật trạng thái
        const rowToUpdate = existingRows[0];
        await prisma.dynamicFormData.update({
          where: { id: rowToUpdate.id },
          data: {
            isDone: isDone,
            lastUpdatedBy: lastUpdatedBy,
          }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cập nhật trạng thái thành công cho ${updatedCount} dòng.`,
      stats: { updated: updatedCount }
    });

  } catch (error) {
    console.error('Error importing status from excel:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi Import trạng thái', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
