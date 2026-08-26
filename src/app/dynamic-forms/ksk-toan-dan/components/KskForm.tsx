'use client';
import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Tabs, Card, message, Spin, Row, Col, DatePicker } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const { Option } = Select;

interface KskFormProps {
    initialData?: any;
    onSuccess?: () => void;
}

export default function KskForm({ initialData, onSuccess }: KskFormProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any>({
        PROVINCE: [], WARD: [], GENDER: [], DAN_TOC: [], QUOC_GIA: [], NGHE_NGHIEP: []
    });
    const [fetchingCats, setFetchingCats] = useState(true);

    useEffect(() => {
        if (initialData) {
            form.setFieldsValue(initialData);
        }
    }, [initialData, form]);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setFetchingCats(true);
        try {
            const types = ['PROVINCE', 'WARD', 'GENDER', 'DAN_TOC', 'QUOC_GIA', 'NGHE_NGHIEP'];
            const catMap: any = {};
            for (const type of types) {
                const res = await fetch(`/api/system-categories?type=${type}`);
                if (res.ok) {
                    const list = await res.json();
                    catMap[type] = list;
                }
            }
            setCategories(catMap);
        } catch (error) {
            message.error('Lỗi tải danh mục hệ thống');
        } finally {
            setFetchingCats(false);
        }
    };

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            const payload = { ...values };
            if (initialData?.id) {
                payload.id = initialData.id;
            }

            const res = await fetch('/api/ksk-toan-dan', {
                method: initialData?.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success('Lưu hồ sơ thành công');
                if (!initialData?.id) form.resetFields();
                if (onSuccess) onSuccess();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi lưu hồ sơ');
            }
        } catch (error) {
            message.error('Lỗi hệ thống');
        } finally {
            setLoading(false);
        }
    };

    const filterOption = (input: string, option: any) => {
        return (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) || 
               (option?.value ?? '').toLowerCase().includes(input.toLowerCase());
    };

    const renderSelectOptions = (type: string) => {
        return categories[type].map((c: any) => (
            <Option key={c.code} value={c.code} label={c.name}>
                {c.code} - {c.name}
            </Option>
        ));
    };

    if (fetchingCats) return <div className="p-10 text-center flex flex-col items-center gap-2"><Spin size="large" /><span>Đang tải danh mục...</span></div>;

    const tabItems = [
        {
            key: '1',
            label: 'Thông tin Hành chính',
            children: (
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="tenBenhNhan" label="Họ tên Bệnh nhân" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                            <Input placeholder="Nhập họ tên" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="ngaySinh" label="Ngày sinh" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                            <Input placeholder="VD: 02/09/1982 hoặc 1982" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="gioiTinh" label="Giới tính" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
                            <Select showSearch optionFilterProp="label">{renderSelectOptions('GENDER')}</Select>
                        </Form.Item>
                    </Col>
                    
                    <Col span={8}>
                        <Form.Item name="cccd" label="Số CCCD" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                            <Input placeholder="Nhập số CCCD" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="ngayCapCccd" label="Ngày cấp CCCD">
                            <Input placeholder="VD: 10/10/2020" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="noiCapCccd" label="Nơi cấp CCCD">
                            <Input placeholder="Cục CS QLHC..." />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="ngheNghiep" label="Nghề nghiệp" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
                            <Select showSearch optionFilterProp="label">{renderSelectOptions('NGHE_NGHIEP')}</Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="danToc" label="Dân tộc" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
                            <Select showSearch optionFilterProp="label">{renderSelectOptions('DAN_TOC')}</Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="quocGia" label="Quốc gia" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
                            <Select showSearch optionFilterProp="label">{renderSelectOptions('QUOC_GIA')}</Select>
                        </Form.Item>
                    </Col>
                </Row>
            )
        },
        {
            key: '2',
            label: 'Địa chỉ & Liên hệ',
            children: (
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="tinh" label="Tỉnh / Thành phố" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
                            <Select showSearch filterOption={filterOption}>{renderSelectOptions('PROVINCE')}</Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="xa" label="Xã / Phường" rules={[{ required: true, message: 'Bắt buộc chọn' }]}>
                            <Select showSearch filterOption={filterOption}>{renderSelectOptions('WARD')}</Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="sdtBenhNhan" label="Số điện thoại" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                            <Input placeholder="Nhập SĐT để tra cứu sau này" />
                        </Form.Item>
                    </Col>
                    <Col span={16}>
                        <Form.Item name="diaChi" label="Địa chỉ chi tiết (Số nhà, đường)" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
                            <Input placeholder="Nhập địa chỉ chi tiết" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="tenNguoiThan" label="Tên người thân">
                            <Input placeholder="Nhập tên người thân" />
                        </Form.Item>
                    </Col>
                </Row>
            )
        },
        {
            key: '3',
            label: 'Khám & BHYT',
            children: (
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="dotKham" label="Đợt khám">
                            <Input placeholder="VD: Khám định kỳ 2024" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="maBHYT" label="Mã số BHYT">
                            <Input placeholder="Nhập mã thẻ BHYT" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="maKcbbd" label="Mã KCB BĐ">
                            <Input placeholder="Mã nơi đăng ký KCB ban đầu" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="bhytBd" label="BHYT Từ ngày">
                            <Input placeholder="VD: 01/01/2024" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="bhytKt" label="BHYT Đến ngày">
                            <Input placeholder="VD: 31/12/2024" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="diaChiBhyt" label="Địa chỉ trên thẻ BHYT">
                            <Input placeholder="Nhập địa chỉ BHYT" />
                        </Form.Item>
                    </Col>
                </Row>
            )
        }
    ];

    return (
        <Form form={form} layout="vertical" onFinish={onFinish}>
            <Tabs type="card" items={tabItems} />
            <div className="mt-4 flex justify-end">
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large">
                    Lưu Hồ Sơ
                </Button>
            </div>
        </Form>
    );
}
