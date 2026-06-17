import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const voucher = await prisma.inventoryVoucher.findUnique({
      where: { id },
      include: {
        from_warehouse: { select: { name: true, department: { select: { ten_khoa: true } } } },
        to_warehouse: { select: { name: true, department: { select: { ten_khoa: true } } } },
        details: true
      }
    });

    if (!voucher) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
    return NextResponse.json(voucher);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const { action, ...data } = body;

    const existing = await prisma.inventoryVoucher.findUnique({
      where: { id },
      include: { details: true }
    });

    if (!existing) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: "Phiếu đã duyệt, không thể thay đổi" }, { status: 400 });
    }

    if (action === 'APPROVE') {
      // Logic Duyệt Phiếu
      const result = await prisma.$transaction(async (tx) => {
        // Cập nhật trạng thái
        const voucher = await tx.inventoryVoucher.update({
          where: { id },
          data: { status: 'APPROVED' }
        });

        // Sinh thiết bị
        if (existing.type === 'NHAP_KHO' && existing.to_warehouse_id) {
          const equipmentsToCreate = [];
          for (const d of existing.details) {
            const qty = d.quantity || 1;
            
            if (d.is_auto_generate) {
              const serials = d.serial_numbers ? d.serial_numbers.split(',').map(s => s.trim()).filter(s => s) : [];
              for (let i = 0; i < qty; i++) {
                equipmentsToCreate.push({
                  ma_vttb: `${existing.voucher_code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                  ten_vttb: d.ten_vttb,
                  qr_code: crypto.randomUUID(),
                  category_id: d.category_id,
                  group_id: d.group_id,
                  type_id: d.type_id,
                  manufacturer_id: d.manufacturer_id,
                  country_id: d.country_id,
                  funding_source_id: d.funding_source_id,
                  serial: serials[i] || null,
                  quanly_serial: true,
                  dongia: d.dongia,
                  vat: d.vat,
                  dongia_vat: d.dongia_vat,
                  quantity: 1,
                  status: "TRONG_KHO",
                  warehouse_id: existing.to_warehouse_id,
                  vattu_hay_tb: 'THIET_BI',
                  voucher_id: id
                });
              }
            } else {
              equipmentsToCreate.push({
                ma_vttb: `${existing.voucher_code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                ten_vttb: d.ten_vttb,
                qr_code: crypto.randomUUID(),
                category_id: d.category_id,
                group_id: d.group_id,
                type_id: d.type_id,
                manufacturer_id: d.manufacturer_id,
                country_id: d.country_id,
                funding_source_id: d.funding_source_id,
                serial: d.serial_numbers || null,
                quanly_serial: false,
                dongia: d.dongia,
                vat: d.vat,
                dongia_vat: d.dongia_vat,
                quantity: qty,
                status: "TRONG_KHO",
                warehouse_id: existing.to_warehouse_id,
                vattu_hay_tb: 'VAT_TU',
                voucher_id: id
              });
            }
          }
          if (equipmentsToCreate.length > 0) {
            await tx.equipment.createMany({ data: equipmentsToCreate });
          }
        }
        return voucher;
      });
      return NextResponse.json({ message: "Duyệt phiếu thành công", result });
    } 
    
    // Nếu không phải APPROVE, thì là Cập nhật nội dung Phiếu
    const { details, ...masterData } = data;
    
    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.inventoryVoucher.update({
        where: { id },
        data: {
          ...masterData,
          document_date: masterData.document_date ? new Date(masterData.document_date) : null,
          received_date: masterData.received_date ? new Date(masterData.received_date) : null,
        }
      });

      // Xóa details cũ
      await tx.inventoryVoucherDetail.deleteMany({ where: { voucher_id: id } });
      
      // Tạo details mới
      if (details && details.length > 0) {
        const detailData = details.map((d: any) => ({
          voucher_id: id,
          ten_vttb: d.ten_vttb,
          category_id: d.category_id,
          group_id: d.group_id,
          type_id: d.type_id,
          quantity: d.quantity || 1,
          dongia: d.dongia,
          vat: d.vat,
          dongia_vat: d.dongia_vat,
          thanh_tien: d.thanh_tien,
          manufacturer_id: d.manufacturer_id,
          country_id: d.country_id,
          funding_source_id: d.funding_source_id,
          serial_numbers: d.serial_numbers,
          is_auto_generate: d.is_auto_generate !== undefined ? d.is_auto_generate : true,
        }));
        await tx.inventoryVoucherDetail.createMany({ data: detailData });
      }

      return voucher;
    });

    return NextResponse.json({ message: "Cập nhật phiếu thành công", result });

  } catch (error) {
    console.error("Error updating voucher:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const existing = await prisma.inventoryVoucher.findUnique({
      where: { id },
      include: { equipments: true }
    });

    if (!existing) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
    
    if (existing.status === 'APPROVED') {
      // Nếu phiếu đã duyệt, kiểm tra xem có thiết bị nào đã xuất kho chưa
      const hasExportedEquipments = existing.equipments.some(eq => eq.status !== 'TRONG_KHO');
      if (hasExportedEquipments) {
        return NextResponse.json(
          { error: "Không thể xóa phiếu vì đã có vật tư/thiết bị được xuất kho hoặc chuyển trạng thái." }, 
          { status: 400 }
        );
      }

      // Xóa tất cả thiết bị đã sinh ra từ phiếu này
      if (existing.equipments.length > 0) {
        await prisma.equipment.deleteMany({
          where: { voucher_id: id }
        });
      }
    }

    await prisma.inventoryVoucher.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Đã xóa phiếu thành công" });
  } catch (error: any) {
    console.error("Error deleting voucher:", error);
    const errStr = String(error?.message || '');
    if (error?.code === 'P2003' || errStr.includes('foreign key constraint') || errStr.includes('23001')) {
        return NextResponse.json({ error: 'Không thể xóa vì Phiếu này đang được dùng bởi dữ liệu khác!' }, { status: 400 });
    }
    return NextResponse.json({ error: "Lỗi khi xóa: " + (error?.message || 'Unknown error') }, { status: 500 });
  }
}
