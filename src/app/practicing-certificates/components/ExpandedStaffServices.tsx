import React, { useEffect, useState } from 'react';
import { Tabs, Table, Spin, Alert } from 'antd';

export default function ExpandedStaffServices({ certId }: { certId: string }) {
    const [staffServices, setStaffServices] = useState<{ mappedServices: any[], otherServices: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mappedTableParams, setMappedTableParams] = useState({ current: 1, pageSize: 10 });
    const [otherTableParams, setOtherTableParams] = useState({ current: 1, pageSize: 10 });

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

    return (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
            <Tabs
                type="card"
                items={[
                    {
                        key: '1',
                        label: `Dịch vụ được thực hiện (${staffServices.mappedServices?.length || 0})`,
                        children: (
                            <Table
                                dataSource={staffServices.mappedServices || []}
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
                        label: `Dịch vụ kỹ thuật khác (${staffServices.otherServices?.length || 0})`,
                        children: (
                            <Table
                                dataSource={staffServices.otherServices || []}
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
