'use client';
import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Space, message, Tag, Popconfirm, Upload, AutoComplete, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const DEFAULT_FIELDS = [
    { code: 'ma_ba', name: 'Mã Bệnh Án / Hồ Sơ' },
    { code: 'ten_bn', name: 'Tên Bệnh Nhân' },
    { code: 'thoi_gian_chi_dinh', name: 'Thời gian chỉ định' },
    { code: 'ma_dich_vu', name: 'Mã Dịch Vụ', required: true },
    { code: 'ten_dich_vu', name: 'Tên Dịch Vụ' },
    { code: 'ten_khoa', name: 'Tên Khoa' },
    { code: 'ma_khoa', name: 'Mã Khoa' },
    { code: 'phong_thuc_hien', name: 'Phòng thực hiện' }
];

const OUTPUT_FIELDS = [
    { code: 'out_ma_ba', name: 'Mã Bệnh Án' },
    { code: 'out_ten_bn', name: 'Tên Bệnh Nhân' },
    { code: 'out_thoi_gian_chi_dinh', name: 'TG Chỉ định' },
    { code: 'out_ten_dich_vu', name: 'Tên Dịch Vụ' },
    { code: 'out_nguoi_thuc_hien', name: 'Người thực hiện' },
    { code: 'out_ma_may', name: 'Mã Máy' },
    { code: 'out_ten_may', name: 'Tên Máy' },
    { code: 'out_bat_dau', name: 'TG Bắt đầu' },
    { code: 'out_ket_thuc', name: 'TG Kết thúc' }
];

export default function ExcelTemplateConfig() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
    const [form] = Form.useForm();

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/clinical-scheduling/excel-templates');
            const data = await res.json();
            if (data.success) {
                setTemplates(data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSave = async (values: any) => {
        const mappings = [...DEFAULT_FIELDS, ...OUTPUT_FIELDS].map(field => ({
            system_field: field.code,
            excel_column: values[field.code] || ''
        })).filter(m => m.excel_column);

        OUTPUT_FIELDS.forEach(field => {
            mappings.push({
                system_field: `enable_${field.code}`,
                excel_column: values[`enable_${field.code}`] === false ? 'false' : 'true'
            });
        });

        const payload = {
            id: editingTemplate?.id,
            name: values.name,
            isDefault: values.isDefault || false,
            mappings
        };

        const method = editingTemplate ? 'PUT' : 'POST';
        
        try {
            const res = await fetch('/api/clinical-scheduling/excel-templates', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                message.success('Đã lưu mẫu thành công!');
                setModalVisible(false);
                fetchTemplates();
            } else {
                message.error('Lỗi: ' + data.message);
            }
        } catch (error) {
            message.error('Có lỗi xảy ra!');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/clinical-scheduling/excel-templates?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                message.success('Đã xóa mẫu!');
                fetchTemplates();
            }
        } catch (error) {
            message.error('Có lỗi xảy ra!');
        }
    };

    const openEditModal = (template?: any) => {
        setEditingTemplate(template || null);
        setUploadedHeaders([]);
        if (template) {
            const formData: any = { name: template.name, isDefault: template.isDefault };
            template.mappings?.forEach((m: any) => {
                if (m.system_field.startsWith('enable_')) {
                    formData[m.system_field] = m.excel_column === 'true';
                } else {
                    formData[m.system_field] = m.excel_column;
                }
            });
            // Ensure any missing enable_ states default to true
            OUTPUT_FIELDS.forEach(f => {
                if (formData[`enable_${f.code}`] === undefined) {
                    formData[`enable_${f.code}`] = true;
                }
            });
            form.setFieldsValue(formData);
        } else {
            form.resetFields();
            const defaultFormData: any = {};
            OUTPUT_FIELDS.forEach(f => {
                defaultFormData[`enable_${f.code}`] = true;
            });
            form.setFieldsValue(defaultFormData);
        }
        setModalVisible(true);
    };

    const handleUploadSampleExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                if (json.length === 0) {
                    return message.error('File Excel không có dữ liệu.');
                }

                const headers = Object.keys(json[0] as object);
                setUploadedHeaders(headers);
                message.success(`Đã lấy được ${headers.length} cột từ file Excel.`);
                
                // Thử auto map nếu form đang trống
                const currentValues = form.getFieldsValue();
                const autoMap = { ...currentValues };
                let hasMapped = false;
                
                headers.forEach(h => {
                    const upper = h.toUpperCase();
                    if (!autoMap.ma_ba && (upper.includes('MÃ HS') || upper.includes('MÃ HỒ SƠ') || upper.includes('MAHOSO'))) { autoMap.ma_ba = h; hasMapped = true; }
                    if (!autoMap.ten_bn && (upper.includes('TÊN BN') || upper.includes('TÊN BỆNH NHÂN') || upper.includes('TENBENHNHAN'))) { autoMap.ten_bn = h; hasMapped = true; }
                    if (!autoMap.thoi_gian_chi_dinh && (upper.includes('THỜI GIAN') || upper.includes('NGÀY Y LỆNH') || upper.includes('THOIGIAN'))) { autoMap.thoi_gian_chi_dinh = h; hasMapped = true; }
                    if (!autoMap.ma_dich_vu && (upper.includes('MÃ DỊCH VỤ') || upper.includes('MÃ DV') || upper === 'MADICHVU')) { autoMap.ma_dich_vu = h; hasMapped = true; }
                    if (!autoMap.ten_dich_vu && (upper.includes('TÊN DỊCH VỤ') || upper.includes('TÊN DV') || upper === 'TENDICHVU')) { autoMap.ten_dich_vu = h; hasMapped = true; }
                    if (!autoMap.ten_khoa && (upper.includes('TÊN KHOA') || upper === 'TENKHOA')) { autoMap.ten_khoa = h; hasMapped = true; }
                    if (!autoMap.ma_khoa && (upper.includes('MÃ KHOA') || upper === 'MAKHOA')) { autoMap.ma_khoa = h; hasMapped = true; }
                    if (!autoMap.phong_thuc_hien && (upper.includes('PHÒNG THỰC HIỆN') || upper === 'PHONGTHUCHIEN')) { autoMap.phong_thuc_hien = h; hasMapped = true; }
                    
                    // Thử auto map cho output
                    if (!autoMap.out_ma_ba && (upper.includes('MÃ BỆNH ÁN') || upper.includes('MÃ HỒ SƠ') || upper === 'MABA')) { autoMap.out_ma_ba = h; hasMapped = true; }
                    if (!autoMap.out_ten_bn && (upper.includes('TÊN BỆNH NHÂN') || upper === 'TENBENHNHAN')) { autoMap.out_ten_bn = h; hasMapped = true; }
                    if (!autoMap.out_thoi_gian_chi_dinh && (upper.includes('THỜI GIAN') || upper === 'THOIGIANCHIDINH')) { autoMap.out_thoi_gian_chi_dinh = h; hasMapped = true; }
                    if (!autoMap.out_ten_dich_vu && (upper.includes('TÊN DỊCH VỤ') || upper === 'TENDICHVU')) { autoMap.out_ten_dich_vu = h; hasMapped = true; }
                    if (!autoMap.out_nguoi_thuc_hien && (upper.includes('NGƯỜI THỰC HIỆN') || upper.includes('BÁC SĨ') || upper === 'NGUOITHUCHIEN')) { autoMap.out_nguoi_thuc_hien = h; hasMapped = true; }
                    if (!autoMap.out_ma_may && (upper.includes('MÃ MÁY') || upper === 'MAMAY')) { autoMap.out_ma_may = h; hasMapped = true; }
                    if (!autoMap.out_ten_may && (upper.includes('TÊN MÁY') || upper === 'TENMAY')) { autoMap.out_ten_may = h; hasMapped = true; }
                    if (!autoMap.out_bat_dau && (upper.includes('BẮT ĐẦU') || upper === 'BATDAU')) { autoMap.out_bat_dau = h; hasMapped = true; }
                    if (!autoMap.out_ket_thuc && (upper.includes('KẾT THÚC') || upper === 'KETTHUC')) { autoMap.out_ket_thuc = h; hasMapped = true; }
                });
                
                if (hasMapped) {
                    form.setFieldsValue(autoMap);
                    message.success('Đã tự động điền một số cột gợi ý!');
                }

            } catch (error) {
                message.error('Lỗi khi đọc file Excel.');
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    const columns = [
        {
            title: 'Tên Mẫu (Template)',
            dataIndex: 'name',
            key: 'name',
            render: (t: string, r: any) => (
                <strong style={{ color: r.isDefault ? '#16a34a' : '#000' }}>
                    {t} {r.isDefault && <CheckCircleOutlined style={{ marginLeft: 8 }} />}
                </strong>
            )
        },
        {
            title: 'Số cột đã cấu hình',
            key: 'mappings',
            render: (_: any, r: any) => <Tag color="blue">{r.mappings?.length || 0} cột</Tag>
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (d: string) => new Date(d).toLocaleDateString('vi-VN')
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, r: any) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(r)}>Sửa</Button>
                    <Popconfirm title="Chắc chắn xóa mẫu này?" onConfirm={() => handleDelete(r.id)}>
                        <Button type="link" danger icon={<DeleteOutlined />}>Xóa</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card title="Cấu hình Mẫu File Excel" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>Thêm Mẫu Mới</Button>} style={{ marginBottom: 24 }}>
            <Table 
                dataSource={templates} 
                columns={columns} 
                rowKey="id" 
                loading={loading}
                pagination={false}
                bordered
                size="small"
            />
            
            <Modal
                title={editingTemplate ? "Sửa Mẫu Excel" : "Thêm Mẫu Excel Mới"}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                width={700}
                maskClosable={false}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="name" label="Tên Mẫu (VD: Mẫu HIS VNPT)" rules={[{ required: true, message: 'Vui lòng nhập tên mẫu' }]}>
                        <Input placeholder="Nhập tên nhận diện cho mẫu này..." />
                    </Form.Item>
                    
                    <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <p style={{ margin: 0, color: '#595959', flex: 1 }}>
                                <i>Bạn có thể tải lên một file Excel mẫu để lấy danh sách tên cột, sau đó chọn từ gợi ý cho nhanh chóng. Hoặc có thể tự nhập tay tên cột.</i>
                            </p>
                            <Upload beforeUpload={handleUploadSampleExcel} showUploadList={false} accept=".xlsx, .xls">
                                <Button icon={<UploadOutlined />}>Tải File Mẫu</Button>
                            </Upload>
                        </div>
                        
                        {uploadedHeaders.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <Tag color="blue">Đã tải {uploadedHeaders.length} cột từ file mẫu</Tag>
                            </div>
                        )}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                            {DEFAULT_FIELDS.map(field => (
                                <Form.Item 
                                    key={field.code} 
                                    name={field.code} 
                                    label={<>{field.name} {field.required && <span style={{ color: 'red' }}>*</span>}</>}
                                >
                                    <AutoComplete 
                                        options={uploadedHeaders.map(h => ({ value: h }))}
                                        placeholder={`Nhập hoặc chọn cột...`}
                                        allowClear
                                        filterOption={(inputValue, option) =>
                                            option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                        }
                                    />
                                </Form.Item>
                            ))}
                        </div>
                    </div>
                    
                    <div style={{ padding: '16px', background: '#e6f4ff', borderRadius: '8px', marginBottom: '16px' }}>
                        <p style={{ margin: '0 0 16px 0', color: '#0958d9' }}>
                            <strong>Cấu hình Cột Kết quả Xuất (Output)</strong><br/>
                            <i>Check vào cột bạn muốn hiển thị khi tải File Excel kết quả xếp lịch. Nhập tên cột nếu muốn đổi tên mặc định.</i>
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                            {OUTPUT_FIELDS.map(field => (
                                <div key={field.code} style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                                    <Form.Item 
                                        name={`enable_${field.code}`} 
                                        valuePropName="checked"
                                        initialValue={true}
                                        style={{ margin: 0, marginRight: 8 }}
                                    >
                                        <Checkbox />
                                    </Form.Item>
                                    <Form.Item 
                                        name={field.code} 
                                        label={<>{field.name} (Gốc)</>}
                                        style={{ margin: 0, flex: 1 }}
                                    >
                                        <Input placeholder={`Nhập tên cột mới cho ${field.name}...`} allowClear />
                                    </Form.Item>
                                </div>
                            ))}
                        </div>
                    </div>
                </Form>
            </Modal>
        </Card>
    );
}
