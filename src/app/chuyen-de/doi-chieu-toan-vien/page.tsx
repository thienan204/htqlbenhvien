'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, Spin, Alert, Row, Col, Statistic, Switch, Select, Input } from 'antd';
import { CheckCircleOutlined, WarningOutlined, StopOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title } = Typography;

export default function GlobalCompliancePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({ totalPerformed: 0, totalViolations: 0, violatedStaffCount: 0 });
    
    // Filters
    const [showViolationsOnly, setShowViolationsOnly] = useState(true);
    const [showChiDinh, setShowChiDinh] = useState(true);
    const [showThucHien, setShowThucHien] = useState(true);
    const [filterKhoa, setFilterKhoa] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

    useEffect(() => {
        const fetchGlobalCompliance = async () => {
            try {
                const res = await fetch('/api/cchn/compliance-all');
                if (!res.ok) {
                    if (res.status === 401) throw new Error('Không có quyền truy cập');
                    throw new Error('Không thể tải dữ liệu đối chiếu toàn viện');
                }
                const result = await res.json();
                setData(result.results || []);
                
                // Calculate unique violated staff count
                const violatedStaffs = new Set((result.results || []).filter((r: any) => !r.isAllowed).map((r: any) => r.cchn));
                
                setStats({
                    totalPerformed: result.totalPerformed || 0,
                    totalViolations: result.totalViolations || 0,
                    violatedStaffCount: violatedStaffs.size
                });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user?.role === 'ADMIN') {
            fetchGlobalCompliance();
        } else {
            setError('Tính năng này chỉ dành cho tài khoản Quản trị');
            setLoading(false);
        }
    }, [user]);

    const normalizeString = (str: string) => {
        if (!str) return '';
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
    };

    const getInitials = (str: string) => {
        if (!str) return '';
        const normalized = normalizeString(str);
        return normalized.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('');
    };

    const filteredData = data.filter((s: any) => {
        // Filter by role
        if (!showChiDinh && !showThucHien) return false;
        const noFlags = !s.isChiDinh && !s.isThucHien;
        if (!noFlags) {
            const matchChiDinh = showChiDinh && s.isChiDinh;
            const matchThucHien = showThucHien && s.isThucHien;
            if (!matchChiDinh && !matchThucHien) return false;
        }

        // Filter by violation
        if (showViolationsOnly && s.isAllowed) return false;

        // Filter by department
        if (filterKhoa && s.khoa_phong !== filterKhoa) return false;

        // Filter by search text (Name, CCHN, Service Name, Service Code)
        if (searchText) {
            const searchInput = normalizeString(searchText);
            const matchName = (s.ho_ten && normalizeString(s.ho_ten).includes(searchInput)) || (s.ho_ten && getInitials(s.ho_ten).includes(searchInput));
            const matchService = s.ten_dich_vu && normalizeString(s.ten_dich_vu).includes(searchInput);
            const matchCode = s.ma_dich_vu && s.ma_dich_vu.toLowerCase().includes(searchText.toLowerCase());
            const matchCchn = s.cchn && s.cchn.toLowerCase().includes(searchText.toLowerCase());
            
            if (!matchName && !matchService && !matchCode && !matchCchn) return false;
        }

        return true;
    });

    const uniqueDepartments = Array.from(new Set(data.map(s => s.khoa_phong))).filter(Boolean);

    const columns = [
        { title: 'STT', key: 'stt', width: 60, render: (_: any, __: any, index: number) => (pagination.current - 1) * pagination.pageSize + index + 1, align: 'center' as const },
        { 
            title: 'Nhân sự', 
            key: 'nhan_su', 
            render: (_: any, record: any) => (
                <div>
                    <div className="font-semibold text-slate-800">{record.ho_ten} <span className="text-slate-400 font-normal">({record.ma_nv})</span></div>
                    <div className="text-xs text-blue-600">{record.cchn}</div>
                </div>
            ),
            width: 220
        },
        { title: 'Khoa / Phòng', dataIndex: 'khoa_phong', key: 'khoa_phong', width: 180 },
        { title: 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: 120 },
        { title: 'Tên Dịch vụ đã thực hiện', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu' },
        { 
            title: 'Đánh giá', 
            dataIndex: 'isAllowed', 
            key: 'isAllowed',
            render: (isAllowed: boolean) => {
                return isAllowed ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>Trong phạm vi</Tag>
                ) : (
                    <Tag color="error" icon={<StopOutlined />}>Vượt phạm vi</Tag>
                );
            },
            width: 140
        },
        {
            title: 'Vai trò',
            key: 'vai_tro',
            render: (_: any, record: any) => {
                const tags = [];
                if (record.isChiDinh) tags.push(<Tag color="purple" key="cd">Chỉ định</Tag>);
                if (record.isThucHien) tags.push(<Tag color="blue" key="th">Thực hiện</Tag>);
                if (tags.length === 0) return <Tag>Không rõ</Tag>;
                return <>{tags}</>;
            },
            width: 130
        }
    ];

    if (loading) return <div className="p-10 flex justify-center"><Spin size="large" /></div>;
    if (error) return <Alert title="Lỗi" description={error} type="error" showIcon className="m-6" />;

    return (
        <div className="p-6 bg-slate-50 min-h-screen space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Đối chiếu Phạm vi Hành nghề (Toàn viện)</h1>
                    <p className="text-slate-500 m-0">Kiểm tra và giám sát các chỉ định, thực hiện dịch vụ kỹ thuật so với chứng chỉ hành nghề của toàn bộ nhân sự.</p>
                </div>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <Card className="shadow-sm border-l-4 border-l-blue-500 rounded-xl">
                        <Statistic title="Tổng DV đã thực hiện" value={stats.totalPerformed} styles={{ content: { color: '#3b82f6' } }} />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card className={`shadow-sm border-l-4 rounded-xl ${stats.totalViolations > 0 ? 'border-l-red-500 bg-red-50' : 'border-l-slate-300'}`}>
                        <Statistic 
                            title={<span className={stats.totalViolations > 0 ? 'text-red-600 font-semibold' : ''}>Tổng DV VƯỢT PHẠM VI</span>} 
                            value={stats.totalViolations} 
                            styles={{ content: { color: stats.totalViolations > 0 ? '#ef4444' : '#94a3b8', fontWeight: stats.totalViolations > 0 ? 'bold' : 'normal' } }} 
                            suffix={stats.totalViolations > 0 ? <WarningOutlined /> : null}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card className={`shadow-sm border-l-4 rounded-xl ${stats.violatedStaffCount > 0 ? 'border-l-orange-500' : 'border-l-slate-300'}`}>
                        <Statistic 
                            title="Số nhân sự có vi phạm" 
                            value={stats.violatedStaffCount} 
                            styles={{ content: { color: stats.violatedStaffCount > 0 ? '#f97316' : '#94a3b8' } }} 
                        />
                    </Card>
                </Col>
            </Row>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <div className="p-4 border-b border-slate-100 bg-white">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                        <div className="flex flex-wrap gap-4">
                            <Input 
                                placeholder="Tìm Tên NV, Mã DV, CCHN..." 
                                prefix={<SearchOutlined className="text-slate-400" />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full sm:w-[280px] rounded-lg"
                                allowClear
                            />
                            <Select
                                placeholder="Lọc Khoa/Phòng"
                                allowClear
                                showSearch
                                className="w-full sm:w-[220px]"
                                value={filterKhoa}
                                onChange={setFilterKhoa}
                                options={uniqueDepartments.map(dept => ({ label: String(dept), value: String(dept) }))}
                            />
                        </div>
                        <div className="flex items-center gap-4 text-sm bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                                <Switch size="small" checked={showChiDinh} onChange={(val) => { setShowChiDinh(val); setPagination({ ...pagination, current: 1 }); }} />
                                <span className={showChiDinh ? "text-purple-700 font-medium" : "text-slate-500"}>Chỉ định</span>
                            </div>
                            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                                <Switch size="small" checked={showThucHien} onChange={(val) => { setShowThucHien(val); setPagination({ ...pagination, current: 1 }); }} />
                                <span className={showThucHien ? "text-blue-700 font-medium" : "text-slate-500"}>Thực hiện</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch size="small" checked={showViolationsOnly} onChange={(val) => { setShowViolationsOnly(val); setPagination({ ...pagination, current: 1 }); }} />
                                <span className={showViolationsOnly ? "text-red-600 font-bold" : "text-slate-500"}>Chỉ hiện Vi phạm</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <Table 
                    dataSource={filteredData} 
                    columns={columns} 
                    rowKey="id"
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100', '200'],
                        showTotal: (total) => `Tổng ${total} bản ghi`
                    }}
                    onChange={(pag) => setPagination({ current: pag.current || 1, pageSize: pag.pageSize || 20 })}
                    size="middle"
                    className="bg-white"
                    locale={{ emptyText: 'Không tìm thấy dữ liệu đối chiếu phù hợp' }}
                />
            </Card>
        </div>
    );
}
