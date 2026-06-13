'use client';

import React, { useState } from 'react';
import { Modal, Upload, Button, message, Typography, Space } from 'antd';
import { InboxOutlined, FileExcelOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import * as XLSX from 'xlsx';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

interface ImportStaffModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ImportStaffModal({ open, onClose, onSuccess }: ImportStaffModalProps) {
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    const handleUpload = async () => {
        if (fileList.length === 0) {
            message.warning('Vui lòng chọn file Excel để tải lên!');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileList[0] as any);

        setUploading(true);
        try {
            const res = await fetch('/api/staff/import', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                message.success(data.message || 'Import thành công!');
                setFileList([]);
                onSuccess();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi import file');
            }
        } catch (error) {
            message.error('Lỗi kết nối tới máy chủ');
        } finally {
            setUploading(false);
        }
    };

    const uploadProps: UploadProps = {
        onRemove: (file) => {
            setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
        },
        beforeUpload: (file) => {
            const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
            if (!isExcel) {
                message.error('Chỉ hỗ trợ tải lên file Excel (.xlsx, .xls)');
                return Upload.LIST_IGNORE;
            }
            setFileList([file]);
            return false; // Prevent automatic upload
        },
        fileList,
        maxCount: 1
    };

    const downloadSampleFile = () => {
        const wsData = [
            [
                'Mã NV', 'Họ và tên', 'Nam', 'Nữ', 
                'Trình độ\r\nchuyên môn', 'Chức danh\r\nnghề nghiệp', 
                'Vị trí việc làm', 'Mã khoa phòng', 'Chức vụ', 'Loại hợp đồng', 
                'Số chứng chỉ hành nghề đăng ký với BHYT', 'Ngày cấp\r\n(Năm-Tháng-Ngày)', 
                'CDNN trong CCHN', 'Phạm vi hành nghề', 'Phạm vi chuyên môn bổ sung', 
                'Dịch vụ kỹ thuật khác', 'Số\r\nđiện thoại'
            ],
            [
                'BS01', 'Nguyễn Văn A', '1990-01-01', '', 
                'Đại học', 'Bác sĩ', 
                'Bác sĩ điều trị', 'K01', 'Trưởng khoa', 'Biên chế', 
                'CCHN-12345', '20150520', 
                'Bác sĩ đa khoa', 'Khám bệnh, chữa bệnh chuyên khoa nội', '', 
                '', '0901234567'
            ],
            [
                'DD01', 'Trần Thị B', '', '1995-10-15', 
                'Cao đẳng', 'Điều dưỡng', 
                'Điều dưỡng viên', 'K02', '', 'Hợp đồng LĐ', 
                '', '', 
                '', '', '', 
                '', '0987654321'
            ]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Chỉnh độ rộng cột
        ws['!cols'] = [
            { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
            { wch: 15 }, { wch: 15 }, 
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
            { wch: 35 }, { wch: 20 }, 
            { wch: 20 }, { wch: 30 }, { wch: 30 }, 
            { wch: 30 }, { wch: 15 }
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Danh sach Nhan su');
        XLSX.writeFile(wb, `Mau_Import_Nhan_Su.xlsx`);
    };

    return (
        <Modal
            title={<Space><FileExcelOutlined className="text-green-600" /> <span>Import Danh sách Nhân sự</span></Space>}
            open={open}
            onCancel={onClose}
            footer={[
                <Button key="sample" icon={<DownloadOutlined />} onClick={downloadSampleFile} className="float-left">
                    Tải file mẫu
                </Button>,
                <Button key="back" onClick={onClose} disabled={uploading}>
                    Hủy
                </Button>,
                <Button key="submit" type="primary" loading={uploading} onClick={handleUpload} disabled={fileList.length === 0}>
                    Bắt đầu Import
                </Button>,
            ]}
        >
            <div className="py-4">
                <Paragraph className="text-slate-500 mb-6">
                    Hệ thống sẽ tự động quét file Excel <strong>dsnv.xlsx</strong>. 
                    <br/>- Các <strong>Danh mục</strong> (Giới tính, Hợp đồng, Chức danh...) sẽ được tự động khởi tạo nếu chưa có.
                    <br/>- Các <strong>Chứng chỉ hành nghề mới</strong> sẽ được tự động liên kết vào hồ sơ nhân sự (1-Nhiều).
                </Paragraph>
                <Dragger {...uploadProps}>
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined className="text-blue-500" />
                    </p>
                    <p className="ant-upload-text font-medium">Nhấp hoặc kéo thả file Excel vào khu vực này</p>
                    <p className="ant-upload-hint text-slate-400">
                        Hỗ trợ file .xlsx, .xls. Dữ liệu sẽ được đối chiếu qua cột Mã NV.
                    </p>
                </Dragger>
            </div>
        </Modal>
    );
}
