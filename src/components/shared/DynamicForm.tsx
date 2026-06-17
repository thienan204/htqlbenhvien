'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Select, DatePicker, Row, Col, message, Button, Space, Tooltip, InputNumber, Switch, AutoComplete, Card } from 'antd';
import { SettingOutlined, CheckOutlined, DragOutlined, ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';

export interface FieldConfig {
    id: string;
    label: string;
    type: 'input' | 'date' | 'year' | 'select' | 'textarea' | 'number' | 'switch' | 'autocomplete';
    required?: boolean;
    span?: number;
    options?: { value: string | number; label: string }[];
    valuePropName?: string;
    onBlur?: (e: any, form: any) => void;
    placeholder?: string;
    defaultValue?: any;
    disabled?: boolean;
}

export interface DynamicFormProps {
    formId: string;
    title: React.ReactNode;
    open: boolean;
    onClose: () => void;
    onSubmit: (values: any) => Promise<boolean | void>;
    fieldsConfig: FieldConfig[];
    initialData?: any;
    onValuesChange?: (changedValues: any, allValues: any, form: any) => void;
    mode?: 'modal' | 'inline';
    hideFooter?: boolean;
    formInstance?: any;
    disabled?: boolean;
}

export default function DynamicForm({ formId, title, open, onClose, onSubmit, fieldsConfig, initialData, onValuesChange, mode = 'modal', hideFooter = false, formInstance, disabled = false }: DynamicFormProps) {
    const [internalForm] = Form.useForm();
    const form = formInstance || internalForm;
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [fields, setFields] = useState<any[]>([]);
    const [formLayout, setFormLayout] = useState<'vertical' | 'horizontal'>('vertical');
    const [labelAlign, setLabelAlign] = useState<'left' | 'right'>('right');
    const [isCompact, setIsCompact] = useState(false);
    const [formWidth, setFormWidth] = useState<number>(100);
    
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'CNTT';
    
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [dragEnabledIndex, setDragEnabledIndex] = useState<number | null>(null);
    const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
    const [addFieldForm] = Form.useForm();

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`/api/form-config?formId=${formId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.settings) {
                        const s = JSON.parse(data.settings);
                        if (s.layout) setFormLayout(s.layout); 
                        if (s.labelAlign) setLabelAlign(s.labelAlign);
                        if (s.isCompact !== undefined) setIsCompact(s.isCompact);
                        if (s.formWidth !== undefined) setFormWidth(s.formWidth);
                    }
                    if (data.layout) {
                        const savedFields = JSON.parse(data.layout);
                        if (Array.isArray(savedFields)) {
                            const restoredFields = savedFields.map((savedF: any) => {
                                const original = fieldsConfig.find(f => f.id === savedF.id);
                                if (original) return { ...original, ...savedF };
                                if (savedF.isCustomField) return savedF;
                                return null;
                            }).filter(Boolean);

                            const existingIds = new Set(restoredFields.map((f: any) => f.id));
                            const newFields = fieldsConfig.filter(f => !existingIds.has(f.id));
                            const finalFields = [...restoredFields, ...newFields.map(f => ({ ...f, widthPercent: Math.round(((f.span || 24) / 24) * 100) }))];

                            if (finalFields.length > 0) {
                                setFields(finalFields);
                                return;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to fetch config', e);
            }
            setFields(fieldsConfig.map(f => ({ ...f, widthPercent: Math.round(((f.span || 24) / 24) * 100) })));
        };
        fetchConfig();
    }, [formId, fieldsConfig]);

    useEffect(() => {
        if (open) {
            setIsEditMode(false);
            form.resetFields();
            if (initialData) {
                form.setFieldsValue(initialData);
            }
        }
    }, [open, initialData, form]);

    const handleSave = async (values: any) => {
        setLoading(true);
        try {
            await onSubmit(values);
        } finally {
            setLoading(false);
        }
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const newFields = [...fields];
        if (direction === 'up' && index > 0) {
            [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
        } else if (direction === 'down' && index < fields.length - 1) {
            [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
        }
        setFields(newFields);
    };

    const changeFieldWidth = (index: number, widthPercent: number) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], widthPercent };
        setFields(newFields);
    };

    const changeFieldLabel = (index: number, customLabel: string) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], customLabel };
        setFields(newFields);
    };

    const changeFieldLabelRatio = (index: number, labelRatio: number | null) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], labelRatio };
        setFields(newFields);
    };

    const deleteCustomField = (index: number) => {
        const newFields = [...fields];
        newFields.splice(index, 1);
        setFields(newFields);
    };

    const latestFieldsRef = useRef(fields);
    useEffect(() => { latestFieldsRef.current = fields; }, [fields]);

    const handleFieldResizeStart = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const initialWidth = latestFieldsRef.current[index].widthPercent;
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const diffX = moveEvent.pageX - startX;
            const containerWidth = document.querySelector('.compact-form') 
                ? (document.querySelector('.compact-form')?.clientWidth || 800) 
                : 800; 
            const diffPercent = (diffX / containerWidth) * 100;
            let newWidth = Math.round(initialWidth + diffPercent);
            if (newWidth < 10) newWidth = 10;
            if (newWidth > 100) newWidth = 100;
            
            const newFields = [...latestFieldsRef.current];
            newFields[index] = { ...newFields[index], widthPercent: newWidth };
            setFields(newFields);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleLabelResizeStart = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const initialRatio = latestFieldsRef.current[index].labelRatio || 33;
        const fieldElement = document.getElementById(`field-${index}`);
        const fieldWidth = fieldElement?.clientWidth || 200;
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const diffX = moveEvent.pageX - startX;
            const diffPercent = (diffX / fieldWidth) * 100;
            let newRatio = Math.round(initialRatio + diffPercent);
            if (newRatio < 5) newRatio = 5;
            if (newRatio > 95) newRatio = 95;
            
            const newFields = [...latestFieldsRef.current];
            newFields[index] = { ...newFields[index], labelRatio: newRatio };
            setFields(newFields);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const toggleEditMode = async () => {
        if (isEditMode) {
            setLoading(true);
            try {
                const res = await fetch('/api/form-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        formId,
                        layout: fields.map(f => ({ 
                            id: f.id, 
                            widthPercent: f.widthPercent, 
                            customLabel: f.customLabel,
                            labelRatio: f.labelRatio
                        })),
                        settings: { layout: formLayout, labelAlign, isCompact, formWidth }
                    })
                });
                if (res.ok) {
                    message.success('Đã lưu cấu hình Form cho toàn hệ thống!');
                } else {
                    message.error('Lưu cấu hình thất bại');
                }
            } catch (error) {
                message.error('Lỗi kết nối khi lưu cấu hình');
            } finally {
                setLoading(false);
            }
        }
        setIsEditMode(!isEditMode);
    };

    const renderInputNode = (field: any) => {
        const inputSize = isCompact ? 'small' : 'large';
        const borderRadiusClass = isCompact ? '!rounded-sm' : '';
        const heightClass = isCompact ? '!h-[24px] !py-0 !px-1.5' : '';
        const fullWidthClass = `w-full ${borderRadiusClass} ${heightClass}`;
        const inputVariant = isCompact ? 'borderless' : 'outlined';
        
        switch (field.type) {
            case 'autocomplete':
                return (
                    <AutoComplete
                        options={field.options || []}
                        placeholder={field.placeholder || `Nhập hoặc chọn ${field.label.toLowerCase()}...`}
                        className={fullWidthClass}
                        size={inputSize}
                        variant={inputVariant}
                        disabled={field.disabled}
                        filterOption={(inputValue, option) =>
                            (option?.label?.toString() || '').toLowerCase().includes(inputValue.toLowerCase()) || 
                            (option?.value?.toString() || '').toLowerCase().includes(inputValue.toLowerCase())
                        }
                        onBlur={(e) => field.onBlur && field.onBlur(e, form)}
                    />
                );
            case 'date': 
                return <DatePicker disabled={field.disabled} format="DD/MM/YYYY" className={fullWidthClass} size={inputSize} variant={inputVariant} style={{ height: isCompact ? 24 : undefined }} onBlur={(e) => field.onBlur && field.onBlur(e, form)} />;
            case 'year': 
                return <DatePicker disabled={field.disabled} picker="year" className={fullWidthClass} size={inputSize} variant={inputVariant} style={{ height: isCompact ? 24 : undefined }} onBlur={(e) => field.onBlur && field.onBlur(e, form)} placeholder="Chọn năm..." />;
            case 'select':
                return (
                    <Select
                        showSearch
                        allowClear
                        disabled={field.disabled}
                        placeholder={field.placeholder || `Chọn ${field.label.toLowerCase()}...`}
                        optionFilterProp="label"
                        filterOption={(input, option) =>
                            (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                        }
                        className={fullWidthClass}
                        size={inputSize}
                        variant={inputVariant}
                        options={field.options || []}
                        onBlur={(e) => field.onBlur && field.onBlur(e, form)}
                    />
                );
            case 'textarea':
                return <Input.TextArea disabled={field.disabled} placeholder={field.placeholder || `Nhập ${field.label.toLowerCase()}...`} className={`${fullWidthClass} !h-auto`} rows={isCompact ? 2 : 3} variant={inputVariant} onBlur={(e) => field.onBlur && field.onBlur(e, form)} />;
            case 'number':
                return <InputNumber disabled={field.disabled} placeholder={field.placeholder || `Nhập số...`} className={fullWidthClass} size={inputSize} variant={inputVariant} min={0} onBlur={(e) => field.onBlur && field.onBlur(e, form)} />;
            case 'switch':
                return <Switch disabled={field.disabled} checkedChildren="Bật" unCheckedChildren="Tắt" size={isCompact ? 'small' : 'default'} />;
            case 'input':
            default:
                return <Input disabled={field.disabled} placeholder={field.placeholder || `Nhập ${field.label.toLowerCase()}...`} className={fullWidthClass} size={inputSize} variant={inputVariant} onBlur={(e) => field.onBlur && field.onBlur(e, form)} />;
        }
    };

    const headerContent = (
        <div className="flex justify-between items-center w-full pr-6 pt-1">
            <span className="text-xl font-bold">{title}</span>
            <Space>
                {isAdmin && (
                    <Tooltip title="Tự sắp xếp vị trí các trường nhập liệu">
                        <Button 
                            type={isEditMode ? "primary" : "default"} 
                            icon={isEditMode ? <CheckOutlined /> : <SettingOutlined />} 
                            onClick={toggleEditMode}
                            className={isEditMode ? "bg-green-500" : ""}
                        >
                            {isEditMode ? "Hoàn tất Cấu hình" : "Cấu hình Form"}
                        </Button>
                    </Tooltip>
                )}
            </Space>
        </div>
    );

    const footerContent = !hideFooter && (
        <div className="flex justify-end p-4 border-t border-slate-100 bg-white">
            <Space>
                {mode === 'modal' && <Button onClick={onClose} size="large">Hủy</Button>}
                <Button type="primary" onClick={() => form.submit()} loading={loading} size="large">Lưu</Button>
            </Space>
        </div>
    );

    const formBodyContent = (
        <>
            <div className={`w-full bg-slate-50 ${mode === 'modal' ? 'p-8' : 'p-4'}`}>
                {isEditMode && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 flex flex-wrap gap-4 justify-between items-center">
                        <div className="flex-1 min-w-[200px]">
                            <DragOutlined className="mr-2" />
                            <strong>Chế độ Cấu hình:</strong> Chỉnh sửa độ rộng, vị trí các trường hoặc đổi kiểu hiển thị Label.
                        </div>
                        <Space wrap>
                            <Button type={isCompact ? 'primary' : 'default'} size="small" onClick={() => setIsCompact(!isCompact)}>
                                Mật độ: {isCompact ? 'Gọn gàng (2px)' : 'Rộng rãi'}
                            </Button>
                            {formLayout === 'horizontal' && (
                                <Button type="default" size="small" onClick={() => setLabelAlign(labelAlign === 'left' ? 'right' : 'left')}>
                                    Căn lề Label: {labelAlign === 'left' ? 'Trái' : 'Phải'}
                                </Button>
                            )}
                            <Button type="primary" ghost size="small" onClick={() => setFormLayout(formLayout === 'vertical' ? 'horizontal' : 'vertical')}>
                                Chuyển sang Label {formLayout === 'vertical' ? 'Nằm ngang' : 'Nằm trên'}
                            </Button>
                            <Button size="small" type="dashed" className="border-blue-400 text-blue-600 font-medium" icon={<PlusOutlined />} onClick={() => setIsAddFieldModalOpen(true)}>
                                Thêm Trường
                            </Button>
                            <div className="flex items-center ml-2 border-l pl-4 border-blue-200">
                                <span className="text-xs font-medium mr-2">Độ rộng Form:</span>
                                <InputNumber 
                                    size="small" 
                                    min={30} 
                                    max={100} 
                                    value={formWidth} 
                                    onChange={(val) => setFormWidth(val || 100)}
                                    formatter={(value) => `${value}%`}
                                    parser={(value) => Number(value?.replace('%', ''))}
                                    className="w-[65px]"
                                />
                            </div>
                        </Space>
                    </div>
                )}
                
                <style>{`
                    .dynamic-form-tooltip-error .ant-form-item-explain {
                        position: absolute;
                        z-index: 50;
                        top: calc(100% + 4px);
                        left: 10px;
                        width: max-content;
                        max-width: calc(100% - 20px);
                        pointer-events: none;
                    }
                    .dynamic-form-tooltip-error .ant-form-item-explain-error {
                        background-color: rgba(239, 68, 68, 0.95);
                        color: white;
                        padding: 5px 10px;
                        border-radius: 6px;
                        font-size: 12px;
                        line-height: 1.4;
                        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
                        animation: tooltipFadeIn 0.2s ease-out forwards;
                        position: relative;
                        white-space: normal;
                    }
                    .dynamic-form-tooltip-error .ant-form-item-explain-error::before {
                        content: '';
                        position: absolute;
                        top: -5px;
                        left: 12px;
                        border-width: 0 5px 5px 5px;
                        border-style: solid;
                        border-color: transparent transparent rgba(239, 68, 68, 0.95) transparent;
                    }
                    .dynamic-form-tooltip-error .ant-form-item-with-help {
                        margin-bottom: 0 !important;
                    }
                    @keyframes tooltipFadeIn {
                        from { opacity: 0; transform: translateY(-4px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>

                <Form 
                    form={form} 
                    layout={formLayout} 
                    size={isCompact ? 'small' : 'large'}
                    labelAlign={labelAlign}
                    onFinish={handleSave}
                    onValuesChange={(changed, all) => onValuesChange && onValuesChange(changed, all, form)}
                    requiredMark={false}
                    labelCol={formLayout === 'horizontal' && !isCompact ? { span: 8 } : undefined}
                    wrapperCol={formLayout === 'horizontal' && !isCompact ? { span: 16 } : undefined}
                    className={`dynamic-form-tooltip-error ${isCompact ? "compact-form" : ""}`}
                    disabled={disabled}
                >
                    <Row gutter={isCompact ? [2, 2] : [24, 24]}>
                        {fields.map((field, index) => {
                            const labelBgClass = !isEditMode && isCompact 
                                ? (formLayout === 'horizontal' 
                                    ? '[&_.ant-form-item-label]:bg-slate-50/80 [&_.ant-form-item-label]:border-r [&_.ant-form-item-label]:border-slate-200/80' 
                                    : '[&_.ant-form-item-label]:bg-slate-50/80 [&_.ant-form-item-label]:border-b [&_.ant-form-item-label]:border-slate-200/80')
                                : '';
                                
                            return (
                                <Col style={{ flex: `0 0 ${field.widthPercent}%`, maxWidth: `${field.widthPercent}%` }} key={field.id}>
                                    <div 
                                        draggable={isEditMode && dragEnabledIndex === index}
                                    onDragStart={(e) => {
                                        setDraggedIndex(index);
                                        e.dataTransfer.effectAllowed = 'move';
                                        setTimeout(() => {
                                            const element = document.getElementById(`field-${index}`);
                                            if (element) element.style.opacity = '0.4';
                                        }, 0);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (draggedIndex !== null && dragOverIndex !== index) {
                                            setDragOverIndex(index);
                                        }
                                    }}
                                    onDragLeave={() => {
                                        if (dragOverIndex === index) {
                                            setDragOverIndex(null);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (draggedIndex !== null && draggedIndex !== index) {
                                            const newFields = [...fields];
                                            const draggedItem = newFields[draggedIndex];
                                            newFields.splice(draggedIndex, 1);
                                            newFields.splice(index, 0, draggedItem);
                                            setFields(newFields);
                                        }
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                        setDragEnabledIndex(null);
                                    }}
                                    onDragEnd={(e) => {
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                        setDragEnabledIndex(null);
                                        const element = document.getElementById(`field-${index}`);
                                        if (element) element.style.opacity = '1';
                                    }}
                                    id={`field-${index}`}
                                    className={`h-full relative flex flex-col justify-start transition-all duration-200 ${
                                        isEditMode 
                                            ? 'outline outline-1 outline-dashed outline-blue-400 outline-offset-2 bg-white/40 rounded-sm z-10' 
                                            : `ring-1 ring-inset ring-slate-200/80 bg-white rounded-sm hover:ring-slate-300 [&_.ant-select-selector]:!h-[24px] [&_.ant-select-selection-item]:!leading-[24px] [&_.ant-select-selection-search-input]:!h-[24px] ${labelBgClass}`
                                    } ${
                                        draggedIndex === index ? 'scale-95 z-0' : ''
                                    } ${
                                        dragOverIndex === index ? 'outline-green-500 bg-green-50/80 scale-[1.02] shadow-lg z-30 ring-2 ring-green-500' : ''
                                    }`}
                                >
                                    <Form.Item 
                                        name={field.id} 
                                        label={
                                            <div className={`flex items-center w-full h-full relative group/label ${!isEditMode && isCompact ? 'px-1.5' : ''}`}>
                                                {isEditMode ? (
                                                    <input 
                                                        value={field.customLabel || field.label} 
                                                        onChange={(e) => changeFieldLabel(index, e.target.value)} 
                                                        className={`w-full bg-blue-50/50 border-0 border-b border-dashed border-blue-400 focus:outline-none focus:border-blue-600 px-0.5 py-0 text-blue-700 ${isCompact ? 'text-xs font-normal' : 'text-sm font-semibold'}`}
                                                        placeholder="Tên nhãn..."
                                                    />
                                                ) : (
                                                    <span className={`text-slate-700 ${isCompact ? 'text-xs font-normal' : 'text-sm font-semibold'}`}>
                                                        {field.customLabel || field.label}
                                                    </span>
                                                )}
                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                                {isEditMode && formLayout === 'horizontal' && (
                                                    <div 
                                                        className="absolute -right-[6px] top-0 bottom-0 w-2 cursor-col-resize hover:bg-green-400/30 z-20 group-hover/label:opacity-100 flex items-center justify-center"
                                                        onMouseDown={(e) => handleLabelResizeStart(e, index)}
                                                    >
                                                        <div className="w-[3px] h-3/4 bg-green-500 rounded-full opacity-50 shadow-sm" />
                                                    </div>
                                                )}
                                            </div>
                                        } 
                                        rules={field.required ? [{ required: true, message: `Vui lòng nhập ${field.customLabel || field.label}` }] : []}
                                        valuePropName={field.valuePropName || 'value'}
                                        className="mb-0 flex-nowrap"
                                        style={isCompact ? { flexWrap: 'nowrap', marginBottom: 0 } : { marginBottom: 0 }}
                                        labelCol={formLayout === 'horizontal' ? (
                                            field.labelRatio && field.labelRatio > 0 
                                                ? { flex: `0 0 ${field.labelRatio}%`, style: { maxWidth: `${field.labelRatio}%`, paddingRight: 4 } } 
                                                : (isCompact ? { flex: 'none', style: { marginRight: 4, whiteSpace: 'nowrap' } } : undefined)
                                        ) : undefined}
                                        wrapperCol={formLayout === 'horizontal' ? (
                                            field.labelRatio && field.labelRatio > 0 
                                                ? { flex: `0 0 ${100 - field.labelRatio}%`, style: { maxWidth: `${100 - field.labelRatio}%`, minWidth: 0 } } 
                                                : (isCompact ? { flex: 'auto', style: { minWidth: 0 } } : undefined)
                                        ) : undefined}
                                    >
                                        {renderInputNode(field)}
                                    </Form.Item>

                                    {isEditMode && (
                                        <div className="mt-1.5 flex flex-wrap gap-1 items-center justify-between bg-slate-50/90 p-1 rounded border border-slate-200">
                                            <div className="flex flex-wrap items-center gap-1">
                                                <Tooltip title="Độ rộng Ô">
                                                    <span className="text-[10px] text-slate-500 font-medium">Ô:</span>
                                                </Tooltip>
                                                <InputNumber 
                                                    size="small" 
                                                    min={2} 
                                                    max={100} 
                                                    value={field.widthPercent} 
                                                    onChange={(val) => changeFieldWidth(index, val || 100)}
                                                    formatter={(value) => `${value}%`}
                                                    parser={(value) => Number(value?.replace('%', ''))}
                                                    className="w-[55px] text-xs"
                                                />
                                                {formLayout === 'horizontal' && (
                                                    <>
                                                        <Tooltip title="Tỷ lệ Label">
                                                            <span className="text-[10px] text-slate-500 font-medium ml-0.5">L:</span>
                                                        </Tooltip>
                                                        <InputNumber 
                                                            size="small" 
                                                            min={5} 
                                                            max={95} 
                                                            value={field.labelRatio || (isCompact ? 0 : 33)} 
                                                            onChange={(val) => changeFieldLabelRatio(index, val)}
                                                            formatter={(value) => value === 0 ? 'Auto' : `${value}%`}
                                                            parser={(value) => value === 'Auto' ? 0 : Number(value?.replace('%', ''))}
                                                            className="w-[60px] text-xs"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                                {field.isCustomField && (
                                                    <Button size="small" type="text" danger icon={<DeleteOutlined className="text-[12px]" />} onClick={() => deleteCustomField(index)} title="Xóa trường tự tạo" />
                                                )}
                                                <div 
                                                    data-drag-handle="true"
                                                    onMouseEnter={() => setDragEnabledIndex(index)}
                                                    onMouseLeave={() => setDragEnabledIndex(null)}
                                                    className="w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                                    title="Kéo thả để di chuyển"
                                                >
                                                    <DragOutlined />
                                                </div>
                                                <Button size="small" icon={<ArrowUpOutlined className="text-[10px]" />} onClick={() => moveField(index, 'up')} disabled={index === 0} />
                                                <Button size="small" icon={<ArrowDownOutlined className="text-[10px]" />} onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} />
                                            </div>
                                        </div>
                                    )}

                                    {isEditMode && (
                                        <div 
                                            className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 z-20 flex items-center justify-center group-hover:opacity-100"
                                            onMouseDown={(e) => handleFieldResizeStart(e, index)}
                                        >
                                            <div className="w-[3px] h-1/2 bg-blue-500 rounded-full opacity-50 shadow-sm" />
                                        </div>
                                    )}
                                </div>
                            </Col>
                            );
                        })}
                    </Row>
                </Form>
            </div>

            <Modal
                title={<div className="text-blue-600 text-lg font-bold">Thêm Trường Dữ Liệu Tự Tạo</div>}
                open={isAddFieldModalOpen}
                onCancel={() => setIsAddFieldModalOpen(false)}
                okText="Thêm Trường"
                cancelText="Hủy"
                onOk={() => {
                    addFieldForm.validateFields().then(values => {
                        const newId = `custom_${values.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}_${Date.now()}`;
                        const newField: any = {
                            id: newId,
                            label: values.label,
                            type: values.type,
                            span: 24,
                            widthPercent: 100,
                            isCustomField: true
                        };
                        if (values.type === 'select' && values.options) {
                            newField.options = values.options.split(',').map((opt: string) => ({ value: opt.trim(), label: opt.trim() }));
                        }
                        setFields([...fields, newField]);
                        setIsAddFieldModalOpen(false);
                        addFieldForm.resetFields();
                        message.success('Đã thêm trường mới. Hãy kéo thả để sắp xếp lại!');
                    });
                }}
            >
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg mb-4 text-blue-800 text-sm">
                    Trường dữ liệu này sẽ được lưu linh hoạt trong hệ thống và bạn có thể sắp xếp ở bất kỳ đâu trên form.
                </div>
                <Form form={addFieldForm} layout="vertical">
                    <Form.Item name="label" label="Tên trường (Label)" rules={[{ required: true, message: 'Vui lòng nhập tên trường' }]}>
                        <Input placeholder="Ví dụ: Màu sắc, Năm bảo dưỡng..." />
                    </Form.Item>
                    <Form.Item name="type" label="Loại dữ liệu" initialValue="input">
                        <Select>
                            <Select.Option value="input">Văn bản ngắn (Text)</Select.Option>
                            <Select.Option value="number">Số (Number)</Select.Option>
                            <Select.Option value="date">Ngày tháng (Date)</Select.Option>
                            <Select.Option value="year">Năm (Year)</Select.Option>
                            <Select.Option value="textarea">Đoạn văn dài (Textarea)</Select.Option>
                            <Select.Option value="select">Danh sách chọn (Select Dropdown)</Select.Option>
                            <Select.Option value="switch">Công tắc (Yes/No)</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item noStyle dependencies={['type']}>
                        {({ getFieldValue }) => {
                            if (getFieldValue('type') === 'select') {
                                return (
                                    <Form.Item name="options" label="Danh sách lựa chọn" rules={[{ required: true, message: 'Vui lòng nhập các lựa chọn' }]} help="Nhập các lựa chọn cách nhau bằng dấu phẩy (Ví dụ: Đỏ, Xanh, Vàng)">
                                        <Input placeholder="Đỏ, Xanh, Vàng" />
                                    </Form.Item>
                                );
                            }
                            return null;
                        }}
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );

    if (mode === 'inline') {
        return (
            <Card title={headerContent} className="mb-6 shadow-sm border-slate-200">
                {formBodyContent}
                {footerContent}
            </Card>
        );
    }

    return (
        <Modal
            title={headerContent}
            style={{ top: 40 }}
            width={`${formWidth}vw`}
            styles={{ 
                content: { padding: 0, borderRadius: '16px', overflow: 'hidden' },
                header: { padding: '16px 24px', margin: 0, borderBottom: '1px solid #f0f0f0' },
                body: { padding: 0 }
            } as any}
            onCancel={onClose}
            open={open}
            footer={footerContent}
        >
            {formBodyContent}
        </Modal>
    );
}
