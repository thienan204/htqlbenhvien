'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Checkbox,
    Input,
    Modal,
    Popconfirm,
    Space,
    Spin,
    Table,
    Tabs,
    Tag,
    Tooltip,
    message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    CheckCircleOutlined,
    DatabaseOutlined,
    ExclamationCircleOutlined,
    ReloadOutlined,
    SearchOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import { getBasePath } from '@/utils/config';

type MatchMethod = 'CCCD' | 'MA_NV' | 'HO_TEN_KHOA' | 'HO_TEN_DUY_NHAT';
type CandidateAction = 'CREATE' | 'UPDATE' | 'SKIP';

interface PreviewSummary {
    totalMau02Rows: number;
    totalMau02WithCchn: number;
    skippedNoCchnCount: number;
    createCount: number;
    updateCount: number;
    skipCount: number;
    unmatchedCount: number;
    preservedExistingCount: number;
    existingTotalCertCount: number;
    newNoiCapCategories: string[];
}

interface PreviewCandidateItem {
    key: string;
    action: CandidateAction;
    staffId: string;
    ma_nv: string;
    ho_ten: string;
    ten_khoa: string;
    so_dinh_danh: string;
    matchMethod: MatchMethod;
    so_cchn: string;
    ngay_cap: string | null;
    noi_cap_name: string | null;
    matchedScopes: string[];
    unknownScopes: string[];
    updatedFields: string[];
    scopesToAdd: string[];
}

interface UnmatchedMau02Item {
    mau02Id: string;
    stt: number | null;
    ho_ten: string;
    ma_khoa: string;
    ten_khoa: string;
    so_dinh_danh: string;
    so_cchn: string;
    reason: string;
}

interface PreviewResponse {
    mode: 'preview';
    summary: PreviewSummary;
    candidates: PreviewCandidateItem[];
    unmatched: UnmatchedMau02Item[];
}

interface RestoreFromMau02ModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const MATCH_METHOD_LABELS: Record<MatchMethod, { label: string; color: string }> = {
    CCCD: { label: 'Khớp CCCD', color: 'green' },
    MA_NV: { label: 'Khớp Mã NV', color: 'cyan' },
    HO_TEN_KHOA: { label: 'Khớp Tên + Khoa', color: 'blue' },
    HO_TEN_DUY_NHAT: { label: 'Khớp Tên duy nhất', color: 'purple' },
};

export default function RestoreFromMau02Modal({ open, onClose, onSuccess }: RestoreFromMau02ModalProps) {
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [updateExistingEmptyFields, setUpdateExistingEmptyFields] = useState(true);
    const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('create');

    const loadPreview = useCallback(async (includeEnrich: boolean) => {
        setLoadingPreview(true);
        setErrorText(null);
        try {
            const res = await fetch(`${getBasePath()}/api/practicing-certificates/restore-from-mau02`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'preview',
                    options: { updateExistingEmptyFields: includeEnrich },
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorText(data.error || 'Không thể kiểm tra dữ liệu Mẫu 02');
                setPreviewData(null);
                return;
            }
            setPreviewData(data as PreviewResponse);
            if (data.summary?.createCount > 0) {
                setActiveTab('create');
            } else if (data.summary?.updateCount > 0) {
                setActiveTab('update');
            } else if (data.summary?.unmatchedCount > 0) {
                setActiveTab('unmatched');
            }
        } catch (err) {
            console.error(err);
            setErrorText('Lỗi kết nối khi đọc dữ liệu Mẫu 02');
        } finally {
            setLoadingPreview(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            setSearchText('');
            loadPreview(updateExistingEmptyFields);
        }
    }, [open, updateExistingEmptyFields, loadPreview]);

    const handleExecuteRestore = async () => {
        setExecuting(true);
        try {
            const res = await fetch(`${getBasePath()}/api/practicing-certificates/restore-from-mau02`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'execute',
                    options: { updateExistingEmptyFields },
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Khôi phục thất bại');
                return;
            }
            const r = data.result;
            message.success(
                `Khôi phục thành công: Tạo mới ${r.createdCount} CCHN, bổ sung ${r.updatedCount} CCHN (giữ nguyên ${r.preservedExistingCount} CCHN ngoài Mẫu 02).`
            );
            onSuccess();
        } catch (err) {
            console.error(err);
            message.error('Lỗi kết nối khi khôi phục dữ liệu CCHN');
        } finally {
            setExecuting(false);
        }
    };

    const normalizedSearch = searchText.trim().toLowerCase();

    const filteredCandidates = useMemo(() => {
        const list = previewData?.candidates || [];
        if (!normalizedSearch) return list;
        return list.filter(
            (item) =>
                item.ma_nv.toLowerCase().includes(normalizedSearch) ||
                item.ho_ten.toLowerCase().includes(normalizedSearch) ||
                item.so_cchn.toLowerCase().includes(normalizedSearch) ||
                item.so_dinh_danh.toLowerCase().includes(normalizedSearch) ||
                item.ten_khoa.toLowerCase().includes(normalizedSearch)
        );
    }, [previewData, normalizedSearch]);

    const filteredUnmatched = useMemo(() => {
        const list = previewData?.unmatched || [];
        if (!normalizedSearch) return list;
        return list.filter(
            (item) =>
                item.ho_ten.toLowerCase().includes(normalizedSearch) ||
                item.so_cchn.toLowerCase().includes(normalizedSearch) ||
                item.so_dinh_danh.toLowerCase().includes(normalizedSearch) ||
                item.ten_khoa.toLowerCase().includes(normalizedSearch)
        );
    }, [previewData, normalizedSearch]);

    const createItems = useMemo(
        () => filteredCandidates.filter((c) => c.action === 'CREATE'),
        [filteredCandidates]
    );
    const updateItems = useMemo(
        () => filteredCandidates.filter((c) => c.action === 'UPDATE'),
        [filteredCandidates]
    );
    const skipItems = useMemo(
        () => filteredCandidates.filter((c) => c.action === 'SKIP'),
        [filteredCandidates]
    );

    const candidateColumns: ColumnsType<PreviewCandidateItem> = [
        {
            title: 'Mã NV',
            dataIndex: 'ma_nv',
            width: 95,
            render: (val: string) => <span className="font-mono font-semibold text-slate-700">{val}</span>,
        },
        {
            title: 'Họ và tên',
            dataIndex: 'ho_ten',
            width: 170,
            render: (val: string, record) => (
                <div>
                    <div className="font-medium text-slate-800">{val}</div>
                    <div className="text-xs text-slate-500">{record.ten_khoa}</div>
                </div>
            ),
        },
        {
            title: 'Cách ghép',
            dataIndex: 'matchMethod',
            width: 135,
            render: (method: MatchMethod, record) => {
                const cfg = MATCH_METHOD_LABELS[method];
                return (
                    <div>
                        <Tag color={cfg.color}>{cfg.label}</Tag>
                        {record.so_dinh_danh && (
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">{record.so_dinh_danh}</div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Số CCHN',
            dataIndex: 'so_cchn',
            width: 145,
            render: (val: string, record) => (
                <div>
                    <span className="font-mono font-medium text-purple-700">{val}</span>
                    <div className="text-xs text-slate-500">{record.ngay_cap || 'Chưa có ngày cấp'}</div>
                </div>
            ),
        },
        {
            title: 'Nơi cấp & Phạm vi CM',
            key: 'details',
            render: (_, record) => (
                <div className="space-y-1">
                    <div className="text-xs text-slate-600">{record.noi_cap_name || 'Chưa có nơi cấp'}</div>
                    <div className="flex flex-wrap gap-1">
                        {record.matchedScopes.slice(0, 6).map((code) => (
                            <Tag key={code} color="blue" className="m-0 text-[11px]">
                                {code}
                            </Tag>
                        ))}
                        {record.matchedScopes.length > 6 && (
                            <Tag className="m-0 text-[11px]">+{record.matchedScopes.length - 6} mã</Tag>
                        )}
                        {record.unknownScopes.length > 0 && (
                            <Tooltip title={`Mã chưa có trong danh mục Phạm vi CM: ${record.unknownScopes.join(', ')}`}>
                                <Tag color="orange" className="m-0 text-[11px]">
                                    <WarningOutlined /> {record.unknownScopes.length} mã lạ
                                </Tag>
                            </Tooltip>
                        )}
                    </div>
                    {record.action === 'UPDATE' && record.updatedFields.length > 0 && (
                        <div className="text-xs text-emerald-700 font-medium">
                            Bổ sung: {record.updatedFields.join(', ')}
                        </div>
                    )}
                </div>
            ),
        },
    ];

    const unmatchedColumns: ColumnsType<UnmatchedMau02Item> = [
        {
            title: 'Họ và tên (Mẫu 02)',
            dataIndex: 'ho_ten',
            width: 180,
            render: (val: string, record) => (
                <div>
                    <div className="font-medium text-slate-800">{val}</div>
                    <div className="text-xs text-slate-500">
                        {record.ten_khoa || record.ma_khoa || '-'}
                    </div>
                </div>
            ),
        },
        {
            title: 'Số định danh',
            dataIndex: 'so_dinh_danh',
            width: 130,
            render: (val: string) => <span className="font-mono text-xs">{val || '-'}</span>,
        },
        {
            title: 'Số CCHN',
            dataIndex: 'so_cchn',
            width: 145,
            render: (val: string) => <span className="font-mono text-purple-700">{val}</span>,
        },
        {
            title: 'Lý do chưa ghép tự động',
            dataIndex: 'reason',
            render: (val: string) => <span className="text-xs text-amber-700">{val}</span>,
        },
    ];

    const summary = previewData?.summary;
    const totalActionable = (summary?.createCount || 0) + (summary?.updateCount || 0);

    return (
        <Modal
            title={
                <Space>
                    <DatabaseOutlined className="text-emerald-600" />
                    <span>Khôi phục CCHN từ Danh mục Mẫu 02</span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            width={1020}
            footer={
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => loadPreview(updateExistingEmptyFields)}
                        disabled={loadingPreview || executing}
                    >
                        Kiểm tra lại
                    </Button>
                    <Space>
                        <Button onClick={onClose} disabled={executing}>
                            Đóng
                        </Button>
                        <Popconfirm
                            title="Xác nhận khôi phục CCHN từ Mẫu 02?"
                            description={`Hệ thống sẽ tạo mới ${summary?.createCount || 0} CCHN và bổ sung trường thiếu cho ${summary?.updateCount || 0} CCHN. Không xóa dữ liệu hiện có.`}
                            onConfirm={handleExecuteRestore}
                            okText="Khôi phục ngay"
                            cancelText="Hủy"
                            disabled={loadingPreview || executing || totalActionable === 0}
                        >
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                loading={executing}
                                disabled={loadingPreview || totalActionable === 0}
                            >
                                Xác nhận khôi phục ({totalActionable} CCHN)
                            </Button>
                        </Popconfirm>
                    </Space>
                </div>
            }
        >
            <div className="space-y-4">
                <Alert
                    type="info"
                    showIcon
                    message="Cơ chế ghép & bảo toàn dữ liệu hiện có"
                    description={
                        <div className="text-xs space-y-1">
                            <div>
                                Hệ thống đối chiếu <strong>Số định danh (CCCD)</strong> ở Mẫu 02 với hồ sơ nhân sự để khôi phục Số CCHN, Ngày cấp, Nơi cấp, Phạm vi chuyên môn và thời gian hành nghề.
                            </div>
                            <div>
                                <strong>An toàn:</strong> Các CCHN đã có (như các nhân sự vừa khai báo mới) được giữ nguyên; chỉ bổ sung các trường còn trống nếu bạn bật tùy chọn bên dưới. <em>Lưu ý: Mẫu 02 không lưu Nhóm phân quyền TT32 nên cột này không thể tự khôi phục.</em>
                            </div>
                        </div>
                    }
                />

                {errorText && <Alert type="error" showIcon message={errorText} />}

                {loadingPreview ? (
                    <div className="py-12 text-center">
                        <Spin tip="Đang đối chiếu dữ liệu Mẫu 02 với danh sách nhân sự..." />
                    </div>
                ) : (
                    summary && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="text-xs text-slate-500">Mẫu 02 có CCHN</div>
                                    <div className="text-lg font-bold text-slate-800">{summary.totalMau02WithCchn}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                    <div className="text-xs text-emerald-700">Sẽ Tạo mới</div>
                                    <div className="text-lg font-bold text-emerald-700">{summary.createCount}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                                    <div className="text-xs text-blue-700">Bổ sung trường thiếu</div>
                                    <div className="text-lg font-bold text-blue-700">{summary.updateCount}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                                    <div className="text-xs text-amber-700">Chưa khớp tự động</div>
                                    <div className="text-lg font-bold text-amber-700">{summary.unmatchedCount}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                                    <div className="text-xs text-purple-700">CCHN mới giữ nguyên</div>
                                    <div className="text-lg font-bold text-purple-700">{summary.preservedExistingCount}</div>
                                </div>
                            </div>

                            {summary.newNoiCapCategories.length > 0 && (
                                <Alert
                                    type="warning"
                                    showIcon
                                    icon={<ExclamationCircleOutlined />}
                                    message={`Sẽ tự tạo ${summary.newNoiCapCategories.length} danh mục Nơi cấp CCHN chưa có: ${summary.newNoiCapCategories.join(', ')}`}
                                />
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <Checkbox
                                    checked={updateExistingEmptyFields}
                                    onChange={(e) => setUpdateExistingEmptyFields(e.target.checked)}
                                >
                                    Bổ sung các trường còn trống (Ngày cấp, Nơi cấp, Phạm vi CM...) cho CCHN đã tồn tại
                                </Checkbox>
                                <Input
                                    placeholder="Lọc theo Mã NV, Họ tên, CCCD, Số CCHN..."
                                    prefix={<SearchOutlined className="text-slate-400" />}
                                    allowClear
                                    className="w-full sm:w-72"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                            </div>

                            <Tabs
                                type="card"
                                activeKey={activeTab}
                                onChange={setActiveTab}
                                items={[
                                    {
                                        key: 'create',
                                        label: `Tạo mới (${createItems.length})`,
                                        children: (
                                            <Table
                                                dataSource={createItems}
                                                columns={candidateColumns}
                                                rowKey="key"
                                                size="small"
                                                pagination={{ pageSize: 8, showSizeChanger: false }}
                                                scroll={{ x: 760 }}
                                            />
                                        ),
                                    },
                                    {
                                        key: 'update',
                                        label: `Bổ sung trường thiếu (${updateItems.length})`,
                                        children: (
                                            <Table
                                                dataSource={updateItems}
                                                columns={candidateColumns}
                                                rowKey="key"
                                                size="small"
                                                pagination={{ pageSize: 8, showSizeChanger: false }}
                                                scroll={{ x: 760 }}
                                            />
                                        ),
                                    },
                                    {
                                        key: 'unmatched',
                                        label: `Chưa khớp (${filteredUnmatched.length})`,
                                        children: (
                                            <Table
                                                dataSource={filteredUnmatched}
                                                columns={unmatchedColumns}
                                                rowKey="mau02Id"
                                                size="small"
                                                pagination={{ pageSize: 8, showSizeChanger: false }}
                                                scroll={{ x: 720 }}
                                            />
                                        ),
                                    },
                                    {
                                        key: 'skip',
                                        label: `Đã đầy đủ (${skipItems.length})`,
                                        children: (
                                            <Table
                                                dataSource={skipItems}
                                                columns={candidateColumns}
                                                rowKey="key"
                                                size="small"
                                                pagination={{ pageSize: 8, showSizeChanger: false }}
                                                scroll={{ x: 760 }}
                                            />
                                        ),
                                    },
                                ]}
                            />
                        </>
                    )
                )}
            </div>
        </Modal>
    );
}

