import React, { useState, useEffect } from 'react';
import { Modal, Transfer, message, Spin } from 'antd';
import type { TransferProps } from 'antd';

interface ServiceMappingModalProps {
    open: boolean;
    onCancel: () => void;
    maPhamVi: string;
    tenPhamVi: string;
}

export default function ServiceMappingModal({ open, onCancel, maPhamVi, tenPhamVi }: ServiceMappingModalProps) {
    const [mockData, setMockData] = useState<any[]>([]);
    const [targetKeys, setTargetKeys] = useState<TransferProps['targetKeys']>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && maPhamVi) {
            fetchData();
        }
    }, [open, maPhamVi]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all Mau05 services
            const resServices = await fetch('/api/mau05-catalog');
            const services = await resServices.json();

            const formattedData = services.map((s: any) => ({
                key: s.MA_DICH_VU,
                title: `${s.MA_DICH_VU} - ${s.TEN_DICH_VU}`,
                description: s.TEN_DICH_VU,
                disabled: false,
            }));

            // Deduplicate to avoid Transfer component errors (MA_DICH_VU might have duplicates in Mẫu 05)
            const uniqueData = Array.from(new Map(formattedData.map((item: any) => [item.key, item])).values());
            setMockData(uniqueData as any);

            // Fetch mapped services for this maPhamVi
            const resMapped = await fetch(`/api/pham-vi-chuyen-mon/mapping?ma_pham_vi=${maPhamVi}`);
            const mappedKeys = await resMapped.json();
            setTargetKeys(mappedKeys);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu dịch vụ');
        } finally {
            setLoading(false);
        }
    };

    const handleChange: TransferProps['onChange'] = (newTargetKeys) => {
        setTargetKeys(newTargetKeys);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/pham-vi-chuyen-mon/mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ma_pham_vi: maPhamVi, ma_dich_vu_list: targetKeys })
            });

            if (res.ok) {
                message.success('Đã lưu cấu hình dịch vụ');
                onCancel();
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            message.error('Lưu cấu hình thất bại');
        } finally {
            setSaving(false);
        }
    };

    const filterOption = (inputValue: string, option: any) => {
        // Nếu người dùng nhập số hoặc dấu chấm (dạng mã dịch vụ)
        if (/^[\d.]+$/.test(inputValue)) {
            // Bắt buộc mã dịch vụ phải BẮT ĐẦU bằng cụm từ tìm kiếm
            return option.key.startsWith(inputValue);
        }
        // Nếu nhập chữ (dạng tên dịch vụ), tìm kiếm tương đối (chứa chuỗi)
        return option.title.toLowerCase().indexOf(inputValue.toLowerCase()) > -1;
    };

    return (
        <Modal
            title={`Cấu hình Dịch vụ (Mẫu 05) cho Phạm vi: ${tenPhamVi} (${maPhamVi})`}
            open={open}
            onCancel={onCancel}
            onOk={handleSave}
            confirmLoading={saving}
            width="80%"
            style={{ top: 20 }}
            destroyOnHidden
        >
            <div className="py-4 w-full h-full">
                {loading ? (
                    <div className="flex justify-center p-10"><Spin size="large" /></div>
                ) : (
                    <Transfer
                        dataSource={mockData}
                        showSearch
                        filterOption={filterOption}
                        targetKeys={targetKeys}
                        onChange={handleChange}
                        style={{ width: '100%' }}
                        styles={{ section: { flex: 1, height: '65vh' } }}
                        render={(item) => item.title}
                        titles={['Dịch vụ chưa gán', 'Dịch vụ đã gán']}
                    />
                )}
            </div>
        </Modal>
    );
}
