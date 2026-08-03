import React, { useState, useEffect } from 'react';
import { Modal, Transfer, Spin, message } from 'antd';
import type { TransferProps } from 'antd';

interface ServiceSelectorModalProps {
    open: boolean;
    onCancel: () => void;
    onOk: (selectedKeys: string[]) => void;
    initialKeys: string[];
}

export default function ServiceSelectorModal({ open, onCancel, onOk, initialKeys }: ServiceSelectorModalProps) {
    const [mockData, setMockData] = useState<any[]>([]);
    const [targetKeys, setTargetKeys] = useState<TransferProps['targetKeys']>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setTargetKeys(initialKeys);
            if (mockData.length === 0) {
                fetchData();
            }
        }
    }, [open, initialKeys]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const resServices = await fetch('/api/mau05-catalog');
            const services = await resServices.json();

            const formattedData = services.map((s: any) => ({
                key: s.MA_DICH_VU,
                title: `${s.MA_DICH_VU} - ${s.TEN_DICH_VU}`,
                description: s.TEN_DICH_VU,
                disabled: false,
            }));

            const uniqueData = Array.from(new Map(formattedData.map((item: any) => [item.key, item])).values());
            setMockData(uniqueData as any);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu dịch vụ');
        } finally {
            setLoading(false);
        }
    };

    const handleChange: TransferProps['onChange'] = (newTargetKeys) => {
        setTargetKeys(newTargetKeys);
    };

    const handleSave = () => {
        onOk(targetKeys as string[]);
    };

    const filterOption = (inputValue: string, option: any) => {
        if (/^[\d.]+$/.test(inputValue)) {
            return option.key ? String(option.key).startsWith(inputValue) : false;
        }
        return option.title ? option.title.toLowerCase().indexOf(inputValue.toLowerCase()) > -1 : false;
    };

    return (
        <Modal
            title="Chọn Dịch vụ Kỹ thuật (Mẫu 05)"
            open={open}
            onCancel={onCancel}
            onOk={handleSave}
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
                        titles={['Dịch vụ chưa chọn', 'Dịch vụ đã chọn']}
                    />
                )}
            </div>
        </Modal>
    );
}
