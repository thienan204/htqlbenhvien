'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    InputNumber, 
    Select, 
    DatePicker, 
    AutoComplete, 
    Switch, 
    Row, 
    Col, 
    Tabs, 
    Card, 
    Button, 
    Drawer, 
    Segmented, 
    Badge, 
    Tooltip, 
    Space, 
    Divider, 
    message 
} from 'antd';
import { 
    SettingOutlined, 
    SaveOutlined, 
    ReloadOutlined, 
    CloseOutlined, 
    CheckOutlined, 
    AppstoreOutlined, 
    BarsOutlined, 
    EyeOutlined, 
    EyeInvisibleOutlined,
    ExclamationCircleOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';

// Định nghĩa từng trường nhập liệu
export interface FormFieldDef {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'switch' | 'autocomplete';
    required?: boolean;
    placeholder?: string;
    options?: { value: string | number; label: string }[];
    span?: number; // 24-col grid: 6 (1/4), 8 (1/3), 12 (1/2), 24 (cả hàng)
    prefix?: React.ReactNode;
    disabled?: boolean;
    tooltip?: string;
    rules?: any[];
}

// Định nghĩa từng nhóm phân đoạn (Section / Tab)
export interface FormSectionDef {
    key: string;
    title: string;
    icon?: React.ReactNode;
    description?: string;
    fields: FormFieldDef[];
}

export interface ModularFormModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: any) => Promise<boolean | void>;
    title: React.ReactNode;
    formId: string;
    sections: FormSectionDef[];
    initialData?: any;
    width?: number | string;
    loading?: boolean;
    submitText?: string;
    cancelText?: string;
    extraHeaderActions?: React.ReactNode;
}

export default function ModularFormModal({
    open,
    onClose,
    onSubmit,
    title,
    formId,
    sections,
    initialData,
    width = 1000,
    loading = false,
    submitText = 'Lưu dữ liệu',
    cancelText = 'Hủy bỏ',
    extraHeaderActions
}: ModularFormModalProps) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [activeTabKey, setActiveTabKey] = useState<string>('');
    const [viewMode, setViewMode] = useState<'tabs' | 'continuous'>('tabs');
    const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
    const [hiddenFields, setHiddenFields] = useState<string[]>([]);
    const [tabErrors, setTabErrors] = useState<Record<string, number>>({});

    // Khởi tạo tab đầu tiên
    useEffect(() => {
        if (sections.length > 0 && !activeTabKey) {
            setActiveTabKey(sections[0].key);
        }
    }, [sections, activeTabKey]);

    // Tải cấu hình form đã lưu (viewMode, hiddenFields)
    const loadConfig = useCallback(async () => {
        try {
            // Đọc từ localStorage trước cho tốc độ tức thì
            const localViewMode = localStorage.getItem(`form_view_mode_${formId}`);
            if (localViewMode === 'tabs' || localViewMode === 'continuous') {
                setViewMode(localViewMode);
            }
            const localHidden = localStorage.getItem(`form_hidden_${formId}`);
            if (localHidden) {
                try {
                    setHiddenFields(JSON.parse(localHidden));
                } catch (e) {}
            }

            // Đồng bộ thêm từ CSDL qua /api/form-config
            const res = await fetch(`/api/form-config?formId=${formId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.settings) {
                    const parsed = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
                    if (parsed.viewMode) setViewMode(parsed.viewMode);
                    if (Array.isArray(parsed.hiddenFields)) setHiddenFields(parsed.hiddenFields);
                }
            }
        } catch (error) {
            console.error('Lỗi tải cấu hình form:', error);
        }
    }, [formId]);

    useEffect(() => {
        if (open) {
            loadConfig();
        }
    }, [open, loadConfig]);

    // Nạp dữ liệu ban đầu vào form khi mở modal
    useEffect(() => {
        if (open) {
            form.resetFields();
            if (initialData) {
                form.setFieldsValue(initialData);
            }
            setTabErrors({});
        }
    }, [open, initialData, form]);

    // Lưu cấu hình form (viewMode, hiddenFields)
    const handleSaveConfig = async (newViewMode: 'tabs' | 'continuous', newHidden: string[]) => {
        try {
            setViewMode(newViewMode);
            setHiddenFields(newHidden);

            // Lưu vào localStorage
            localStorage.setItem(`form_view_mode_${formId}`, newViewMode);
            localStorage.setItem(`form_hidden_${formId}`, JSON.stringify(newHidden));

            // Lưu vào Database
            await fetch('/api/form-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId,
                    settings: {
                        viewMode: newViewMode,
                        hiddenFields: newHidden
                    }
                })
            });

            message.success('Đã lưu cấu hình giao diện thành công!');
            setIsConfigDrawerOpen(false);
        } catch (error) {
            console.error('Lỗi lưu cấu hình form:', error);
            message.error('Không thể lưu cấu hình lên máy chủ');
        }
    };

    // Khôi phục mặc định
    const handleResetConfig = () => {
        handleSaveConfig('tabs', []);
    };

    // Toggle ẩn/hiện một trường
    const handleToggleFieldVisibility = (fieldName: string, isVisible: boolean) => {
        setHiddenFields(prev => {
            if (isVisible) {
                return prev.filter(f => f !== fieldName);
            } else {
                return [...prev, fieldName];
            }
        });
    };

    // Xử lý nộp form
    const handleOk = async () => {
        try {
            setSubmitting(true);
            const values = await form.validateFields();
            const result = await onSubmit(values);
            if (result !== false) {
                form.resetFields();
            }
        } catch (errorInfo: any) {
            // Kiểm tra và đếm lỗi trên từng tab để hiển thị badge cảnh báo
            if (errorInfo?.errorFields) {
                const errorsBySection: Record<string, number> = {};
                let firstSectionWithError: string | null = null;

                errorInfo.errorFields.forEach((err: any) => {
                    const fieldName = err.name?.[0];
                    const sec = sections.find(s => s.fields.some(f => f.name === fieldName));
                    if (sec) {
                        errorsBySection[sec.key] = (errorsBySection[sec.key] || 0) + 1;
                        if (!firstSectionWithError) firstSectionWithError = sec.key;
                    }
                });

                setTabErrors(errorsBySection);

                // Tự động nhảy sang tab đầu tiên có lỗi để người dùng dễ điền
                if (firstSectionWithError && viewMode === 'tabs') {
                    setActiveTabKey(firstSectionWithError);
                }

                message.error('Vui lòng kiểm tra và điền đầy đủ các trường bắt buộc!');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Render một trường nhập liệu cụ thể
    const renderFormFieldWidget = (field: FormFieldDef) => {
        switch (field.type) {
            case 'number':
                return (
                    <InputNumber
                        placeholder={field.placeholder || `Nhập ${field.label.toLowerCase()}...`}
                        disabled={field.disabled}
                        className="w-full !rounded-lg !h-9 leading-9 text-[13px] border-slate-300 hover:border-blue-400 focus:border-blue-500 shadow-2xs"
                    />
                );
            case 'select':
                return (
                    <Select
                        placeholder={field.placeholder || `Chọn ${field.label.toLowerCase()}...`}
                        options={field.options}
                        disabled={field.disabled}
                        showSearch
                        allowClear
                        filterOption={(input, option) =>
                            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        className="w-full !rounded-lg text-[13px] [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 hover:[&_.ant-select-selector]:!border-blue-400 [&_.ant-select-selector]:!h-9 [&_.ant-select-selection-item]:!leading-9 [&_.ant-select-selection-placeholder]:!leading-9 shadow-2xs"
                        style={{ height: 36 }}
                    />
                );
            case 'autocomplete':
                return (
                    <AutoComplete
                        placeholder={field.placeholder || `Nhập hoặc tìm ${field.label.toLowerCase()}...`}
                        options={field.options}
                        disabled={field.disabled}
                        allowClear
                        filterOption={(input, option) =>
                            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        className="w-full !rounded-lg text-[13px] [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 hover:[&_.ant-select-selector]:!border-blue-400 [&_.ant-select-selector]:!h-9 [&_.ant-select-selection-item]:!leading-9 [&_.ant-select-selection-placeholder]:!leading-9 shadow-2xs"
                        style={{ height: 36 }}
                    />
                );
            case 'date':
                return (
                    <DatePicker
                        format="DD/MM/YYYY"
                        placeholder={field.placeholder || 'Chọn ngày'}
                        disabled={field.disabled}
                        className="w-full !rounded-lg !h-9 text-[13px] border-slate-300 hover:border-blue-400 focus:border-blue-500 shadow-2xs"
                    />
                );
            case 'textarea':
                return (
                    <Input.TextArea
                        rows={3}
                        placeholder={field.placeholder || `Nhập ${field.label.toLowerCase()}...`}
                        disabled={field.disabled}
                        className="!rounded-lg text-[13px] py-1.5 border-slate-300 hover:border-blue-400 focus:border-blue-500 shadow-2xs"
                    />
                );
            case 'switch':
                return (
                    <div className="pt-1">
                        <Switch
                            checkedChildren="Bật"
                            unCheckedChildren="Tắt"
                            disabled={field.disabled}
                        />
                    </div>
                );
            case 'text':
            default:
                return (
                    <Input
                        prefix={field.prefix}
                        placeholder={field.placeholder || `Nhập ${field.label.toLowerCase()}...`}
                        disabled={field.disabled}
                        allowClear
                        className="!rounded-lg !h-9 text-[13px] border-slate-300 hover:border-blue-400 focus:border-blue-500 shadow-2xs"
                    />
                );
        }
    };

    // Render lưới các trường của một Section
    const renderSectionFieldsGrid = (section: FormSectionDef) => {
        const visibleFields = section.fields.filter(f => !hiddenFields.includes(f.name));

        if (visibleFields.length === 0) {
            return (
                <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Tất cả các trường trong mục này đã được ẩn trong Cấu hình Form.
                </div>
            );
        }

        return (
            <Row gutter={[16, 0]}>
                {visibleFields.map(field => {
                    const span = field.span || 8;
                    const isRequired = Boolean(field.required);

                    const rules = field.rules || (isRequired ? [{ required: true, message: `Vui lòng nhập ${field.label}` }] : []);

                    return (
                        <Col 
                            key={field.name}
                            xs={24}
                            sm={span <= 12 ? 12 : 24}
                            md={span}
                            className="min-w-0"
                        >
                            <Form.Item
                                name={field.name}
                                label={
                                    <span className="font-medium text-slate-700 text-[13px] flex items-center gap-1 leading-tight">
                                        <span>{field.label}</span>
                                        {isRequired && <span className="text-red-500 font-bold ml-0.5">*</span>}
                                        {field.tooltip && (
                                            <Tooltip title={field.tooltip}>
                                                <ExclamationCircleOutlined className="text-slate-400 text-[11px] ml-0.5" />
                                            </Tooltip>
                                        )}
                                    </span>
                                }
                                rules={rules}
                                className="!mb-3.5"
                                valuePropName={field.type === 'switch' ? 'checked' : 'value'}
                            >
                                {renderFormFieldWidget(field)}
                            </Form.Item>
                        </Col>
                    );
                })}
            </Row>
        );
    };

    // Tạo items cho Tabs Ant Design
    const tabItems = useMemo(() => {
        return sections.map(section => {
            const errorCount = tabErrors[section.key] || 0;

            const tabLabel = (
                <span className="flex items-center gap-1.5 font-medium text-xs sm:text-[13px] px-0.5 whitespace-nowrap">
                    {section.icon && <span className="text-sm">{section.icon}</span>}
                    <span>{section.title}</span>
                    {errorCount > 0 && (
                        <Badge count={errorCount} size="small" className="ml-1" />
                    )}
                </span>
            );

            return {
                key: section.key,
                label: tabLabel,
                children: (
                    <div className="pt-1.5 pb-1">
                        {section.description && (
                            <div className="mb-2.5 text-xs text-slate-500 bg-blue-50/60 border border-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                <span className="text-blue-500 text-xs">ℹ️</span>
                                <span>{section.description}</span>
                            </div>
                        )}
                        {renderSectionFieldsGrid(section)}
                    </div>
                )
            };
        });
    }, [sections, tabErrors, hiddenFields]);

    return (
        <>
            <Modal
                title={
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8 pb-3 border-b border-slate-100">
                        {/* Tiêu đề Modal */}
                        <div className="min-w-0 flex items-center gap-2.5">
                            <div className="font-bold text-base sm:text-lg text-slate-800 truncate">
                                {title}
                            </div>
                        </div>

                        {/* Nút chuyển chế độ xem & Nút Cấu hình Form */}
                        <div className="flex items-center gap-2 shrink-0">
                            {extraHeaderActions}

                            {/* Bộ chuyển đổi Chế độ xem: Phân theo Tab <-> Cuộn 1 trang (Kiểu Icon căn giữa chuẩn) */}
                            <Segmented
                                size="middle"
                                value={viewMode}
                                onChange={(val) => {
                                    const mode = val as 'tabs' | 'continuous';
                                    setViewMode(mode);
                                    localStorage.setItem(`form_view_mode_${formId}`, mode);
                                }}
                                options={[
                                    {
                                        value: 'tabs',
                                        icon: (
                                            <Tooltip title="Chế độ Phân Tab">
                                                <div className="w-7 h-7 flex items-center justify-center">
                                                    <AppstoreOutlined className="text-[15px]" />
                                                </div>
                                            </Tooltip>
                                        )
                                    },
                                    {
                                        value: 'continuous',
                                        icon: (
                                            <Tooltip title="Chế độ Cuộn 1 trang">
                                                <div className="w-7 h-7 flex items-center justify-center">
                                                    <BarsOutlined className="text-[15px]" />
                                                </div>
                                            </Tooltip>
                                        )
                                    }
                                ]}
                                className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 [&_.ant-segmented-item-label]:!p-0 [&_.ant-segmented-item-label]:!flex [&_.ant-segmented-item-label]:!items-center [&_.ant-segmented-item-label]:!justify-center [&_.ant-segmented-item-icon]:!m-0 [&_.ant-segmented-item-icon]:!flex [&_.ant-segmented-item-icon]:!items-center [&_.ant-segmented-item-icon]:!justify-center"
                            />

                            {/* Nút Cấu hình Form */}
                            <Tooltip title="Tùy chỉnh ẩn/hiển thị các trường thông tin">
                                <Button
                                    size="middle"
                                    icon={<SettingOutlined className="text-slate-600" />}
                                    onClick={() => setIsConfigDrawerOpen(true)}
                                    className="rounded-lg border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-400 font-medium text-xs flex items-center gap-1"
                                >
                                    <span className="hidden sm:inline">Cấu hình</span>
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                }
                open={open}
                onCancel={onClose}
                width={width}
                centered
                destroyOnHidden
                className="max-w-[96vw]"
                styles={{
                    body: {
                        maxHeight: 'calc(88vh - 120px)',
                        overflowY: 'auto',
                        paddingRight: '6px',
                        paddingTop: '10px',
                        paddingBottom: '4px'
                    }
                }}
                footer={
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-400 hidden sm:block">
                            💡 Các trường có dấu <span className="text-red-500 font-bold">*</span> là bắt buộc nhập
                        </div>
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                            <Button
                                onClick={onClose}
                                disabled={submitting || loading}
                                className="h-9 px-4 rounded-lg text-slate-600 font-medium hover:bg-slate-50 flex-1 sm:flex-initial text-sm"
                            >
                                {cancelText}
                            </Button>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleOk}
                                loading={submitting || loading}
                                className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold shadow-xs flex-1 sm:flex-initial text-sm"
                            >
                                {submitText}
                            </Button>
                        </div>
                    </div>
                }
            >
                <Form
                    form={form}
                    layout="vertical"
                    preserve={true}
                    scrollToFirstError={true}
                    requiredMark={false}
                    className="staff-modular-form [&_.ant-form-item-label]:!pb-0.5 [&_.ant-form-item-label>label]:!text-slate-700 [&_.ant-form-item-label>label]:!text-[13px] [&_.ant-form-item-label>label]:!font-medium [&_.ant-form-item-label>label]:!h-auto"
                >
                    {/* CHẾ ĐỘ 1: PHÂN CHIA THEO TAB (Antd Tabs type="card") */}
                    {viewMode === 'tabs' ? (
                        <Tabs
                            type="card"
                            activeKey={activeTabKey}
                            onChange={setActiveTabKey}
                            items={tabItems}
                            className="modular-form-tabs [&_.ant-tabs-nav]:!mb-2.5 [&_.ant-tabs-tab]:!px-3 [&_.ant-tabs-tab]:!py-1.5 [&_.ant-tabs-tab]:!rounded-t-lg"
                        />
                    ) : (
                        /* CHẾ ĐỘ 2: CUỘN 1 TRANG LIÊN TỤC (Từng nhóm trong thẻ Card sang trọng) */
                        <div className="space-y-4">
                            {sections.map(section => (
                                <Card
                                    key={section.key}
                                    id={`section-${section.key}`}
                                    className="rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow"
                                    styles={{
                                        header: { 
                                            backgroundColor: '#f8fafc', 
                                            borderBottom: '1px solid #e2e8f0', 
                                            padding: '10px 18px' 
                                        },
                                        body: { 
                                            padding: '16px 18px 4px 18px' 
                                        }
                                    }}
                                    title={
                                        <div className="flex items-center gap-2 text-slate-800">
                                            {section.icon && <span className="text-blue-600 text-base">{section.icon}</span>}
                                            <span className="font-bold text-sm sm:text-base">{section.title}</span>
                                            {section.description && (
                                                <span className="text-xs text-slate-400 font-normal hidden md:inline">
                                                    — {section.description}
                                                </span>
                                            )}
                                        </div>
                                    }
                                >
                                    {renderSectionFieldsGrid(section)}
                                </Card>
                            ))}
                        </div>
                    )}
                </Form>
            </Modal>

            {/* NGĂN KÉO CẤU HÌNH FORM (DRAWER) */}
            <Drawer
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                        <SettingOutlined className="text-blue-600" />
                        <span>Cấu hình Giao diện Form</span>
                    </div>
                }
                open={isConfigDrawerOpen}
                onClose={() => setIsConfigDrawerOpen(false)}
                size={420}
                className="config-form-drawer"
                footer={
                    <div className="flex items-center justify-between">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={handleResetConfig}
                            className="rounded-xl text-xs text-slate-600"
                        >
                            Khôi phục mặc định
                        </Button>
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={() => handleSaveConfig(viewMode, hiddenFields)}
                            className="rounded-xl bg-blue-600 hover:bg-blue-500 font-medium text-xs px-4"
                        >
                            Lưu cấu hình
                        </Button>
                    </div>
                }
            >
                <div className="space-y-5 text-sm">
                    {/* 1. Chọn chế độ xem mặc định */}
                    <div>
                        <div className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                            <span>1.</span> Chế độ hiển thị mặc định
                        </div>
                        <div className="text-xs text-slate-500 mb-2.5">
                            Chọn cách hiển thị form phù hợp nhất với thói quen làm việc của bạn:
                        </div>
                        <Segmented
                            block
                            size="middle"
                            value={viewMode}
                            onChange={(val) => setViewMode(val as 'tabs' | 'continuous')}
                            options={[
                                {
                                    label: <span className="font-medium text-xs py-1">📑 Phân chia theo Tab</span>,
                                    value: 'tabs'
                                },
                                {
                                    label: <span className="font-medium text-xs py-1">📜 Cuộn 1 trang liên tục</span>,
                                    value: 'continuous'
                                }
                            ]}
                            className="p-1 bg-slate-100 rounded-xl"
                        />
                    </div>

                    <Divider className="my-3" />

                    {/* 2. Quản lý ẩn / hiện trường theo từng nhóm */}
                    <div>
                        <div className="font-bold text-slate-800 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <span>2.</span> Ẩn / Hiện các trường thông tin
                            </span>
                            <span className="text-[11px] font-normal text-slate-400">
                                Đã ẩn {hiddenFields.length} trường
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 mb-3">
                            Gạt tắt các trường không dùng để form trở nên gọn gàng và dễ nhìn hơn:
                        </div>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                            {sections.map(sec => (
                                <div key={sec.key} className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                                    <div className="font-bold text-xs text-slate-800 pb-2 mb-2 border-b border-slate-200 flex items-center gap-1.5">
                                        {sec.icon}
                                        <span>{sec.title}</span>
                                        <span className="text-[10px] text-slate-400 font-normal">
                                            ({sec.fields.length} trường)
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {sec.fields.map(f => {
                                            const isHidden = hiddenFields.includes(f.name);
                                            const isRequired = Boolean(f.required);

                                            return (
                                                <div 
                                                    key={f.name}
                                                    className="flex items-center justify-between text-xs py-1 px-1.5 hover:bg-white rounded-lg transition-colors"
                                                >
                                                    <span className={`truncate mr-2 ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                                                        {f.label} {isRequired && <span className="text-red-500 font-bold">*</span>}
                                                    </span>
                                                    <Tooltip title={isRequired ? 'Trường bắt buộc, không thể ẩn' : (isHidden ? 'Bấm để hiển thị' : 'Bấm để ẩn khỏi form')}>
                                                        <Switch
                                                            size="small"
                                                            checked={!isHidden}
                                                            disabled={isRequired}
                                                            onChange={(checked) => handleToggleFieldVisibility(f.name, checked)}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Drawer>
        </>
    );
}

