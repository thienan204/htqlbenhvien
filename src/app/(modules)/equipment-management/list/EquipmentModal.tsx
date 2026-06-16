'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message, Button, Space } from 'antd';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';
import dayjs from 'dayjs';

interface EquipmentModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    equipmentData?: any;
}

export default function EquipmentModal({ open, onClose, onSuccess, equipmentData }: EquipmentModalProps) {
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [manufacturers, setManufacturers] = useState<any[]>([]);
    const [countries, setCountries] = useState<any[]>([]);
    const [productionYears, setProductionYears] = useState<any[]>([]);
    const [fundingSources, setFundingSources] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchDependencies();
        }
    }, [open]);

    const fetchDependencies = async () => {
        try {
            const [whRes, catRes] = await Promise.all([
                fetch('/api/warehouses'),
                fetch('/api/system-categories')
            ]);
            
            if (whRes.ok) setWarehouses(await whRes.json());
            if (catRes.ok) {
                const sysCats = await catRes.json();
                setCategories(sysCats.filter((c: any) => c.type === 'DANH_MUC_THIET_BI'));
                setGroups(sysCats.filter((c: any) => c.type === 'NHOM_THIET_BI'));
                setTypes(sysCats.filter((c: any) => c.type === 'LOAI_THIET_BI'));
                setUnits(sysCats.filter((c: any) => c.type === 'DON_VI_TINH'));
                setManufacturers(sysCats.filter((c: any) => c.type === 'HANG_SAN_XUAT'));
                setCountries(sysCats.filter((c: any) => c.type === 'NUOC_SAN_XUAT'));
                setProductionYears(sysCats.filter((c: any) => c.type === 'NAM_SAN_XUAT'));
                setFundingSources(sysCats.filter((c: any) => c.type === 'NGUON_KINH_PHI'));
                setSuppliers(sysCats.filter((c: any) => c.type === 'DON_VI_CUNG_UNG'));
            }
        } catch (error) {
            console.error('Lỗi tải danh mục', error);
            message.error('Lỗi tải danh mục');
        }
    };

    const handleSave = async (values: any) => {
        const isUpdate = !!equipmentData;
        const method = isUpdate ? 'PUT' : 'POST';
        const url = isUpdate ? `/api/equipments/${equipmentData.id}` : '/api/equipments';

        // Lọc bớt các trường không cần gửi lên nếu cần
        const payload: any = { ...values };
        if (payload.dongia) payload.dongia = Number(payload.dongia);
        if (payload.vat) payload.vat = Number(payload.vat);
        if (payload.dongia_vat) payload.dongia_vat = Number(payload.dongia_vat);
        if (payload.thoigian_khauhao) payload.thoigian_khauhao = Number(payload.thoigian_khauhao);
        
        if (payload.ngay_bdbh && typeof payload.ngay_bdbh.toISOString === 'function') payload.ngay_bdbh = payload.ngay_bdbh.toISOString();
        if (payload.ngay_ktbh && typeof payload.ngay_ktbh.toISOString === 'function') payload.ngay_ktbh = payload.ngay_ktbh.toISOString();
        if (payload.production_year_id && typeof payload.production_year_id.year === 'function') {
            payload.production_year_id = payload.production_year_id.year().toString();
        }

        // Đóng gói custom_fields
        const custom_fields: any = {};
        Object.keys(payload).forEach(key => {
            if (key.startsWith('custom_')) {
                custom_fields[key] = payload[key];
                delete payload[key];
            }
        });
        payload.custom_fields = custom_fields;

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            message.success(`${isUpdate ? 'Cập nhật' : 'Thêm'} thiết bị thành công`);
            onSuccess();
        } else {
            const err = await res.json();
            message.error(err.error || 'Lỗi khi lưu thiết bị');
        }
    };

    const handleNameBlur = async (e: any, form: any) => {
        if (equipmentData) return; // Không sinh mã khi đang sửa
        
        const name = e.target?.value || '';
        if (!name.trim()) return;

        const normalized = name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9]/g, '');
            
        if (normalized.length >= 3) {
            const prefixBase = normalized.substring(0, 3).toUpperCase();
            const year = new Date().getFullYear();
            const prefix = `${prefixBase}${year}`;
            
            try {
                const res = await fetch(`/api/equipments/next-code?prefix=${prefix}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.nextCode) {
                        const latestCode = form.getFieldValue('ma_vttb');
                        if (!latestCode || /^[A-Z0-9]{3}\d{4}\d{4}$/.test(latestCode)) {
                            form.setFieldsValue({ ma_vttb: data.nextCode });
                        }
                    }
                }
            } catch (error) {
                console.error('Lỗi khi lấy mã tiếp theo', error);
            }
        }
    };

    const fieldsConfig: FieldConfig[] = [
        { id: 'ma_vttb', label: 'Mã Vật tư / Thiết bị (Bắt buộc)', type: 'input', required: true, span: 8 },
        { 
            id: 'ten_vttb', 
            label: 'Tên Vật tư / Thiết bị (Bắt buộc)', 
            type: 'input', 
            required: true, 
            span: 16,
            onBlur: handleNameBlur
        },
        { 
            id: 'warehouse_id', 
            label: 'Nơi lưu trữ (Kho)', 
            type: 'select', 
            required: true, 
            span: 12,
            options: warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.department?.ten_khoa || 'Không xác định'})` }))
        },
        { 
            id: 'category_id', 
            label: 'Phân loại chung', 
            type: 'select', 
            span: 12,
            options: categories.map(c => ({ value: c.id, label: c.name }))
        },
        { 
            id: 'group_id', 
            label: 'Nhóm thiết bị', 
            type: 'select', 
            span: 12,
            options: groups.map(g => ({ value: g.id, label: g.name }))
        },
        { 
            id: 'type_id', 
            label: 'Loại thiết bị', 
            type: 'select', 
            span: 12,
            options: types.map(t => ({ value: t.id, label: t.name }))
        },
        { 
            id: 'donvitinh', 
            label: 'Đơn vị tính', 
            type: 'select', 
            span: 8,
            options: units.map(u => ({ value: u.name, label: u.name }))
        },
        { 
            id: 'vattu_hay_tb', 
            label: 'Phân loại (Vật tư / Thiết bị)', 
            type: 'select', 
            span: 8,
            options: [
                { value: 'THIET_BI', label: 'Thiết bị' },
                { value: 'VAT_TU', label: 'Vật tư' }
            ]
        },
        { 
            id: 'manufacturer_id', 
            label: 'Hãng sản xuất', 
            type: 'select', 
            span: 8,
            options: manufacturers.map(m => ({ value: m.id, label: m.name }))
        },
        { 
            id: 'country_id', 
            label: 'Nước sản xuất', 
            type: 'select', 
            span: 8,
            options: countries.map(c => ({ value: c.id, label: c.name }))
        },
        { 
            id: 'production_year_id', 
            label: 'Năm sản xuất', 
            type: 'year', 
            span: 8
        },
        { 
            id: 'funding_source_id', 
            label: 'Nguồn kinh phí', 
            type: 'select', 
            span: 8,
            options: fundingSources.map(f => ({ value: f.id, label: f.name }))
        },
        { id: 'dongia', label: 'Đơn giá', type: 'number', span: 6 },
        { id: 'vat', label: 'VAT (%)', type: 'number', span: 6 },
        { id: 'dongia_vat', label: 'Đơn giá sau VAT', type: 'number', span: 6 },
        { 
            id: 'dv_cungung', 
            label: 'Đơn vị cung ứng', 
            type: 'select', 
            span: 6,
            options: suppliers.map(s => ({ value: s.name, label: s.name }))
        },
        { id: 'kyhieu', label: 'Ký hiệu / Model', type: 'input', span: 8 },
        { id: 'serial', label: 'Số Serial', type: 'input', span: 8 },
        { 
            id: 'quanly_serial', 
            label: 'Quản lý bằng Serial?', 
            type: 'switch', 
            span: 8,
            valuePropName: 'checked'
        },
        { 
            id: 'bao_hanh', 
            label: 'Có bảo hành?', 
            type: 'switch', 
            span: 8,
            valuePropName: 'checked'
        },
        { id: 'ngay_bdbh', label: 'Ngày BĐ Bảo hành', type: 'date', span: 8 },
        { id: 'ngay_ktbh', label: 'Ngày KT Bảo hành', type: 'date', span: 8 },
        { id: 'pp_tinh_khauhao', label: 'PP tính Khấu hao', type: 'input', span: 8 },
        { id: 'thoigian_khauhao', label: 'Thời gian Khấu hao (Tháng)', type: 'number', span: 8 },
        { id: 'ten_ketoan', label: 'Tên Kế toán', type: 'input', span: 8 },
        { 
            id: 'status', 
            label: 'Trạng thái hoạt động', 
            type: 'select', 
            span: 24,
            options: [
                { value: 'TRONG_KHO', label: 'Trong kho' },
                { value: 'DANG_SU_DUNG', label: 'Đang sử dụng' },
                { value: 'BAO_HONG', label: 'Báo hỏng' },
                { value: 'THANH_LY', label: 'Thanh lý' }
            ]
        }
    ];

    const initialData = equipmentData ? {
        ...equipmentData,
        ngay_bdbh: equipmentData.ngay_bdbh ? dayjs(equipmentData.ngay_bdbh) : undefined,
        ngay_ktbh: equipmentData.ngay_ktbh ? dayjs(equipmentData.ngay_ktbh) : undefined,
        production_year_id: equipmentData.production_year_id ? dayjs(equipmentData.production_year_id) : undefined,
        ...(equipmentData.custom_fields && typeof equipmentData.custom_fields === 'object' ? equipmentData.custom_fields : {})
    } : { status: 'TRONG_KHO', quanly_serial: false, bao_hanh: false };

    return (
        <DynamicForm
            formId="equipment_form"
            title={equipmentData ? "Cập nhật Thiết bị" : "Thêm mới Thiết bị"}
            open={open}
            onClose={onClose}
            onSubmit={handleSave}
            fieldsConfig={fieldsConfig}
            initialData={initialData}
        />
    );
}
