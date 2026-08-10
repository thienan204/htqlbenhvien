import React, { useEffect, useState } from 'react';
import { Tabs, Table, Spin, Alert, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

export default function ExpandedStaffServices({ certId }: { certId: string }) {
    const [staffServices, setStaffServices] = useState<{ mappedServices: any[], otherServices: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mappedTableParams, setMappedTableParams] = useState({ current: 1, pageSize: 10 });
    const [otherTableParams, setOtherTableParams] = useState({ current: 1, pageSize: 10 });
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        const fetchServices = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/practicing-certificates/services?id=${certId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStaffServices(data);
                } else {
                    setError('Không thể lấy danh sách dịch vụ');
                }
            } catch (err) {
                console.error(err);
                setError('Đã xảy ra lỗi khi tải dữ liệu');
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, [certId]);

    if (loading) {
        return <div className="p-4 text-center"><Spin /></div>;
    }

    if (error || !staffServices) {
        return <div className="p-4"><Alert type="error" message={error || 'Lỗi tải dữ liệu'} /></div>;
    }

    const columns = [
        { title: 'Mã Dịch Vụ', dataIndex: 'MA_DICH_VU', width: 120 },
        { title: 'Tên Dịch Vụ', dataIndex: 'TEN_DICH_VU' },
        { title: 'Đơn Giá', dataIndex: 'DON_GIA', width: 120, render: (val: any) => val ? val.toLocaleString() + ' đ' : '-' }
    ];

    const filterServices = (services: any[]) => {
        if (!searchText) return services;
        const lowerSearch = searchText.toLowerCase();
        return services.filter(s => 
            (s.MA_DICH_VU && s.MA_DICH_VU.toLowerCase().includes(lowerSearch)) ||
            (s.TEN_DICH_VU && s.TEN_DICH_VU.toLowerCase().includes(lowerSearch))
        );
    };

    const mappedFiltered = staffServices ? filterServices(staffServices.mappedServices || []) : [];
    const otherFiltered = staffServices ? filterServices(staffServices.otherServices || []) : [];

    return (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
            <div className="flex justify-end mb-4">
                <Input
                    placeholder="Tìm kiếm theo Mã hoặc Tên Dịch Vụ..."
                    prefix={<SearchOutlined className="text-slate-400" />}
                    value={searchText}
                    onChange={(e) => {
                        setSearchText(e.target.value);
                        setMappedTableParams(prev => ({ ...prev, current: 1 }));
                        setOtherTableParams(prev => ({ ...prev, current: 1 }));
                    }}
                    className="max-w-md rounded-lg"
                    allowClear
                />
            </div>
            <Tabs
                type="card"
                items={[
                    {
                        key: '1',
                        label: `Dịch vụ được thực hiện (${mappedFiltered.length})`,
                        children: (
                            <Table
                                dataSource={mappedFiltered}
                                rowKey="id"
                                pagination={{
                                    current: mappedTableParams.current,
                                    pageSize: mappedTableParams.pageSize,
                                    showSizeChanger: true,
                                    locale: { items_per_page: '/ Trang' }
                                }}
                                onChange={(pagination) => {
                                    setMappedTableParams({
                                        current: pagination.current || 1,
                                        pageSize: pagination.pageSize || 10,
                                    });
                                }}
                                size="small"
                                columns={columns}
                                bordered
                            />
                        )
                    },
                    {
                        key: '2',
                        label: `Dịch vụ kỹ thuật khác (${otherFiltered.length})`,
                        children: (
                            <Table
                                dataSource={otherFiltered}
                                rowKey="id"
                                pagination={{
                                    current: otherTableParams.current,
                                    pageSize: otherTableParams.pageSize,
                                    showSizeChanger: true,
                                    locale: { items_per_page: '/ Trang' }
                                }}
                                onChange={(pagination) => {
                                    setOtherTableParams({
                                        current: pagination.current || 1,
                                        pageSize: pagination.pageSize || 10,
                                    });
                                }}
                                size="small"
                                columns={columns}
                                bordered
                            />
                        )
                    }
                ]}
            />
        </div>
    );
}
