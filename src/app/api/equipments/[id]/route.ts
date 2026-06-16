import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        warehouse: {
          include: { department: true }
        },
        maintenanceLogs: true
      }
    });

    if (!equipment) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { qr_code, ...updateData } = body; // Không cho phép update qr_code trực tiếp

    const equipment = await prisma.equipment.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(equipment);
  } catch (error: any) {
    console.error("Error updating equipment:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Mã thiết bị hoặc QR Code đã tồn tại" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Kiểm tra xem thiết bị này có thuộc phiếu nhập nào không
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { voucher_id: true }
    });

    if (equipment?.voucher_id) {
      return NextResponse.json(
        { error: "Không thể xóa vì thiết bị này được tạo từ Phiếu nhập kho. Vui lòng thanh lý hoặc sửa thông tin." }, 
        { status: 400 }
      );
    }

    await prisma.equipment.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Equipment deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting equipment:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
