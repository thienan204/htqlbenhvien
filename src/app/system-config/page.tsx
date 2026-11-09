'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Table,
    Tabs,
    Card,
    Switch,
    Input,
    InputNumber,
    Select,
    Tag,
    Button,
    Space,
    Tooltip,
    message,
    Modal,
    Badge
} from 'antd';
import {
    SettingOutlined,
    SearchOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    GlobalOutlined,
    AppstoreOutlined,
    ThunderboltOutlined,
    UserOutlined,
    SaveOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

interface ConfigItem {
    id: string;
    key: string;
    value: string;
    title: string | null;
    description: string | null;
    category: 'SYSTEM' | 'MODULE' | null;
    module: string | null;
    route: string | null;
    dataType: 'BOOLEAN' | 'STRING' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'JSON' | null;
    options: string | null;
    parsedOptions?: { label: string; value: string }[];
    defaultValue: string | null;
    order: number | null;
    updatedAt: string;
}

export default function SystemConfigPage() {
    const { user } = useAuth();
    const [configs, setConfigs] = useState<ConfigItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'SYSTEM' | 'MODULE'>('MODULE');
    const [searchText, setSearchText] = useState('');
    const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});

    const isAdmin = user?.role === 'ADMIN' || user?.userLevel === 'LEVEL_1_BGD';

    // Tải danh sách cấu hình từ API
    const fetchConfigs = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/system-config');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.configs)) {
                    setConfigs(data.configs);
                }
            } else {
                message.error('Không thể tải danh sách cấu hình');
            }
        } catch (error) {
            console.error('Lỗi tải cấu hình:', error);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    // Cập nhật giá trị cấu hình
    const handleUpdateConfig = async (key: string, newValue: string) => {
        if (!isAdmin) {
            message.warning('Chỉ Quản trị viên (Admin) mới có quyền thay đổi thông số này');
            return;
        }

        try {
            setSavingKeys(prev => ({ ...prev, [key]: true }));
            const res = await fetch('/api/system-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: newValue })
            });

            if (res.ok) {
                message.success('Đã lưu cấu hình thành công!');
                // Cập nhật state cục bộ ngay lập tức
                setConfigs(prev =>
                    prev.map(c => (c.key === key ? { ...c, value: newValue } : c))
                );
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi lưu cấu hình');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi lưu cấu hình');
        } finally {
            setSavingKeys(prev => ({ ...prev, [key]: false }));
        }
    };

    // Khôi phục về giá trị mặc định
    const handleResetDefault = (item: ConfigItem) => {
        if (!item.defaultValue) return;
        Modal.confirm({
            title: 'Khôi phục giá trị mặc định?',
            content: `Bạn có chắc muốn khôi phục thông số "${item.title || item.key}" về giá trị mặc định ban đầu: "${item.defaultValue}"?`,
            okText: 'Khôi phục',
            cancelText: 'Hủy',
            onOk: () => handleUpdateConfig(item.key, item.defaultValue!)
        });
    };

    // Danh sách phân hệ duy nhất để hiển thị bộ lọc
    const availableModules = useMemo(() => {
        const modules = new Set<string>();
        configs.forEach(c => {
            if (c.module) modules.add(c.module);
        });
        return Array.from(modules);
    }, [configs]);

    // Lọc danh sách cấu hình theo Tab, Phân hệ và Từ khóa tìm kiếm
    const filteredConfigs = useMemo(() => {
        return configs.filter(item => {
            // Lọc theo Tab (SYSTEM vs MODULE)
            const itemCategory = item.category || 'MODULE';
            if (itemCategory !== activeTab) return false;

            // Lọc theo Phân hệ (Module)
            if (selectedModule && item.module !== selectedModule) return false;

            // Lọc theo từ khóa tìm kiếm
            if (searchText.trim()) {
                const q = searchText.toLowerCase();
                const matchTitle = (item.title || '').toLowerCase().includes(q);
                const matchKey = item.key.toLowerCase().includes(q);
                const matchDesc = (item.description || '').toLowerCase().includes(q);
                const matchRoute = (item.route || '').toLowerCase().includes(q);
                if (!matchTitle && !matchKey && !matchDesc && !matchRoute) return false;
            }

            return true;
        });
    }, [configs, activeTab, selectedModule, searchText]);

    // Render linh hoạt theo từng kiểu dữ liệu (Adaptive Value Control)
    const renderValueControl = (item: ConfigItem) => {
        const isSaving = savingKeys[item.key] || false;
        const type = item.dataType || 'BOOLEAN';

        switch (type) {
            case 'BOOLEAN': {
                const isChecked = item.value === 'true' || item.value === '1';
                return (
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={isChecked}
                            loading={isSaving}
                            disabled={!isAdmin}
                            onChange={(checked) => handleUpdateConfig(item.key, checked ? 'true' : 'false')}
                            checkedChildren="BẬT"
                            unCheckedChildren="TẮT"
                            className={isChecked ? 'bg-blue-600' : 'bg-slate-300'}
                        />
                        <span className={`text-xs font-semibold ${isChecked ? 'text-blue-600' : 'text-slate-400'}`}>
                            {isChecked ? 'Đang kích hoạt' : 'Đang tắt'}
                        </span>
                    </div>
                );
            }

            case 'SELECT': {
                const options = item.parsedOptions || [
                    { label: 'Dấu + (Mặc định)', value: '+' },
                    { label: 'Dấu x (Đi làm)', value: 'x' }
                ];
                return (
                    <Select
                        value={item.value || item.defaultValue || ''}
                        loading={isSaving}
                        disabled={!isAdmin}
                        onChange={(val) => handleUpdateConfig(item.key, String(val))}
                        options={options}
                        className="w-48 text-xs font-medium"
                        size="middle"
                    />
                );
            }

            case 'NUMBER': {
                return (
                    <InputNumber
                        value={Number(item.value || item.defaultValue || 0)}
                        disabled={!isAdmin}
                        onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== item.value) {
                                handleUpdateConfig(item.key, val);
                            }
                        }}
                        onPressEnter={(e: any) => {
                            handleUpdateConfig(item.key, e.target.value);
                        }}
                        className="w-32"
                        size="middle"
                    />
                );
            }

            case 'STRING':
            default: {
                return (
                    <Input
                        defaultValue={item.value || ''}
                        disabled={!isAdmin}
                        onBlur={(e) => {
                            if (e.target.value !== item.value) {
                                handleUpdateConfig(item.key, e.target.value);
                            }
                        }}
                        onPressEnter={(e: any) => {
                            handleUpdateConfig(item.key, e.target.value);
                        }}
                        placeholder="Nhập giá trị cấu hình..."
                        className="w-64 text-xs"
                        size="middle"
                    />
                );
            }
        }
    };

    // Cấu hình các cột của Bảng
    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (
                <span className="text-slate-400 text-xs">{index + 1}</span>
            )
        },
        {
            title: 'Phân hệ / Vị trí áp dụng',
            key: 'module_route',
            width: 190,
            render: (_: any, item: ConfigItem) => {
                const isSystem = item.category === 'SYSTEM';
                return (
                    <div className="space-y-1">
                        <div>
                            <Tag color={isSystem ? 'purple' : 'blue'} className="text-[11px] font-semibold">
                                {item.module || (isSystem ? 'HỆ THỐNG' : 'CHUNG')}
                            </Tag>
                        </div>
                        {item.route && item.route !== 'ALL' && (
                            <div className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                                {item.route}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Tên tính năng & Mô tả tác dụng',
            key: 'info',
            render: (_: any, item: ConfigItem) => {
                return (
                    <div className="py-1">
                        <div className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5 flex-wrap">
                            <span>{item.title || item.key}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-normal bg-slate-50 px-1 py-0.2 rounded border border-slate-200">
                                {item.key}
                            </span>
                        </div>
                        {item.description && (
                            <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                                {item.description}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Giá trị cấu hình hiện tại',
            key: 'value_control',
            width: 250,
            render: (_: any, item: ConfigItem) => renderValueControl(item)
        },
        {
            title: 'Mặc định & Thao tác',
            key: 'action',
            width: 150,
            align: 'center' as const,
            render: (_: any, item: ConfigItem) => {
                const isDifferentFromDefault = item.defaultValue && item.value !== item.defaultValue;
                return (
                    <div className="space-y-1">
                        {isDifferentFromDefault ? (
                            <Button
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={() => handleResetDefault(item)}
                                disabled={!isAdmin}
                                className="text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                            >
                                Về mặc định
                            </Button>
                        ) : (
                            <span className="text-[11px] text-slate-400 italic">
                                Đang dùng mặc định
                            </span>
                        )}
                    </div>
                );
            }
        }
    ];

    const tabItems = [
        {
            key: 'MODULE',
            label: (
                <span className="flex items-center gap-2 font-semibold px-2">
                    <AppstoreOutlined />
                    <span>📦 Cấu Hình Phân Hệ & Hiển Thị (Theo Route)</span>
                    <Badge
                        count={configs.filter(c => (c.category || 'MODULE') === 'MODULE').length}
                        color="blue"
                        className="ml-1"
                    />
                </span>
            )
        },
        {
            key: 'SYSTEM',
            label: (
                <span className="flex items-center gap-2 font-semibold px-2">
                    <GlobalOutlined />
                    <span>🌐 Cấu Hình Hệ Thống (Quy Trình & Chính Sách)</span>
                    <Badge
                        count={configs.filter(c => c.category === 'SYSTEM').length}
                        color="purple"
                        className="ml-1"
                    />
                </span>
            )
        }
    ];

    return (
        <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
            {/* Header thông tin trang */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-xs border border-blue-100">
                            <SettingOutlined />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span>Trung Tâm Cấu Hình Thông Số & Tính Năng</span>
                                {!isAdmin && (
                                    <Tag color="warning" className="text-xs font-normal">
                                        Chế độ xem (Chỉ Admin mới sửa được)
                                    </Tag>
                                )}
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Quản lý tập trung các quy tắc quy trình toàn viện, hành vi hiển thị và cờ tính năng linh hoạt cho từng phân hệ.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchConfigs}
                            loading={loading}
                            className="rounded-xl text-xs font-medium"
                        >
                            Tải lại
                        </Button>
                    </div>
                </div>
            </div>

            {/* Khung nội dung chính với Tabs chuẩn card */}
            <Card className="rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <Tabs
                    type="card"
                    activeKey={activeTab}
                    onChange={(k) => {
                        setActiveTab(k as 'SYSTEM' | 'MODULE');
                        setSelectedModule(null);
                    }}
                    items={tabItems}
                    className="mb-4"
                />

                {/* Thanh tìm kiếm & Bộ lọc */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                    <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
                        <Input
                            placeholder="🔍 Tìm kiếm theo tên chức năng, route (/staff/...) hoặc mã cấu hình..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            allowClear
                            className="max-w-md rounded-xl text-xs h-9"
                        />

                        {activeTab === 'MODULE' && availableModules.length > 0 && (
                            <Select
                                placeholder="[ Lọc theo Phân hệ ]"
                                value={selectedModule}
                                onChange={setSelectedModule}
                                allowClear
                                className="w-48 text-xs"
                                options={availableModules.map(m => ({ label: `Phân hệ: ${m}`, value: m }))}
                            />
                        )}
                    </div>

                    <div className="text-xs text-slate-400">
                        Hiển thị <b>{filteredConfigs.length}</b> cấu hình
                    </div>
                </div>

                {/* Bảng danh sách Cấu hình */}
                <Table
                    columns={columns}
                    dataSource={filteredConfigs}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    bordered
                    size="middle"
                    className="rounded-xl overflow-hidden border border-slate-200"
                />
            </Card>
        </div>
    );
}

