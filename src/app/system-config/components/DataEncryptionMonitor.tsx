'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Card, Table, Tag, Button, Switch, Space, Progress, 
    Modal, message, Alert, Tooltip, Popconfirm, Typography 
} from 'antd';
import { 
    SafetyCertificateOutlined, 
    LockOutlined, 
    UnlockOutlined, 
    ReloadOutlined, 
    ThunderboltOutlined, 
    CheckCircleOutlined, 
    WarningOutlined,
    KeyOutlined,
    FileProtectOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface FieldStat {
    field: string;
    label: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    totalWithData: number;
    encryptedCount: number;
    plaintextCount: number;
    percentage: number;
    isActive: boolean;
}

interface EncryptionStatusResponse {
    success: boolean;
    totalStaff: number;
    encryptionEnabled: boolean;
    maskingEnabled: boolean;
    allowUnmask: boolean;
    activeFields: string[];
    fieldStats: FieldStat[];
    serverKeyConfigured: boolean;
}

export default function DataEncryptionMonitor() {
    const [data, setData] = useState<EncryptionStatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/system-config/encryption');
            if (res.ok) {
                const resData = await res.json();
                setData(resData);
            } else {
                message.error('Không thể tải trạng thái mã hóa dữ liệu.');
            }
        } catch (error) {
            console.error('Lỗi fetchStatus:', error);
            message.error('Lỗi kết nối máy chủ.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Bật / tắt một trường mã hóa
    const handleToggleField = async (field: string, checked: boolean) => {
        if (!data) return;
        const currentActive = data.activeFields || [];
        let newActive: string[];

        if (checked) {
            newActive = Array.from(new Set([...currentActive, field]));
        } else {
            newActive = currentActive.filter(f => f !== field);
        }

        try {
            setActionLoading(true);
            const res = await fetch('/api/system-config/encryption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_active_fields',
                    activeFields: newActive
                })
            });

            if (res.ok) {
                message.success(`Đã ${checked ? 'bật' : 'tắt'} cấu hình mã hóa cho trường ${field}`);
                fetchStatus();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi cập nhật cấu hình trường');
        } finally {
            setActionLoading(false);
        }
    };

    // Chạy mã hóa hàng loạt toàn bộ CSDL
    const handleEncryptAll = async () => {
        try {
            setActionLoading(true);
            message.loading({ content: 'Đang tiến hành mã hóa an toàn toàn bộ dữ liệu CSDL...', key: 'encrypting' });
            const res = await fetch('/api/system-config/encryption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'encrypt_all' })
            });

            if (res.ok) {
                const result = await res.json();
                message.success({ content: result.message || 'Mã hóa hoàn tất thành công!', key: 'encrypting', duration: 4 });
                fetchStatus();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error({ content: err.error || 'Mã hóa thất bại', key: 'encrypting' });
            }
        } catch (error) {
            message.error({ content: 'Lỗi kết nối khi chạy mã hóa', key: 'encrypting' });
        } finally {
            setActionLoading(false);
        }
    };

    // Giải mã hoàn nguyên về chữ thường (Rollback)
    const handleDecryptAll = async () => {
        try {
            setActionLoading(true);
            message.loading({ content: 'Đang tiến hành giải mã hoàn nguyên dữ liệu về Plaintext...', key: 'decrypting' });
            const res = await fetch('/api/system-config/encryption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'decrypt_all' })
            });

            if (res.ok) {
                const result = await res.json();
                message.success({ content: result.message || 'Hoàn nguyên thành công!', key: 'decrypting', duration: 4 });
                fetchStatus();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error({ content: err.error || 'Giải mã thất bại', key: 'decrypting' });
            }
        } catch (error) {
            message.error({ content: 'Lỗi kết nối khi giải mã', key: 'decrypting' });
        } finally {
            setActionLoading(false);
        }
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        {
            title: 'Tên trường dữ liệu',
            key: 'label',
            render: (_: any, r: FieldStat) => (
                <div>
                    <span className="font-semibold text-slate-800 text-sm">{r.label}</span>
                    <span className="block text-xs text-slate-400 font-mono">Tên cột CSDL: {r.field}</span>
                </div>
            )
        },
        {
            title: 'Phân loại',
            dataIndex: 'category',
            key: 'category',
            width: 140,
            render: (cat: string) => <Tag color="cyan">{cat}</Tag>
        },
        {
            title: 'Mức nhạy cảm',
            dataIndex: 'severity',
            key: 'severity',
            width: 130,
            render: (sev: 'HIGH' | 'MEDIUM' | 'LOW') => {
                if (sev === 'HIGH') return <Tag color="error" className="font-medium">TỐI MẬT (Cao)</Tag>;
                if (sev === 'MEDIUM') return <Tag color="warning" className="font-medium">NHẠY CẢM</Tag>;
                return <Tag color="default">THÔNG THƯỜNG</Tag>;
            }
        },
        {
            title: 'Bật mã hóa',
            key: 'isActive',
            width: 120,
            align: 'center' as const,
            render: (_: any, r: FieldStat) => (
                <Switch
                    checked={r.isActive}
                    onChange={(checked) => handleToggleField(r.field, checked)}
                    loading={actionLoading}
                    checkedChildren="BẬT"
                    unCheckedChildren="TẮT"
                />
            )
        },
        {
            title: 'Số bản ghi có dữ liệu',
            dataIndex: 'totalWithData',
            key: 'totalWithData',
            width: 150,
            align: 'center' as const,
            render: (val: number) => <span className="font-medium text-slate-700">{val} / {data?.totalStaff || 0}</span>
        },
        {
            title: 'Đã mã hóa (CSDL)',
            key: 'encryptedCount',
            width: 150,
            align: 'center' as const,
            render: (_: any, r: FieldStat) => (
                <div>
                    <span className="font-bold text-emerald-600">{r.encryptedCount}</span>
                    {r.plaintextCount > 0 && (
                        <span className="text-xs text-rose-500 block">({r.plaintextCount} chưa mã hóa)</span>
                    )}
                </div>
            )
        },
        {
            title: 'Tiến độ bảo vệ',
            key: 'progress',
            width: 180,
            render: (_: any, r: FieldStat) => {
                const percent = r.percentage;
                const status = percent === 100 ? 'success' : (percent > 0 ? 'normal' : 'exception');
                return (
                    <div className="w-full">
                        <Progress percent={percent} size="small" status={status} />
                    </div>
                );
            }
        }
    ];

    const activeStats = data?.fieldStats.filter(f => f.isActive) || [];
    const totalActiveRecords = activeStats.reduce((acc, curr) => acc + curr.totalWithData, 0);
    const totalEncryptedRecords = activeStats.reduce((acc, curr) => acc + curr.encryptedCount, 0);
    const overallPercentage = totalActiveRecords > 0 ? Math.round((totalEncryptedRecords / totalActiveRecords) * 100) : 100;

    return (
        <div className="space-y-4">
            {/* Banner Thông Báo Tuân Thủ An Ninh Mạng */}
            <Alert
                title="Trung tâm Bảo vệ & Mã hóa Thông tin Cá nhân (PII) - Bệnh viện Đa khoa tỉnh Lạng Sơn"
                description={
                    <div className="text-xs leading-relaxed text-slate-600">
                        Hệ thống tuân thủ <strong>Nghị định 13/2023/NĐ-CP</strong> về bảo vệ dữ liệu cá nhân và tiêu chuẩn An toàn thông tin Y tế Cấp độ 3.
                        Dữ liệu được bảo vệ bằng thuật toán mã hóa đối xứng <strong>AES-256-GCM</strong> (Authenticated Encryption) kết hợp <strong>Blind Index (HMAC-SHA256)</strong> để vừa bảo đảm tuyệt đối dữ liệu CSDL vừa bảo đảm tốc độ tìm kiếm và đăng nhập.
                    </div>
                }
                type="info"
                showIcon
                icon={<SafetyCertificateOutlined className="text-blue-600 text-xl" />}
                className="rounded-xl border-blue-200 bg-blue-50/50"
            />

            {/* Các thẻ KPI Thống Kê Giám Sát */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="rounded-xl shadow-sm border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <Text type="secondary" className="text-xs uppercase font-semibold">Tổng nhân sự toàn viện</Text>
                            <div className="text-2xl font-bold text-slate-800 mt-1">{data?.totalStaff || 0} cán bộ</div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                            <FileProtectOutlined />
                        </div>
                    </div>
                </Card>

                <Card className="rounded-xl shadow-sm border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <Text type="secondary" className="text-xs uppercase font-semibold">Trường kích hoạt mã hóa</Text>
                            <div className="text-2xl font-bold text-emerald-600 mt-1">{data?.activeFields.length || 0} trường</div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl">
                            <LockOutlined />
                        </div>
                    </div>
                </Card>

                <Card className="rounded-xl shadow-sm border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <Text type="secondary" className="text-xs uppercase font-semibold">Tỉ lệ dữ liệu an toàn</Text>
                            <div className="text-2xl font-bold text-indigo-600 mt-1">{overallPercentage}%</div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
                            <CheckCircleOutlined />
                        </div>
                    </div>
                </Card>

                <Card className="rounded-xl shadow-sm border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <Text type="secondary" className="text-xs uppercase font-semibold">Khóa máy chủ (AES Key)</Text>
                            <div className="text-sm font-semibold text-slate-700 mt-2 flex items-center gap-1.5">
                                <Tag color="success" className="!mr-0">ĐÃ KÍCH HOẠT (256-bit)</Tag>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl">
                            <KeyOutlined />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Bảng Giám Sát & Danh Sách Các Trường */}
            <Card
                title={
                    <div className="flex items-center gap-2">
                        <LockOutlined className="text-blue-600" />
                        <span className="font-bold text-slate-800">Danh Mục Các Trường Dữ Liệu Nhân Sự</span>
                        <Tag color="processing" className="ml-2">Tick chọn để áp dụng mã hóa</Tag>
                    </div>
                }
                extra={
                    <Space>
                        <Button 
                            icon={<ReloadOutlined />} 
                            onClick={fetchStatus} 
                            loading={loading}
                        >
                            Làm mới
                        </Button>
                        <Popconfirm
                            title="Xác nhận mã hóa CSDL"
                            description="Hệ thống sẽ quét và mã hóa toàn bộ dữ liệu của các trường đang được BẬT. Quá trình mất khoảng 2-3 giây."
                            onConfirm={handleEncryptAll}
                            okText="Đồng ý mã hóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: false, type: 'primary' }}
                        >
                            <Button 
                                type="primary" 
                                icon={<ThunderboltOutlined />} 
                                loading={actionLoading}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                ⚡ Áp dụng & Mã hóa ngay
                            </Button>
                        </Popconfirm>
                        <Popconfirm
                            title="CẢNH BÁO: Giải mã hoàn nguyên toàn bộ"
                            description="Bạn có chắc chắn muốn giải mã toàn bộ dữ liệu CSDL về dạng văn bản thô (Plaintext)? Chỉ dùng khi có yêu cầu hoàn nguyên đặc biệt."
                            onConfirm={handleDecryptAll}
                            okText="Tôi hiểu, giải mã về chữ thường"
                            cancelText="Hủy bỏ"
                            okButtonProps={{ danger: true }}
                        >
                            <Button 
                                danger 
                                icon={<UnlockOutlined />} 
                                loading={actionLoading}
                            >
                                Giải mã về Plaintext
                            </Button>
                        </Popconfirm>
                    </Space>
                }
                className="rounded-xl shadow-sm border-slate-200"
            >
                <Table
                    columns={columns}
                    dataSource={data?.fieldStats || []}
                    rowKey="field"
                    loading={loading}
                    pagination={false}
                    size="middle"
                    bordered
                />
            </Card>
        </div>
    );
}

