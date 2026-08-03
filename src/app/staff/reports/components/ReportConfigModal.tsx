'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Upload, Button, message, Typography, Space, Divider, Alert, InputNumber, Form, Select, Input, AutoComplete, Tabs } from 'antd';
import { InboxOutlined, DownloadOutlined, FileExcelOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

interface ReportConfigModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    templateId?: string | null;
}

export default function ReportConfigModal({ open, onClose, onSuccess, templateId }: ReportConfigModalProps) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [reportType, setReportType] = useState('LISTING');
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
                    if (templateId) {
                        const res = await fetch(`${basePath}/api/staff/reports/${templateId}`);
                        if (res.ok) {
                            const data = await res.json();
                            setCode(data.code);
                            setName(data.name);
                            setDescription(data.description || '');
                            setReportType(data.reportType || 'LISTING');
                            setStartRow(data.startRow || 8);
                            if (data.groupBy) setGroupBy(data.groupBy);
                            if (data.columnMapping) {
                                const map = JSON.parse(data.columnMapping);
                                setColumnMapping(map);
                                const keys = Object.keys(map).map(Number).filter(k => !isNaN(k));
                                if (keys.length > 0) setColCount(Math.max(...keys, 15));
                            }
                            if (data.filters) {
                                setFilters(JSON.parse(data.filters));
                            }
                        }
                    } else {
                        setCode('');
                        setName('');
                        setDescription('');
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
        if (!code || !name) {
            message.warning('Vui lòng nhập Mã và Tên báo cáo');
            return;
        }

        const formData = new FormData();
        if (fileList.length > 0) {
            formData.append('file', fileList[0] as any);
        }
        formData.append('code', code);
        formData.append('name', name);
        formData.append('description', description);
        formData.append('reportType', reportType);
        if (startRow) formData.append('startRow', startRow.toString());
        formData.append('groupBy', groupBy);
        formData.append('columnMapping', JSON.stringify(columnMapping));
        formData.append('filters', JSON.stringify(filters));

        try {
            setUploading(true);
            const basePath = window.location.pathname.split('/staff')[0];
            const url = templateId 
                ? `${basePath}/api/staff/reports/${templateId}` 
                : `${basePath}/api/staff/reports`;
                
            const res = await fetch(url, {
                method: templateId ? 'PUT' : 'POST',
                body: formData,
            });

            if (res.ok) {
                message.success(templateId ? 'Cập nhật thành công!' : 'Tạo mới thành công!');
                setFileList([]);
                if (onSuccess) onSuccess();
                else onClose();
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
            title={<span className="text-xl font-bold">{templateId ? 'Sửa Mẫu Báo Cáo' : 'Tạo Mẫu Báo Cáo Mới'}</span>}
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
                <Tabs
                    type="card"
                    items={[
                        {
                            key: '1',
                            label: 'Cấu hình Báo cáo',
                            children: (
                                <>
                                    <Divider>Thông tin Chung</Divider>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <Form.Item label="Mã báo cáo" required>
                                            <Input value={code} onChange={e => setCode(e.target.value)} disabled={!!templateId} />
                                        </Form.Item>
                                        <Form.Item label="Tên báo cáo" required>
                                            <Input value={name} onChange={e => setName(e.target.value)} />
                                        </Form.Item>
                                        <Form.Item label="Loại báo cáo" className="col-span-2">
                                            <Select value={reportType} onChange={setReportType}>
                                                <Select.Option value="LISTING">Báo cáo Danh sách (Listing)</Select.Option>
                                                <Select.Option value="STATISTIC">Báo cáo Thống kê / Tổng hợp (Statistic)</Select.Option>
                                                <Select.Option value="COMBINED">Báo cáo Hỗn hợp (Danh sách + Thống kê)</Select.Option>
                                            </Select>
                                        </Form.Item>
                                        <Form.Item label="Mô tả" className="col-span-2">
                                            <Input.TextArea value={description} onChange={e => setDescription(e.target.value)} />
                                        </Form.Item>
                                    </div>

                                    <Divider>Cấu hình Mẫu xuất</Divider>

                                    {reportType === 'LISTING' && (
                                        <div className="grid grid-cols-2 gap-6 mb-6">
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold text-slate-700 whitespace-nowrap">Dòng bắt đầu điền dữ liệu:</span>
                                                <InputNumber 
                                                    min={1} 
                                                    value={startRow} 
                                                    onChange={setStartRow} 
                                                    className="w-24"
                                                />
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold text-slate-700 whitespace-nowrap">Gom nhóm dữ liệu theo:</span>
                                                <Select 
                                                    className="flex-1"
                                                    value={groupBy}
                                                    onChange={setGroupBy}
                                                    showSearch
                                                    optionFilterProp="children"
                                                >
                                                    <Select.Option value="none">-- Không gom nhóm --</Select.Option>
                                                    <Select.Option value="department">Khoa / Phòng</Select.Option>
                                                    <Select.Option value="job_title">Chức danh</Select.Option>
                                                    {availableFields.map(f => (
                                                        <Select.Option key={f.value} value={f.value}>{f.label}</Select.Option>
                                                    ))}
                                                </Select>
                                            </div>
                                        </div>
                                    )}

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

                                    {(reportType === 'LISTING' || reportType === 'COMBINED') && (
                                        <>
                                            <Divider>Cấu hình Cột Dữ Liệu (Column Mapping)</Divider>
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-slate-700">Số lượng cột dữ liệu:</span>
                                                    <InputNumber min={1} max={100} value={colCount} onChange={val => setColCount(val || 15)} />
                                                </div>
                                                <Button type="dashed" onClick={() => setShowAddField(!showAddField)}>
                                                    + Thêm trường dữ liệu
                                                </Button>
                                            </div>

                                            {showAddField && (
                                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 flex gap-4 items-end">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-slate-600 mb-1">Mã trường (Tương ứng API)</div>
                                                        <Input 
                                                            placeholder="Ví dụ: dan_toc" 
                                                            value={newFieldValue} 
                                                            onChange={(e) => setNewFieldValue(e.target.value.toLowerCase().replace(/\s+/g, '_'))} 
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-slate-600 mb-1">Tên hiển thị</div>
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

                                            <div className="max-h-96 overflow-y-auto pr-2 bg-slate-50 p-3 rounded border mb-6">
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
                                        </>
                                    )}

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
                                </>
                            )
                        },
                        {
                            key: '2',
                            label: 'Hướng dẫn sử dụng',
                            children: (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                        <h3 className="text-blue-800 font-bold text-lg mb-2 flex items-center gap-2">
                                            <DownloadOutlined /> Tải File Excel Mẫu
                                        </h3>
                                        <p className="text-blue-700 mb-3">Bạn có thể tải các file mẫu dưới đây về máy để tham khảo cách cấu hình hoặc dùng ngay lập tức.</p>
                                        <div className="flex gap-4">
                                            <Button type="primary" ghost icon={<FileExcelOutlined />} href="/htqlbenhvien/sample-reports/Template_Listing.xlsx" target="_blank">
                                                Mẫu Danh sách
                                            </Button>
                                            <Button type="primary" ghost icon={<FileExcelOutlined />} href="/htqlbenhvien/sample-reports/Template_Statistic.xlsx" target="_blank">
                                                Mẫu Thống kê (Data Dump)
                                            </Button>
                                            <Button type="primary" ghost icon={<FileExcelOutlined />} href="/htqlbenhvien/sample-reports/Template_Combined.xlsx" target="_blank">
                                                Mẫu Hỗn hợp (Cả hai)
                                            </Button>
                                        </div>
                                    </div>

                                    <Alert 
                                        type="info"
                                        showIcon
                                        title={<span className="font-semibold text-lg">1. Báo cáo Danh sách (Listing)</span>}
                                        description={
                                            <div className="mt-2 text-slate-700">
                                                <p className="mb-2">Dùng để xuất danh sách cán bộ, nhân viên (mỗi dòng là một người).</p>
                                                <div className="font-semibold mb-1">Cách làm:</div>
                                                <ol className="list-decimal pl-5 space-y-1">
                                                    <li>Tạo file mẫu bằng Excel, định dạng tiêu đề, màu sắc tùy ý.</li>
                                                    <li>Thiết lập ánh xạ cột (Mapping) ở mục <b>Cấu hình Cột Dữ Liệu</b> tương ứng với thứ tự cột trong file Excel (Ví dụ: Cột 1 là STT, Cột 2 là Họ tên...).</li>
                                                    <li>Hệ thống sẽ tự động điền danh sách nhân sự từ <b>Dòng bắt đầu điền dữ liệu</b>.</li>
                                                    <li>(Tùy chọn) Chọn <b>Gom nhóm dữ liệu</b> để tự động chia nhóm (Ví dụ: Gom theo Khoa/Phòng).</li>
                                                </ol>
                                            </div>
                                        }
                                    />

                                    <Alert 
                                        type="success"
                                        showIcon
                                        title={<span className="font-semibold text-lg">2. Báo cáo Thống kê / Tổng hợp (Statistic)</span>}
                                        description={
                                            <div className="mt-2 text-slate-700">
                                                <p className="mb-2">Dùng để đếm số lượng dựa trên các điều kiện đan chéo (Ví dụ: Đếm số lượng Nữ là Thạc sĩ).</p>
                                                <div className="font-semibold mb-1">Cách làm (Cơ chế Data Dump):</div>
                                                <ol className="list-decimal pl-5 space-y-1">
                                                    <li>Tạo file mẫu bằng Excel. <b>Sheet 1</b> chứa biểu mẫu báo cáo thống kê của bạn.</li>
                                                    <li>Tạo thêm <b>Sheet 2</b> và đổi tên sheet này thành đúng chữ <code>Data_Raw</code>. (Cứ để trống sheet này).</li>
                                                    <li>Quay lại <b>Sheet 1</b>, dùng các hàm Excel (như <code>COUNTIFS</code> hoặc <code>Pivot Table</code>) để lấy dữ liệu từ sheet <code>Data_Raw</code>.</li>
                                                    <li>Tải file này lên phần mềm. Khi xuất báo cáo, phần mềm sẽ tự động ném toàn bộ dữ liệu thô vào sheet <code>Data_Raw</code>, và các hàm Excel ở Sheet 1 sẽ tự động nhảy số chuẩn xác!</li>
                                                </ol>
                                            </div>
                                        }
                                    />

                                    <Alert 
                                        type="warning"
                                        showIcon
                                        title={<span className="font-semibold text-lg">3. Báo cáo Hỗn hợp (Danh sách + Thống kê)</span>}
                                        description={
                                            <div className="mt-2 text-slate-700">
                                                <p className="mb-2">Kết hợp sức mạnh của cả 2 loại trên trong cùng một file.</p>
                                                <div className="font-semibold mb-1">Cơ chế hoạt động:</div>
                                                <ol className="list-decimal pl-5 space-y-1">
                                                    <li>Hệ thống sẽ điền Danh sách chi tiết vào <b>Sheet 1</b> (áp dụng các cấu hình ánh xạ cột, gom nhóm).</li>
                                                    <li>Đồng thời, hệ thống cũng đổ toàn bộ dữ liệu thô vào sheet <b>Data_Raw</b> (thường nằm ở Sheet 2).</li>
                                                    <li>Bạn có thể tạo thêm <b>Sheet 3</b> để vẽ biểu đồ hoặc tạo Pivot Table đọc dữ liệu từ Data_Raw.</li>
                                                </ol>
                                            </div>
                                        }
                                    />
                                </div>
                            )
                        }
                    ]}
                />
            </div>
        </Modal>
    );
}
