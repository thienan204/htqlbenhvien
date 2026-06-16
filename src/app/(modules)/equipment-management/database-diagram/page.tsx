'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Typography, Card, Space, Button } from 'antd';
import { DatabaseOutlined, ReloadOutlined } from '@ant-design/icons';
import mermaid from 'mermaid';

const { Title, Paragraph } = Typography;

const diagramCode = `
erDiagram
    Department ||--o{ Warehouse : "có"
    Department ||--o{ Staff : "có"
    
    Warehouse ||--o{ Equipment : "lưu trữ"
    Warehouse ||--o{ InventoryVoucher : "từ kho (from_warehouse_id)"
    Warehouse ||--o{ InventoryVoucher : "đến kho (to_warehouse_id)"
    
    Staff ||--o{ Warehouse : "thủ kho (storekeeper)"
    
    InventoryVoucher ||--o{ InventoryVoucherDetail : "chi tiết phiếu"
    InventoryVoucher ||--o{ Equipment : "sinh ra (voucher_id)"
    
    Equipment ||--o{ MaintenanceLog : "ghi nhận bảo trì"
    
    SystemCategory ||--o{ Equipment : "phân loại"

    Department {
        String ma_khoa PK
        String ten_khoa
        String type "CLINICAL / MANAGEMENT"
    }

    Warehouse {
        String id PK
        String code "Mã kho"
        String name "Tên kho"
        String warehouse_type "KHO_CHINH / KHO_KHOA"
        String department_id FK
    }

    Equipment {
        String id PK
        String ma_vttb "Mã quản lý"
        String ten_vttb "Tên VT/TB"
        String qr_code "Mã QR"
        Int quantity "Số lượng"
        String status "TRONG_KHO / DANG_SU_DUNG / THANH_LY"
        String warehouse_id FK
        String voucher_id FK
    }

    InventoryVoucher {
        String id PK
        String voucher_code "Mã phiếu"
        String type "NHAP_KHO / XUAT_KHO"
        String sub_type "NHAP_MOI, XUAT_CHUYEN_KHO..."
        String status "PENDING / APPROVED"
        String from_warehouse_id FK
        String to_warehouse_id FK
    }

    InventoryVoucherDetail {
        String id PK
        String voucher_id FK
        String ten_vttb
        Int quantity
        Float dongia
    }
`;

export default function DatabaseDiagramPage() {
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [rendered, setRendered] = useState(false);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif'
        });

        const renderDiagram = async () => {
            if (mermaidRef.current) {
                try {
                    const { svg } = await mermaid.render('mermaid-svg', diagramCode);
                    mermaidRef.current.innerHTML = svg;
                    setRendered(true);
                } catch (error) {
                    console.error("Mermaid parsing failed", error);
                }
            }
        };

        renderDiagram();
    }, []);

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={3} className="!mb-0 text-slate-800">
                        <DatabaseOutlined className="mr-2 text-blue-600" />
                        Sơ Đồ Cấu Trúc Database Kho
                    </Title>
                    <p className="text-slate-500 mt-1">Sơ đồ Thực thể - Liên kết (ER Diagram) mô tả luồng luân chuyển vật tư thiết bị</p>
                </div>
                <Button 
                    icon={<ReloadOutlined />} 
                    onClick={() => window.location.reload()}
                >
                    Tải lại sơ đồ
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                {!rendered && (
                    <div className="flex justify-center items-center h-64 text-slate-400">
                        Đang vẽ sơ đồ...
                    </div>
                )}
                <div 
                    ref={mermaidRef} 
                    className="flex justify-center bg-white p-4 overflow-x-auto rounded-lg"
                />
                
                <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <Title level={5} className="!text-blue-800 mb-2">Chú thích các mối quan hệ quan trọng:</Title>
                    <ul className="list-disc pl-5 space-y-1 text-slate-700">
                        <li><strong>Warehouse (Kho)</strong> luôn thuộc về một <strong>Department (Khoa)</strong>.</li>
                        <li><strong>Equipment (Vật tư/Thiết bị)</strong> luôn nằm ở một <strong>Warehouse</strong>. Khi xuất kho sử dụng, nó có thể được đổi <code>warehouse_id</code> sang Kho của Khoa đó.</li>
                        <li><strong>InventoryVoucher (Phiếu Kho)</strong> tạo ra biến động số dư. Tùy loại (Nhập, Xuất, Luân chuyển) mà sử dụng <code>from_warehouse_id</code> và/hoặc <code>to_warehouse_id</code>.</li>
                        <li>Trường <code>voucher_id</code> trong bảng Equipment dùng để truy xuất xem thiết bị này được sinh ra từ Phiếu Nhập Kho nào.</li>
                    </ul>
                </div>
            </Card>
        </div>
    );
}
