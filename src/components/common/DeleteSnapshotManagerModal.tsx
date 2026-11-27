'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Input,
    Modal,
    Popconfirm,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    ClearOutlined,
    DeleteOutlined,
    DownloadOutlined,
    HistoryOutlined,
    ReloadOutlined,
    RollbackOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBasePath } from '@/utils/config';

export interface DeleteSnapshotItem {
    id: string;
    tableName: string;
    displayName: string;
    actionType: string;
    filterSummary: string | null;
    recordCount: number;
    rawSizeBytes: number;
    restorable: boolean;
    deletedById: string | null;
    deletedByName: string | null;
    deletedByRole: string | null;
    restoredAt: string | null;
    restoredByName: string | null;
    createdAt: string;
}

interface DeleteSnapshotPanelProps {
    active?: boolean;
    onRestored?: (tableName: string) => void;
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    DELETE_ALL: { label: 'Xóa toàn bộ', color: 'red' },
    BULK_DELETE: { label: 'Xóa hàng loạt', color: 'orange' },
    SYNC_OVERWRITE: { label: 'Đồng bộ ghi đè', color: 'blue' },
};

/**
 * Bảng quản lý, tải JSON, khôi phục và xóa dọn các bản Snapshot đã tự động chụp trước khi xóa
 */
export function DeleteSnapshotPanel({ active = true, onRestored }: DeleteSnapshotPanelProps) {
    const [snapshots, setSnapshots] = useState<DeleteSnapshotItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [clearingAll, setClearingAll] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filterTable, setFilterTable] = useState<string | undefined>(undefined);

    const fetchSnapshots = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/admin/delete-snapshots`);
            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Không thể tải danh sách Snapshot');
                return;
            }
            setSnapshots(data.snapshots || []);
        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối khi tải danh sách Snapshot');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (active) {
            fetchSnapshots();
        }
    }, [active, fetchSnapshots]);

    const handleDownloadJson = (item: DeleteSnapshotItem) => {
        const url = `${getBasePath()}/api/admin/delete-snapshots?id=${encodeURIComponent(item.id)}&download=true`;
        window.open(url, '_blank');
    };

    const handleRestore = async (item: DeleteSnapshotItem) => {
        setRestoringId(item.id);
        try {
            const res = await fetch(`${getBasePath()}/api/admin/delete-snapshots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id }),
            });
            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Khôi phục thất bại');
                return;
            }
            const countsSummary = Object.entries((data.restoredCounts || {}) as Record<string, number>)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            message.success(`Khôi phục thành công (${countsSummary || 'hoàn tất'}).`);
            await fetchSnapshots();
            onRestored?.(item.tableName);
        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối khi khôi phục');
        } finally {
            setRestoringId(null);
        }
    };

    const handleDeleteOne = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`${getBasePath()}/api/admin/delete-snapshots?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Xóa Snapshot thất bại');
                return;
            }
            message.success('Đã xóa bản Snapshot khỏi CSDL.');
            setSnapshots((prev) => prev.filter((s) => s.id !== id));
        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối khi xóa Snapshot');
        } finally {
            setDeletingId(null);
        }
    };

    const handleClearAllSnapshots = async () => {
        setClearingAll(true);
        try {
            const res = await fetch(
                `${getBasePath()}/api/admin/delete-snapshots?deleteAll=true&confirmDeleteAll=true`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (!res.ok) {
                message.error(data.error || 'Không thể xóa toàn bộ Snapshot');
                return;
            }
            message.success(data.message || 'Đã xóa sạch tất cả Snapshot.');
            setSnapshots([]);
        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối khi dọn Snapshot');
        } finally {
            setClearingAll(false);
        }
    };

    const tableOptions = useMemo(() => {
        const uniq = Array.from(new Set(snapshots.map((s) => s.tableName)));
        return uniq.map((name) => ({ label: name, value: name }));
    }, [snapshots]);

    const filtered = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        return snapshots.filter((item) => {
            if (filterTable && item.tableName !== filterTable) return false;
            if (!q) return true;
            return (
                item.tableName.toLowerCase().includes(q) ||
                item.displayName.toLowerCase().includes(q) ||
                (item.deletedByName || '').toLowerCase().includes(q) ||
                (item.filterSummary || '').toLowerCase().includes(q)
            );
        });
    }, [snapshots, filterTable, searchText]);

    const totalRawBytes = useMemo(
        () => snapshots.reduce((sum, item) => sum + (item.rawSizeBytes || 0), 0),
        [snapshots]
    );

    const columns: ColumnsType<DeleteSnapshotItem> = [
        {
            title: 'Thời điểm sao lưu',
            dataIndex: 'createdAt',
            width: 155,
            render: (val: string) => (
                <span className="font-mono text-xs text-slate-700">
                    {dayjs(val).format('DD/MM/YYYY HH:mm:ss')}
                </span>
            ),
        },
        {
            title: 'Bảng dữ liệu & Phạm vi',
            key: 'table',
            render: (_, record) => (
                <div className="space-y-0.5">
                    <div className="font-medium text-slate-800">{record.displayName}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Tag className="m-0 font-mono">{record.tableName}</Tag>
                        <span className="text-slate-500">{record.filterSummary || 'Toàn bộ'}</span>
                    </div>
                </div>
            ),
        },
        {
            title: 'Thao tác & Người thực hiện',
            key: 'actor',
            width: 195,
            render: (_, record) => {
                const cfg = ACTION_LABELS[record.actionType] || { label: record.actionType, color: 'default' };
                return (
                    <div className="space-y-1">
                        <Tag color={cfg.color} className="m-0">
                            {cfg.label}
                        </Tag>
                        <div className="text-xs text-slate-600">
                            {record.deletedByName || 'Hệ thống'}{' '}
                            {record.deletedByRole ? `(${record.deletedByRole})` : ''}
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Quy mô',
            key: 'size',
            width: 130,
            render: (_, record) => (
                <div className="text-xs">
                    <div className="font-semibold text-slate-800">
                        {record.recordCount.toLocaleString('vi-VN')} dòng
                    </div>
                    <div className="text-slate-500">JSON: {formatBytes(record.rawSizeBytes)}</div>
                </div>
            ),
        },
        {
            title: 'Trạng thái khôi phục',
            key: 'status',
            width: 160,
            render: (_, record) =>
                record.restoredAt ? (
                    <div className="text-xs text-emerald-700">
                        <div>Đã khôi phục: {dayjs(record.restoredAt).format('DD/MM HH:mm')}</div>
                        {record.restoredByName && <div>Bởi: {record.restoredByName}</div>}
                    </div>
                ) : (
                    <span className="text-xs text-slate-400">Chưa khôi phục</span>
                ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 245,
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Tải file Snapshot JSON gốc về máy">
                        <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadJson(record)}
                        >
                            Tải JSON
                        </Button>
                    </Tooltip>

                    {record.restorable && (
                        <Popconfirm
                            title="Khôi phục dữ liệu từ Snapshot này?"
                            description="Hệ thống sẽ nạp lại các bản ghi bị thiếu (giữ nguyên dữ liệu mới đang có)."
                            onConfirm={() => handleRestore(record)}
                            okText="Khôi phục"
                            cancelText="Hủy"
                        >
                            <Button
                                size="small"
                                type="primary"
                                ghost
                                icon={<RollbackOutlined />}
                                loading={restoringId === record.id}
                            >
                                Khôi phục
                            </Button>
                        </Popconfirm>
                    )}

                    <Popconfirm
                        title="Xóa bản Snapshot này?"
                        description="Chỉ xóa bản sao lưu dự phòng để giải phóng dung lượng CSDL."
                        onConfirm={() => handleDeleteOne(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            loading={deletingId === record.id}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <Alert
                type="info"
                showIcon
                title="Sao lưu tự động trước khi Xóa toàn bộ / Ghi đè"
                description="Mỗi khi ADMIN thực hiện Xóa tất cả hoặc Đồng bộ ghi đè, hệ thống tự động chụp Snapshot JSON nén vào CSDL (tối đa 15.000 dòng / 10 MB). Sau khi kiểm tra công việc ổn định, bạn có thể bấm Xóa tại đây để giải phóng dung lượng."
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Space wrap>
                    <Input
                        placeholder="Tìm bảng, người thao tác..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        allowClear
                        className="w-60"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    <Select
                        placeholder="Lọc theo bảng"
                        allowClear
                        className="w-48"
                        options={tableOptions}
                        value={filterTable}
                        onChange={(val) => setFilterTable(val)}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchSnapshots} loading={loading}>
                        Làm mới
                    </Button>
                </Space>

                <Space>
                    <span className="text-xs text-slate-500">
                        Tổng: <strong>{snapshots.length}</strong> bản ({formatBytes(totalRawBytes)} JSON gốc)
                    </span>
                    {snapshots.length > 0 && (
                        <Popconfirm
                            title="Xóa toàn bộ các bản Snapshot sao lưu?"
                            description="Hành động này chỉ xóa các bản sao lưu dự phòng (không ảnh hưởng dữ liệu chính đang chạy). Tiếp tục?"
                            onConfirm={handleClearAllSnapshots}
                            okText="Xóa hết Snapshot"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button danger icon={<ClearOutlined />} loading={clearingAll}>
                                Dọn sạch Snapshot
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            </div>

            <Table
                dataSource={filtered}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="small"
                scroll={{ x: 920 }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
            />
        </div>
    );
}

interface DeleteSnapshotManagerModalProps {
    open: boolean;
    onClose: () => void;
    onRestored?: (tableName: string) => void;
}

export default function DeleteSnapshotManagerModal({
    open,
    onClose,
    onRestored,
}: DeleteSnapshotManagerModalProps) {
    return (
        <Modal
            title={
                <Space>
                    <HistoryOutlined className="text-blue-600" />
                    <span>Quản lý Snapshot Sao lưu trước khi xóa</span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            width={1060}
            footer={
                <Button onClick={onClose}>Đóng</Button>
            }
        >
            <DeleteSnapshotPanel active={open} onRestored={onRestored} />
        </Modal>
    );
}

