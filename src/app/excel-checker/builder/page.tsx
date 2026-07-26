'use client';

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, Select, message, Divider, Typography, Row, Col, Table, Popconfirm, Space, Modal } from 'antd';
import { InboxOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, EditOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

interface RuleFormType {
    ruleName: string;
    ruleType: 'TIME_OVERLAP';
    groupCols: string[];
    startCol?: string;
    endCol?: string;
    serviceCol?: string;
    ignoreValues?: string[];
    minGapMinutes?: number;
    departmentOverrides?: {
        departmentCode: string;
        allowedServices?: string[];
        excludedServices?: string[];
    }[];
}

export default function ExcelTemplateBuilderPage() {
    const [form] = Form.useForm();
    const [headers, setHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isMounted, setIsMounted] = useState(false);

    const [rulesList, setRulesList] = useState<RuleFormType[]>([]);
    const [ruleForm] = Form.useForm();
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);

    const [departments, setDepartments] = useState<any[]>([]);

    useEffect(() => {
        setIsMounted(true);
        fetchTemplates();
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/departments`);
            const data = await res.json();
            setDepartments(data || []);
        } catch (error) {
            console.error('Lỗi khi tải khoa phòng:', error);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/excel-templates`);
            const data = await res.json();
            setTemplates(data || []);
        } catch (error) {
            console.error('Lỗi khi tải danh sách:', error);
        }
    };

    const handleOpenCreate = () => {
        setEditingId(null);
        form.resetFields();
        setHeaders([]);
        setRulesList([]);
        setIsModalOpen(true);
    };

    const handleEdit = (record: any) => {
        setEditingId(record.id);
        form.setFieldsValue({
            name: record.name,
            description: record.description,
            exportFileName: record.outputConfig?.exportFileName,
            displayColumns: record.outputConfig?.displayColumns
        });
        
        const mappedRules = record.rules?.map((r: any) => ({
            ruleName: r.ruleName,
            ruleType: r.ruleType,
            groupCols: r.mapping.groupCols,
            startCol: r.mapping.startCol,
            endCol: r.mapping.endCol,
            serviceCol: r.mapping.serviceCol,
            ignoreValues: r.mapping.ignoreValues,
            minGapMinutes: r.mapping.minGapMinutes,
            departmentOverrides: r.permissions?.departmentOverrides
        })) || [];
        setRulesList(mappedRules);
        
        if (headers.length === 0) {
            const tempHeaders = new Set<string>();
            record.rules?.forEach((r: any) => {
                r.mapping.groupCols?.forEach((c: string) => tempHeaders.add(c));
                if (r.mapping.startCol) tempHeaders.add(r.mapping.startCol);
                if (r.mapping.endCol) tempHeaders.add(r.mapping.endCol);
                if (r.mapping.serviceCol) tempHeaders.add(r.mapping.serviceCol);
            });
            setHeaders(Array.from(tempHeaders));
        }
        
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`${getBasePath()}/api/excel-templates/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa cấu hình');
                fetchTemplates();
            }
        } catch (error) {
            message.error('Lỗi khi xóa');
        }
    };

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
                const tempHeaders: string[] = [];
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = firstSheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
                    let hdr = "UNKNOWN " + C;
                    if (cell && cell.t) hdr = XLSX.utils.format_cell(cell);
                    tempHeaders.push(hdr);
                }
                setHeaders(tempHeaders);
                message.success('Đã tải thành công danh sách cột từ file mẫu!');
            } catch (error) {
                message.error('Không thể đọc file Excel. Vui lòng kiểm tra lại.');
            }
        };
        reader.readAsArrayBuffer(file);
        return false; 
    };

    const onFinish = async (values: any) => {
        if (!values.name) {
            message.error('Vui lòng nhập tên Template');
            return;
        }

        setLoading(true);
        try {
            const templateData: any = {
                name: values.name,
                description: values.description,
                rules: rulesList.map((r: RuleFormType, index: number) => ({
                    id: `rule_${Date.now()}_${index}`,
                    ruleName: r.ruleName || `Quy tắc ${index + 1}`,
                    ruleType: r.ruleType || 'TIME_OVERLAP',
                    mapping: {
                        groupCols: r.groupCols,
                        startCol: r.startCol,
                        endCol: r.endCol,
                        serviceCol: r.serviceCol,
                        ignoreValues: r.ignoreValues,
                        minGapMinutes: r.minGapMinutes || 0
                    },
                    permissions: r.departmentOverrides ? {
                        departmentOverrides: r.departmentOverrides
                    } : undefined,
                    active: true
                })),
                outputConfig: {
                    exportFileName: values.exportFileName || 'Danh_sach_loi',
                    displayColumns: values.displayColumns,
                    includeViolationColumn: true
                }
            };
            
            if (editingId) {
                templateData.id = editingId;
                const res = await fetch(`${getBasePath()}/api/excel-templates/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData)
                });
                if (!res.ok) throw new Error('Cập nhật thất bại');
                message.success('Cập nhật Template thành công!');
            } else {
                const saveRes = await fetch(`${getBasePath()}/api/excel-templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData)
                });
                const saveData = await saveRes.json();
                if (!saveData.success) throw new Error(saveData.error);

                await fetch(`${getBasePath()}/api/menus`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: values.name,
                        path: `/excel-checker/${saveData.data.slug}`,
                        icon: 'FileExcelOutlined',
                        isActive: true,
                    })
                });
                message.success('Khởi tạo Template và Menu Link thành công!');
            }

            form.resetFields();
            setHeaders([]);
            setIsModalOpen(false);
            fetchTemplates();
        } catch (error: any) {
            message.error(`Lỗi: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenRuleForm = (index: number | null) => {
        if (index !== null) {
            setEditingRuleIndex(index);
            ruleForm.setFieldsValue(rulesList[index]);
        } else {
            setEditingRuleIndex(null);
            ruleForm.resetFields();
            ruleForm.setFieldsValue({ ruleType: 'TIME_OVERLAP' });
        }
        setIsRuleModalOpen(true);
    };

    const handleDeleteRule = (index: number) => {
        const newRules = [...rulesList];
        newRules.splice(index, 1);
        setRulesList(newRules);
    };

    const handleSaveRule = async () => {
        try {
            const values = await ruleForm.validateFields();
            const newRules = [...rulesList];
            if (editingRuleIndex !== null) {
                newRules[editingRuleIndex] = values;
            } else {
                newRules.push(values);
            }
            setRulesList(newRules);
            setIsRuleModalOpen(false);
        } catch (e) {
            // Validation error
        }
    };

    const tableColumns = [
        { title: 'Tên Kịch Bản', dataIndex: 'name', key: 'name' },
        { title: 'Đường dẫn (Slug)', dataIndex: 'slug', key: 'slug' },
        { title: 'Số lượng Quy tắc', key: 'rules', render: (r: any) => r.rules?.length || 0 },
        {
            title: 'Hành động',
            key: 'action',
            render: (text: string, record: any) => (
                <Space size="middle">
                    <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Sửa</Button>
                    <Popconfirm title="Xóa kịch bản này?" onConfirm={() => handleDelete(record.id)}>
                        <Button type="link" danger icon={<DeleteOutlined />}>Xóa</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const ruleColumns = [
        { title: 'Tên Quy tắc', dataIndex: 'ruleName', key: 'ruleName' },
        { title: 'Loại', dataIndex: 'ruleType', key: 'ruleType', render: () => 'Trùng thời gian' },
        { title: 'Cột nhóm', dataIndex: 'groupCols', key: 'groupCols', render: (cols: string[]) => cols?.join(', ') },
        { 
            title: 'Hành động', 
            key: 'action', 
            render: (_: any, __: any, index: number) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleOpenRuleForm(index)}>Sửa</Button>
                    <Button type="link" size="small" danger onClick={() => handleDeleteRule(index)}>Xóa</Button>
                </Space>
            ) 
        }
    ];

    return (
        <>
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>Quản lý Kịch bản Kiểm tra Excel</Title>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    Thêm Kịch bản mới
                </Button>
            </div>
            
            <Card variant="borderless">
                <Table 
                    dataSource={templates} 
                    columns={tableColumns} 
                    rowKey="id" 
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {isMounted && (
                <Modal
                    title={editingId ? 'Chỉnh sửa Kịch bản' : 'Khởi tạo Kịch bản mới'}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    footer={null}
                    width={1200}
                    forceRender
                >
                    <Row gutter={24} style={{ marginTop: 16 }}>
                        <Col span={8}>
                            <Card title="1. Tải File Mẫu (Đọc tên cột)" variant="borderless" style={{ background: '#fafafa' }}>
                                <Dragger
                                    accept=".xlsx, .xls"
                                    beforeUpload={handleFileUpload}
                                    maxCount={1}
                                >
                                    <p className="ant-upload-drag-icon">
                                        <InboxOutlined />
                                    </p>
                                    <p className="ant-upload-text">Kéo thả hoặc click để chọn file Excel mẫu</p>
                                    <p className="ant-upload-hint">
                                        Hệ thống chỉ dùng file này để bóc tách Tên Cột (Header), không lưu trữ dữ liệu.
                                    </p>
                                </Dragger>

                                {headers.length > 0 && (
                                    <div style={{ marginTop: 24 }}>
                                        <h4>Cột phát hiện được ({headers.length}):</h4>
                                        <div style={{ maxHeight: 300, overflowY: 'auto', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #d9d9d9' }}>
                                            {headers.map((h, i) => (
                                                <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                                                    <Text code>{h}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </Col>

                        <Col span={16}>
                            <Card title="2. Thiết lập Quy tắc" variant="borderless">
                                <Form 
                                    form={form} 
                                    layout="vertical" 
                                    onFinish={onFinish}
                                >
                                    <Form.Item 
                                        name="name" 
                                        label="Tên Template (Sẽ hiển thị trên Menu)" 
                                        rules={[{ required: true }]}
                                    >
                                        <Input placeholder="VD: Kiểm tra Trùng Phẫu Thuật" size="large" />
                                    </Form.Item>

                                    <Form.Item name="description" label="Mô tả / Hướng dẫn thêm">
                                        <Input.TextArea placeholder="Nhập hướng dẫn cho nhân viên khoa phòng..." />
                                    </Form.Item>

                                    <Form.Item name="displayColumns" label="Các cột hiển thị trên bảng kết quả (Để trống sẽ hiển thị tất cả các cột của file Excel)">
                                        <Select 
                                            mode="multiple" 
                                            placeholder="Chọn các cột muốn hiển thị..."
                                            allowClear
                                        >
                                            {headers.map(h => <Select.Option key={h} value={h}>{h}</Select.Option>)}
                                        </Select>
                                    </Form.Item>

                                    <Divider titlePlacement="left">Danh sách Quy tắc</Divider>

                                    <Table 
                                        dataSource={rulesList} 
                                        columns={ruleColumns} 
                                        rowKey={(record) => record.ruleName || Math.random().toString()}
                                        pagination={false}
                                        size="small"
                                        style={{ marginBottom: 16 }}
                                    />

                                    <Button type="dashed" onClick={() => handleOpenRuleForm(null)} block icon={<PlusOutlined />}>
                                        Thêm Quy Tắc Mới
                                    </Button>

                                    <Form.Item>
                                        <Space>
                                            <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />} loading={loading}>
                                                {editingId ? 'Cập nhật Cấu hình' : 'Lưu Cấu Hình & Tạo Menu Link'}
                                            </Button>
                                            <Button size="large" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                                        </Space>
                                    </Form.Item>
                                </Form>
                            </Card>
                        </Col>
                    </Row>
                </Modal>
            )}
        </div>

            {isMounted && (
                <Modal
                    title={editingRuleIndex !== null ? 'Chỉnh sửa Quy tắc' : 'Thêm Quy tắc mới'}
                    open={isRuleModalOpen}
                    onCancel={() => setIsRuleModalOpen(false)}
                    onOk={handleSaveRule}
                    width={700}
                    forceRender
                >
                    <Form form={ruleForm} layout="vertical">
                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item name="ruleName" label="Tên quy tắc" rules={[{ required: true, message: 'Vui lòng nhập tên quy tắc' }]}>
                                    <Input placeholder="VD: Báo trùng Mã Máy" />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="ruleType" label="Loại quy tắc">
                                    <Select disabled>
                                        <Option value="TIME_OVERLAP">Kiểm tra Trùng Thời Gian</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item 
                                    name="groupCols" 
                                    label="Cột Định Danh Nhóm (VD: Cột Mã Máy, Mã Giường)"
                                    rules={[{ required: true, message: 'Vui lòng chọn cột định danh' }]}
                                >
                                    <Select mode="multiple" placeholder="Chọn cột...">
                                        {headers.map(h => <Option key={h} value={h}>{h}</Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item 
                                    name="startCol" 
                                    label="Cột Thời gian Bắt đầu"
                                    rules={[{ required: true, message: 'Vui lòng chọn cột thời gian bắt đầu' }]}
                                >
                                    <Select placeholder="Chọn cột...">
                                        {headers.map(h => <Option key={h} value={h}>{h}</Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item 
                                    name="endCol" 
                                    label="Cột Thời gian Kết thúc"
                                    rules={[{ required: true, message: 'Vui lòng chọn cột thời gian kết thúc' }]}
                                >
                                    <Select placeholder="Chọn cột...">
                                        {headers.map(h => <Option key={h} value={h}>{h}</Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item 
                                    name="ignoreValues" 
                                    label="Bỏ qua các giá trị nhóm (Nhập xong nhấn Enter để thêm)"
                                    tooltip="Nếu Cột Định Danh Nhóm chứa các giá trị này, hệ thống sẽ bỏ qua và không kiểm tra trùng lặp cho các dòng đó."
                                >
                                    <Select 
                                        mode="tags" 
                                        placeholder="VD: -1, null..."
                                        tokenSeparators={[',']}
                                        style={{ width: '100%' }}
                                    >
                                        <Select.Option value="-1">-1</Select.Option>
                                        <Select.Option value="null">null</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item 
                                    name="serviceCol" 
                                    label="Cột Mã Dịch Vụ (Dùng để lọc/phân quyền khoa phòng sau này)"
                                >
                                    <Select placeholder="Tùy chọn: Chọn cột chứa Mã Dịch Vụ..." allowClear>
                                        {headers.map(h => <Option key={h} value={h}>{h}</Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <div style={{ marginBottom: 8, fontWeight: 500 }}>Phân quyền theo khoa phòng (Chỉ áp dụng nếu có Cột Mã Dịch Vụ)</div>
                                <Form.List name="departmentOverrides">
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Card key={key} size="small" style={{ marginBottom: 8, backgroundColor: '#fafafa' }}>
                                                    <Row gutter={8} align="middle">
                                                        <Col span={7}>
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'departmentCode']}
                                                                rules={[{ required: true, message: 'Chọn khoa' }]}
                                                                style={{ marginBottom: 0 }}
                                                            >
                                                                <Select placeholder="Chọn Khoa..." showSearch optionFilterProp="children">
                                                                    {departments.map(d => <Select.Option key={d.ma_khoa} value={d.ma_khoa}>{d.ten_khoa}</Select.Option>)}
                                                                </Select>
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={8}>
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'allowedServices']}
                                                                style={{ marginBottom: 0 }}
                                                            >
                                                                <Select mode="tags" placeholder="Mã DV cho phép (VD: SA01)" tokenSeparators={[',']} />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={8}>
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'excludedServices']}
                                                                style={{ marginBottom: 0 }}
                                                            >
                                                                <Select mode="tags" placeholder="Mã DV bỏ qua (VD: XQ02)" tokenSeparators={[',']} />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={1}>
                                                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                                                        </Col>
                                                    </Row>
                                                </Card>
                                            ))}
                                            <Form.Item>
                                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                                    Thêm Phân Quyền Khoa
                                                </Button>
                                            </Form.Item>
                                        </>
                                    )}
                                </Form.List>
                            </Col>
                        </Row>
                    </Form>
                </Modal>
            )}
        </>
    );
}
