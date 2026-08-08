'use client';
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, Table, Input, Button, InputNumber, Select, message, Spin, Tag, Checkbox, Tabs } from 'antd';
import { SaveOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Option } = Select;

interface Mau05ConfigProps {
    externalFilterCodes?: string[];
    onConfigStatus?: (unconfiguredCount: number) => void;
}

export const Mau05Config = forwardRef((props: Mau05ConfigProps, ref) => {
    const { externalFilterCodes = [], onConfigStatus } = props;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [qualifications, setQualifications] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');
    const [filterCodes, setFilterCodes] = useState<string[]>([]);
    const [editedRows, setEditedRows] = useState<{ [id: string]: any }>({});

    useEffect(() => {
        if (externalFilterCodes && externalFilterCodes.length > 0) {
            setFilterCodes(externalFilterCodes);
        }
    }, [externalFilterCodes]);

    useImperativeHandle(ref, () => ({
        getUnconfiguredCount: () => {
            return unconfiguredServices.length;
        },
        hasUnconfigured: () => {
            return unconfiguredServices.length > 0;
        }
    }));

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/clinical-scheduling/config');
            const data = await res.json();
            if (data.success) {
                setServices(data.services || []);
                if (data.qualifications) {
                    const uniqueQuals = Array.from(new Set(data.qualifications.map((q: any) => q.name))).map(name => {
                        return data.qualifications.find((q: any) => q.name === name);
                    });
                    setQualifications(uniqueQuals);
                }
            } else {
                message.error('Lỗi tải dữ liệu Mẫu 05: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ khi tải Mẫu 05');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const updatedServices = Object.values(editedRows);
            if (updatedServices.length === 0) {
                message.info('Không có thay đổi nào để lưu.');
                setSaving(false);
                return;
            }
            
            const res = await fetch('/api/clinical-scheduling/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updatedServices: updatedServices
                })
            });
            const data = await res.json();
            
            if (data.success) {
                message.success('Đã lưu cấu hình dịch vụ thành công!');
                setEditedRows({}); // Reset edited state
            } else {
                message.error('Lỗi lưu cấu hình: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ khi lưu');
        } finally {
            setSaving(false);
        }
    };

    const handleRowChange = (record: any, field: string, value: any) => {
        const newData = [...services];
        const index = newData.findIndex(item => item.id === record.id);
        if (index > -1) {
            newData[index][field] = value;
            setServices(newData);
            
            setEditedRows(prev => ({
                ...prev,
                [record.id]: {
                    ...prev[record.id],
                    id: record.id,
                    [field]: value
                }
            }));
        }
    };

    const columns = [
        {
            title: 'Mã Dịch vụ',
            dataIndex: 'MA_DICH_VU',
            key: 'MA_DICH_VU',
            width: 150,
        },
        {
            title: 'Tên Dịch vụ',
            dataIndex: 'TEN_DICH_VU',
            key: 'TEN_DICH_VU',
        },
        {
            title: 'Thời gian thực hiện (Phút)',
            dataIndex: 'thoigian_thuc_hien',
            key: 'thoigian_thuc_hien',
            width: 250,
            render: (text: number, record: any) => (
                <InputNumber
                    min={1}
                    value={text}
                    onChange={(val) => handleRowChange(record, 'thoigian_thuc_hien', val)}
                    placeholder="VD: 5"
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Khoảng nghỉ (Buffer)',
            dataIndex: 'buffer_time',
            key: 'buffer_time',
            width: 150,
            render: (text: number, record: any) => (
                <InputNumber
                    min={0}
                    value={text}
                    onChange={(val) => handleRowChange(record, 'buffer_time', val)}
                    placeholder="Theo khoa"
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Làm song song',
            dataIndex: 'is_concurrent',
            key: 'is_concurrent',
            width: 120,
            align: 'center' as const,
            render: (text: boolean, record: any) => (
                <Checkbox
                    checked={text}
                    onChange={(e) => handleRowChange(record, 'is_concurrent', e.target.checked)}
                />
            )
        },
        {
            title: 'Yêu cầu Máy móc',
            dataIndex: 'yeu_cau_may_moc',
            key: 'yeu_cau_may_moc',
            width: 250,
            render: (text: string, record: any) => (
                <Select
                    value={text || undefined}
                    onChange={(val) => handleRowChange(record, 'yeu_cau_may_moc', val)}
                    placeholder="Chọn loại máy"
                    style={{ width: '100%' }}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                >
                    {qualifications.filter(q => q.type === 'LOAI_MAY').map((q, idx) => (
                        <Option key={idx} value={q.code}>{q.name}</Option>
                    ))}
                </Select>
            )
        }
    ];

    const getInitials = (text: string) => {
        if (!text) return '';
        const noAccent = text.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D');
        return noAccent.split(/[\s\-\_]+/)
            .map(word => word.charAt(0))
            .join('')
            .toLowerCase();
    };

    const filteredServices = services.filter(s => {
        const searchLower = searchText.toLowerCase();
        const tenDichVu = s.TEN_DICH_VU || '';
        const maDichVu = s.MA_DICH_VU || '';
        const initials = getInitials(tenDichVu);
        
        if (filterCodes.length > 0 && !filterCodes.includes(maDichVu)) {
            return false;
        }

        return tenDichVu.toLowerCase().includes(searchLower) ||
               maDichVu.toLowerCase().includes(searchLower) ||
               initials.includes(searchLower);
    });

    const unconfiguredServices = filteredServices.filter(s => !s.thoigian_thuc_hien || s.thoigian_thuc_hien <= 0);
    const configuredServices = filteredServices.filter(s => s.thoigian_thuc_hien && s.thoigian_thuc_hien > 0);

    useEffect(() => {
        if (onConfigStatus && !loading) {
            onConfigStatus(unconfiguredServices.length);
        }
    }, [unconfiguredServices.length, loading, onConfigStatus]);

    return (
        <Card 
            title="Danh mục Dịch vụ (Mau 05)" 
            extra={
                <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    onClick={handleSave} 
                    loading={saving}
                >
                    Lưu Thay Đổi
                </Button>
            }
            style={{ marginBottom: 24 }}
        >
            <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <Input
                    placeholder="Tìm kiếm theo Tên hoặc Mã Dịch vụ..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                    style={{ width: 400 }}
                />
                
                {filterCodes.length > 0 && (
                    <Tag 
                        color="blue" 
                        closable={externalFilterCodes.length === 0} // Chỉ cho phép xoá nếu không bị ép từ ngoài vào
                        onClose={() => setFilterCodes([])}
                        style={{ fontSize: 14, padding: '4px 12px' }}
                    >
                        Đang lọc {filterCodes.length} dịch vụ
                    </Tag>
                )}
            </div>
            
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin size="large" />
                </div>
            ) : (
                <Tabs
                    type="card"
                    defaultActiveKey={unconfiguredServices.length > 0 ? "2" : "1"}
                    items={[
                        {
                            key: '1',
                            label: `Tất cả (${filteredServices.length})`,
                            children: (
                                <Table 
                                    dataSource={filteredServices} 
                                    columns={columns} 
                                    rowKey="id"
                                    pagination={{ pageSize: 20 }}
                                    bordered
                                    size="middle"
                                />
                            )
                        },
                        {
                            key: '2',
                            label: <span style={{ color: unconfiguredServices.length > 0 ? '#ff4d4f' : 'inherit', fontWeight: unconfiguredServices.length > 0 ? 'bold' : 'normal' }}>Chưa cấu hình ({unconfiguredServices.length})</span>,
                            children: (
                                <Table 
                                    dataSource={unconfiguredServices} 
                                    columns={columns} 
                                    rowKey="id"
                                    pagination={{ pageSize: 20 }}
                                    bordered
                                    size="middle"
                                />
                            )
                        },
                        {
                            key: '3',
                            label: <span style={{ color: '#52c41a' }}>Đã cấu hình ({configuredServices.length})</span>,
                            children: (
                                <Table 
                                    dataSource={configuredServices} 
                                    columns={columns} 
                                    rowKey="id"
                                    pagination={{ pageSize: 20 }}
                                    bordered
                                    size="middle"
                                />
                            )
                        }
                    ]}
                />
            )}
        </Card>
    );
});

export default Mau05Config;
