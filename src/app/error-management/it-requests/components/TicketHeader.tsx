import React from 'react';
import { Button, Switch } from 'antd';
import { PlusOutlined, BugOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface TicketHeaderProps {
    user: any;
    isAdmin: boolean;
    isAvailable: boolean;
    togglingAvailability: boolean;
    onToggleAvailability: (checked: boolean) => void;
    onCreateRequest: () => void;
    onOpenSettings: () => void;
}

export const TicketHeader: React.FC<TicketHeaderProps> = ({
    user,
    isAdmin,
    isAvailable,
    togglingAvailability,
    onToggleAvailability,
    onCreateRequest,
    onOpenSettings
}) => {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                    <BugOutlined />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Yêu cầu xử lý của khoa phòng</h1>
                    <p className="text-sm sm:text-base text-slate-500 m-0">Quản lý các ticket hỗ trợ gửi lên phòng CNTT</p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center mt-4 sm:mt-0">
                {user?.role === 'CNTT' && (
                    <div className="flex items-center gap-2">
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
                        <Button 
                            icon={<SettingOutlined />} 
                            onClick={onOpenSettings} 
                            title="Cài đặt cảnh báo"
                            size="large"
                            className="text-slate-500 hover:text-blue-500"
                        />
                    </div>
                )}
                {user?.role === 'ADMIN' && (
                    <Link href="/error-management/config" className="w-full sm:w-auto">
                        <Button 
                            type="default" 
                            size="large" 
                            icon={<SettingOutlined />} 
                            className="w-full text-slate-600 border-slate-200 hover:text-blue-600 hover:border-blue-400"
                        >
                            Cấu hình Lỗi phần mềm
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
