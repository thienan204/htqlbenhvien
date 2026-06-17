import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        department: true,
        storekeeper: true
      }
    });

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Error fetching warehouse:", error);
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
    const { code, name, department_id, warehouse_type, room, storekeeper_id, status } = body;

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        code,
        name,
        department_id,
        warehouse_type,
        room,
        storekeeper_id,
        status
      }
    });

    return NextResponse.json(warehouse);
  } catch (error: any) {
    console.error("Error updating warehouse:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
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
    
    // Check constraints manually to provide specific error message
    const equipmentCount = await prisma.equipment.count({ where: { warehouse_id: id } });
    const fromVoucherCount = await prisma.inventoryVoucher.count({ where: { from_warehouse_id: id } });
    const toVoucherCount = await prisma.inventoryVoucher.count({ where: { to_warehouse_id: id } });
    const voucherCount = fromVoucherCount + toVoucherCount;

    if (equipmentCount > 0 || voucherCount > 0) {
        let msgParts = [];
        if (equipmentCount > 0) msgParts.push(`${equipmentCount} Thiết bị/Vật tư`);
        if (voucherCount > 0) msgParts.push(`${voucherCount} Phiếu kho`);
        return NextResponse.json({ 
            error: `Không thể xóa vì Kho này đang liên kết với ${msgParts.join(' và ')}. Vui lòng chuyển dữ liệu trước khi xóa.` 
        }, { status: 400 });
    }

    await prisma.warehouse.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Warehouse deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting warehouse:", error);
    const errStr = String(error?.message || '');
    if (error?.code === 'P2003' || errStr.includes('foreign key constraint') || errStr.includes('23001')) {
        return NextResponse.json({ error: 'Không thể xóa vì Kho này đang được dùng bởi dữ liệu khác!' }, { status: 400 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
