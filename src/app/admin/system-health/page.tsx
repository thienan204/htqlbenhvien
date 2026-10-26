'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Card, Tabs, Tag, Button, Spin, Statistic, Progress, Table, 
    Badge, Row, Col, Typography, Switch, Tooltip, Empty, Alert,
    Segmented, Input 
} from 'antd';
import { 
    DashboardOutlined, 
    DatabaseOutlined, 
    CloudServerOutlined, 
    ApiOutlined, 
    CheckCircleOutlined, 
    CloseCircleOutlined, 
    SyncOutlined, 
    ClockCircleOutlined, 
    ThunderboltOutlined,
    HddOutlined,
    SafetyCertificateOutlined,
    ArrowUpOutlined,
    FundOutlined,
    FilterOutlined,
    SearchOutlined
} from '@ant-design/icons';
import { getBasePath } from '@/utils/config';

const { Title, Text } = Typography;

export default function SystemHealthPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Bộ lọc nguồn API và từ khóa tìm kiếm
    const [sourceFilter, setSourceFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const fetchMetrics = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const res = await fetch(`${getBasePath()}/api/admin/system-health`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setError(null);
            } else if (res.status === 403) {
                setError('Bạn không có quyền truy cập trang này (Chỉ dành cho Quản trị viên và CNTT)');
            } else {
                setError('Không thể tải dữ liệu giám sát hệ thống');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    // Tự động làm mới mỗi 10 giây nếu bật autoRefresh
    useEffect(() => {
        if (!autoRefresh) return;
        const timer = setInterval(() => {
            fetchMetrics();
        }, 10000);
        return () => clearInterval(timer);
    }, [autoRefresh, fetchMetrics]);

    // Hàm nhận diện phân loại nguồn API
    const getApiCategoryInfo = useCallback((path: string) => {
        if (!path) return { key: 'INTERNAL', label: 'Nội Bộ Web', icon: '🌐', color: 'blue', isExternal: false, desc: 'API phục vụ giao diện trang web' };
        if (path.includes('/api/his-services')) {
            return { 
                key: 'HIS', 
                label: 'HIS Bệnh Viện', 
                icon: '🩺', 
                color: 'green', 
                isExternal: true,
                desc: 'Tích hợp phần mềm HIS bệnh viện'
            };
        }
        if (path.includes('/api/extension') || path.includes('/api/beds')) {
            return { 
                key: 'EXTENSION', 
                label: 'Tiện Ích Trình Duyệt', 
                icon: '🧩', 
                color: 'purple', 
                isExternal: true,
                desc: 'Tiện ích Extension trên Chrome, Edge, Cốc Cốc, Firefox...'
            };
        }
        if (path.includes('/api/mobile')) {
            return { 
                key: 'MOBILE', 
                label: 'Mobile App', 
                icon: '📱', 
                color: 'orange', 
                isExternal: true,
                desc: 'Ứng dụng di động nhân viên'
            };
        }
        if (path.includes('/api/patients')) {
            return { 
                key: 'PATIENT', 
                label: 'Tra Cứu Bệnh Nhân', 
                icon: '👥', 
                color: 'cyan', 
                isExternal: true,
                desc: 'API tra cứu lịch sử hẹn khám bệnh nhân'
            };
        }
        return { 
            key: 'INTERNAL', 
            label: 'Nội Bộ Web', 
            icon: '🌐', 
            color: 'blue', 
            isExternal: false,
            desc: 'API nội bộ trang quản lý'
        };
    }, []);

    // Hàm phân tích thiết bị / trình duyệt người dùng từ User-Agent
    const parseClientDevice = useCallback((userAgent?: string) => {
        if (!userAgent) return { name: 'Trình duyệt Web', icon: '🌐' };
        const ua = userAgent.toLowerCase();
        if (ua.includes('coccoc')) return { name: 'Cốc Cốc Browser', icon: '🟢' };
        if (ua.includes('edg/')) return { name: 'Microsoft Edge', icon: '🔵' };
        if (ua.includes('chrome/')) return { name: 'Google Chrome', icon: '🟡' };
        if (ua.includes('firefox/')) return { name: 'Mozilla Firefox', icon: '🦊' };
        if (ua.includes('safari/') && !ua.includes('chrome/')) return { name: 'Apple Safari', icon: '🧭' };
        if (ua.includes('postman')) return { name: 'Postman Runtime', icon: '🟠' };
        if (ua.includes('okhttp') || ua.includes('dart') || ua.includes('cfnetwork')) return { name: 'Mobile App Client', icon: '📱' };
        return { name: 'Trình duyệt Web', icon: '💻' };
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Spin size="large" />
                <span className="text-slate-600 font-medium">Đang kiểm tra sức khỏe và lưu lượng hệ thống...</span>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <Alert message="Cảnh báo truy cập" description={error} type="error" showIcon />
            </div>
        );
    }

    const isDbHealthy = data?.database?.status === 'UP';
    const isHealthy = data?.status === 'HEALTHY' && isDbHealthy;
    const server = data?.server || {};
    const memory = server.memory || {};
    const db = data?.database || {};
    const business = data?.businessCounters || {};
    const apiTraffic = data?.apiTraffic || {};

    // Danh sách lọc Top Endpoints
    const filteredTopEndpoints = (apiTraffic.topEndpoints || []).filter((item: any) => {
        const cat = getApiCategoryInfo(item.path);
        const matchesSearch = !searchQuery || item.path.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        if (sourceFilter === 'ALL') return true;
        if (sourceFilter === 'EXTERNAL') return cat.isExternal;
        return cat.key === sourceFilter;
    });

    // Danh sách lọc Recent Logs
    const filteredRecentLogs = (apiTraffic.recentLogs || []).filter((item: any) => {
        const cat = getApiCategoryInfo(item.path);
        const query = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            item.path.toLowerCase().includes(query) || 
            (item.ip && item.ip.toLowerCase().includes(query)) ||
            (item.userAgent && item.userAgent.toLowerCase().includes(query));
        if (!matchesSearch) return false;
        if (sourceFilter === 'ALL') return true;
        if (sourceFilter === 'EXTERNAL') return cat.isExternal;
        return cat.key === sourceFilter;
    });

    const externalCount = (apiTraffic.topEndpoints || []).filter((e: any) => getApiCategoryInfo(e.path).isExternal).length;
    const hisCount = (apiTraffic.topEndpoints || []).filter((e: any) => getApiCategoryInfo(e.path).key === 'HIS').length;
    const extCount = (apiTraffic.topEndpoints || []).filter((e: any) => getApiCategoryInfo(e.path).key === 'EXTENSION').length;
    const mobileCount = (apiTraffic.topEndpoints || []).filter((e: any) => getApiCategoryInfo(e.path).key === 'MOBILE').length;
    const patientCount = (apiTraffic.topEndpoints || []).filter((e: any) => getApiCategoryInfo(e.path).key === 'PATIENT').length;
    const internalCount = (apiTraffic.topEndpoints || []).filter((e: any) => !getApiCategoryInfo(e.path).isExternal).length;

    const renderFilterBar = (totalItems: number, currentFilteredCount: number, labelName: string) => (
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-2xs mb-4">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                    <FilterOutlined className="text-blue-600" /> Lọc Nguồn API:
                </span>
                <Segmented
                    value={sourceFilter}
                    onChange={(val) => setSourceFilter(val as string)}
                    className="bg-white p-1 rounded-xl shadow-2xs font-medium text-xs"
                    options={[
                        { label: <span>🌐 Tất cả ({totalItems})</span>, value: 'ALL' },
                        { 
                            label: (
                                <span className="font-bold text-emerald-700">
                                    ⚡ Chỉ Đối Ngoại ({externalCount})
                                </span>
                            ), 
                            value: 'EXTERNAL' 
                        },
                        { label: <span>👥 Bệnh nhân ({patientCount})</span>, value: 'PATIENT' },
                        { label: <span>🩺 HIS ({hisCount})</span>, value: 'HIS' },
                        { label: <span>🧩 Tiện ích Ext ({extCount})</span>, value: 'EXTENSION' },
                        { label: <span>📱 Mobile ({mobileCount})</span>, value: 'MOBILE' },
                        { label: <span>💻 Nội bộ ({internalCount})</span>, value: 'INTERNAL' },
                    ]}
                />
            </div>

            <div className="flex items-center gap-2 self-end lg:self-center w-full lg:w-auto">
                <Input
                    prefix={<SearchOutlined className="text-slate-400" />}
                    placeholder="Tìm theo URL hoặc địa chỉ IP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    allowClear
                    className="w-full lg:w-72 rounded-xl text-xs"
                    size="middle"
                />
                <Tag color="blue" className="rounded-lg text-xs py-1 px-2.5 font-semibold shrink-0">
                    {currentFilteredCount} {labelName}
                </Tag>
            </div>
        </div>
    );

    const topEndpointsColumns = [
        {
            title: 'STT',
            key: 'stt',
            width: 55,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (
                <span className="text-slate-400 font-mono text-xs">{index + 1}</span>
            )
        },
        {
            title: 'Nguồn / Phân Loại',
            key: 'category',
            width: 175,
            render: (_: any, record: any) => {
                const cat = getApiCategoryInfo(record.path);
                return (
                    <Tooltip title={cat.desc}>
                        <Tag color={cat.color} className="font-semibold text-xs border-none flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full cursor-help">
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                        </Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Phương thức',
            dataIndex: 'method',
            key: 'method',
            width: 90,
            render: (method: string) => {
                let color = 'blue';
                if (method === 'GET') color = 'green';
                else if (method === 'POST') color = 'gold';
                else if (method === 'PUT') color = 'geekblue';
                else if (method === 'DELETE') color = 'red';
                return <Tag color={color} className="font-bold border-none text-[11px]">{method}</Tag>;
            }
        },
        {
            title: 'Đường dẫn API',
            dataIndex: 'path',
            key: 'path',
            render: (path: string) => (
                <code className="text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded font-mono font-medium break-all">
                    {path}
                </code>
            )
        },
        {
            title: 'Số lượt gọi',
            dataIndex: 'hitCount',
            key: 'hitCount',
            width: 110,
            sorter: (a: any, b: any) => b.hitCount - a.hitCount,
            defaultSortOrder: 'descend' as const,
            render: (count: number) => (
                <span className="font-bold text-blue-600">{count.toLocaleString()}</span>
            )
        },
        {
            title: 'Tốc độ TB',
            dataIndex: 'avgDurationMs',
            key: 'avgDurationMs',
            width: 100,
            render: (ms: number) => {
                let colorClass = 'text-emerald-600';
                if (ms > 300) colorClass = 'text-red-500';
                else if (ms > 100) colorClass = 'text-amber-600';
                return <span className={`font-semibold ${colorClass}`}>{ms} ms</span>;
            }
        },
        {
            title: 'Thành công (2xx)',
            dataIndex: 'status2xx',
            key: 'status2xx',
            width: 125,
            render: (s2xx: number, record: any) => {
                const total = record.hitCount || 1;
                const percent = Math.round((s2xx / total) * 100);
                return (
                    <span className="text-xs font-semibold text-emerald-700">
                        {s2xx} ({percent}%)
                    </span>
                );
            }
        },
        {
            title: 'Lần gọi cuối',
            dataIndex: 'lastHitAt',
            key: 'lastHitAt',
            width: 100,
            render: (t: string) => <span className="text-xs text-slate-500">{t || 'Vừa xong'}</span>
        }
    ];

    const recentLogsColumns = [
        {
            title: 'Thời gian',
            dataIndex: 'timeStr',
            key: 'timeStr',
            width: 90,
            render: (t: string) => <span className="font-mono text-xs text-slate-600">{t}</span>
        },
        {
            title: 'Nguồn gọi',
            key: 'category',
            width: 160,
            render: (_: any, record: any) => {
                const cat = getApiCategoryInfo(record.path);
                return (
                    <Tag color={cat.color} className="font-semibold text-[11px] border-none flex items-center gap-1 w-fit rounded-full">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                    </Tag>
                );
            }
        },
        {
            title: 'Method',
            dataIndex: 'method',
            key: 'method',
            width: 80,
            render: (method: string) => {
                let color = 'blue';
                if (method === 'GET') color = 'green';
                else if (method === 'POST') color = 'gold';
                else if (method === 'PUT') color = 'geekblue';
                else if (method === 'DELETE') color = 'red';
                return <Tag color={color} className="font-bold border-none text-[11px]">{method}</Tag>;
            }
        },
        {
            title: 'Endpoint',
            dataIndex: 'path',
            key: 'path',
            render: (p: string) => (
                <span className="font-mono text-xs text-slate-800 break-all">{p}</span>
            )
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 90,
            render: (st: number) => {
                let color = 'success';
                if (st >= 500) color = 'error';
                else if (st >= 400) color = 'warning';
                return <Badge status={color as any} text={<span className="font-bold text-xs">{st}</span>} />;
            }
        },
        {
            title: 'Độ trễ',
            dataIndex: 'durationMs',
            key: 'durationMs',
            width: 80,
            render: (ms: number) => (
                <span className="text-xs font-mono text-slate-600">{ms} ms</span>
            )
        },
        {
            title: 'IP & Trình duyệt / Thiết bị',
            key: 'clientInfo',
            width: 195,
            render: (_: any, record: any) => {
                const dev = parseClientDevice(record.userAgent);
                return (
                    <div className="flex flex-col text-xs leading-tight">
                        <span className="font-mono text-slate-700 font-semibold">{record.ip || '127.0.0.1'}</span>
                        <Tooltip title={record.userAgent || 'Không có User-Agent'}>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 cursor-help">
                                <span>{dev.icon}</span>
                                <span className="font-medium truncate max-w-[140px]">{dev.name}</span>
                            </span>
                        </Tooltip>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="p-4 sm:p-6 max-w-[98%] mx-auto space-y-6">
            {/* Header: Tiêu đề & Công cụ làm mới */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <Title level={3} className="!mb-1 text-slate-800 flex items-center gap-3">
                        <DashboardOutlined className="text-blue-600" />
                        Giám Sát Vận Hành & Sức Khỏe Hệ Thống
                    </Title>
                    <Text className="text-slate-500 text-xs sm:text-sm">
                        Theo dõi thời gian thực trạng thái CSDL, tài nguyên máy chủ và thống kê lưu lượng API trong ngày.
                    </Text>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
                        <span>Tự động làm mới (10s):</span>
                        <Switch 
                            checked={autoRefresh} 
                            onChange={setAutoRefresh} 
                            size="small" 
                        />
                    </div>

                    <Button 
                        type="primary" 
                        icon={<SyncOutlined spin={refreshing} />} 
                        onClick={() => fetchMetrics(true)}
                        loading={refreshing}
                        className="bg-blue-600 rounded-xl font-medium"
                    >
                        Kiểm tra ngay
                    </Button>
                </div>
            </div>

            {/* Banner trạng thái tổng thể */}
            <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-xs ${
                isHealthy 
                    ? 'bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border-emerald-200 text-emerald-900' 
                    : 'bg-gradient-to-r from-rose-50 via-red-50/50 to-white border-rose-200 text-rose-900'
            }`}>
                <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs ${
                        isHealthy ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}>
                        {isHealthy ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    </div>
                    <div>
                        <div className="text-base sm:text-lg font-bold">
                            {isHealthy 
                                ? '🟢 HỆ THỐNG ĐANG HOẠT ĐỘNG TỐT & KHỎE MẠNH' 
                                : '🔴 HỆ THỐNG GẶP CẢNH BÁO KẾT NỐI'}
                        </div>
                        <div className="text-xs opacity-80 mt-0.5">
                            Cập nhật lúc: <strong>{data?.checkedAt || 'Vừa xong'}</strong> • Máy chủ phản hồi tức thời
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                    <Tag color={isDbHealthy ? 'success' : 'error'} className="font-semibold px-3 py-1 text-xs rounded-full border-none">
                        PostgreSQL: {isDbHealthy ? `Online (${db.latencyMs}ms)` : 'Offline'}
                    </Tag>
                    <Tag color="blue" className="font-semibold px-3 py-1 text-xs rounded-full border-none">
                        Uptime: {server.uptimeFormatted || 'Mới khởi động'}
                    </Tag>
                </div>
            </div>

            {/* Khung nội dung với Tabs card */}
            <Tabs 
                type="card"
                defaultActiveKey="overview"
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs"
                items={[
                    {
                        key: 'overview',
                        label: (
                            <span className="flex items-center gap-2 font-medium">
                                <SafetyCertificateOutlined /> Sức Khỏe & Vận Hành
                            </span>
                        ),
                        children: (
                            <div className="space-y-6 pt-2">
                                {/* Thống kê nhanh 4 thẻ */}
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} sm={12} lg={6}>
                                        <Card className="rounded-2xl border-slate-200 bg-slate-50/60 shadow-2xs hover:border-blue-300 transition-all">
                                            <Statistic 
                                                title={<span className="text-slate-500 text-xs font-semibold uppercase">Cơ sở dữ liệu (PostgreSQL)</span>}
                                                value={db.status === 'UP' ? 'Hoạt động' : 'Mất kết nối'}
                                                styles={{ content: { color: db.status === 'UP' ? '#059669' : '#e11d48', fontSize: '20px', fontWeight: 700 } }}
                                                prefix={<DatabaseOutlined className="mr-1" />}
                                            />
                                            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                                                <span>Độ trễ truy vấn Ping:</span>
                                                <strong className="text-emerald-600 font-mono">{db.latencyMs} ms</strong>
                                            </div>
                                        </Card>
                                    </Col>

                                    <Col xs={24} sm={12} lg={6}>
                                        <Card className="rounded-2xl border-slate-200 bg-slate-50/60 shadow-2xs hover:border-blue-300 transition-all">
                                            <Statistic 
                                                title={<span className="text-slate-500 text-xs font-semibold uppercase">Thời gian chạy (Uptime)</span>}
                                                value={server.uptimeFormatted || 'Đang chạy'}
                                                styles={{ content: { color: '#2563eb', fontSize: '17px', fontWeight: 700 } }}
                                                prefix={<ClockCircleOutlined className="mr-1" />}
                                            />
                                            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                                                <span>Khởi động từ:</span>
                                                <strong className="text-slate-700">{server.startTime || 'Hôm nay'}</strong>
                                            </div>
                                        </Card>
                                    </Col>

                                    <Col xs={24} sm={12} lg={6}>
                                        <Card className="rounded-2xl border-slate-200 bg-slate-50/60 shadow-2xs hover:border-blue-300 transition-all">
                                            <Statistic 
                                                title={<span className="text-slate-500 text-xs font-semibold uppercase">Phiếu CNTT Hôm Nay</span>}
                                                value={business.itRequestsToday || 0}
                                                styles={{ content: { color: '#d97706', fontSize: '22px', fontWeight: 700 } }}
                                                prefix={<ThunderboltOutlined className="mr-1" />}
                                                suffix={<span className="text-xs text-slate-500 font-normal">yêu cầu</span>}
                                            />
                                            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                                                <span>Đang xử lý / Đã xong:</span>
                                                <strong className="text-slate-700">{business.itRequestsInProgress} / {business.itRequestsResolvedToday}</strong>
                                            </div>
                                        </Card>
                                    </Col>

                                    <Col xs={24} sm={12} lg={6}>
                                        <Card className="rounded-2xl border-slate-200 bg-slate-50/60 shadow-2xs hover:border-blue-300 transition-all">
                                            <Statistic 
                                                title={<span className="text-slate-500 text-xs font-semibold uppercase">Tổng Request API Hôm Nay</span>}
                                                value={apiTraffic.totalRequestsToday || 0}
                                                styles={{ content: { color: '#7c3aed', fontSize: '22px', fontWeight: 700 } }}
                                                prefix={<ApiOutlined className="mr-1" />}
                                                suffix={<span className="text-xs text-slate-500 font-normal">lượt</span>}
                                            />
                                            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                                                <span>Tỷ lệ thành công:</span>
                                                <strong className="text-emerald-600 font-semibold">{apiTraffic.successRatePercent}%</strong>
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Chi tiết Tài nguyên Máy chủ & Hệ điều hành */}
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} md={12}>
                                        <Card title={<span className="font-bold text-slate-800 text-sm flex items-center gap-2"><HddOutlined className="text-blue-500" /> Bộ Nhớ RAM Node.js (Heap Memory)</span>} className="rounded-2xl border-slate-200 shadow-2xs h-full">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-500">Mức sử dụng RAM / Giới hạn Heap Node.js:</span>
                                                    <span className="text-xs font-bold text-emerald-700">
                                                        {memory.heapUsedMB} MB / {memory.heapLimitMB || 4096} MB ({memory.percentHeapUsed}%)
                                                    </span>
                                                </div>
                                                <Progress 
                                                    percent={memory.percentHeapUsed || 0} 
                                                    status={memory.percentHeapUsed > 80 ? 'exception' : 'normal'}
                                                    strokeColor={
                                                        memory.percentHeapUsed > 80 
                                                            ? '#ef4444' 
                                                            : memory.percentHeapUsed > 50 
                                                                ? '#f59e0b' 
                                                                : '#10b981'
                                                    }
                                                />
                                                <div className="grid grid-cols-3 gap-2 pt-2 text-xs text-slate-600">
                                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="text-slate-400 text-[11px]">Đã cấp phát:</div>
                                                        <div className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5">{memory.heapTotalMB} MB</div>
                                                        <div className="text-[10px] text-slate-400">Heap Total</div>
                                                    </div>
                                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="text-slate-400 text-[11px]">RAM Vật Lý:</div>
                                                        <div className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5">{memory.rssMB} MB</div>
                                                        <div className="text-[10px] text-slate-400">RSS Memory</div>
                                                    </div>
                                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="text-slate-400 text-[11px]">Trần giới hạn:</div>
                                                        <div className="font-bold text-emerald-700 text-xs sm:text-sm mt-0.5">{memory.heapLimitMB || 4096} MB</div>
                                                        <div className="text-[10px] text-emerald-600 font-semibold">Tối đa ~4GB</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Card title={<span className="font-bold text-slate-800 text-sm flex items-center gap-2"><CloudServerOutlined className="text-indigo-500" /> Môi Trường Vận Hành (Server Runtime)</span>} className="rounded-2xl border-slate-200 shadow-2xs h-full">
                                            <div className="space-y-3 text-xs">
                                                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                                    <span className="text-slate-500">Nền tảng máy chủ:</span>
                                                    <strong className="text-slate-800 font-mono">{server.platform}</strong>
                                                </div>
                                                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                                    <span className="text-slate-500">Phiên bản Node.js:</span>
                                                    <Tag color="cyan" className="font-mono font-semibold">{server.nodeVersion}</Tag>
                                                </div>
                                                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                                    <span className="text-slate-500">Tài khoản nhân sự đang hoạt động:</span>
                                                    <strong className="text-blue-600">{business.totalUsers} tài khoản</strong>
                                                </div>
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="text-slate-500">Quy tắc giám định XML kích hoạt:</span>
                                                    <strong className="text-purple-600">{business.activeRulesCount} quy tắc</strong>
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>
                            </div>
                        )
                    },
                    {
                        key: 'api-traffic',
                        label: (
                            <span className="flex items-center gap-2 font-medium">
                                <FundOutlined /> Lưu Lượng & Hiệu Năng API
                            </span>
                        ),
                        children: (
                            <div className="space-y-6 pt-2">
                                {/* Thống kê chỉ số API */}
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} sm={8}>
                                        <Card className="rounded-2xl border-slate-200 bg-blue-50/50 shadow-2xs">
                                            <Statistic 
                                                title={<span className="text-slate-600 font-semibold text-xs">Tổng Request Hôm Nay</span>}
                                                value={apiTraffic.totalRequestsToday || 0}
                                                styles={{ content: { color: '#1d4ed8', fontWeight: 800 } }}
                                                suffix={<span className="text-xs text-slate-500">lượt gọi</span>}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={8}>
                                        <Card className="rounded-2xl border-slate-200 bg-emerald-50/50 shadow-2xs">
                                            <Statistic 
                                                title={<span className="text-slate-600 font-semibold text-xs">Tỷ Lệ Phản Hồi Thành Công (2xx)</span>}
                                                value={apiTraffic.successRatePercent || 100}
                                                precision={1}
                                                styles={{ content: { color: '#047857', fontWeight: 800 } }}
                                                suffix="%"
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={8}>
                                        <Card className="rounded-2xl border-slate-200 bg-purple-50/50 shadow-2xs">
                                            <Statistic 
                                                title={<span className="text-slate-600 font-semibold text-xs">Thời Gian Phản Hồi Trung Bình</span>}
                                                value={apiTraffic.avgLatencyMs || 15}
                                                styles={{ content: { color: '#6d28d9', fontWeight: 800 } }}
                                                suffix="ms"
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Phân bổ theo khung giờ 24h */}
                                <Card title={<span className="font-bold text-slate-800 text-sm">Biểu Đồ Lưu Lượng Theo Khung Giờ Trong Ngày (0h - 23h)</span>} className="rounded-2xl border-slate-200 shadow-2xs">
                                    <div className="h-44 flex items-end gap-1 sm:gap-2 px-2 pt-4">
                                        {Array.from({ length: 24 }).map((_, hour) => {
                                            const count = apiTraffic.hourlyDistribution?.[hour] || 0;
                                            const maxCount = Math.max(...(apiTraffic.hourlyDistribution || [1]), 1);
                                            const percent = Math.round((count / maxCount) * 100);
                                            const heightPx = Math.max(percent * 1.1, 4);

                                            return (
                                                <Tooltip key={hour} title={`Khung giờ ${hour}h:00 - ${hour}h:59 : ${count} requests`}>
                                                    <div className="flex-1 flex flex-col items-center group cursor-pointer">
                                                        <div 
                                                            style={{ height: `${heightPx}px` }} 
                                                            className={`w-full max-w-[20px] rounded-t transition-all ${
                                                                count > 0 
                                                                    ? 'bg-blue-500 group-hover:bg-blue-600' 
                                                                    : 'bg-slate-200'
                                                            }`}
                                                        />
                                                        <span className="text-[10px] text-slate-400 mt-1 font-mono">{hour}h</span>
                                                    </div>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                    <div className="text-xs text-slate-500 text-center mt-2">
                                        * Rà chuột vào từng cột để xem chi tiết số lượt truy cập theo từng khung giờ
                                    </div>
                                </Card>

                                {/* Bảng Top Endpoints */}
                                <Card 
                                    title={
                                        <div className="flex items-center justify-between py-1 flex-wrap gap-2">
                                            <span className="font-bold text-slate-800 text-sm">
                                                Thống Kê Chi Tiết Các API Được Truy Cập Trong Ngày
                                            </span>
                                            {sourceFilter !== 'ALL' && (
                                                <Tag color="processing" closable onClose={() => setSourceFilter('ALL')} className="text-xs font-normal">
                                                    Đang lọc nguồn: <strong>{sourceFilter}</strong>
                                                </Tag>
                                            )}
                                        </div>
                                    } 
                                    className="rounded-2xl border-slate-200 shadow-2xs"
                                >
                                    {renderFilterBar(apiTraffic.topEndpoints?.length || 0, filteredTopEndpoints.length, 'endpoint')}
                                    <Table 
                                        dataSource={filteredTopEndpoints} 
                                        columns={topEndpointsColumns} 
                                        rowKey={(record) => `${record.method}-${record.path}`}
                                        pagination={{ pageSize: 10, size: 'small', showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
                                        size="middle"
                                        locale={{ emptyText: <Empty description="Không có API nào phù hợp với bộ lọc" /> }}
                                    />
                                </Card>
                            </div>
                        )
                    },
                    {
                        key: 'live-logs',
                        label: (
                            <span className="flex items-center gap-2 font-medium">
                                <ThunderboltOutlined /> Nhật Ký Truy Cập Trực Tiếp (Live Stream)
                            </span>
                        ),
                        children: (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                                    <span>Hiển thị tối đa 100 lượt gọi API mới nhất vừa gửi tới máy chủ:</span>
                                    <span className="font-semibold text-slate-700">Tổng lưu lượng toàn thời gian: {apiTraffic.totalRequestsAllTime?.toLocaleString() || 0}</span>
                                </div>
                                {renderFilterBar(apiTraffic.recentLogs?.length || 0, filteredRecentLogs.length, 'lượt gọi')}
                                <Table 
                                    dataSource={filteredRecentLogs} 
                                    columns={recentLogsColumns} 
                                    rowKey="id"
                                    pagination={{ pageSize: 12, size: 'small' }}
                                    size="small"
                                    locale={{ emptyText: <Empty description="Không có lượt truy cập nào phù hợp với bộ lọc" /> }}
                                />
                            </div>
                        )
                    }
                ]}
            />
        </div>
    );
}
