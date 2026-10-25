'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Tag, Popconfirm, message, Empty, Spin } from 'antd';
import {
    SafetyCertificateOutlined,
    PlusOutlined,
    DeleteOutlined,
    LaptopOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { startRegistration } from '@simplewebauthn/browser';

interface PasskeyItem {
    id: string;
    deviceName: string | null;
    deviceType: string | null;
    createdAt: string;
    lastUsedAt: string | null;
}

interface PasskeyManagementModalProps {
    open: boolean;
    onClose: () => void;
}

export default function PasskeyManagementModal({ open, onClose }: PasskeyManagementModalProps) {
    const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [deviceName, setDeviceName] = useState('');

    const fetchPasskeys = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/passkey/list');
            const data = await res.json();
            if (res.ok && data.passkeys) {
                setPasskeys(data.passkeys);
            }
        } catch (err) {
            console.error('Error fetching passkeys:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchPasskeys();
            // Default device name based on OS / Browser
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const defaultName = isMobile ? 'Điện thoại di động' : 'Máy tính làm việc';
            setDeviceName(defaultName);
        }
    }, [open]);

    const handleRegisterNewPasskey = async () => {
        if (!deviceName.trim()) {
            message.warning('Vui lòng đặt tên gợi nhớ cho thiết bị này');
            return;
        }

        setRegistering(true);
        try {
            // 1. Nhận options từ server
            const challengeRes = await fetch('/api/auth/passkey/register-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!challengeRes.ok) {
                const errData = await challengeRes.json();
                throw new Error(errData.error || 'Không thể khởi tạo đăng ký');
            }

            const options = await challengeRes.json();

            // 2. Kích hoạt WebAuthn prompt trên trình duyệt
            let regResponse;
            try {
                regResponse = await startRegistration({ optionsJSON: options });
            } catch (authError: any) {
                if (authError.name === 'NotAllowedError') {
                    message.info('Bạn đã hủy thao tác quét vân tay / FaceID.');
                    return;
                }
                throw authError;
            }

            // 3. Gửi response lên server để xác thực và lưu khóa
            const verifyRes = await fetch('/api/auth/passkey/register-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    response: regResponse,
                    deviceName: deviceName.trim()
                })
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                throw new Error(verifyData.error || 'Xác thực sinh trắc học thất bại');
            }

            message.success(verifyData.message || 'Đăng ký Sinh trắc học thành công!');
            setIsAddOpen(false);
            fetchPasskeys();
        } catch (err: any) {
            console.error('Passkey registration error:', err);
            message.error(err.message || 'Thiết bị không hỗ trợ hoặc xảy ra lỗi.');
        } finally {
            setRegistering(false);
        }
    };

    const handleDeletePasskey = async (id: string) => {
        try {
            const res = await fetch('/api/auth/passkey/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Không thể xóa thiết bị');
            }

            message.success('Đã hủy liên kết thiết bị!');
            fetchPasskeys();
        } catch (err: any) {
            message.error(err.message || 'Lỗi khi xóa thiết bị');
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                    <SafetyCertificateOutlined className="text-cyan-600 text-xl" />
                    <span>Bảo mật Sinh trắc học (Vân tay / FaceID / Passkey)</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={620}
            destroyOnHidden
        >
            <div className="space-y-4 pt-2">
                <div className="p-3.5 bg-cyan-50/80 border border-cyan-100 rounded-xl text-cyan-900 text-xs flex gap-2.5 items-start">
                    <InfoCircleOutlined className="text-cyan-600 text-base mt-0.5 shrink-0" />
                    <div>
                        <span className="font-bold">Đăng nhập nhanh 1 giây:</span> Sau khi đăng ký, bạn có thể đăng nhập bằng
                        chạm cảm biến vân tay, FaceID hoặc Windows Hello mà không cần nhập mật khẩu.
                        Dữ liệu sinh trắc học được lưu an toàn trong phần cứng của thiết bị bạn đang dùng.
                    </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div className="font-bold text-slate-700 text-sm">
                        Thiết bị đã liên kết ({passkeys.length})
                    </div>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        className="bg-cyan-600 hover:bg-cyan-700"
                        onClick={() => setIsAddOpen(true)}
                    >
                        Đăng ký thiết bị này
                    </Button>
                </div>

                {loading ? (
                    <div className="py-12 flex flex-col justify-center items-center gap-2.5">
                        <Spin size="default" />
                        <span className="text-slate-500 text-xs font-medium">Đang tải danh sách thiết bị...</span>
                    </div>
                ) : passkeys.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Chưa có thiết bị sinh trắc học nào được liên kết"
                        className="py-6"
                    >
                        <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => setIsAddOpen(true)}
                        >
                            Kích hoạt ngay trên thiết bị này
                        </Button>
                    </Empty>
                ) : (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {passkeys.map((item) => (
                            <div
                                key={item.id}
                                className="px-4 py-3 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:border-cyan-300 transition-all flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center text-lg font-bold">
                                        <LaptopOutlined />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <span>{item.deviceName || 'Thiết bị bảo mật'}</span>
                                            <Tag color="success" className="text-[10px] font-semibold border-none flex items-center gap-1">
                                                <CheckCircleOutlined /> Đang kích hoạt
                                            </Tag>
                                        </div>
                                        <div className="text-slate-400 text-xs mt-0.5">
                                            Đăng ký: {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                                            {item.lastUsedAt && (
                                                <span> • Dùng gần nhất: {new Date(item.lastUsedAt).toLocaleDateString('vi-VN')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Popconfirm
                                    title="Hủy liên kết thiết bị"
                                    description="Bạn có chắc chắn muốn xóa thiết bị sinh trắc học này không?"
                                    okText="Xóa"
                                    cancelText="Hủy"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => handleDeletePasskey(item.id)}
                                >
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        className="hover:bg-red-50"
                                    />
                                </Popconfirm>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sub-modal: Nhập tên thiết bị để đăng ký */}
                <Modal
                    title="Đăng ký Thiết bị Sinh trắc học"
                    open={isAddOpen}
                    onCancel={() => !registering && setIsAddOpen(false)}
                    onOk={handleRegisterNewPasskey}
                    confirmLoading={registering}
                    okText={registering ? "Đang quét..." : "Bắt đầu Quét Vân tay / FaceID"}
                    cancelText="Đóng"
                    okButtonProps={{ className: 'bg-cyan-600 hover:bg-cyan-700' }}
                >
                    <div className="py-3 space-y-3">
                        <p className="text-slate-600 text-sm">
                            Hệ thống sẽ gọi tính năng xác thực <strong>Windows Hello, Touch ID hoặc FaceID</strong> trên thiết bị của bạn.
                        </p>
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">
                                Tên gợi nhớ của thiết bị này:
                            </label>
                            <Input
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                                placeholder="Ví dụ: Laptop cá nhân, iPhone Khoa YHCT..."
                                maxLength={50}
                                disabled={registering}
                            />
                        </div>
                    </div>
                </Modal>
            </div>
        </Modal>
    );
}
