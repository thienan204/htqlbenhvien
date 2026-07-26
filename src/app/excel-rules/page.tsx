
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, message, Spin, Modal, Form, Input, Select, Checkbox, Row, Col, Space, Popconfirm, Tag, Switch, Upload, AutoComplete, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { createDuplicateRule, deleteDuplicateRule, getDuplicateRules, updateDuplicateRule } from '@/actions/duplicate-rules';
import { getCurrentUser, type UserPayload } from '@/actions/auth';
import { useRouter } from 'next/navigation';

interface DuplicateRule {
    id: string;
    ruleType?: string;
    name: string;
    machineCols: string[];
    serviceCol?: string;
    startCol: string;
    endCol: string;
    ignoreMaMayMinusOne: boolean;
    active?: boolean;
    serviceValues?: string[];
    excludedServiceValues?: string[];
    ignoreIfSameField?: string;
    minGapMinutes?: number;
}

export default function ExcelRulesPage() {
    const [rules, setRules] = useState<DuplicateRule[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [mau05Services, setMau05Services] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserPayload | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<DuplicateRule | null>(null);
    const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
    const [uploadingSample, setUploadingSample] = useState(false);

    const router = useRouter();
    const [form] = Form.useForm();
    const [deptForm] = Form.useForm();

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await getDuplicateRules('ALL');
            if (res && res.success && res.data) {
                setRules(res.data as unknown as DuplicateRule[]);
            } else {
                message.error("Không thể tải danh sách quy tắc.");
            }
        } catch (error) {
            console.error("fetchRules failed:", error);
            message.error("Lỗi kết nối khi tải quy tắc.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
        getCurrentUser().then(user => setCurrentUser(user));
        fetch('/api/departments')
            .then(res => res.json())
            .then(data => setDepartments(Array.isArray(data) ? data : []))
            .catch(console.error);
        fetch('/api/mau05-catalog')
            .then(res => res.json())
            .then(data => setMau05Services(Array.isArray(data) ? data : []))
            .catch(console.error);
    }, []);

    const handleCreateRule = async (values: any) => {
        setLoading(true);
        const res = await createDuplicateRule({
            ...values,
            ignoreMaMayMinusOne: values.ignoreMaMayMinusOne || false,
            active: values.active !== undefined ? values.active : true,
            ignoreIfSameField: values.ignoreIfSameField || '',
            minGapMinutes: values.minGapMinutes ? parseInt(String(values.minGapMinutes), 10) : 0
        });

        if (res.success) {
            message.success("Đã tạo quy tắc mới.");
            setIsModalOpen(false);
            form.resetFields();
            fetchRules();
        } else {
            message.error("Lỗi khi tạo quy tắc.");
        }
        setLoading(false);
    };

    const handleUpdateRule = async (values: any) => {
        if (!editingRule) return;
        setLoading(true);
        const res = await updateDuplicateRule(editingRule.id, {
            ...values,
            ignoreMaMayMinusOne: values.ignoreMaMayMinusOne || false,
            ignoreIfSameField: values.ignoreIfSameField || '',
            minGapMinutes: values.minGapMinutes ? parseInt(String(values.minGapMinutes), 10) : 0
        });

        if (res.success) {
            message.success("Đã cập nhật quy tắc.");
            setIsModalOpen(false);
            setEditingRule(null);
            form.resetFields();
            fetchRules();
        } else {
            message.error("Lỗi khi cập nhật quy tắc.");
        }
        setLoading(false);
    };

    const handleDeleteRule = async (id: string) => {
        setLoading(true);
        const res = await deleteDuplicateRule(id);
        if (res.success) {
            message.success("Đã xóa quy tắc.");
            fetchRules();
        } else {
            message.error("Lỗi khi xóa quy tắc.");
        }
        setLoading(false);
    };

    const handleUploadSample = async (file: File) => {
        setUploadingSample(true);
        try {
            const wb = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await wb.xlsx.load(arrayBuffer);
            const ws = wb.worksheets[0];
            if (!ws) {
                message.error("File không có sheet nào!");
                return false;
            }
            
            const firstRow = ws.getRow(1);
            const headers: string[] = [];
            firstRow.eachCell((cell, colNumber) => {
                const val = cell.value?.toString().trim();
                if (val) headers.push(val);
            });
            
            if (headers.length === 0) {
                message.error("Không tìm thấy tên cột ở dòng đầu tiên!");
            } else {
                setSampleHeaders(headers);
                message.success(`Đã đọc được ${headers.length} cột từ file mẫu.`);
            }
        } catch (error) {
            console.error("Lỗi đọc file:", error);
            message.error("Không thể đọc file Excel!");
        } finally {
            setUploadingSample(false);
        }
        return false; // Prevent default upload behavior
    };

    const openCreateModal = () => {
        if (currentUser?.role !== 'ADMIN') {
            message.warning("Chỉ Quản trị viên mới được tạo quy tắc.");
            return;
        }
        setEditingRule(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const openEditModal = (rule: DuplicateRule) => {
        if (!currentUser) return;
        if (currentUser.role !== 'ADMIN' && currentUser.role !== 'KHOA') {
            message.warning("Bạn không có quyền cấu hình.");
            return;
        }
        setEditingRule(rule);
        
        if (currentUser.role === 'ADMIN') {
            form.setFieldsValue(rule);
            setIsModalOpen(true);
        } else {
            const deptConfig = rule.departmentExclusions?.find((d: any) => d.department === currentUser.ma_khoa) || {
                department: currentUser.ma_khoa,
                includedServices: [],
                excludedServices: []
            };
            deptForm.setFieldsValue(deptConfig);
            setIsDeptModalOpen(true);
        }
    };

    const handleDeptUpdateRule = async (values: any) => {
        if (!editingRule || !currentUser) return;
        setLoading(true);
        
        const newDeptExclusions = (editingRule.departmentExclusions || []).filter((d: any) => d.department !== currentUser.ma_khoa);
        newDeptExclusions.push({
            department: currentUser.ma_khoa,
            includedServices: values.includedServices || [],
            excludedServices: values.excludedServices || []
        });

        const res = await updateDuplicateRule(editingRule.id, {
            ...editingRule,
            departmentExclusions: newDeptExclusions
        });

        if (res.success) {
            message.success("Đã cập nhật cấu hình Khoa.");
            setIsDeptModalOpen(false);
            setEditingRule(null);
            fetchRules();
        } else {
            message.error("Lỗi cập nhật cấu hình.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Cấu hình Quy tắc Excel</h1>
                        <p className="text-slate-500 font-medium">Quản lý các quy tắc kiểm tra trùng lặp cho file Excel</p>
                    </div>
                    {currentUser?.role === 'ADMIN' && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                            Thêm quy tắc mới
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {loading && <div className="text-center py-12"><Spin size="large" /></div>}

                    {!loading && rules.map(rule => (
                        <Card key={rule.id} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-500"></div>
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg text-slate-800">{rule.name}</h3>
                                        {rule.ruleType === 'PTTT' ? <Tag color="purple">PTTT</Tag> : <Tag color="blue">Excel Thường</Tag>}
                                        {rule.active === false ? <Tag color="default">Đã ẩn</Tag> : <Tag color="green">Hoạt động</Tag>}
                                    </div>
                                    <div className="text-sm text-slate-500 space-y-1">
                                        <p><span className="font-semibold text-slate-700">Cột định danh (Gộp nhóm):</span> {rule.machineCols.join(', ')}</p>
                                        <p><span className="font-semibold text-slate-700">Mốc thời gian:</span> {rule.startCol} - {rule.endCol}</p>
                                        {rule.serviceCol && <p><span className="font-semibold text-slate-700">Lọc theo dịch vụ:</span> {rule.serviceCol} {rule.serviceValues?.length ? `(${rule.serviceValues.join(', ')})` : ''}</p>}
                                        {rule.minGapMinutes ? <p><span className="font-semibold text-slate-700">Khoảng cách tối thiểu:</span> {rule.minGapMinutes} phút</p> : null}
                                        {rule.ignoreMaMayMinusOne && <p className="text-orange-600 italic">Caution: Bỏ qua nếu giá trị = -1</p>}
                                    </div>
                                </div>

                                <Space className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    {(currentUser?.role === 'ADMIN' || currentUser?.role === 'KHOA') && (
                                        <Button
                                            icon={<EditOutlined />}
                                            onClick={() => openEditModal(rule)}
                                            title={currentUser?.role === 'ADMIN' ? 'Sửa toàn bộ quy tắc' : 'Cấu hình dịch vụ của Khoa'}
                                        />
                                    )}
                                    {currentUser?.role === 'ADMIN' && (
                                        <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDeleteRule(rule.id)}>
                                            <Button danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    )}
                                </Space>
                            </div>
                        </Card>
                    ))}

                    {!loading && rules.length === 0 && (
                        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                            Chưa có quy tắc nào. Hãy thêm mới!
                        </div>
                    )}
                </div>
            </div>

            <Modal
                title={editingRule ? "Chỉnh sửa Quy tắc" : "Tạo Quy tắc Mới"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                width={1000}
            >
                <Tabs
                    defaultActiveKey="1"
                    items={[
                        {
                            key: '1',
                            label: 'Cấu hình',
                            children: (
                                <>
                                    <div className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                        <div className="font-semibold text-slate-700">Gợi ý tên cột (Tuỳ chọn)</div>
                        <div className="text-sm text-slate-500">Tải lên một file Excel mẫu để lấy danh sách tên cột có sẵn.</div>
                    </div>
                    <Upload
                        beforeUpload={handleUploadSample}
                        showUploadList={false}
                        accept=".xlsx, .xls"
                    >
                        <Button loading={uploadingSample} icon={<UploadOutlined />}>Tải File Mẫu</Button>
                    </Upload>
                </div>
                {sampleHeaders.length > 0 && (
                    <div className="mb-4 px-2 text-sm text-green-600 font-medium">
                        ✓ Đã nạp thành công {sampleHeaders.length} cột. Bạn có thể chọn tên cột từ danh sách sổ xuống.
                    </div>
                )}
                
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={editingRule ? handleUpdateRule : handleCreateRule}
                    initialValues={{ ignoreMaMayMinusOne: false, active: true, ruleType: 'EXCEL' }}
                >
                    <Form.Item
                        label="Tên Quy tắc"
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên quy tắc' }]}
                    >
                        <Input placeholder="Ví dụ: Kiểm tra trùng máy..." />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="ruleType" label="Loại quy tắc">
                                <Select>
                                    <Select.Option value="EXCEL">Quy tắc Excel thường</Select.Option>
                                    <Select.Option value="PTTT">Quy tắc Phẫu thuật - Thủ thuật</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="active" label="Trạng thái hoạt động" valuePropName="checked">
                                <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Đã ẩn" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={24}>
                            <div className="bg-blue-50 p-3 mb-4 rounded border border-blue-100 text-blue-700 text-sm">
                                Nhập chính xác tên cột trong file Excel (Case-sensitive)
                            </div>
                        </Col>
                        <Col span={24}>
                            <Form.Item
                                label="Cột Định danh (Machine)"
                                name="machineCols"
                                rules={[{ required: true, message: 'Nhập ít nhất 1 cột' }]}
                            >
                                <Select mode="tags" placeholder="Nhập tên cột rồi ấn Enter hoặc chọn từ danh sách..." options={sampleHeaders.map(h => ({ value: h, label: h }))} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Cột Bắt đầu (Start Time)" name="startCol" rules={[{ required: true }]}>
                                <AutoComplete
                                    placeholder="VD: NGAY_VAO"
                                    options={sampleHeaders.map(h => ({ value: h, label: h }))}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Cột Kết thúc (End Time)" name="endCol" rules={[{ required: true }]}>
                                <AutoComplete
                                    placeholder="VD: NGAY_RA"
                                    options={sampleHeaders.map(h => ({ value: h, label: h }))}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Cột Dịch vụ (Tùy chọn)" name="serviceCol">
                                <AutoComplete
                                    placeholder="VD: MA_DICH_VU"
                                    options={sampleHeaders.map(h => ({ value: h, label: h }))}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Giá trị Dịch vụ (Bao gồm)" name="serviceValues">
                                <Select 
                                    mode="tags" 
                                    placeholder="Nhập hoặc chọn mã dịch vụ từ danh mục..." 
                                    showSearch
                                    optionFilterProp="label"
                                    options={mau05Services.map(s => ({ value: s.MA_DICH_VU, label: s.MA_DICH_VU + ' - ' + s.TEN_DICH_VU }))}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="Giá trị Dịch vụ (Loại trừ chung)" name="excludedServiceValues">
                                <Select 
                                    mode="tags" 
                                    placeholder="Nhập hoặc chọn mã dịch vụ cần loại trừ..." 
                                    showSearch
                                    optionFilterProp="label"
                                    options={mau05Services.map(s => ({ value: s.MA_DICH_VU, label: s.MA_DICH_VU + ' - ' + s.TEN_DICH_VU }))}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        
                        <Col span={24}>
                            <Form.List name="departmentExclusions">
                                {(fields, { add, remove }) => (
                                    <div className="bg-white border rounded p-4 mb-4 shadow-sm">
                                        <div className="font-semibold text-slate-700 mb-2">Loại trừ Dịch vụ riêng biệt theo Khoa/Phòng</div>
                                        <div className="text-xs text-slate-500 mb-4">
                                            Nếu tài khoản đăng nhập thuộc Khoa này, danh sách dịch vụ dưới đây sẽ được gộp chung với danh sách loại trừ chung.
                                        </div>
                                        {fields.length > 0 && (
                                            <Row gutter={8} className="font-semibold text-slate-600 mb-2 px-2 hidden md:flex text-sm">
                                                <Col span={6}>Khoa / Phòng</Col>
                                                <Col span={9}>Dịch vụ được phép (Chỉ kiểm tra các DV này)</Col>
                                                <Col span={8}>Dịch vụ loại trừ (Bỏ qua các DV này)</Col>
                                                <Col span={1}></Col>
                                            </Row>
                                        )}
                                        {fields.map(({ key, name, ...restField }) => (
                                            <Row gutter={8} key={key} className="items-start mb-2 bg-slate-50 p-2 rounded border border-slate-100">
                                                <Col span={6}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'department']}
                                                        rules={[{ required: true, message: 'Chọn Khoa' }]}
                                                        className="mb-0"
                                                    >
                                                        <Select
                                                            placeholder="Chọn Khoa/Phòng"
                                                            showSearch
                                                            optionFilterProp="children"
                                                            options={departments.map(d => ({ value: d.ma_khoa, label: d.ten_khoa }))}
                                                        />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={9}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'includedServices']}
                                                        className="mb-0"
                                                    >
                                                        <Select 
                                                            mode="tags" 
                                                            placeholder="Mặc định: Tất cả" 
                                                            showSearch
                                                            optionFilterProp="label"
                                                            options={mau05Services.map(s => ({ value: s.MA_DICH_VU, label: s.MA_DICH_VU + ' - ' + s.TEN_DICH_VU }))}
                                                            maxTagCount="responsive"
                                                        />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={8}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'excludedServices']}
                                                        className="mb-0"
                                                    >
                                                        <Select 
                                                            mode="tags" 
                                                            placeholder="Không loại trừ" 
                                                            showSearch
                                                            optionFilterProp="label"
                                                            options={mau05Services.map(s => ({ value: s.MA_DICH_VU, label: s.MA_DICH_VU + ' - ' + s.TEN_DICH_VU }))}
                                                            maxTagCount="responsive"
                                                        />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={1} className="flex justify-end items-center mt-1">
                                                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                                                </Col>
                                            </Row>
                                        ))}
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} className="mt-2 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100">
                                            Thêm Khoa ngoại trừ
                                        </Button>
                                    </div>
                                )}
                            </Form.List>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item name="ignoreMaMayMinusOne" valuePropName="checked">
                                <Checkbox>Bỏ qua nếu giá trị định danh = -1</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Giá trị cần bỏ qua nếu trùng (Tuỳ chọn)" name="ignoreIfSameField">
                                <AutoComplete
                                    placeholder="VD: MA_BN (Bỏ qua báo lỗi nếu chung giá trị)"
                                    options={sampleHeaders.map(h => ({ value: h, label: h }))}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Khoảng cách tối thiểu giữa 2 DV (Phút)" name="minGapMinutes">
                                <Input type="number" min={0} placeholder="VD: 1, 5, 10..." />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                            {editingRule ? "Cập nhật" : "Lưu Quy tắc"}
                        </Button>
                    </div>
                </Form>
                                </>
                            )
                        },
                        {
                            key: '2',
                            label: 'Hướng dẫn chi tiết',
                            children: (
                                <div className="p-5 bg-white rounded-lg text-slate-700 leading-relaxed text-[15px]">
                                    <h3 className="text-xl font-bold mb-4 text-blue-600">Hướng dẫn cấu hình Quy tắc Excel</h3>
                                    <ul className="list-disc pl-5 space-y-3">
                                        <li><b className="text-slate-800">Loại quy tắc:</b> Chọn "Quy tắc Excel Thường" hoặc "Quy tắc Phẫu thuật - Thủ thuật" tùy vào loại file cần quét.</li>
                                        <li><b className="text-slate-800">Cột Định danh (Machine):</b> Tên cột dùng để gom nhóm dữ liệu (ví dụ: MA_MAY, TT_CHINH). Hệ thống sẽ tìm tất cả các dòng có chung giá trị định danh này để kiểm tra xem chúng có bị trùng lặp thời gian hay không.</li>
                                        <li><b className="text-slate-800">Cột Bắt đầu & Kết thúc:</b> Nhập <b>chính xác</b> tên cột chứa dữ liệu thời gian trong file Excel của bạn (phân biệt chữ hoa/thường).</li>
                                        <li><b className="text-slate-800">Cột Dịch vụ (Tùy chọn):</b> Nếu nhập tên cột chứa Mã/Tên dịch vụ, bạn có thể thiết lập thêm <i>Giá trị Bao gồm</i> (chỉ quét các dịch vụ này) hoặc <i>Loại trừ chung</i> (không quét các dịch vụ này).</li>
                                        <li><b className="text-slate-800">Loại trừ theo Khoa:</b> Dành riêng cho các tài khoản cấp Khoa. Mỗi khoa có thể tự định nghĩa thêm danh sách các dịch vụ ngoại lệ mà không làm ảnh hưởng đến cấu hình chung của toàn viện.</li>
                                        <li><b className="text-slate-800">Bỏ qua nếu giá trị = -1:</b> Nếu tích chọn, mọi bản ghi có giá trị định danh là <code>-1</code> hoặc rỗng (null) sẽ được bỏ qua, không bị hệ thống báo lỗi trùng lặp.</li>
                                        <li><b className="text-slate-800">Bỏ qua nếu cùng chung giá trị (Tùy chọn):</b> Nếu 2 bản ghi có cùng một giá trị ở cột này (ví dụ cùng MABENHNHAN), hệ thống sẽ bỏ qua và không báo lỗi trùng lặp giữa chúng.</li>
                                    </ul>
                                </div>
                            )
                        }
                    ]}
                />
            </Modal>
            <Modal
                title={`Cấu hình Khoa: ${editingRule?.name || ''}`}
                open={isDeptModalOpen}
                onCancel={() => setIsDeptModalOpen(false)}
                footer={null}
                width={800}
            >
                <div className="mb-4 text-sm text-slate-500 bg-blue-50 p-3 rounded border border-blue-100">
                    <strong>Lưu ý:</strong> Nếu "Dịch vụ được phép" có dữ liệu, quy tắc này sẽ CHỈ áp dụng quét lỗi trên các dịch vụ đó. Nếu bỏ trống, quy tắc sẽ áp dụng cho toàn bộ dịch vụ.
                </div>
                <Form
                    form={deptForm}
                    layout="vertical"
                    onFinish={handleDeptUpdateRule}
                >
                    <Form.Item
                        name="includedServices"
                        label={<span className="font-semibold text-green-700">Dịch vụ được phép (Chỉ kiểm tra trùng các dịch vụ này)</span>}
                    >
                        <Select 
                            mode="tags" 
                            placeholder="Nhập hoặc chọn mã dịch vụ từ danh mục..." 
                            showSearch
                            optionFilterProp="label"
                            options={mau05Services.map(s => ({ value: s.MA_DICH_VU, label: s.MA_DICH_VU + ' - ' + s.TEN_DICH_VU }))}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                    
                    <Form.Item
                        name="excludedServices"
                        label={<span className="font-semibold text-red-700">Dịch vụ loại trừ (Bỏ qua kiểm tra trùng)</span>}
                    >
                        <Select 
                            mode="tags" 
                            placeholder="Nhập hoặc chọn mã dịch vụ cần loại trừ..." 
                            showSearch
                            optionFilterProp="label"
                            options={mau05Services.map(s => ({ value: s.MA_DICH_VU, label: s.MA_DICH_VU + ' - ' + s.TEN_DICH_VU }))}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button onClick={() => setIsDeptModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                            Lưu cấu hình
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
