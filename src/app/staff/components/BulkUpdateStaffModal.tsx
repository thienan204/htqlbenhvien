import React, { useState } from 'react';
import { Modal, Checkbox, Button, Upload, message, Alert, Typography } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Text } = Typography;

const STAFF_FIELDS = [
    { value: 'ho_ten', label: 'Họ và tên' },
    { value: 'ma_khoa', label: 'Mã khoa' },
    { value: 'cccd', label: 'Căn cước công dân (CCCD)' },
    { value: 'so_dien_thoai', label: 'Số điện thoại' },
    { value: 'ngay_sinh', label: 'Ngày sinh (YYYY-MM-DD)' },
    { value: 'dia_chi', label: 'Địa chỉ' },
    { value: 'ma_bhxh', label: 'Mã BHXH' },
    { value: 'gioi_tinh', label: 'Giới tính (Danh mục)' },
    { value: 'dan_toc', label: 'Dân tộc (Danh mục)' },
    { value: 'chuc_danh', label: 'Chức danh nghề nghiệp (Danh mục)' },
    { value: 'chuc_vu', label: 'Chức vụ (Danh mục)' },
    { value: 'trinh_do', label: 'Trình độ (Danh mục)' },
    { value: 'vi_tri_viec_lam', label: 'Vị trí việc làm (Danh mục)' },
    { value: 'loai_hop_dong', label: 'Loại hợp đồng (Danh mục)' }
];

interface BulkUpdateStaffModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function BulkUpdateStaffModal({ open, onClose, onSuccess }: BulkUpdateStaffModalProps) {
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    const handleDownloadTemplate = () => {
        if (selectedFields.length === 0) {
            message.warning('Vui lòng chọn ít nhất một trường dữ liệu để tạo mẫu!');
            return;
        }

        const headers = ['ma_nv']; 
        selectedFields.forEach(field => {
            headers.push(field);
        });

        const wsData = [headers];
        
        const sampleRow = ['BV0001'];
        selectedFields.forEach(field => {
            if (field.includes('ngay')) {
                sampleRow.push('1990-01-01');
            } else {
                sampleRow.push('Dữ liệu mẫu');
            }
        });
        wsData.push(sampleRow);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        const colWidths = headers.map(() => ({ wch: 25 }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Update_Staff');
        XLSX.writeFile(wb, `Mau_Update_Staff_Dynamic.xlsx`);
    };

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
                const maNvIndex = headers.findIndex(h => h.toLowerCase() === 'ma_nv');

                if (maNvIndex === -1) {
                    message.error('File Excel bắt buộc phải có cột "ma_nv"');
                    setUploading(false);
                    return;
                }

                const updates = [];

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const ma_nv = row[maNvIndex];
                    if (!ma_nv) continue;

                    const rowUpdate: any = { ma_nv: ma_nv.toString().trim() };

                    headers.forEach((header, index) => {
                        if (index !== maNvIndex && header) {
                            const val = row[index];
                            if (val !== undefined && val !== null && val !== '') {
                                if (header.includes('ngay') && typeof val === 'number') {
                                    const date = new Date((val - (25567 + 2)) * 86400 * 1000); 
                                    rowUpdate[header] = date.toISOString();
                                } else {
                                    rowUpdate[header] = val.toString().trim();
                                }
                            }
                        }
                    });

                    if (Object.keys(rowUpdate).length > 1) {
                        updates.push(rowUpdate);
                    }
                }

                if (updates.length === 0) {
                    message.warning('Không tìm thấy dữ liệu hợp lệ để cập nhật');
                    setUploading(false);
                    return;
                }

                const res = await fetch('/api/staff/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates })
                });

                const result = await res.json();

                if (res.ok) {
                    if (result.failedCount > 0) {
                        message.warning(`Đã cập nhật ${result.successCount} nhân sự. Lỗi ${result.failedCount} dòng (xem console).`);
                        console.warn('Các dòng bị lỗi:', result.failedRows);
                    } else {
                        message.success(`Cập nhật thành công toàn bộ ${result.successCount} nhân sự!`);
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
        return false; 
    };

    return (
        <Modal
            title="Cập nhật hàng loạt Nhân sự qua Excel"
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Alert 
                title="Hướng dẫn sử dụng" 
                description={
                    <ul className="list-disc pl-5 mt-2 mb-0">
                        <li>Bước 1: Chọn các trường dữ liệu bạn muốn cập nhật bổ sung ở bên dưới.</li>
                        <li>Bước 2: Bấm nút "Tải File Mẫu" để sinh ra file Excel với đúng các cột đã chọn.</li>
                        <li>Bước 3: Điền dữ liệu vào file (Bắt buộc phải điền chuẩn cột <b>ma_nv</b>). Các trường Danh mục (Giới tính, Dân tộc, Trình độ...) chỉ cần gõ Tên.</li>
                        <li>Bước 4: Tải file đó lên ở phần Import bên dưới. Hệ thống sẽ tự động đối chiếu và cập nhật!</li>
                    </ul>
                }
                type="info" 
                showIcon 
                className="mb-6"
            />

            <div className="mb-6">
                <Text strong className="block mb-2 text-lg">1. Chọn trường cần xuất ra File Mẫu để điền bổ sung:</Text>
                <Checkbox.Group 
                    options={STAFF_FIELDS} 
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
