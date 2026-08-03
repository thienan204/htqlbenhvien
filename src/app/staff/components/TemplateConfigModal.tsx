'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Upload, Button, message, Typography, Space, Divider, Alert, InputNumber, Form, Select, Input, AutoComplete } from 'antd';
import { InboxOutlined, DownloadOutlined, FileExcelOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

interface TemplateConfigModalProps {
    open: boolean;
    onClose: () => void;
}

export default function TemplateConfigModal({ open, onClose }: TemplateConfigModalProps) {
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [startRow, setStartRow] = useState<number | null>(8);
    const [groupBy, setGroupBy] = useState<string>('department');
    const [colCount, setColCount] = useState<number>(15);
    const [availableFields, setAvailableFields] = useState<{value: string, label: string}[]>([]);
    const [filters, setFilters] = useState<{field: string, operator: string, value: string}[]>([]);
    
    // States for adding new field
    const [showAddField, setShowAddField] = useState(false);
    const [newFieldValue, setNewFieldValue] = useState('');
    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [addingField, setAddingField] = useState(false);

    const dbFieldOptions = [
        { value: 'so_dien_thoai', label: 'so_dien_thoai (Số điện thoại)' },
        { value: 'ma_bhxh', label: 'ma_bhxh (Mã số BHXH)' },
        { value: 'ma_ho_gia_dinh', label: 'ma_ho_gia_dinh (Mã hộ gia đình)' },
        { value: 'ngay_cap_cccd', label: 'ngay_cap_cccd (Ngày cấp CCCD)' },
        { value: 'noi_cap_cccd', label: 'noi_cap_cccd (Nơi cấp CCCD)' },
        { value: 'dia_chi', label: 'dia_chi (Địa chỉ chi tiết)' },
        { value: 'so_qd_tuyen_dung', label: 'so_qd_tuyen_dung (Số QĐ tuyển dụng)' },
        { value: 'ngay_tuyen_dung', label: 'ngay_tuyen_dung (Ngày tuyển dụng)' },
        { value: 'thoi_diem_nang_luong', label: 'thoi_diem_nang_luong (Thời điểm nâng lương)' },
    ];

    const [columnMapping, setColumnMapping] = useState<{[key: string]: string}>({
        "1": "stt", "2": "ma_nv", "3": "ho_ten", "4": "nam_sinh", "5": "gioi_tinh",
        "6": "cccd", "7": "chuc_danh", "8": "vi_tri", "9": "loai_hd", "10": "thoi_gian",
        "11": "cchn_pham_vi", "12": "cchn_so", "13": "cchn_ngay_cap", "14": "cchn_noi_cap", "15": "ghi_chu"
    });

    // Lấy cấu hình hiện tại khi mở modal
    useEffect(() => {
        if (open) {
            const fetchConfig = async () => {
                try {
                    const basePath = window.location.pathname.split('/staff')[0];
                    const res = await fetch(`${basePath}/api/staff/template?type=bieu1a&action=config`);
                    if (res.ok) {
                        const data = await res.json();
                        setStartRow(data.startRow || 8);
                        if (data.groupBy) setGroupBy(data.groupBy);
                        if (data.columnMapping) {
                            setColumnMapping(data.columnMapping);
                            // Cập nhật số lượng cột dựa trên key lớn nhất
                            const keys = Object.keys(data.columnMapping).map(Number).filter(k => !isNaN(k));
                            if (keys.length > 0) setColCount(Math.max(...keys, 15));
                        }
                        if (data.filters) {
                            setFilters(data.filters);
                        }
                    }
                    
                    const resFields = await fetch(`${basePath}/api/staff/template?type=bieu1a&action=fields`);
                    if (resFields.ok) {
                        const fields = await resFields.json();
                        if (fields && fields.length > 0) setAvailableFields(fields);
                    }
                } catch (e) {
                    console.error(e);
                }
            };
            fetchConfig();
            setFileList([]); // Reset file list
        }
    }, [open]);

    const downloadCurrentTemplate = () => {
        const basePath = window.location.pathname.split('/staff')[0];
        const url = new URL(`${basePath}/api/staff/template?type=bieu1a`, window.location.origin);
        window.open(url.toString(), '_blank');
    };

    const handleUpload = async () => {
        const formData = new FormData();
        if (fileList.length > 0) {
            formData.append('file', fileList[0] as any);
        }
        formData.append('type', 'bieu1a');
        if (startRow) {
            formData.append('startRow', startRow.toString());
        }
        formData.append('groupBy', groupBy);
        formData.append('columnMapping', JSON.stringify(columnMapping));
        formData.append('filters', JSON.stringify(filters));

        try {
            setUploading(true);
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/template`, {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                message.success('Đã cập nhật file mẫu Biểu 1A thành công!');
                setFileList([]);
                onClose();
            } else {
                const data = await res.json();
                message.error(data.error || 'Cập nhật file mẫu thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi tải file lên máy chủ');
        } finally {
            setUploading(false);
        }
    };

    const handleAddField = async () => {
        if (!newFieldValue.trim() || !newFieldLabel.trim()) {
            message.warning('Vui lòng nhập đủ Mã trường và Tên hiển thị');
            return;
        }
        
        try {
            setAddingField(true);
            const formData = new FormData();
            formData.append('type', 'bieu1a');
            formData.append('action', 'addField');
            formData.append('value', newFieldValue.trim());
            formData.append('label', newFieldLabel.trim());

            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/template`, {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.fields) {
                    setAvailableFields(data.fields);
                    message.success(`Đã thêm trường: ${newFieldLabel}`);
                    setNewFieldValue('');
                    setNewFieldLabel('');
                    setShowAddField(false);
                }
            } else {
                message.error('Lỗi khi thêm trường mới');
            }
        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setAddingField(false);
        }
    };

    const uploadProps: UploadProps = {
        onRemove: (file) => {
            setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
        },
        beforeUpload: (file) => {
            const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx');
            if (!isExcel) {
                message.error('Chỉ hỗ trợ file Excel (.xlsx)');
                return Upload.LIST_IGNORE;
            }
            setFileList([file]);
            return false;
        },
        fileList,
        maxCount: 1
    };

    return (
        <Modal
            title={<span className="text-xl font-bold">Cấu hình File Mẫu (Template)</span>}
            open={open}
            onCancel={onClose}
            width="90%"
            footer={[
                <Button key="cancel" onClick={onClose} disabled={uploading}>
                    Đóng
                </Button>,
                <Button key="submit" type="primary" loading={uploading} onClick={handleUpload}>
                    Lưu Cấu Hình
                </Button>,
            ]}
        >
            <div className="py-2">
                <Alert 
                    type="info"
                    showIcon
                    description={
                        <div>
                            <div className="font-semibold text-slate-800">Quy trình sửa file mẫu Báo Cáo:</div>
                            <ol className="list-decimal pl-5 mt-2 mb-2 text-slate-600">
                                <li>Bấm tải <b>File mẫu hiện tại</b> về máy tính của bạn.</li>
                                <li>Mở file bằng Microsoft Excel, xóa hết các chữ dạng <code>{`{{...}}`}</code> ở dòng dữ liệu, chỉ giữ lại định dạng ô trống (màu sắc, viền, font chữ).</li>
                                <li>Thiết lập ánh xạ cột (Mapping) ở mục <b>Cấu hình Cột Dữ Liệu</b> phía dưới.</li>
                                <li>Lưu file trên Excel, sau đó <b>Tải file vừa sửa lên đây</b> để cập nhật hệ thống.</li>
                            </ol>
                            <div className="text-xs italic text-blue-600">
                                *Sử dụng tính năng <b>Gom nhóm dữ liệu</b> ở phần Cấu hình bên dưới để Báo cáo đẹp hơn.
                            </div>
                        </div>
                    }
                    className="mb-6"
                />

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between mb-6">
                    <div>
                        <div className="font-semibold text-blue-900 mb-1">Mẫu Biểu 1A (Trích ngang nhân sự)</div>
                        <div className="text-sm text-blue-600">Đang sử dụng mẫu chuẩn của hệ thống</div>
                    </div>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={downloadCurrentTemplate}>
                        Tải mẫu hiện tại
                    </Button>
                </div>

                <Divider>Cấu hình Mẫu xuất</Divider>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Form.Item label={<span className="font-medium">Dòng bắt đầu điền dữ liệu</span>}>
                        <InputNumber 
                            min={1} 
                            max={100} 
                            value={startRow} 
                            onChange={setStartRow} 
                            className="w-full"
                        />
                    </Form.Item>

                    <Form.Item label={<span className="font-medium">Gom nhóm dữ liệu theo</span>}>
                        <Select value={groupBy} onChange={setGroupBy} className="w-full">
                            <Select.Option value="none">Không gom nhóm (Phẳng)</Select.Option>
                            {availableFields.map(f => (
                                <Select.Option key={f.value} value={f.value}>{f.label}</Select.Option>
                            ))}
                            {availableFields.length === 0 && (
                                <>
                                    <Select.Option value="phong_ban">Khoa / Phòng</Select.Option>
                                    <Select.Option value="chuc_danh">Chức danh</Select.Option>
                                    <Select.Option value="vi_tri">Vị trí việc làm</Select.Option>
                                    <Select.Option value="loai_hd">Loại hợp đồng</Select.Option>
                                </>
                            )}
                        </Select>
                    </Form.Item>
                </div>

                <Divider>Cấu hình Lọc Dữ liệu (Bộ lọc)</Divider>
                <div className="mb-4">
                    {filters.map((filter, index) => (
                        <div key={index} className="flex items-center gap-3 mb-2 bg-slate-50 p-2 rounded border border-slate-200">
                            <Select 
                                className="w-1/3" 
                                placeholder="Chọn trường..."
                                value={filter.field}
                                onChange={(val) => {
                                    const newFilters = [...filters];
                                    newFilters[index].field = val;
                                    setFilters(newFilters);
                                }}
                            >
                                {availableFields.map(f => (
                                    <Select.Option key={f.value} value={f.value}>{f.label}</Select.Option>
                                ))}
                            </Select>
                            <Select 
                                className="w-32 shrink-0" 
                                value={filter.operator}
                                onChange={(val) => {
                                    const newFilters = [...filters];
                                    newFilters[index].operator = val;
                                    setFilters(newFilters);
                                }}
                            >
                                <Select.Option value="equals">Bằng (=)</Select.Option>
                                <Select.Option value="contains">Chứa từ khóa</Select.Option>
                                <Select.Option value="not_equals">Khác (!=)</Select.Option>
                                <Select.Option value="not_contains">Không chứa</Select.Option>
                            </Select>
                            <Input 
                                className="flex-1" 
                                placeholder="Giá trị lọc..." 
                                value={filter.value}
                                onChange={(e) => {
                                    const newFilters = [...filters];
                                    newFilters[index].value = e.target.value;
                                    setFilters(newFilters);
                                }}
                            />
                            <Button 
                                type="text" 
                                danger 
                                icon={<DeleteOutlined />} 
                                onClick={() => {
                                    const newFilters = [...filters];
                                    newFilters.splice(index, 1);
                                    setFilters(newFilters);
                                }}
                            />
                        </div>
                    ))}
                    <Button 
                        type="dashed" 
                        onClick={() => setFilters([...filters, { field: '', operator: 'equals', value: '' }])}
                        className="w-full"
                    >
                        + Thêm điều kiện lọc
                    </Button>
                </div>

                <Divider>Cấu hình Cột Dữ Liệu (Column Mapping)</Divider>
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <span className="font-medium">Số lượng cột dữ liệu:</span>
                            <InputNumber min={1} max={50} value={colCount} onChange={(val) => setColCount(val || 15)} />
                        </div>
                        <Button type="dashed" onClick={() => setShowAddField(!showAddField)}>
                            {showAddField ? 'Đóng' : '+ Thêm trường dữ liệu'}
                        </Button>
                    </div>

                    {showAddField && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-3 flex items-end gap-3 shadow-inner">
                            <div className="flex-1">
                                <div className="text-xs font-semibold text-slate-600 mb-1">Mã trường (Tên cột DB)</div>
                                <AutoComplete 
                                    className="w-full"
                                    placeholder="Chọn hoặc gõ tên cột..." 
                                    options={dbFieldOptions}
                                    value={newFieldValue} 
                                    onChange={(val) => setNewFieldValue(val)} 
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-semibold text-slate-600 mb-1">Tên hiển thị (Ví dụ: Số BHYT)</div>
                                <Input 
                                    placeholder="Tên hiện trong Dropdown..." 
                                    value={newFieldLabel} 
                                    onChange={(e) => setNewFieldLabel(e.target.value)} 
                                />
                            </div>
                            <Button type="primary" loading={addingField} onClick={handleAddField}>
                                Lưu vào Từ điển
                            </Button>
                        </div>
                    )}

                    <div className="max-h-96 overflow-y-auto pr-2 bg-slate-50 p-3 rounded border">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {Array.from({length: colCount}).map((_, idx) => {
                                const colIndex = (idx + 1).toString();
                                return (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-16 font-medium text-slate-500 shrink-0">Cột {colIndex}:</div>
                                        <Select 
                                            className="w-full"
                                            value={columnMapping[colIndex] || 'none'}
                                            onChange={(val) => setColumnMapping({...columnMapping, [colIndex]: val})}
                                        >
                                            <Select.Option value="none"><span className="text-slate-400">-- Bỏ trống --</span></Select.Option>
                                            {availableFields.map(f => (
                                                <Select.Option key={f.value} value={f.value}>{f.label}</Select.Option>
                                            ))}
                                            {availableFields.length === 0 && (
                                                <>
                                                    <Select.Option value="stt">Số thứ tự</Select.Option>
                                                    <Select.Option value="ma_nv">Mã nhân viên</Select.Option>
                                                    <Select.Option value="ho_ten">Họ và tên</Select.Option>
                                                </>
                                            )}
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <Divider>Tải lên mẫu mới</Divider>

                <Dragger {...uploadProps} className="bg-slate-50">
                    <p className="ant-upload-drag-icon">
                        <FileExcelOutlined className="text-green-600" />
                    </p>
                    <p className="ant-upload-text font-medium text-slate-700">Nhấp hoặc kéo thả file Excel vào đây</p>
                    <p className="ant-upload-hint text-slate-500">
                        Hệ thống sẽ lấy file mới này làm chuẩn cho tất cả các lần xuất báo cáo sau này.
                    </p>
                </Dragger>
            </div>
        </Modal>
    );
}
