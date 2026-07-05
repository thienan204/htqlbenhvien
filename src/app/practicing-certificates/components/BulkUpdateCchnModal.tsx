import React, { useState } from 'react';
import { Modal, Checkbox, Button, Upload, message, Alert, Typography, Space } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Text } = Typography;

const CCHN_FIELDS = [
    { value: 'ngay_cap', label: 'Ngày cấp (YYYY-MM-DD)' },
    { value: 'chuc_danh_cchn', label: 'Chức danh CCHN' },
    { value: 'pham_vi_hanh_nghe', label: 'Phạm vi hành nghề' },
    { value: 'pham_vi_bo_sung', label: 'Phạm vi bổ sung' },
    { value: 'dich_vu_ky_thuat', label: 'Dịch vụ kỹ thuật khác' },
    { value: 'noi_cap_cchn', label: 'Nơi cấp CCHN' },
    { value: 'vb_phan_cong', label: 'Văn bản phân công' },
    { value: 'thoi_gian_dang_ky', label: 'Thời gian đăng ký' },
    { value: 'thoi_gian_ngay', label: 'Thời gian ngày' },
    { value: 'thoi_gian_tuan', label: 'Thời gian tuần' },
    { value: 'cskcb_khac', label: 'Cơ sở KCB khác' },
    { value: 'cskcb_cgkt', label: 'Cơ sở KCB chuyển giao KT' },
    { value: 'qd_cgkt', label: 'Quyết định chuyển giao KT' },
    { value: 'tu_ngay', label: 'Từ ngày (YYYY-MM-DD)' },
    { value: 'den_ngay', label: 'Đến ngày (YYYY-MM-DD)' }
];

interface BulkUpdateCchnModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function BulkUpdateCchnModal({ open, onClose, onSuccess }: BulkUpdateCchnModalProps) {
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Hàm tạo File Excel Mẫu dựa trên các cột đã chọn
    const handleDownloadTemplate = () => {
        if (selectedFields.length === 0) {
            message.warning('Vui lòng chọn ít nhất một trường dữ liệu để tạo mẫu!');
            return;
        }

        // Tạo dòng header
        const headers = ['so_cchn']; // Bắt buộc phải có so_cchn để làm khóa chính
        selectedFields.forEach(field => {
            headers.push(field);
        });

        const wsData = [headers];
        
        // Dòng ví dụ (Mock data)
        const sampleRow = ['CCHN-123456'];
        selectedFields.forEach(field => {
            if (field.includes('ngay')) {
                sampleRow.push('2024-01-01');
            } else {
                sampleRow.push('Dữ liệu mẫu');
            }
        });
        wsData.push(sampleRow);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Chỉnh độ rộng cột
        const colWidths = headers.map(() => ({ wch: 25 }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Update_CCHN');
        XLSX.writeFile(wb, `Mau_Update_CCHN_Dynamic.xlsx`);
    };

    // Hàm xử lý khi Upload File Excel
    const handleFileUpload = (file: File) => {
        setUploading(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length <= 1) {
                    message.error('File không có dữ liệu');
                    setUploading(false);
                    return;
                }

                const headers = jsonData[0] as string[];
                const soCchnIndex = headers.findIndex(h => h.toLowerCase() === 'so_cchn');

                if (soCchnIndex === -1) {
                    message.error('File Excel bắt buộc phải có cột "so_cchn"');
                    setUploading(false);
                    return;
                }

                const updates = [];

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const so_cchn = row[soCchnIndex];
                    if (!so_cchn) continue;

                    const rowUpdate: any = { so_cchn: so_cchn.toString().trim() };

                    // Quét qua tất cả các cột khác
                    headers.forEach((header, index) => {
                        if (index !== soCchnIndex && header) {
                            const val = row[index];
                            // Nếu có dữ liệu thì mới parse
                            if (val !== undefined && val !== null && val !== '') {
                                // Nếu là phạm vi hành nghề, tách lấy ID
                                if (header === 'pham_vi_hanh_nghe') {
                                    const parts = val.toString().split(';');
                                    const ids: string[] = [];
                                    parts.forEach((p: string) => {
                                        const match = p.trim().match(/^(\d+)/);
                                        if (match && match[1]) ids.push(match[1]);
                                    });
                                    if (ids.length > 0) {
                                        rowUpdate.pham_vi_hanh_nghe_ids = ids;
                                    }
                                } else if (header.includes('ngay') && typeof val === 'number') {
                                    const date = new Date((val - (25567 + 2)) * 86400 * 1000); // Công thức chuẩn Excel
                                    rowUpdate[header] = date.toISOString();
                                } else {
                                    rowUpdate[header] = val.toString().trim();
                                }
                            }
                        }
                    });

                    // Nếu có ít nhất 1 trường ngoài so_cchn để update
                    if (Object.keys(rowUpdate).length > 1) {
                        updates.push(rowUpdate);
                    }
                }

                if (updates.length === 0) {
                    message.warning('Không tìm thấy dữ liệu hợp lệ để cập nhật');
                    setUploading(false);
                    return;
                }

                // Gọi API Bulk Update
                const res = await fetch('/api/practicing-certificates/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates })
                });

                const result = await res.json();

                if (res.ok) {
                    if (result.failedCount > 0) {
                        message.warning(`Đã cập nhật ${result.successCount} CCHN. Lỗi ${result.failedCount} CCHN (xem console).`);
                        console.warn('Các CCHN bị lỗi:', result.failedRows);
                    } else {
                        message.success(`Cập nhật thành công toàn bộ ${result.successCount} CCHN!`);
                    }
                    onSuccess();
                } else {
                    message.error(result.error || 'Lỗi cập nhật dữ liệu');
                }
            } catch (error) {
                console.error(error);
                message.error('Có lỗi xảy ra khi đọc file Excel');
            } finally {
                setUploading(false);
            }
        };

        reader.readAsArrayBuffer(file);
        return false; // Ngăn Antd upload tự động
    };

    return (
        <Modal
            title="Cập nhật hàng loạt CCHN qua Excel"
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Alert 
                title="Hướng dẫn sử dụng" 
                description={
                    <ul className="list-disc pl-5 mt-2 mb-0">
                        <li>Bước 1: Chọn các trường dữ liệu bạn muốn cập nhật ở bên dưới.</li>
                        <li>Bước 2: Bấm nút "Tải File Mẫu" để sinh ra file Excel với đúng các cột đã chọn.</li>
                        <li>Bước 3: Điền dữ liệu vào file Excel (Nhớ điền đúng cột <b>so_cchn</b>).</li>
                        <li>Bước 4: Tải file đó lên ở phần Import bên dưới. Hệ thống sẽ tự động cập nhật!</li>
                    </ul>
                }
                type="info" 
                showIcon 
                className="mb-6"
            />

            <div className="mb-6">
                <Text strong className="block mb-2 text-lg">1. Chọn trường cần xuất ra File Mẫu:</Text>
                <Checkbox.Group 
                    options={CCHN_FIELDS} 
                    value={selectedFields} 
                    onChange={(checkedValues) => setSelectedFields(checkedValues as string[])} 
                    className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-slate-50 border border-slate-200 rounded-lg"
                />
                
                <div className="mt-4">
                    <Button 
                        type="primary" 
                        icon={<DownloadOutlined />} 
                        onClick={handleDownloadTemplate}
                        disabled={selectedFields.length === 0}
                    >
                        Tải File Mẫu (Đã chọn {selectedFields.length} trường)
                    </Button>
                </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
                <Text strong className="block mb-4 text-lg">2. Upload File đã điền dữ liệu để Cập nhật:</Text>
                <Upload 
                    beforeUpload={handleFileUpload} 
                    showUploadList={false} 
                    accept=".xlsx, .xls"
                >
                    <Button size="large" icon={<UploadOutlined />} loading={uploading}>
                        Import File Cập nhật
                    </Button>
                </Upload>
            </div>
        </Modal>
    );
}
