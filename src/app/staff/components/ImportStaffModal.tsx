'use client';

import React, { useState } from 'react';
import { Modal, Upload, Button, message, Typography, Space, Alert } from 'antd';
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

            const contentType = res.headers.get('content-type');
            if (res.ok && contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
                // Download file
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `KetQua_Import_${new Date().getTime()}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                
                const success = res.headers.get('X-Success-Count') || '0';
                const failed = res.headers.get('X-Failed-Count') || '0';
                
                if (parseInt(failed) > 0) {
                    message.warning(`Import xong! Thành công: ${success}, Thất bại: ${failed}. Vui lòng mở file vừa tải về để xem chi tiết lỗi!`, 5);
                } else {
                    message.success(`Import thành công toàn bộ ${success} dòng!`, 5);
                }
                
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
                'Mã NV', 'Họ và tên', 'Mã khoa phòng', 'Nam', 'Nữ', 'Căn cước công dân', 'Dân tộc', 'Số điện thoại', 'Mã BHXH',
                'Nơi sinh', 'Quê quán', 'Nơi ở hiện nay', 'Tôn giáo',
                'Trình độ chuyên môn', 'Chức danh nghề nghiệp', 'Chức vụ', 'Vị trí việc làm', 'Loại hợp đồng',
                'Số QĐ Tuyển dụng', 'Ngày Tuyển dụng', 'Mã ngạch', 'Hệ số lương', 'Bậc lương', 'Phụ cấp TNVK', 'Thời điểm nâng lương',
                'Số chứng chỉ hành nghề đăng ký với BHYT', 'Ngày cấp (Năm-Tháng-Ngày)', 'Nơi cấp CCHN', 
                'CDNN trong CCHN', 'Phạm vi hành nghề', 'Phạm vi chuyên môn bổ sung', 'Dịch vụ kỹ thuật khác'
            ],
            [
                'BS01', 'Nguyễn Văn A', 'K01', '1990-01-01', '', '012345678901', 'Kinh', '0901234567', 'BHXH12345',
                'Phường Chi Lăng', 'Phường Tam Thanh', 'Phường Đông Kinh', 'Không',
                'Đại học', 'Bác sĩ', 'Trưởng khoa', 'Bác sĩ điều trị', 'Biên chế',
                '123/QĐ-SYT', '2015-05-01', 'V.08.01.03', '3.33', '2', '0.2', '2023-01-01',
                'CCHN-12345', '20150520', 'Sở Y Tế Lạng Sơn',
                'Bác sĩ đa khoa', '301 - Khám bệnh, chữa bệnh chuyên khoa nội', '', ''
            ]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Chỉnh độ rộng cột
        ws['!cols'] = [
            { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
            { wch: 35 }, { wch: 20 }, { wch: 20 },
            { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 30 }
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
                    Tải File Mẫu (Cập nhật 2026)
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

                <Alert 
                    title="Hướng dẫn Import" 
                    description={
                        <ul className="list-disc pl-5 mt-2 mb-0 text-sm text-slate-600">
                            <li><b>Mã NV, Họ Tên, Mã Khoa</b> là các trường bắt buộc.</li>
                            <li>Nếu Mã NV <b>chưa có</b> trên phần mềm: Tạo mới nhân sự.</li>
                            <li>Nếu Mã NV <b>đã tồn tại</b>: Hệ thống sẽ <b>Cập nhật (Ghi đè)</b>. Các ô Excel bỏ trống sẽ được bỏ qua.</li>
                            <li>Ngày tháng điền chuẩn định dạng (YYYY-MM-DD hoặc YYYYMMDD).</li>
                            <li>Các trường Danh mục (Trình độ, Dân tộc, Lương...) chỉ cần điền đúng Tên, phần mềm sẽ tự tạo danh mục nếu chưa có.</li>
                            <li className="text-purple-600 font-medium">Sau khi Import xong, hệ thống sẽ tự sinh ra file Excel Báo Cáo ghi rõ dòng nào thành công, dòng nào lỗi ở cột cuối cùng!</li>
                        </ul>
                    }
                    type="info" 
                    showIcon 
                    className="mb-4"
                />

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
