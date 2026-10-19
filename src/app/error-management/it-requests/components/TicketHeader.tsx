import React, { useState, useEffect } from 'react';
import { Button, Switch, Popconfirm, Popover, Input } from 'antd';
import { PlusOutlined, BugOutlined, SettingOutlined, DeleteOutlined, AimOutlined, ShopOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface TicketHeaderProps {
    user: any;
    isAdmin: boolean;
    isAvailable: boolean;
    togglingAvailability: boolean;
    onToggleAvailability: (checked: boolean) => void;
    onCreateRequest: () => void;
    onOpenSettings: () => void;
    onDeleteAll?: () => void;
    targetDepartment?: string;
    autoAssignDisabled?: boolean;
    focusReason?: string;
    togglingFocusMode?: boolean;
    onToggleFocusMode?: (disabled: boolean, reason?: string) => void;
}

export const TicketHeader: React.FC<TicketHeaderProps> = ({
    user,
    isAdmin,
    isAvailable,
    togglingAvailability,
    onToggleAvailability,
    onCreateRequest,
    onOpenSettings,
    onDeleteAll,
    targetDepartment = 'CNTT',
    autoAssignDisabled = false,
    focusReason = '',
    togglingFocusMode = false,
    onToggleFocusMode
}) => {
    const [focusPopoverOpen, setFocusPopoverOpen] = useState(false);
    const [reasonInput, setReasonInput] = useState(focusReason);

    useEffect(() => {
        setReasonInput(focusReason);
    }, [focusReason]);
    const isVTYT = targetDepartment === 'VTYT';
    const isHCQT = targetDepartment === 'HCQT';
    
    let title = 'Quản lý yêu cầu CNTT';
    if (isVTYT) title = 'Quản lý yêu cầu Vật tư Y tế';
    if (isHCQT) title = 'Quản lý yêu cầu Hành chính Quản trị';
    
    let description = 'Quản lý các ticket hỗ trợ gửi lên phòng CNTT';
    if (isVTYT) description = 'Quản lý các ticket hỗ trợ gửi lên phòng Vật tư Y tế';
    if (isHCQT) description = 'Quản lý các ticket hỗ trợ gửi lên phòng Hành chính Quản trị';
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                    <BugOutlined />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 m-0">{title}</h1>
                    <p className="text-sm sm:text-base text-slate-500 m-0">{description}</p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center mt-4 sm:mt-0">
                {(user?.role === targetDepartment || user?.role === 'ADMIN') && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 px-4 py-2 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg border border-slate-200 w-full sm:w-auto">
                            <span className="text-sm font-medium text-slate-600">Trạng thái Nhận việc:</span>
                            <Switch 
                                checked={isAvailable}
                                loading={togglingAvailability}
                                onChange={onToggleAvailability}
                                checkedChildren="Bật"
                                unCheckedChildren="Tắt"
                            />
                        </div>

                        {/* Chế độ tập trung (Tự động tạo phiếu và miễn chia việc tự động) */}
                        {onToggleFocusMode && (
                            <Popover
                                trigger="click"
                                open={focusPopoverOpen}
                                onOpenChange={setFocusPopoverOpen}
                                placement="bottomRight"
                                title={
                                    <div className="font-semibold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                                        <AimOutlined className="text-amber-500 text-base" /> Chế độ tập trung
                                    </div>
                                }
                                content={
                                    <div className="w-96 space-y-3 py-1">
                                        <p className="text-xs text-slate-500 m-0 leading-relaxed">
                                            Khi bật, hệ thống sẽ <strong>miễn phân công tự động</strong> việc mới từ khoa phòng và <strong>tự động tạo một Yêu cầu</strong> để bạn theo dõi tiến độ.
                                        </p>
                                        <div>
                                            <label className="text-xs font-medium text-slate-700 block mb-1">Nhiệm vụ / Công việc tập trung:</label>
                                            <Input.TextArea 
                                                placeholder="Ví dụ: Triển khai EMR, Cài máy chủ PACS..." 
                                                value={reasonInput}
                                                onChange={(e) => setReasonInput(e.target.value)}
                                                rows={3}
                                                showCount
                                                style={{ resize: 'vertical' }}
                                                className="rounded-lg text-xs"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                            <Button size="small" onClick={() => setFocusPopoverOpen(false)}>Đóng</Button>
                                            {autoAssignDisabled ? (
                                                <Button 
                                                    size="small" 
                                                    type="primary" 
                                                    danger
                                                    loading={togglingFocusMode}
                                                    onClick={() => {
                                                        onToggleFocusMode?.(false, '');
                                                        setFocusPopoverOpen(false);
                                                    }}
                                                >
                                                    Tắt & Nhận việc lại
                                                </Button>
                                            ) : (
                                                <Button 
                                                    size="small" 
                                                    type="primary" 
                                                    loading={togglingFocusMode}
                                                    className="bg-amber-500 hover:bg-amber-600 border-amber-500 text-white"
                                                    onClick={() => {
                                                        onToggleFocusMode?.(true, reasonInput);
                                                        setFocusPopoverOpen(false);
                                                    }}
                                                >
                                                    Bật tập trung & Tạo yêu cầu
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                }
                            >
                                <button
                                    type="button"
                                    className={`px-3 py-1.5 rounded-xl sm:rounded-lg border text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-all shadow-sm ${
                                        autoAssignDisabled
                                            ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/20'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                                    }`}
                                    title="Chế độ tập trung - Miễn nhận việc tự động và tự tạo yêu cầu theo dõi"
                                >
                                    <AimOutlined className={autoAssignDisabled ? 'text-amber-600 text-base animate-pulse' : 'text-slate-400 text-base'} />
                                    <span>
                                        {autoAssignDisabled 
                                            ? (focusReason ? `🎯 Tập trung: ${focusReason}` : '🎯 Đang tập trung')
                                            : '🎯 Chế độ tập trung'
                                        }
                                    </span>
                                </button>
                            </Popover>
                        )}

                        <Button 
                            icon={<SettingOutlined />} 
                            onClick={onOpenSettings} 
                            title="Cài đặt cảnh báo"
                            size="large"
                            className="text-slate-500 hover:text-blue-500"
                        />
                    </div>
                )}
                {isAdmin && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Link href={`/error-management/config?targetDepartment=${targetDepartment}`} className="w-full sm:w-auto">
                            <Button 
                                type="default" 
                                size="large" 
                                icon={<SettingOutlined />} 
                                className="w-full text-slate-600 border-slate-200 hover:text-blue-600 hover:border-blue-400"
                            >
                                Cấu hình
                            </Button>
                        </Link>
                        {onDeleteAll && user?.role === 'ADMIN' && (
                            <Popconfirm
                                title="Xóa toàn bộ dữ liệu"
                                description="Bạn có chắc chắn muốn xóa toàn bộ Yêu cầu xử lý không? Hành động này không thể hoàn tác!"
                                onConfirm={onDeleteAll}
                                okText="Xóa tất cả"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                            >
                                <Button 
                                    danger 
                                    size="large" 
                                    icon={<DeleteOutlined />} 
                                    className="w-full sm:w-auto"
                                >
                                    Xóa tất cả
                                </Button>
                            </Popconfirm>
                        )}
                    </div>
                )}
                {(user?.role === targetDepartment || user?.role === 'ADMIN') && (
                    <Link href={`/error-management/vendor-tasks?targetDepartment=${targetDepartment}`} className="w-full sm:w-auto">
                        <Button 
                            type="default"
                            size="large"
                            icon={<ShopOutlined />}
                            className="w-full font-medium text-amber-700 bg-amber-50/80 border-amber-300 hover:bg-amber-100 hover:border-amber-400"
                        >
                            🏢 Việc gửi ngoài
                        </Button>
                    </Link>
                )}
                <Button className="w-full sm:w-auto" type="primary" size="large" icon={<PlusOutlined />} onClick={onCreateRequest}>
                    Tạo Yêu Cầu
                </Button>
            </div>
        </div>
    );
};
