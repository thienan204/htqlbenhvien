'use client'

import React, { useState, useEffect } from 'react'
import {
    Table, Button, Modal, Form, Input,
    Switch, InputNumber, Select, message, Tag, Space, Popconfirm, AutoComplete
} from 'antd'
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    CodeOutlined
} from '@ant-design/icons'
import {
    getSpecializedRules,
    createSpecializedRule,
    updateSpecializedRule,
    deleteSpecializedRule
} from '@/actions/specialized-rules'

const { TextArea } = Input

// Custom Input Component for Duplicate Bed Logic
const DuplicateBedConfigInput = ({ value, onChange }: { value?: string, onChange?: (val: string) => void }) => {
    // Parse initial value or use defaults
    const getInitialState = () => {
        try {
            if (value) {
                const parsed = JSON.parse(value);
                return {
                    bed: parsed.fields?.bed || 'MA_GIUONG',
                    startTime: parsed.fields?.startTime || 'NGAY_YL',
                    endTime: parsed.fields?.endTime || 'NGAY_KQ',
                    maNhom: parsed.filter?.MA_NHOM !== undefined ? parsed.filter.MA_NHOM : 15,
                    tyleTtDv: parsed.filter?.TYLE_TT_DV || '',
                    includeServices: parsed.filter?.MA_DICH_VU_INCLUDE || [],
                    excludeServices: parsed.filter?.MA_DICH_VU_EXCLUDE || [],
                    tolerance: parsed.toleranceMinutes !== undefined ? parsed.toleranceMinutes : 15,
                    ignoreIfSameField: parsed.ignoreIfSameField || '',
                    ignoreNullValues: parsed.ignoreNullValues !== undefined ? parsed.ignoreNullValues : true
                };
            }
        } catch (e) { }
        return {
            bed: 'MA_GIUONG',
            startTime: 'NGAY_YL',
            endTime: 'NGAY_KQ',
            maNhom: 15,
            tyleTtDv: '',
            includeServices: [],
            excludeServices: [],
            tolerance: 15,
            ignoreIfSameField: '',
            ignoreNullValues: true
        };
    };

    const [state, setState] = useState(getInitialState());

    // Reset state when value changes (e.g. switching rules)
    useEffect(() => {
        setState(getInitialState());
    }, [value]);

    // Trigger Update
    const triggerChange = (newState: any) => {
        setState(newState);
        if (onChange) {
            const filter: any = {};
            if (newState.maNhom) {
                if (Array.isArray(newState.maNhom)) {
                     if (newState.maNhom.length > 0) filter.MA_NHOM = newState.maNhom;
                } else {
                     filter.MA_NHOM = Number(newState.maNhom);
                }
            }
            if (newState.tyleTtDv) {
                filter.TYLE_TT_DV = Number(newState.tyleTtDv);
            }
            if (newState.includeServices && newState.includeServices.length > 0) {
                filter.MA_DICH_VU_INCLUDE = newState.includeServices;
            }
            if (newState.excludeServices && newState.excludeServices.length > 0) {
                filter.MA_DICH_VU_EXCLUDE = newState.excludeServices;
            }

            const json = {
                type: "DUPLICATE_BED",
                fields: {
                    bed: newState.bed,
                    room: "MA_PHONG", // Default hardcoded for now or allow config if needed
                    department: "MA_KHOA",
                    startTime: newState.startTime,
                    endTime: newState.endTime
                },
                filter: filter,
                toleranceMinutes: Number(newState.tolerance),
                ignoreIfSameField: newState.ignoreIfSameField,
                ignoreNullValues: newState.ignoreNullValues
            };
            onChange(JSON.stringify(json, null, 2));
        }
    };

    const handleChange = (key: string, val: any) => {
        const newState = { ...state, [key]: val };
        triggerChange(newState);
    };

    return (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Trường kiểm tra (Giường/Key Check)</label>
                    <Select
                        mode="tags"
                        value={Array.isArray(state.bed) ? state.bed : [state.bed]}
                        onChange={(v) => handleChange('bed', v)}
                        className="w-full"
                        placeholder="Chọn trường kiểm tra trùng"
                        options={[
                            { label: 'MA_GIUONG (Mã Giường)', value: 'MA_GIUONG' },
                            { label: 'MA_DICH_VU (Mã DV)', value: 'MA_DICH_VU' },
                            { label: 'MA_VAT_TU (Mã Vật Tư)', value: 'MA_VAT_TU' },
                            { label: 'MA_KHOA (Mã Khoa)', value: 'MA_KHOA' },
                            { label: 'MA_PHONG (Mã Phòng)', value: 'MA_PHONG' },
                            { label: 'MA_MAY (Mã Máy)', value: 'MA_MAY' },
                            { label: 'MA_BAC_SI (Mã Bác Sĩ)', value: 'MA_BAC_SI' },
                            { label: 'MA_BN (Mã Bệnh nhân)', value: 'MA_BN' },
                            { label: 'MA_LK (Mã Lượt khám)', value: 'MA_LK' },
                            { label: 'NGUOI_THUC_HIEN (Người thực hiện)', value: 'NGUOI_THUC_HIEN' },
                        ]}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Mã Nhóm (Filter)</label>
                    <Select
                        mode="tags"
                        value={Array.isArray(state.maNhom) ? state.maNhom : (state.maNhom ? [String(state.maNhom)] : [])}
                        onChange={(v) => handleChange('maNhom', v)}
                        className="w-full"
                        placeholder="VD: 15, 18"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tỷ lệ DV (Filter)</label>
                    <InputNumber
                        value={state.tyleTtDv}
                        onChange={(v) => handleChange('tyleTtDv', v)}
                        className="w-full"
                        placeholder="Ví dụ: 100"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bỏ qua lỗi trùng Nếu 2 DV cùng trường (Field)</label>
                    <Select
                        mode="tags"
                        maxCount={1}
                        value={state.ignoreIfSameField ? [state.ignoreIfSameField] : []}
                        onChange={(v) => handleChange('ignoreIfSameField', v[0] || '')}
                        className="w-full"
                        placeholder="VD: MA_BN, MA_LK..."
                        options={[
                            { label: 'MA_BN (Cùng Bệnh Nhân)', value: 'MA_BN' },
                            { label: 'MA_LK (Cùng Lượt Khám)', value: 'MA_LK' },
                            { label: 'MA_THE_BHYT (Cùng Thẻ BHYT)', value: 'MA_THE_BHYT' }
                        ]}
                    />
                    <div className="text-xs text-slate-400 mt-1">Để trống nếu muốn luôn kiểm tra. Gõ tên trường XML nếu cần.</div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bỏ qua giá trị null (Khuyết mã)</label>
                    <div className="flex items-center gap-2 mt-1">
                        <Switch
                            checked={state.ignoreNullValues}
                            onChange={(v) => handleChange('ignoreNullValues', v)}
                        />
                        <span className="text-sm text-slate-600">Tự động bỏ qua không quét các dịch vụ không có mã</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">LỌC MÃ DV (Chỉ lấy)</label>
                    <Select
                        mode="tags"
                        value={state.includeServices}
                        onChange={(v) => handleChange('includeServices', v)}
                        className="w-full"
                        placeholder="Nhập mã DV muốn lọc..."
                        open={false}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">LOẠI TRỪ MÃ DV (Bỏ qua)</label>
                    <Select
                        mode="tags"
                        value={state.excludeServices}
                        onChange={(v) => handleChange('excludeServices', v)}
                        className="w-full"
                        placeholder="Nhập mã DV muốn bỏ qua..."
                        open={false}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Thời gian bắt đầu</label>
                    <Select
                        value={state.startTime}
                        onChange={(v) => handleChange('startTime', v)}
                        className="w-full"
                        options={[
                            { label: 'NGAY_YL (Ngày Y Lệnh)', value: 'NGAY_YL' },
                            { label: 'NGAY_TH_YL (Ngày TH Y Lệnh)', value: 'NGAY_TH_YL' },
                            { label: 'NGAY_VAO (Ngày Vào)', value: 'NGAY_VAO' },
                            { label: 'NGAY_KQ (Ngày Kết Quả)', value: 'NGAY_KQ' }
                        ]}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Thời gian kết thúc</label>
                    <Select
                        value={state.endTime}
                        onChange={(v) => handleChange('endTime', v)}
                        className="w-full"
                        options={[
                            { label: 'NGAY_KQ (Ngày Kết Quả)', value: 'NGAY_KQ' },
                            { label: 'NGAY_RA (Ngày Ra)', value: 'NGAY_RA' },
                            { label: 'NGAY_YL (Ngày Y Lệnh)', value: 'NGAY_YL' },
                            { label: 'NGAY_TH_YL (Ngày TH Y Lệnh)', value: 'NGAY_TH_YL' }
                        ]}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sai số cho phép (Phút)</label>
                <InputNumber
                    value={state.tolerance}
                    onChange={(v) => handleChange('tolerance', v)}
                    className="w-full"
                />
                <div className="text-xs text-slate-400 mt-1">Khoảng thời gian trùng lặp tối thiểu để báo lỗi.</div>
            </div>
        </div>
    );
};

// Custom Input Component for Duplicate Doctor Logic
const DuplicateDoctorConfigInput = ({ value, onChange }: { value?: string, onChange?: (val: string) => void }) => {
    const getInitialState = () => {
        try {
            if (value) {
                const parsed = JSON.parse(value);
                return {
                    doctor: parsed.fields?.doctor || 'MA_BAC_SI',
                    time: parsed.fields?.time || 'NGAY_YL',
                    maNhom: parsed.filter?.MA_NHOM ? parsed.filter.MA_NHOM.join(', ') : '',
                    tolerance: parsed.toleranceMinutes !== undefined ? parsed.toleranceMinutes : 0,
                    ignoreNullValues: parsed.ignoreNullValues !== undefined ? parsed.ignoreNullValues : true
                };
            }
        } catch (e) { }
        return {
            doctor: 'MA_BAC_SI',
            time: 'NGAY_YL',
            maNhom: '',
            tolerance: 0,
            ignoreNullValues: true
        };
    };

    const [state, setState] = useState(getInitialState());

    useEffect(() => {
        setState(getInitialState());
    }, [value]);

    const triggerChange = (newState: any) => {
        setState(newState);
        if (onChange) {
            const filter: any = {};
            if (newState.maNhom && typeof newState.maNhom === 'string' && newState.maNhom.trim() !== '') {
                // Split by comma, trim spaces, filter empty strings, and convert to Number
                filter.MA_NHOM = newState.maNhom
                    .split(',')
                    .map((m: string) => m.trim())
                    .filter((m: string) => m !== '')
                    .map((m: string) => Number(m));
            }

            const json = {
                type: "DUPLICATE_DOCTOR",
                fields: {
                    doctor: newState.doctor,
                    time: newState.time
                },
                filter: filter,
                toleranceMinutes: Number(newState.tolerance),
                ignoreNullValues: newState.ignoreNullValues
            };
            onChange(JSON.stringify(json, null, 2));
        }
    };

    const handleChange = (key: string, val: any) => {
        const newState = { ...state, [key]: val };
        triggerChange(newState);
    };

    return (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Trường Mã Bác Sĩ (Trên XML)</label>
                    <Select
                        value={state.doctor}
                        onChange={(v) => handleChange('doctor', v)}
                        className="w-full"
                        options={[
                            { label: 'MA_BAC_SI', value: 'MA_BAC_SI' },
                            { label: 'MA_BS', value: 'MA_BS' },
                        ]}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Trường Thời gian Y Lệnh</label>
                    <Select
                        value={state.time}
                        onChange={(v) => handleChange('time', v)}
                        className="w-full"
                        options={[
                            { label: 'NGAY_YL', value: 'NGAY_YL' },
                            { label: 'NGAY_TH_YL', value: 'NGAY_TH_YL' },
                            { label: 'NGAY_KQ', value: 'NGAY_KQ' },
                        ]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bỏ qua giá trị null (Khuyết mã)</label>
                    <div className="flex items-center gap-2 mt-1">
                        <Switch
                            checked={state.ignoreNullValues}
                            onChange={(v) => handleChange('ignoreNullValues', v)}
                        />
                        <span className="text-sm text-slate-600">Tự động bỏ qua không quét các dịch vụ không có mã</span>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mã Nhóm Dịch Vụ - MA_NHOM</label>
                <Input
                    value={state.maNhom}
                    onChange={(e) => handleChange('maNhom', e.target.value)}
                    className="w-full"
                    placeholder="Ví dụ: 1, 2, 3"
                />
                <div className="text-xs text-slate-400 mt-1">Các nhóm cách nhau bằng dấu phẩy (,). Để trống để quét tất cả.</div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sai số cho phép (Phút)</label>
                <InputNumber
                    value={state.tolerance}
                    onChange={(v) => handleChange('tolerance', v)}
                    className="w-full"
                />
                <div className="text-xs text-slate-400 mt-1">Độ lệch thời gian cho phép báo trùng (Mặc định 0 = Cùng thời điểm tuyệt đối).</div>
            </div>
        </div>
    );
};

export default function ConfigPage() {
    const [rules, setRules] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<any>(null)
    const [editorMode, setEditorMode] = useState<'JSON' | 'DUPLICATE_BED' | 'MACHINE_CHECK' | 'DUPLICATE_DOCTOR'>('JSON');
    const [form] = Form.useForm()

    const detectEditorMode = (jsonString: string) => {
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed.type === 'DUPLICATE_BED') return 'DUPLICATE_BED';
            if (parsed.type === 'DUPLICATE_DOCTOR') return 'DUPLICATE_DOCTOR';
            if (parsed.type === 'MACHINE_CHECK') return 'MACHINE_CHECK';
        } catch (e) { }
        return 'JSON';
    }

    const fetchRules = async () => {
        setLoading(true)
        try {
            const res = await getSpecializedRules()
            if (res && res.success) {
                const filteredRules = (res.data || []).filter((rule: any) => rule.ruleType !== 'SYSTEM_CONFIG');
                setRules(filteredRules)
            } else {
                message.error(res?.error || "Không thể tải danh sách quy tắc.")
            }
        } catch (error) {
            console.error("fetchRules failed:", error)
            message.error("Lỗi kết nối khi tải quy tắc.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRules()
    }, [])

    const handleAdd = () => {
        setEditingRule(null)
        form.resetFields()
        // Default
        const defaultConfig = JSON.stringify({
            fields: { machineCode: "MA_MAY" },
            constraints: { maxPerDay: 50 },
            type: "MACHINE_CHECK"
        }, null, 2);

        form.setFieldsValue({
            isActive: true,
            order: rules.length + 1,
            ruleType: 'MACHINE_CHECK',
            logicConfig: defaultConfig
        })
        setEditorMode('MACHINE_CHECK');
        setIsModalOpen(true)
    }

    const handleEdit = (record: any) => {
        setEditingRule(record)
        const jsonConfig = JSON.stringify(record.logicConfig, null, 2);
        form.setFieldsValue({
            ...record,
            logicConfig: jsonConfig
        })
        setEditorMode(detectEditorMode(jsonConfig));
        setIsModalOpen(true)
    }

    const handleModeChange = (mode: 'JSON' | 'DUPLICATE_BED' | 'MACHINE_CHECK' | 'DUPLICATE_DOCTOR') => {
        setEditorMode(mode as any);
        const templates = {
            'DUPLICATE_BED': {
                type: "DUPLICATE_BED",
                fields: {
                    bed: "MA_GIUONG",
                    room: "MA_PHONG",
                    department: "MA_KHOA",
                    startTime: "NGAY_YL",
                    endTime: "NGAY_KQ"
                },
                filter: { MA_NHOM: 15 },
                toleranceMinutes: 15,
                ignoreIfSameField: ''
            },
            'DUPLICATE_DOCTOR': {
                type: "DUPLICATE_DOCTOR",
                fields: {
                    doctor: "MA_BAC_SI",
                    time: "NGAY_YL"
                },
                filter: { MA_NHOM: [1, 2, 3] }, // Mặc định mẫu
                toleranceMinutes: 0
            },
            'MACHINE_CHECK': {
                type: "MACHINE_CHECK",
                fields: { machineCode: "MA_MAY" },
                constraints: { maxPerDay: 50 }
            }
        };

        if (mode !== 'JSON' && templates[mode as keyof typeof templates]) {
            form.setFieldValue('logicConfig', JSON.stringify(templates[mode as keyof typeof templates], null, 2));
        }
    };

    const handleDelete = async (id: string) => {
        const res = await deleteSpecializedRule(id)
        if (res.success) {
            message.success('Đã xóa quy tắc')
            fetchRules()
        } else {
            message.error(res.error)
        }
    }

    const handleSave = async () => {
        try {
            const values = await form.validateFields()

            // Parse JSON
            let logicConfigParsed = {}
            try {
                logicConfigParsed = JSON.parse(values.logicConfig)
            } catch (e) {
                message.error('Cấu hình Logic không đúng định dạng JSON')
                return
            }

            const payload = {
                ...values,
                logicConfig: logicConfigParsed
            }

            let res
            if (editingRule) {
                res = await updateSpecializedRule(editingRule.id, payload)
            } else {
                res = await createSpecializedRule(payload)
            }

            if (res.success) {
                message.success(editingRule ? 'Đã cập nhật' : 'Đã thêm mới')
                setIsModalOpen(false)
                fetchRules()
            } else {
                message.error(res.error)
            }
        } catch (error) {
            // Validation error
        }
    }

    const columns = [
        {
            title: 'Tên quy tắc',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
                <div>
                    <div className="font-semibold">{text}</div>
                    <div className="text-xs text-slate-400">{record.slug}</div>
                </div>
            )
        },
        {
            title: 'Loại',
            dataIndex: 'ruleType',
            key: 'ruleType',
            width: 150,
            render: (type: string) => {
                let color = 'default'
                if (type === 'DUPLICATE_BED') color = 'orange'
                if (type === 'DUPLICATE_DOCTOR') color = 'purple'
                if (type === 'MACHINE_CHECK') color = 'blue'
                return <Tag color={color}>{type}</Tag>
            }
        },
        {
            title: 'Thứ tự',
            dataIndex: 'order',
            key: 'order',
            width: 80,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 100,
            render: (active: boolean) => (
                <Tag color={active ? 'success' : 'error'}>
                    {active ? 'Active' : 'Inactive'}
                </Tag>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 120,
            render: (_: any, record: any) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined className="text-blue-600" />}
                        onClick={() => handleEdit(record)}
                    />
                    <Popconfirm
                        title="Xóa quy tắc này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Cấu hình</h1>
                    <p className="text-slate-500">Thêm, sửa, xóa các quy tắc kiểm tra chuyên đề.</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Thêm quy tắc
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={rules}
                rowKey="id"
                loading={loading}
                pagination={false}
            />

            <Modal
                title={editingRule ? "Sửa Quy Tắc" : "Thêm Quy Tắc Mới"}
                open={isModalOpen}
                onOk={handleSave}
                onCancel={() => setIsModalOpen(false)}
                width={700}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{ isActive: true, order: 0 }}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="name"
                            label="Tên quy tắc"
                            rules={[{ required: true, message: 'Nhập tên quy tắc' }]}
                        >
                            <Input placeholder="Ví dụ: Kiểm tra Mã Máy" />
                        </Form.Item>
                        <Form.Item
                            name="slug"
                            label="Slug (URL)"
                            rules={[{ required: true, message: 'Nhập slug duy nhất' }]}
                            tooltip="Đường dẫn trên URL, không dấu, viết liền. Ví dụ: kiem-tra-ma-may"
                        >
                            <Input placeholder="kiem-tra-ma-may" />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="ruleType"
                            label="Loại quy tắc"
                            rules={[{ required: true }]}
                        >
                            <AutoComplete
                                options={[
                                    { value: 'MACHINE_CHECK', label: 'MACHINE_CHECK (Kiểm tra máy)' },
                                    { value: 'DUPLICATE_BED', label: 'DUPLICATE_BED (Trùng giường)' },
                                    { value: 'DUPLICATE_DOCTOR', label: 'DUPLICATE_DOCTOR (Trùng bác sĩ)' },
                                    { value: 'GROUP_15', label: 'GROUP_15 (Nhóm 15)' },
                                    { value: 'SQL', label: 'SQL (Truy vấn tùy chỉnh)' }
                                ]}
                                placeholder="Nhập hoặc chọn loại quy tắc"
                                filterOption={(inputValue, option) =>
                                    String(option!.value).toUpperCase().indexOf(inputValue.toUpperCase()) !== -1 ||
                                    String(option!.label).toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                }
                            />
                        </Form.Item>
                        <Form.Item
                            name="order"
                            label="Thứ tự hiển thị"
                        >
                            <InputNumber className="w-full" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="description"
                        label="Mô tả"
                    >
                        <Input.TextArea rows={2} />
                    </Form.Item>

                    <Form.Item
                        name="isActive"
                        valuePropName="checked"
                        label="Kích hoạt"
                    >
                        <Switch />
                    </Form.Item>

                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Cấu hình Logic
                            <span className="ml-2 text-xs font-normal text-slate-400">(Chọn kiểu form để nhập liệu dễ hơn)</span>
                        </label>
                        <Select
                            value={editorMode}
                            onChange={(v) => handleModeChange(v as any)}
                            style={{ width: 220 }}
                            size="small"
                        >
                            <Select.Option value="JSON">📝 JSON (Nâng cao)</Select.Option>
                            <Select.Option value="DUPLICATE_BED">📋 Form (Trùng giường)</Select.Option>
                            <Select.Option value="DUPLICATE_DOCTOR">📋 Form (Trùng bác sĩ)</Select.Option>
                        </Select>
                    </div>

                    {editorMode === 'MACHINE_CHECK' && (
                        <div className="p-4 mb-4 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
                            Form Kiểm tra máy đang phát triển. Vui lòng dùng định dạng JSON bên dưới.
                        </div>
                    )}
                    {editorMode === 'DUPLICATE_DOCTOR' && (
                        <div className="p-4 mb-4 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            Quy tắc tìm các chỉ định Dịch vụ/Thuốc của cùng Mã BS xuất hiện cùng 1 thời điểm. Hỗ trợ dữ liệu NGAY_YL định dạng đến Giây (14 ký tự).
                        </div>
                    )}

                    <Form.Item
                        name="logicConfig"
                        noStyle
                        rules={[{ required: true, message: 'Nhập cấu hình' }]}
                    >
                        {editorMode === 'DUPLICATE_BED' ? (
                            <DuplicateBedConfigInput />
                        ) : editorMode === 'DUPLICATE_DOCTOR' ? (
                            <DuplicateDoctorConfigInput />
                        ) : (
                            <TextArea
                                rows={8}
                                className="font-mono text-sm bg-slate-50"
                                spellCheck={false}
                                placeholder="Nhập cấu hình JSON..."
                            />
                        )}
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
