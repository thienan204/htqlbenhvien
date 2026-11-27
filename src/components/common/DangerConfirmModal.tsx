'use client';

import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Space, Typography } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined, HistoryOutlined, SafetyOutlined } from '@ant-design/icons';
import DeleteSnapshotManagerModal from './DeleteSnapshotManagerModal';

const { Text } = Typography;

export interface DangerConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    title: string;
    targetName: string;
    affectedCount?: number | null;
    cascadeWarning?: string;
    confirmKeyword?: string;
    okText?: string;
    loading?: boolean;
    autoSnapshotNote?: boolean;
    allowSnapshotManager?: boolean;
    onSnapshotRestored?: (tableName: string) => void;
}

/**
 * Modal xác nhận mức độ ĐỎ dùng chung cho các thao tác Xóa toàn bộ / Xóa hàng loạt / Xóa gây Cascade lớn.
 * Bắt buộc tick cam kết và gõ chính xác từ khóa xác nhận mới bật nút Xóa.
 */
export default function DangerConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    targetName,
    affectedCount,
    cascadeWarning,
    confirmKeyword = 'XOA TAT CA',
    okText = 'Xác nhận xóa vĩnh viễn',
    loading = false,
    autoSnapshotNote = true,
    allowSnapshotManager = true,
    onSnapshotRestored,
}: DangerConfirmModalProps) {
    const [checked, setChecked] = useState(false);
    const [typedText, setTypedText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setChecked(false);
            setTypedText('');
        }
    }, [open]);

    const normalizedExpected = confirmKeyword.trim().toUpperCase();
    const isMatched = typedText.trim().toUpperCase() === normalizedExpected;
    const canConfirm = checked && isMatched && !loading && !submitting;

    const handleSubmit = async () => {
        if (!canConfirm) return;
        setSubmitting(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Modal
                title={
                    <Space className="text-rose-600">
                        <ExclamationCircleOutlined />
                        <span>{title}</span>
                    </Space>
                }
                open={open}
                onCancel={onClose}
                width={580}
                footer={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            {allowSnapshotManager && (
                                <Button
                                    type="link"
                                    size="small"
                                    icon={<HistoryOutlined />}
                                    onClick={() => setSnapshotModalOpen(true)}
                                    className="px-0"
                                >
                                    Xem / dọn Snapshot đã lưu
                                </Button>
                            )}
                        </div>
                        <Space>
                            <Button onClick={onClose} disabled={loading || submitting}>
                                Hủy bỏ
                            </Button>
                            <Button
                                type="primary"
                                danger
                                icon={<DeleteOutlined />}
                                disabled={!canConfirm}
                                loading={loading || submitting}
                                onClick={handleSubmit}
                            >
                                {okText}
                            </Button>
                        </Space>
                    </div>
                }
            >
                <div className="space-y-4 py-1">
                    <Alert
                        type="error"
                        showIcon
                        title={
                            <span>
                                Sắp xóa dữ liệu: <strong>{targetName}</strong>
                                {typeof affectedCount === 'number' && (
                                    <span> ({affectedCount.toLocaleString('vi-VN')} bản ghi)</span>
                                )}
                            </span>
                        }
                        description={
                            <div className="text-xs space-y-1.5 mt-1">
                                <div>
                                    Thao tác này sẽ xóa toàn bộ dữ liệu thuộc phạm vi đã chọn. Vui lòng kiểm tra kỹ trước khi xác nhận.
                                </div>
                                {cascadeWarning && (
                                    <div className="font-semibold text-rose-700">
                                        Cảnh báo dữ liệu liên kết: {cascadeWarning}
                                    </div>
                                )}
                            </div>
                        }
                    />

                    {autoSnapshotNote && (
                        <Alert
                            type="info"
                            showIcon
                            icon={<SafetyOutlined />}
                            title="Bảo vệ tự động: Hệ thống sẽ chụp Snapshot JSON trước khi xóa"
                            description="Sau khi hoàn tất kiểm tra, bạn có thể tải về, khôi phục hoặc xóa dọn Snapshot tại mục Quản lý Snapshot."
                        />
                    )}

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                        <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)}>
                            <span className="text-sm font-medium text-slate-700">
                                Tôi đã kiểm tra kỹ và hiểu rõ phạm vi dữ liệu sẽ bị xóa.
                            </span>
                        </Checkbox>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-600">
                                Nhập chính xác cụm từ <Text code className="font-bold text-rose-600">{normalizedExpected}</Text> vào ô bên dưới để mở khóa nút xóa:
                            </div>
                            <Input
                                placeholder={`Gõ ${normalizedExpected} để xác nhận`}
                                value={typedText}
                                onChange={(e) => setTypedText(e.target.value)}
                                onPressEnter={handleSubmit}
                                status={typedText && !isMatched ? 'warning' : undefined}
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {allowSnapshotManager && (
                <DeleteSnapshotManagerModal
                    open={snapshotModalOpen}
                    onClose={() => setSnapshotModalOpen(false)}
                    onRestored={(tableName) => {
                        setSnapshotModalOpen(false);
                        onSnapshotRestored?.(tableName);
                    }}
                />
            )}
        </>
    );
}

