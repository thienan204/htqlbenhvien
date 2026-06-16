import React, { useRef } from 'react';
import { Modal, Button, Typography, QRCode } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface PrintQRCodeModalProps {
    open: boolean;
    onClose: () => void;
    equipment: any;
}

export default function PrintQRCodeModal({ open, onClose, equipment }: PrintQRCodeModalProps) {
    const qrRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        if (!equipment) return;
        
        // Tạo một cửa sổ in mới
        const printWindow = window.open('', '', 'width=600,height=600');
        if (!printWindow) return;

        // Lấy thẻ canvas của antd QRCode
        const canvas = qrRef.current?.querySelector('canvas');
        const dataUrl = canvas?.toDataURL('image/png');

        printWindow.document.write(`
            <html>
                <head>
                    <title>In Tem Thiết Bị</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 20px;
                            display: flex;
                            justify-content: center;
                            background-color: #fff;
                        }
                        .label-container {
                            border: 2px solid #000;
                            padding: 15px;
                            width: 300px;
                            text-align: center;
                            border-radius: 8px;
                        }
                        .hospital-name {
                            font-size: 14px;
                            font-weight: bold;
                            text-transform: uppercase;
                            margin-bottom: 10px;
                            border-bottom: 1px solid #ccc;
                            padding-bottom: 5px;
                        }
                        .equipment-name {
                            font-size: 16px;
                            font-weight: bold;
                            margin-top: 10px;
                            margin-bottom: 5px;
                        }
                        .equipment-code {
                            font-size: 14px;
                            color: #333;
                            margin-bottom: 15px;
                        }
                        .qr-image {
                            width: 150px;
                            height: 150px;
                            margin: 0 auto;
                        }
                        @media print {
                            @page { margin: 0; }
                            body { padding: 10mm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        <div class="hospital-name">Bệnh viện Đa Khoa Lạng Sơn</div>
                        ${dataUrl ? `<img class="qr-image" src="${dataUrl}" />` : ''}
                        <div class="equipment-name">${equipment.ten_vttb}</div>
                        <div class="equipment-code">Mã: ${equipment.ma_vttb}</div>
                    </div>
                    <script>
                        // Đợi ảnh render xong trên window mới gọi print
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Modal
            title="In Tem Mã QR"
            open={open}
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Đóng
                </Button>,
                <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint} className="bg-blue-600">
                    Tiến hành In
                </Button>
            ]}
            centered
            width={400}
        >
            {equipment && (
                <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-lg border border-slate-200 mt-4">
                    <Text type="secondary" className="mb-4">Bệnh viện Đa Khoa Lạng Sơn</Text>
                    <div ref={qrRef} className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                        <QRCode 
                            value={equipment.qr_code} 
                            size={180} 
                            color="#1e293b" // slate-800
                            bordered={false}
                        />
                    </div>
                    <Title level={5} className="!mt-4 !mb-1 text-center px-4">{equipment.ten_vttb}</Title>
                    <Text strong className="text-blue-600">Mã: {equipment.ma_vttb}</Text>
                </div>
            )}
        </Modal>
    );
}
