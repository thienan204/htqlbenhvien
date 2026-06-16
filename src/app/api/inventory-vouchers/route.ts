import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const sub_type = searchParams.get('sub_type');
    const warehouse_id = searchParams.get('warehouse_id');

    const whereClause: any = {};
    if (type) whereClause.type = type;
    if (sub_type) whereClause.sub_type = sub_type;
    if (warehouse_id) {
      whereClause.OR = [
        { from_warehouse_id: warehouse_id },
        { to_warehouse_id: warehouse_id }
      ];
    }

    const vouchers = await prisma.inventoryVoucher.findMany({
      where: whereClause,
      include: {
        from_warehouse: { select: { name: true, department: { select: { ten_khoa: true } } } },
        to_warehouse: { select: { name: true, department: { select: { ten_khoa: true } } } },
        details: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(vouchers);
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      voucher_code, type, sub_type, supplier_name, document_number, document_date, 
      deliverer_name, deliverer_address, received_date, 
      from_warehouse_id, to_warehouse_id, created_by, details, status = 'PENDING'
    } = body;

    // Bắt đầu một transaction để đảm bảo toàn vẹn dữ liệu
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tạo Phiếu Header
      const voucher = await tx.inventoryVoucher.create({
        data: {
          voucher_code,
          type,
          sub_type,
          supplier_name,
          document_number: document_number ? document_number : null,
          document_date: document_date ? new Date(document_date) : null,
          deliverer_name,
          deliverer_address,
          received_date: received_date ? new Date(received_date) : null,
          from_warehouse_id,
          to_warehouse_id,
          created_by,
          status,
        }
      });

      // 2. Tạo Chi tiết phiếu
      if (details && details.length > 0) {
        const detailData = details.map((d: any) => ({
          voucher_id: voucher.id,
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

        // 3. LOGIC CỐT LÕI KHI DUYỆT PHIẾU (APPROVED)
        if (status === 'APPROVED') {
          // A. NHẬP MỚI TỪ NHÀ CUNG CẤP
          if (type === 'NHAP_KHO' && sub_type === 'NHAP_MOI' && to_warehouse_id) {
            const equipmentsToCreate = [];
            for (const d of details) {
              const qty = d.quantity || 1;
              if (d.is_auto_generate) {
                const serials = d.serial_numbers ? d.serial_numbers.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [];
                for (let i = 0; i < qty; i++) {
                  equipmentsToCreate.push({
                    ma_vttb: `${voucher_code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
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
                    warehouse_id: to_warehouse_id,
                    vattu_hay_tb: 'THIET_BI',
                    voucher_id: voucher.id
                  });
                }
              } else {
                equipmentsToCreate.push({
                  ma_vttb: `${voucher_code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
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
                  warehouse_id: to_warehouse_id,
                  vattu_hay_tb: 'VAT_TU',
                  voucher_id: voucher.id
                });
              }
            }
            if (equipmentsToCreate.length > 0) {
              await tx.equipment.createMany({ data: equipmentsToCreate });
            }
          }

          // B. XUẤT CHUYỂN KHO HOẶC NHẬP HOÀN TRẢ
          else if ((sub_type === 'XUAT_CHUYEN_KHO' || sub_type === 'NHAP_HOAN_TRA') && to_warehouse_id) {
            for (const d of details) {
              if (d.equipment_id) {
                const equipment = await tx.equipment.findUnique({ where: { id: d.equipment_id } });
                if (equipment) {
                  if (equipment.quanly_serial) {
                    await tx.equipment.update({
                      where: { id: d.equipment_id },
                      data: { warehouse_id: to_warehouse_id, status: 'TRONG_KHO' }
                    });
                  } else {
                    if (equipment.quantity >= d.quantity) {
                      await tx.equipment.update({
                        where: { id: d.equipment_id },
                        data: { quantity: equipment.quantity - d.quantity }
                      });
                      const { id: _eqId, createdAt: _eqCA, updatedAt: _eqUA, custom_fields: _eqCF, ...eqData } = equipment;
                      await tx.equipment.create({
                        data: {
                          ...eqData,
                          custom_fields: _eqCF ? JSON.parse(JSON.stringify(_eqCF)) : undefined,
                          ma_vttb: `${voucher_code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                          qr_code: crypto.randomUUID(),
                          warehouse_id: to_warehouse_id,
                          quantity: d.quantity,
                          status: 'TRONG_KHO',
                          voucher_id: voucher.id
                        }
                      });
                    } else {
                      throw new Error(`Số lượng tồn không đủ cho vật tư: ${d.ten_vttb}`);
                    }
                  }
                }
              }
            }
          }

          // C. XUẤT SỬ DỤNG
          else if (sub_type === 'XUAT_SU_DUNG') {
            for (const d of details) {
              if (d.equipment_id) {
                const equipment = await tx.equipment.findUnique({ where: { id: d.equipment_id } });
                if (equipment) {
                  if (equipment.quanly_serial) {
                    await tx.equipment.update({
                      where: { id: d.equipment_id },
                      data: { status: 'DANG_SU_DUNG' }
                    });
                  } else {
                    if (equipment.quantity >= d.quantity) {
                      await tx.equipment.update({
                        where: { id: d.equipment_id },
                        data: { quantity: equipment.quantity - d.quantity }
                      });
                      const { id: _eqId, createdAt: _eqCA, updatedAt: _eqUA, custom_fields: _eqCF, ...eqData } = equipment;
                      await tx.equipment.create({
                        data: {
                          ...eqData,
                          custom_fields: _eqCF ? JSON.parse(JSON.stringify(_eqCF)) : undefined,
                          ma_vttb: `${voucher_code}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                          qr_code: crypto.randomUUID(),
                          quantity: d.quantity,
                          status: 'DANG_SU_DUNG',
                          voucher_id: voucher.id
                        }
                      });
                    } else {
                      throw new Error(`Số lượng tồn không đủ cho vật tư: ${d.ten_vttb}`);
                    }
                  }
                }
              }
            }
          }

          // D. XUẤT TRẢ NHÀ CUNG CẤP
          else if (sub_type === 'XUAT_TRA_NCC') {
            for (const d of details) {
              if (d.equipment_id) {
                const equipment = await tx.equipment.findUnique({ where: { id: d.equipment_id } });
                if (equipment) {
                  if (equipment.quanly_serial) {
                    await tx.equipment.update({
                      where: { id: d.equipment_id },
                      data: { status: 'THANH_LY' }
                    });
                  } else {
                    if (equipment.quantity >= d.quantity) {
                      await tx.equipment.update({
                        where: { id: d.equipment_id },
                        data: { quantity: equipment.quantity - d.quantity }
                      });
                    } else {
                      throw new Error(`Số lượng tồn không đủ cho vật tư: ${d.ten_vttb}`);
                    }
                  }
                }
              }
            }
          }
        }
      }

      return voucher;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating inventory voucher:", error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Mã phiếu đã tồn tại" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
