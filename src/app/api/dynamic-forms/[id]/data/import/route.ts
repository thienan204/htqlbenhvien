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

    let createdCount = 0;
    let updatedCount = 0;

    // Chạy tuần tự để dễ xử lý logic
    for (const row of data) {
      // row là một object dạng { [label]: value, ... } do xlsx đọc từ Excel.
      // Cần map lại label thành name dựa trên config.
      const mappedData: any = {};
      let isDone = false;
      let lastUpdatedBy = 'Excel Import';

      // Map các trường trong config
      config.forEach(field => {
        if (row[field.label] !== undefined && row[field.label] !== null) {
          mappedData[field.name] = String(row[field.label]);
        }
      });

      // Lấy trạng thái
      if (row['Trạng thái']) {
        isDone = row['Trạng thái'].toString().trim().toLowerCase() === 'đã xong';
      }

      // Lấy người cập nhật nếu có
      if (row['Cập nhật lần cuối bởi']) {
        lastUpdatedBy = String(row['Cập nhật lần cuối bởi']);
      }

      // Lấy giá trị của khoá xác thực từ dòng hiện tại
      // Chú ý: Dữ liệu từ xlsx gửi lên có key là Label!
      const verificationValue = row[verificationLabel];

      if (!verificationValue) {
        continue; // Bỏ qua nếu dòng không có khoá xác thực
      }

      // Tìm xem dòng này đã có trong database chưa
      // Do lỗi kiểu dữ liệu (String vs Numeric trong JSON), ta tìm cả 2 kiểu
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
        // Cập nhật (Merge data)
        const rowToUpdate = existingRows[0];
        const currentData = rowToUpdate.data as any;
        const newData = { ...currentData, ...mappedData };

        await prisma.dynamicFormData.update({
          where: { id: rowToUpdate.id },
          data: {
            data: newData,
            isDone: isDone,
            lastUpdatedBy: lastUpdatedBy,
          }
        });
        updatedCount++;
      } else {
        // Tạo mới
        await prisma.dynamicFormData.create({
          data: {
            formId: id,
            data: mappedData,
            isDone: isDone,
            lastUpdatedBy: lastUpdatedBy,
          }
        });
        createdCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cập nhật thành công! Tạo mới: ${createdCount} dòng, Cập nhật: ${updatedCount} dòng.`,
      stats: { created: createdCount, updated: updatedCount }
    });

  } catch (error) {
    console.error('Error importing excel:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi Import dữ liệu', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
