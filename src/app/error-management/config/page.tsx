'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Form, message, Breadcrumb, Card, Space, Drawer, Popconfirm, Tabs, InputNumber, Radio, Upload, Alert, Popover, Tooltip, Switch, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined, YoutubeOutlined, LinkOutlined, SendOutlined, QuestionCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { SoundConfig, playSoundByConfig, stopAllNotificationSounds, extractYouTubeId } from '@/utils/audioUtils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ITError {
    id: string; // Virtual ID for table key
    name: string;
    isVisible?: boolean;
}

export default function ITConfigPage() {
    const [softwareErrors, setSoftwareErrors] = useState<ITError[]>([]);
    const [hardwareErrors, setHardwareErrors] = useState<ITError[]>([]);
    const [activeTab, setActiveTab] = useState<string>('SOFTWARE');
    const [loading, setLoading] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingError, setEditingError] = useState<ITError | null>(null);
    const [form] = Form.useForm();
    const { user } = useAuth();
    
    // We also need to preserve the assignmentMode
    const [assignmentMode, setAssignmentMode] = useState<string>('A');
    const [maxConcurrentTasks, setMaxConcurrentTasks] = useState<number>(2);
    const [morningStartTime, setMorningStartTime] = useState<string>('07:00');
    const [morningEndTime, setMorningEndTime] = useState<string>('11:30');
    const [afternoonStartTime, setAfternoonStartTime] = useState<string>('13:30');
    const [afternoonEndTime, setAfternoonEndTime] = useState<string>('16:50');
    const [officeEndTime, setOfficeEndTime] = useState<string>('16:50');
    const [holidays, setHolidays] = useState<string[]>([]);
    const [makeupWorkdays, setMakeupWorkdays] = useState<string[]>([]);
    const [newHolidayInput, setNewHolidayInput] = useState<string>('');
    const [newMakeupInput, setNewMakeupInput] = useState<string>('');
    const [noStaffWarningEnabled, setNoStaffWarningEnabled] = useState<boolean>(true);
    const [noStaffWarningMessage, setNoStaffWarningMessage] = useState<string>('');
    const [maxImageSizeMB, setMaxImageSizeMB] = useState<number>(15);
    const [allowedFileExtensions, setAllowedFileExtensions] = useState<string>('.jpg, .jpeg, .png, .gif, .pdf, .docx, .xlsx, .doc, .xls, .zip, .rar');
    const [maBaLength, setMaBaLength] = useState<number>(11);
    const [telegramBotToken, setTelegramBotToken] = useState<string>('');
    const [telegramChatId, setTelegramChatId] = useState<string>('');
    const [testingTelegram, setTestingTelegram] = useState(false);
    const [personalTelegramId, setPersonalTelegramId] = useState<string>('');
    const [savingPersonal, setSavingPersonal] = useState(false);
    const [testingPersonal, setTestingPersonal] = useState(false);
    const [zaloEnabled, setZaloEnabled] = useState<boolean>(false);
    const [zaloWebhookUrl, setZaloWebhookUrl] = useState<string>('');
    const [testingZalo, setTestingZalo] = useState(false);
    const [notificationSound, setNotificationSound] = useState<SoundConfig>({
        type: 'DEFAULT',
        url: '',
        duration: 7,
        name: ''
    });
    const [isPlayingSound, setIsPlayingSound] = useState(false);

    const searchParams = useSearchParams();
    const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';

    const canAccess = user?.role === 'ADMIN' || user?.role === targetDepartment;
    const isAdmin = user?.role === 'ADMIN';
    const canManageErrors = user?.role === 'ADMIN' || user?.role === targetDepartment;

    useEffect(() => {
        fetchConfig();
        fetchMyProfile();
    }, []);

    const fetchMyProfile = async () => {
        try {
            const res = await fetch('/api/auth/profile');
            if (res.ok) {
                const data = await res.json();
                if (data.user?.telegram_id) {
                    setPersonalTelegramId(data.user.telegram_id);
                } else if ((user as any)?.telegram_id) {
                    setPersonalTelegramId((user as any).telegram_id);
                }
            }
        } catch (e) {
            if ((user as any)?.telegram_id) {
                setPersonalTelegramId((user as any).telegram_id);
            }
        }
    };

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/error-management/it-request-config?targetDepartment=${targetDepartment}`);
            if (res.ok) {
                const data = await res.json();
                const rawSoft = data.softwareErrorsConfig || data.softwareErrors || [];
                const mappedSoftwareErrors = rawSoft.map((err: any, index: number) => ({
                    id: typeof err === 'object' && err.id ? String(err.id) : `soft_${index}_${Date.now()}`,
                    name: typeof err === 'object' ? err.name : String(err),
                    isVisible: typeof err === 'object' && err.isVisible !== undefined ? Boolean(err.isVisible) : true
                }));
                const rawHard = data.hardwareErrorsConfig || data.hardwareErrors || [];
                const mappedHardwareErrors = rawHard.map((err: any, index: number) => ({
                    id: typeof err === 'object' && err.id ? String(err.id) : `hard_${index}_${Date.now()}`,
                    name: typeof err === 'object' ? err.name : String(err),
                    isVisible: typeof err === 'object' && err.isVisible !== undefined ? Boolean(err.isVisible) : true
                }));
                setSoftwareErrors(mappedSoftwareErrors);
                setHardwareErrors(mappedHardwareErrors);
                setAssignmentMode(data.assignmentMode || 'A');
                setMaxConcurrentTasks(data.maxConcurrentTasks !== undefined ? Number(data.maxConcurrentTasks) : 2);
                setMorningStartTime(data.morningStartTime || '07:00');
                setMorningEndTime(data.morningEndTime || '11:30');
                setAfternoonStartTime(data.afternoonStartTime || '13:30');
                const loadedAfternoonEnd = data.afternoonEndTime || data.officeEndTime || '16:50';
                setAfternoonEndTime(loadedAfternoonEnd);
                setOfficeEndTime(loadedAfternoonEnd);
                setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
                setMakeupWorkdays(Array.isArray(data.makeupWorkdays) ? data.makeupWorkdays : []);
                setNoStaffWarningEnabled(data.noStaffWarningEnabled !== undefined ? Boolean(data.noStaffWarningEnabled) : true);
                setNoStaffWarningMessage(data.noStaffWarningMessage || '');
                setMaxImageSizeMB(data.maxFileSizeMB || data.maxImageSizeMB || 15);
                setAllowedFileExtensions(data.allowedFileExtensions || '.jpg, .jpeg, .png, .gif, .pdf, .docx, .xlsx, .doc, .xls, .zip, .rar');
                setMaBaLength(data.maBaLength || 11);
                setTelegramBotToken(data.telegramBotToken || '');
                setTelegramChatId(data.telegramChatId || '');
                setZaloEnabled(Boolean(data.zaloEnabled));
                setZaloWebhookUrl(data.zaloWebhookUrl || '');
                if (data.notificationSound) {
                    setNotificationSound(data.notificationSound);
                }
            } else {
                message.error('Lỗi tải cấu hình');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    const saveErrorsConfig = async (newSoft: ITError[], newHard: ITError[]) => {
        try {
            const payload = {
                softwareErrorsConfig: newSoft.map(e => ({ name: e.name, isVisible: e.isVisible !== false })),
                hardwareErrorsConfig: newHard.map(e => ({ name: e.name, isVisible: e.isVisible !== false })),
                softwareErrors: newSoft.filter(e => e.isVisible !== false).map(e => e.name),
                hardwareErrors: newHard.filter(e => e.isVisible !== false).map(e => e.name),
                assignmentMode,
                maxImageSizeMB,
                targetDepartment
            };
            const res = await fetch(`/api/error-management/it-request-config?targetDepartment=${targetDepartment}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                message.error('Lỗi khi lưu cấu hình');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi lưu cấu hình');
        }
    };

    const handleMoveItem = async (index: number, direction: 'UP' | 'DOWN') => {
        const isSoftware = activeTab === 'SOFTWARE';
        const currentErrors = [...(isSoftware ? softwareErrors : hardwareErrors)];
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= currentErrors.length) return;

        const [movedItem] = currentErrors.splice(index, 1);
        currentErrors.splice(targetIndex, 0, movedItem);

        if (isSoftware) {
            setSoftwareErrors(currentErrors);
            await saveErrorsConfig(currentErrors, hardwareErrors);
        } else {
            setHardwareErrors(currentErrors);
            await saveErrorsConfig(softwareErrors, currentErrors);
        }
        message.success(`Đã đổi vị trí "${movedItem.name}"`);
    };

    const handleToggleVisibility = async (id: string, isVisible: boolean) => {
        const isSoftware = activeTab === 'SOFTWARE';
        const currentList = isSoftware ? softwareErrors : hardwareErrors;
        const targetItem = currentList.find(e => e.id === id);
        const updatedErrors = currentList.map(item => 
            item.id === id ? { ...item, isVisible } : item
        );

        if (isSoftware) {
            setSoftwareErrors(updatedErrors);
            await saveErrorsConfig(updatedErrors, hardwareErrors);
        } else {
            setHardwareErrors(updatedErrors);
            await saveErrorsConfig(softwareErrors, updatedErrors);
        }
        message.success(isVisible 
            ? `Đã hiện "${targetItem?.name || 'mục'}" ngoài trang tạo yêu cầu` 
            : `Đã ẩn "${targetItem?.name || 'mục'}" khỏi trang tạo yêu cầu`
        );
    };

    const handleSave = async (values: { name: string; isVisible?: boolean }) => {
        try {
            const isSoftware = activeTab === 'SOFTWARE';
            const currentErrors = isSoftware ? softwareErrors : hardwareErrors;
            let updatedErrors = [...currentErrors];
            const cleanName = values.name.trim();
            const isVisible = values.isVisible !== undefined ? values.isVisible : true;
            
            if (editingError) {
                // Update
                updatedErrors = updatedErrors.map((e: ITError) => e.id === editingError.id ? { 
                    ...e, 
                    name: cleanName,
                    isVisible
                } : e);
            } else {
                // Check duplicate
                if (updatedErrors.some((e: ITError) => e.name.toLowerCase() === cleanName.toLowerCase())) {
                    message.error('Lỗi này đã tồn tại!');
                    return;
                }
                // Add new
                updatedErrors.push({
                    id: `${isSoftware ? 'soft' : 'hard'}_${Date.now()}`,
                    name: cleanName,
                    isVisible
                });
            }

            const softToSave = isSoftware ? updatedErrors : softwareErrors;
            const hardToSave = !isSoftware ? updatedErrors : hardwareErrors;

            await saveErrorsConfig(softToSave, hardToSave);

            message.success('Lưu thành công');
            setIsDrawerOpen(false);
            form.resetFields();
            setEditingError(null);
            fetchConfig();
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const isSoftware = activeTab === 'SOFTWARE';
            const currentErrors = isSoftware ? softwareErrors : hardwareErrors;
            const updatedErrors = currentErrors.filter((e: ITError) => e.id !== id);

            const softToSave = isSoftware ? updatedErrors : softwareErrors;
            const hardToSave = !isSoftware ? updatedErrors : hardwareErrors;

            await saveErrorsConfig(softToSave, hardToSave);

            message.success('Xóa thành công');
            fetchConfig();
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleSaveGeneralConfig = async (soundToSave?: any) => {
        try {
            const currentSound = (soundToSave && typeof soundToSave === 'object' && 'type' in soundToSave) ? soundToSave : notificationSound;
            const payload = {
                softwareErrorsConfig: softwareErrors.map(e => ({ name: e.name, isVisible: e.isVisible !== false })),
                hardwareErrorsConfig: hardwareErrors.map(e => ({ name: e.name, isVisible: e.isVisible !== false })),
                softwareErrors: softwareErrors.filter(e => e.isVisible !== false).map((e: any) => e.name),
                hardwareErrors: hardwareErrors.filter(e => e.isVisible !== false).map((e: any) => e.name),
                assignmentMode,
                maxConcurrentTasks,
                morningStartTime: morningStartTime.trim() || '07:00',
                morningEndTime: morningEndTime.trim() || '11:30',
                afternoonStartTime: afternoonStartTime.trim() || '13:30',
                afternoonEndTime: (afternoonEndTime.trim() || officeEndTime.trim() || '16:50'),
                officeEndTime: (afternoonEndTime.trim() || officeEndTime.trim() || '16:50'),
                holidays,
                makeupWorkdays,
                noStaffWarningEnabled,
                noStaffWarningMessage: noStaffWarningMessage.trim(),
                maxImageSizeMB,
                maxFileSizeMB: maxImageSizeMB,
                allowedFileExtensions,
                maBaLength,
                targetDepartment,
                telegramBotToken,
                telegramChatId,
                zaloEnabled,
                zaloWebhookUrl: zaloWebhookUrl.trim(),
                notificationSound: currentSound
            };
            const res = await fetch(`/api/error-management/it-request-config?targetDepartment=${targetDepartment}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                localStorage.setItem(`${targetDepartment}_department_notification_sound`, JSON.stringify(currentSound));
                message.success('Đã lưu cấu hình chung thành công!');
            } else {
                message.error('Lỗi khi lưu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleTestTelegram = async () => {
        if (!telegramBotToken?.trim() || !telegramChatId?.trim()) {
            message.warning('Vui lòng nhập Bot Token và Chat ID trước khi kiểm tra');
            return;
        }
        setTestingTelegram(true);
        try {
            const res = await fetch('/api/error-management/it-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'TEST_TELEGRAM',
                    testBotToken: telegramBotToken.trim(),
                    testChatId: telegramChatId.trim(),
                    targetDepartment
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                message.success(data.message || 'Đã gửi tin nhắn thử nghiệm thành công! Hãy kiểm tra nhóm Telegram.');
            } else {
                message.error(data.error || 'Gửi thử nghiệm thất bại. Vui lòng kiểm tra lại Token hoặc Chat ID.');
            }
        } catch (e: any) {
            message.error('Lỗi kết nối khi gửi thử Telegram');
        } finally {
            setTestingTelegram(false);
        }
    };

    const handleSavePersonalTelegram = async () => {
        setSavingPersonal(true);
        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: user?.name || user?.username,
                    telegram_id: personalTelegramId.trim()
                })
            });
            if (res.ok) {
                message.success('Đã lưu Telegram ID cá nhân thành công!');
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi lưu Telegram ID cá nhân');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi lưu Telegram ID cá nhân');
        } finally {
            setSavingPersonal(false);
        }
    };

    const handleTestPersonalTelegram = async () => {
        if (!personalTelegramId?.trim()) {
            message.warning('Vui lòng nhập Telegram ID của bạn trước khi kiểm tra');
            return;
        }
        setTestingPersonal(true);
        try {
            const res = await fetch('/api/error-management/it-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'TEST_PERSONAL_TELEGRAM',
                    personalTelegramId: personalTelegramId.trim(),
                    targetDepartment
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                message.success(data.message || 'Đã gửi tin nhắn thử nghiệm vào Telegram riêng của bạn!');
            } else {
                message.error(data.error || 'Gửi thất bại. Hãy chắc chắn bạn đã bấm Start bot trên Telegram.');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi gửi thử Telegram cá nhân');
        } finally {
            setTestingPersonal(false);
        }
    };

    const handleTestZalo = async () => {
        if (!zaloWebhookUrl?.trim()) {
            message.warning('Vui lòng nhập Zalo Webhook URL trước khi kiểm tra');
            return;
        }
        setTestingZalo(true);
        try {
            const res = await fetch('/api/error-management/it-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'TEST_ZALO',
                    testWebhookUrl: zaloWebhookUrl.trim(),
                    targetDepartment
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                message.success(data.message || 'Đã gửi tin nhắn thử nghiệm thành công! Hãy kiểm tra nhóm Zalo.');
            } else {
                message.error(data.error || 'Gửi thử nghiệm thất bại. Vui lòng kiểm tra lại Webhook URL.');
            }
        } catch (e: any) {
            message.error('Lỗi kết nối khi gửi thử Zalo');
        } finally {
            setTestingZalo(false);
        }
    };

    const handleUploadDeptSound = (file: File) => {
        const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav');
        if (!isAudio) {
            message.error('Chỉ hỗ trợ file âm thanh (MP3, WAV)!');
            return false;
        }
        if (file.size / 1024 / 1024 > 3) {
            message.error('Dung lượng file tối đa là 3MB!');
            return false;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setNotificationSound((prev: SoundConfig) => ({
                ...prev,
                type: 'UPLOAD',
                url: base64,
                name: file.name
            }));
            message.success(`Đã chọn file: ${file.name}`);
        };
        reader.readAsDataURL(file);
        return false;
    };

    const handleTestSound = () => {
        if (isPlayingSound) {
            stopAllNotificationSounds();
            setIsPlayingSound(false);
            return;
        }
        if (notificationSound.type === 'YOUTUBE' && notificationSound.url && !extractYouTubeId(notificationSound.url)) {
            message.error('Link YouTube không hợp lệ!');
            return;
        }
        setIsPlayingSound(true);
        playSoundByConfig(notificationSound);
        setTimeout(() => {
            setIsPlayingSound(false);
        }, (notificationSound.duration || 7) * 1000);
    };

    const columns = [
        {
            title: 'STT',
            key: 'index',
            width: 70,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Tên lỗi',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: ITError) => (
                <div className="flex items-center gap-2">
                    <span className={record.isVisible === false ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'}>
                        {name}
                    </span>
                    {record.isVisible === false && (
                        <Tag color="default" className="text-[11px] font-normal">Đang ẩn</Tag>
                    )}
                </div>
            )
        },
        ...(canManageErrors ? [
            {
                title: 'Thứ tự',
                key: 'order',
                width: 100,
                align: 'center' as const,
                render: (_: any, record: ITError, index: number) => {
                    const currentList = activeTab === 'SOFTWARE' ? softwareErrors : hardwareErrors;
                    const isFirst = index === 0;
                    const isLast = index === currentList.length - 1;
                    return (
                        <Space size={4}>
                            <Tooltip title={isFirst ? 'Đang ở vị trí đầu tiên' : 'Đẩy lên trên'}>
                                <Button
                                    size="small"
                                    icon={<ArrowUpOutlined />}
                                    disabled={isFirst}
                                    onClick={() => handleMoveItem(index, 'UP')}
                                />
                            </Tooltip>
                            <Tooltip title={isLast ? 'Đang ở vị trí cuối cùng' : 'Đẩy xuống dưới'}>
                                <Button
                                    size="small"
                                    icon={<ArrowDownOutlined />}
                                    disabled={isLast}
                                    onClick={() => handleMoveItem(index, 'DOWN')}
                                />
                            </Tooltip>
                        </Space>
                    );
                }
            },
            {
                title: 'Hiển thị',
                key: 'isVisible',
                width: 110,
                align: 'center' as const,
                render: (_: any, record: ITError) => (
                    <Tooltip title={record.isVisible !== false ? 'Đang hiện ra ngoài cho khoa phòng chọn' : 'Đang ẩn khỏi màn hình tạo yêu cầu'}>
                        <Switch
                            size="small"
                            checked={record.isVisible !== false}
                            checkedChildren="Hiện"
                            unCheckedChildren="Ẩn"
                            onChange={(checked) => handleToggleVisibility(record.id, checked)}
                        />
                    </Tooltip>
                )
            },
            {
                title: 'Hành động',
                key: 'action',
                width: 120,
                align: 'center' as const,
                render: (_: any, record: ITError) => (
                    <Space size="middle">
                        <Tooltip title="Chỉnh sửa">
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => {
                                    setEditingError(record);
                                    form.setFieldsValue({ 
                                        name: record.name,
                                        isVisible: record.isVisible !== false
                                    });
                                    setIsDrawerOpen(true);
                                }}
                            />
                        </Tooltip>
                        <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDelete(record.id)}>
                            <Tooltip title="Xóa">
                                <Button icon={<DeleteOutlined />} danger />
                            </Tooltip>
                        </Popconfirm>
                    </Space>
                ),
            }
        ] : []),
    ];

    if (!canAccess) {
        return <div className="p-10 text-center text-red-500">Bạn không có quyền truy cập trang này.</div>;
    }

    const tabItems = [
        {
            key: 'SOFTWARE',
            label: 'Lỗi Phần mềm (BAĐT)',
            children: (
                <>
                    <div className="mb-4 text-slate-500 text-sm">
                        Danh sách các lỗi nghiệp vụ phần mềm (Ví dụ: Hủy ký số, Sai thông tin hành chính, ...) để các khoa phòng chọn nhanh khi báo lỗi. Dùng nút <b>⬆️ Lên / ⬇️ Xuống</b> để sắp xếp thứ tự và công tắc <b>Hiện / Ẩn</b> để hiển thị ra màn hình ngoài.
                    </div>
                    <Table
                        columns={columns}
                        dataSource={softwareErrors}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 50, showSizeChanger: true }}
                        bordered
                    />
                </>
            )
        },
        {
            key: 'HARDWARE',
            label: 'Lỗi Thiết bị / Sửa chữa',
            children: (
                <>
                    <div className="mb-4 text-slate-500 text-sm">
                        Danh sách các lỗi phần cứng, mạng, thiết bị (Ví dụ: Mất mạng, Kẹt giấy máy in, Lỗi chuột bàn phím, ...). Dùng nút <b>⬆️ Lên / ⬇️ Xuống</b> để sắp xếp thứ tự và công tắc <b>Hiện / Ẩn</b> để hiển thị ra màn hình ngoài.
                    </div>
                    <Table
                        columns={columns}
                        dataSource={hardwareErrors}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 50, showSizeChanger: true }}
                        bordered
                    />
                </>
            )
        },
        {
            key: 'GENERAL',
            label: 'Cấu hình chung',
            children: (
                <div className="space-y-6 w-full mt-4">
                    {!isAdmin && (
                        <Alert 
                            type="info"
                            showIcon
                            className="rounded-xl border-blue-200 bg-blue-50/80"
                            title={<span className="font-semibold text-blue-900">Quyền hạn tài khoản Kỹ thuật viên ({user?.role})</span>}
                            description={
                                <div className="text-xs text-slate-600 space-y-1 mt-0.5">
                                    <div>• Các cấu hình phân công công việc, khung giờ và bot chung do <b>Quản trị viên (ADMIN)</b> thiết lập.</div>
                                    <div>• Bạn chỉ cần kiểm tra và điền <b>Telegram ID cá nhân</b> của bạn tại mục bên dưới để nhận tin nhắn riêng khi được giao việc.</div>
                                </div>
                            }
                        />
                    )}
                    {/* Card 1: Chế độ phân công công việc (4 Tùy chọn) */}
                    <Card 
                        size="small" 
                        title={
                            <div className="flex items-center justify-between w-full">
                                <span className="font-semibold text-slate-800">Chế độ phân công công việc (4 Tùy chọn)</span>
                                <Popover 
                                    trigger="click"
                                    placement="bottomRight"
                                    title={<span className="font-bold text-blue-700">📘 Hướng dẫn chi tiết 4 chế độ phân công</span>}
                                    content={
                                        <div className="max-w-[490px] max-h-[75vh] overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed pr-1">
                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1">
                                                    🟢 1. Tự do nhận việc (Chế độ A)
                                                </div>
                                                <div className="text-slate-600 space-y-1">
                                                    <div>• <b>Cơ chế:</b> Ticket ở trạng thái chờ, không gán cho ai. Mọi nhân viên kỹ thuật đều thấy, ai rảnh thì tự bấm <i>"Nhận việc"</i>.</div>
                                                    <div>• <b>Lưu ý:</b> Dễ bị đùn đẩy hoặc các ca khó bị để lâu.</div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1">
                                                    🟡 2. Trưởng nhóm điều phối (Chế độ B)
                                                </div>
                                                <div className="text-slate-600 space-y-1">
                                                    <div>• <b>Cơ chế:</b> Ticket gửi lên nằm chờ, chỉ Admin hoặc Trưởng phòng mới có quyền bấm chỉ định người xử lý.</div>
                                                    <div>• <b>Lưu ý:</b> Phụ thuộc vào Trưởng phòng phải túc trực chia việc thủ công.</div>
                                                </div>
                                            </div>

                                            <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                                <div className="font-bold text-amber-900 text-xs mb-1">
                                                    ⚡ 3. Tự động - Phản ứng nhanh (Chế độ C)
                                                </div>
                                                <div className="text-slate-700 space-y-1">
                                                    <div>• <b>Cơ chế:</b> Đếm số việc đang dở dang (Chờ + Đang làm) của từng người. Ai đang có ít việc dở dang nhất sẽ nhận việc ngay để hỗ trợ khoa nhanh nhất.</div>
                                                </div>
                                            </div>

                                            <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                                                <div className="font-bold text-blue-900 text-xs mb-1 flex items-center justify-between">
                                                    <span>⚖️ 4. Tự động - Cân bằng công bằng (Chế độ D)</span>
                                                    <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded">Khuyên dùng</span>
                                                </div>
                                                <div className="text-slate-700 space-y-1">
                                                    <div>• <b>Cơ chế 2 tầng:</b> Ưu tiên người đang rảnh tay trước. Nếu có nhiều người cùng rảnh, so sánh tổng số việc đã nhận trong ca/ngày để chia đều việc, tránh người làm nhanh bị ôm đồm quá nhiều việc.</div>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <Button 
                                        type="link" 
                                        size="small" 
                                        icon={<QuestionCircleOutlined />} 
                                        className="text-blue-600 hover:text-blue-500 font-medium p-0 h-auto flex items-center gap-1"
                                    >
                                        Xem hướng dẫn
                                    </Button>
                                </Popover>
                            </div>
                        }
                        className="border border-slate-200"
                    >
                        <div className="flex flex-col gap-3">
                            <Radio.Group 
                                value={assignmentMode} 
                                onChange={e => setAssignmentMode(e.target.value)}
                                className="flex flex-col gap-2.5"
                                disabled={!isAdmin}
                            >
                                <Radio value="A">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-slate-700">1. Tự do nhận việc</span>
                                        <Tooltip title="Ticket không gán cho ai, mọi nhân viên đều thấy và tự chủ động bấm 'Nhận việc' khi rảnh">
                                            <QuestionCircleOutlined className="text-slate-400 text-xs hover:text-blue-500 cursor-pointer" />
                                        </Tooltip>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">Ticket gửi lên ở trạng thái chờ, nhân viên {targetDepartment} ai rảnh thì chủ động click "Nhận việc".</div>
                                </Radio>
                                <Radio value="B">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-slate-700">2. Trưởng nhóm điều phối</span>
                                        <Tooltip title="Chỉ Admin hoặc Trưởng phòng mới có quyền gán việc cho nhân viên, không tự động gán ai">
                                            <QuestionCircleOutlined className="text-slate-400 text-xs hover:text-blue-500 cursor-pointer" />
                                        </Tooltip>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">Ticket gửi lên không phân công ai. Chỉ Admin/Trưởng phòng mới có quyền gán việc cho nhân viên.</div>
                                </Radio>
                                <Radio value="C">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-slate-700">3. Tự động - Phản ứng nhanh (Tốc độ)</span>
                                        <Tooltip title="Đếm số việc dở dang (chờ + đang làm), ai đang rảnh tay nhất sẽ nhận việc ngay để hỗ trợ khoa">
                                            <QuestionCircleOutlined className="text-slate-400 text-xs hover:text-blue-500 cursor-pointer" />
                                        </Tooltip>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">Ưu tiên người ít việc dở dang nhất tại thời điểm đó để xử lý lỗi ngay cho khoa phòng.</div>
                                </Radio>
                                <Radio value="D">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-slate-700">4. Tự động - Cân bằng công bằng (2 tầng)</span>
                                        <span className="text-[10px] bg-green-100 text-green-700 font-medium px-1.5 py-0.2 rounded">Khuyên dùng</span>
                                        <Tooltip title="Ưu tiên người rảnh việc dở dang trước, kết hợp so sánh tổng số việc trong ca để chia đều, người làm nhanh không bị dồn việc">
                                            <QuestionCircleOutlined className="text-blue-500 text-xs hover:text-blue-600 cursor-pointer" />
                                        </Tooltip>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">Cân bằng 2 tầng: Vừa ưu tiên người rảnh, vừa so sánh tổng việc trong ca để chia đều công việc cho cả phòng.</div>
                                </Radio>
                            </Radio.Group>

                            {/* Cấu hình Giới hạn việc dở dang tối đa (khi chọn chế độ tự động C hoặc D) */}
                            {(assignmentMode === 'C' || assignmentMode === 'D') && (
                                <div className="mt-2 p-3 bg-amber-50/70 rounded-lg border border-amber-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                                            🛑 Giới hạn việc dở dang tối đa mỗi người:
                                            <Tooltip title="Nếu một nhân viên đang có số việc chưa xong chạm mức này, hệ thống sẽ KHÔNG chia thêm việc cho họ nữa để tránh quá tải">
                                                <QuestionCircleOutlined className="text-amber-600 cursor-pointer text-xs" />
                                            </Tooltip>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <InputNumber 
                                            min={1} 
                                            max={10} 
                                            value={maxConcurrentTasks} 
                                            onChange={val => setMaxConcurrentTasks(val || 2)}
                                            disabled={!isAdmin}
                                            className="w-24"
                                        />
                                        <span className="text-xs text-slate-600">việc dở dang / người (Khuyến nghị: 2 hoặc 3)</span>
                                    </div>
                                </div>
                            )}

                            {isAdmin && (
                                <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="w-fit mt-2 bg-blue-600 hover:bg-blue-500">
                                    Lưu chế độ phân công
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* Card 2: Cấu hình 2 Khung thời gian làm việc & Lịch trực */}
                    <Card 
                        size="small" 
                        title={<span className="font-semibold text-slate-800">Cấu hình 2 Khung thời gian: Hành chính & Giờ trực</span>}
                        extra={
                            isAdmin && (
                                <Button 
                                    size="small" 
                                    type="link" 
                                    onClick={() => {
                                        setMorningStartTime('07:00');
                                        setMorningEndTime('11:30');
                                        setAfternoonStartTime('13:30');
                                        setAfternoonEndTime('16:50');
                                        setOfficeEndTime('16:50');
                                        message.info('Đã khôi phục khung giờ về mặc định!');
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700 p-0 h-auto"
                                >
                                    Đặt lại mặc định
                                </Button>
                            )
                        }
                        className="border border-slate-200"
                    >
                        <div className="flex flex-col gap-3 text-xs">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Cột 1: Khung 1 - Giờ Hành chính */}
                                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col justify-between">
                                    <div>
                                        <div className="font-bold text-slate-800 text-xs mb-2.5 flex items-center justify-between">
                                            <span>🏢 Khung 1: Giờ Hành chính (Admin tùy chỉnh)</span>
                                            <span className="text-[10px] text-slate-400 font-normal">Định dạng HH:mm</span>
                                        </div>
                                        <div className="space-y-2.5">
                                            {/* Ca Sáng */}
                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-amber-500">☀️</span>
                                                    <span className="font-semibold text-slate-700 text-xs">Ca Sáng:</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        value={morningStartTime} 
                                                        onChange={e => setMorningStartTime(e.target.value)} 
                                                        disabled={!isAdmin}
                                                        placeholder="07:00" 
                                                        style={{ width: 75 }}
                                                        className="text-center font-bold text-blue-700 text-xs h-7 px-1 rounded-md"
                                                    />
                                                    <span className="text-slate-400 font-bold">-</span>
                                                    <Input 
                                                        value={morningEndTime} 
                                                        onChange={e => setMorningEndTime(e.target.value)} 
                                                        disabled={!isAdmin}
                                                        placeholder="11:30" 
                                                        style={{ width: 75 }}
                                                        className="text-center font-bold text-blue-700 text-xs h-7 px-1 rounded-md"
                                                    />
                                                </div>
                                            </div>

                                            {/* Ca Chiều */}
                                            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-orange-500">🌤️</span>
                                                        <span className="font-semibold text-slate-700 text-xs">Ca Chiều:</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">(Mốc giao ca ra về)</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        value={afternoonStartTime} 
                                                        onChange={e => setAfternoonStartTime(e.target.value)} 
                                                        disabled={!isAdmin}
                                                        placeholder="13:30" 
                                                        style={{ width: 75 }}
                                                        className="text-center font-bold text-blue-700 text-xs h-7 px-1 rounded-md"
                                                    />
                                                    <span className="text-slate-400 font-bold">-</span>
                                                    <Input 
                                                        value={afternoonEndTime} 
                                                        onChange={e => {
                                                            setAfternoonEndTime(e.target.value);
                                                            setOfficeEndTime(e.target.value);
                                                        }} 
                                                        disabled={!isAdmin}
                                                        placeholder="16:50" 
                                                        style={{ width: 75 }}
                                                        className="text-center font-bold text-blue-700 text-xs h-7 px-1 rounded-md"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-500 italic mt-2.5 pt-2 border-t border-slate-200/80">
                                        * Mặc định bệnh viện: Sáng <b>07:00 - 11:30</b>, Chiều <b>13:30 - 16:50</b>.
                                    </div>
                                </div>

                                {/* Cột 2: Khung 2 - Giờ Trực & Ngoài giờ */}
                                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col justify-between">
                                    <div>
                                        <div className="font-bold text-blue-900 text-xs mb-2.5 flex items-center justify-between">
                                            <span>🏥 Khung 2: Giờ Trực & Ngoài giờ</span>
                                            <span className="text-[10px] text-blue-600 bg-blue-100/70 px-1.5 py-0.5 rounded-full font-medium">Tự động liên thông</span>
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-center justify-between bg-white/90 p-2 rounded-lg border border-blue-100">
                                                <span className="font-medium text-slate-600">🍱 Trực Trưa:</span>
                                                <span className="font-bold text-blue-800">{morningEndTime || '11:30'} - {afternoonStartTime || '13:30'}</span>
                                            </div>
                                            <div className="flex items-center justify-between bg-white/90 p-2 rounded-lg border border-blue-100">
                                                <span className="font-medium text-slate-600">🌙 Trực Tối & Đêm:</span>
                                                <span className="font-bold text-indigo-700">{afternoonEndTime || '16:50'} - {morningStartTime || '07:00'} (sáng hôm sau)</span>
                                            </div>
                                            <div className="flex items-center justify-between bg-white/90 p-2 rounded-lg border border-blue-100">
                                                <span className="font-medium text-slate-600">🏖️ Thứ 7, CN, Ngày Lễ:</span>
                                                <span className="font-bold text-emerald-700">Trực 24/24 ({morningStartTime || '07:00'} - {morningStartTime || '07:00'})</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-blue-700 italic mt-2.5 pt-2 border-t border-blue-100">
                                        * Lúc <b>{afternoonEndTime || '16:50'}</b> mọi người tắt trạng thái ra về, hệ thống tự động gán việc cho Người trực đang bật trạng thái!
                                    </div>
                                </div>
                            </div>

                            {/* Ngày nghỉ lễ / Hoán đổi */}
                            <div className="pt-2 border-t border-slate-200">
                                <div className="font-semibold text-slate-800 mb-1 flex items-center justify-between">
                                    <span>Danh sách Ngày nghỉ Lễ / Tết / Hoán đổi (Tính là Giờ trực cả ngày):</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px] p-1.5 bg-slate-50 rounded border border-slate-200">
                                    {holidays.length === 0 ? (
                                        <span className="text-slate-400 italic text-[11px]">Chưa có ngày lễ nào được thiết lập.</span>
                                    ) : (
                                        holidays.map(day => (
                                            <Tag 
                                                key={day} 
                                                closable={isAdmin} 
                                                onClose={() => setHolidays(holidays.filter(d => d !== day))}
                                                color="red"
                                                className="text-xs"
                                            >
                                                {day}
                                            </Tag>
                                        ))
                                    )}
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Nhập ngày dạng YYYY-MM-DD (VD: 2026-04-30)"
                                            value={newHolidayInput}
                                            onChange={e => setNewHolidayInput(e.target.value)}
                                            className="text-xs w-60 h-7"
                                        />
                                        <Button 
                                            size="small"
                                            onClick={() => {
                                                const val = newHolidayInput.trim();
                                                if (val && /^\d{4}-\d{2}-\d{2}$/.test(val) && !holidays.includes(val)) {
                                                    setHolidays([...holidays, val]);
                                                    setNewHolidayInput('');
                                                } else {
                                                    message.warning('Vui lòng nhập đúng định dạng YYYY-MM-DD (Ví dụ: 2026-04-30)');
                                                }
                                            }}
                                        >
                                            + Thêm ngày nghỉ
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Ngày làm bù Thứ 7, CN */}
                            <div className="pt-2 border-t border-slate-200">
                                <div className="font-semibold text-slate-800 mb-1">
                                    Danh sách Ngày làm bù Thứ 7, CN (Tính là Giờ hành chính):
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px] p-1.5 bg-slate-50 rounded border border-slate-200">
                                    {makeupWorkdays.length === 0 ? (
                                        <span className="text-slate-400 italic text-[11px]">Chưa có ngày làm bù nào.</span>
                                    ) : (
                                        makeupWorkdays.map(day => (
                                            <Tag 
                                                key={day} 
                                                closable={isAdmin} 
                                                onClose={() => setMakeupWorkdays(makeupWorkdays.filter(d => d !== day))}
                                                color="green"
                                                className="text-xs"
                                            >
                                                {day}
                                            </Tag>
                                        ))
                                    )}
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Nhập ngày làm bù YYYY-MM-DD (VD: 2026-05-02)"
                                            value={newMakeupInput}
                                            onChange={e => setNewMakeupInput(e.target.value)}
                                            className="text-xs w-60 h-7"
                                        />
                                        <Button 
                                            size="small"
                                            onClick={() => {
                                                const val = newMakeupInput.trim();
                                                if (val && /^\d{4}-\d{2}-\d{2}$/.test(val) && !makeupWorkdays.includes(val)) {
                                                    setMakeupWorkdays([...makeupWorkdays, val]);
                                                    setNewMakeupInput('');
                                                } else {
                                                    message.warning('Vui lòng nhập đúng định dạng YYYY-MM-DD (Ví dụ: 2026-05-02)');
                                                }
                                            }}
                                        >
                                            + Thêm ngày bù
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {isAdmin && (
                                <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="w-fit mt-1 bg-blue-600 hover:bg-blue-500">
                                    Lưu Khung giờ & Lịch làm việc
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* Card 3: Cảnh báo Khoa/Phòng khi không có ai nhận việc */}
                    <Card 
                        size="small" 
                        title={
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">Cảnh báo Khoa/Phòng khi không có ai nhận việc</span>
                                    <Switch 
                                        checked={noStaffWarningEnabled} 
                                        onChange={checked => setNoStaffWarningEnabled(checked)} 
                                        checkedChildren="Bật" 
                                        unCheckedChildren="Tắt"
                                        disabled={!isAdmin}
                                    />
                                </div>
                                <Tooltip title="Khi Khoa gửi yêu cầu mà không có ai nhận (ngoài giờ hoặc không ai trực), hệ thống sẽ bật cảnh báo cho Khoa đồng thời bắn cảnh báo đỏ lên Telegram/Zalo">
                                    <QuestionCircleOutlined className="text-slate-400 text-xs cursor-pointer hover:text-blue-500" />
                                </Tooltip>
                            </div>
                        }
                        className="border border-slate-200"
                    >
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className="text-xs font-semibold text-slate-700 mb-1">
                                    Nội dung thông điệp cảnh báo hiển thị cho Khoa/Phòng:
                                </div>
                                <Input.TextArea 
                                    rows={3}
                                    value={noStaffWarningMessage}
                                    onChange={e => setNoStaffWarningMessage(e.target.value)}
                                    placeholder="Ví dụ: Hiện tại ngoài khung giờ hành chính / kỹ thuật viên đang bận ca trực ngoài viện nên chưa thể tiếp nhận ngay. Yêu cầu của Khoa/Phòng đã được lưu trên hệ thống và chuyển đến nhóm trực. Nếu là sự cố khẩn cấp, vui lòng gọi điện thoại trực ban..."
                                    disabled={!isAdmin}
                                    className="text-xs"
                                />
                                <div className="text-[11px] text-slate-400 mt-1 italic">
                                    * Thông điệp này sẽ hiện lên màn hình Khoa/Phòng khi họ gửi yêu cầu mà không có nhân viên kỹ thuật nào tiếp nhận.
                                </div>
                            </div>
                            {isAdmin && (
                                <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="w-fit bg-blue-600 hover:bg-blue-500">
                                    Lưu nội dung cảnh báo
                                </Button>
                            )}
                        </div>
                    </Card>

                    <Card size="small" title="Cấu hình Tệp đính kèm & Dung lượng (Ảnh / File)" className="border border-slate-200">
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className="text-xs font-semibold text-slate-700 mb-1">Dung lượng tối đa mỗi tệp:</div>
                                <div className="flex gap-2 items-center">
                                    <InputNumber 
                                        min={1} 
                                        max={100} 
                                        value={maxImageSizeMB} 
                                        onChange={val => setMaxImageSizeMB(val || 15)} 
                                        disabled={user?.role !== 'ADMIN'}
                                    />
                                    <span className="text-slate-500 font-medium">MB</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1">Dung lượng tối đa cho mỗi file hoặc ảnh tải lên. Khuyến nghị 15MB - 30MB.</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-700 mb-1">Danh sách đuôi file được phép đính kèm:</div>
                                <Input 
                                    value={allowedFileExtensions}
                                    onChange={e => setAllowedFileExtensions(e.target.value)}
                                    placeholder=".jpg, .jpeg, .png, .pdf, .docx, .xlsx, .zip..."
                                    disabled={user?.role !== 'ADMIN'}
                                    className="text-xs"
                                />
                                <div className="text-[11px] text-slate-500 mt-1">Các đuôi file viết cách nhau bởi dấu phẩy. Mặc định hỗ trợ ảnh, tài liệu văn phòng và file nén.</div>
                            </div>
                            {user?.role === 'ADMIN' && (
                                <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="w-fit mt-1">Lưu cấu hình tệp</Button>
                            )}
                        </div>
                    </Card>

                    <Card size="small" title="Độ dài Mã Bệnh Án (BA)" className="border border-slate-200">
                        <div className="flex gap-2 items-center">
                            <InputNumber 
                                min={6} 
                                max={30} 
                                value={maBaLength} 
                                onChange={val => setMaBaLength(val || 11)} 
                                disabled={user?.role !== 'ADMIN'}
                            />
                            <span className="text-slate-500 font-medium">ký tự</span>
                            {user?.role === 'ADMIN' && (
                                <Button type="default" onClick={() => handleSaveGeneralConfig()}>Lưu thay đổi</Button>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 mt-2">Độ dài chuẩn của mã bệnh án (Ví dụ: <code>BA001028282</code> là 11 ký tự). Sau này khi bệnh viện tăng độ dài mã BA (12, 13 ký tự...), bạn có thể điều chỉnh tại đây để hệ thống tự động nhận diện và kiểm soát độ dài phù hợp.</div>
                    </Card>

                    <Card 
                        size="small" 
                        title={
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">Cấu hình Thông báo Telegram</span>
                                <Popover 
                                    trigger="click"
                                    placement="bottomRight"
                                    title={<span className="font-bold text-blue-700">📘 Hướng dẫn thiết lập Bot Telegram</span>}
                                    content={
                                        <div className="max-w-[480px] max-h-[70vh] overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed pr-1">
                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1">
                                                    1️⃣ Bước 1: Tạo Bot Telegram & lấy <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">Bot Token</code>
                                                </div>
                                                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                                                    <li>Mở Telegram, tìm tài khoản: <b>@BotFather</b> (có tích xanh).</li>
                                                    <li>Bấm <b>Start</b> và gửi lệnh: <code>/newbot</code></li>
                                                    <li>Nhập tên hiển thị (VD: <code>Bot CNTT BV Đa Khoa Lạng Sơn</code>).</li>
                                                    <li>Nhập username cho Bot (phải kết thúc bằng chữ <code>bot</code>, VD: <code>bvdkls_it_bot</code>).</li>
                                                    <li>Sao chép mã <b>HTTP API Token</b> (dạng <code>8587756206:AAHYxJXL3...</code>) và dán vào ô <b>Bot Token</b>.</li>
                                                </ul>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1">
                                                    2️⃣ Bước 2: Lấy <code className="text-purple-600 bg-purple-50 px-1 py-0.5 rounded">Chat ID</code> của Nhóm CNTT
                                                </div>
                                                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                                                    <li>Tạo nhóm Telegram cho phòng CNTT (hoặc dùng nhóm hiện có).</li>
                                                    <li>Thêm Bot vừa tạo vào nhóm và cấp quyền Quản trị viên (Admin).</li>
                                                    <li>Thêm bot <b>@getmyid_bot</b> vào nhóm để lấy ID.</li>
                                                    <li>Nhìn dòng <b>Current chat ID</b> (thường có dấu trừ ở đầu, VD: <code>-1002345678901</code>).</li>
                                                    <li>Sao chép toàn bộ ID này (kể cả dấu <code>-</code>) và dán vào ô <b>Chat ID</b>. Sau đó có thể xóa <code>@getmyid_bot</code> ra khỏi nhóm.</li>
                                                </ul>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1">
                                                    3️⃣ Bước 3: Lấy Telegram ID cá nhân cho nhân viên (để nhận tin riêng 1-1)
                                                </div>
                                                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                                                    <li>Từng nhân viên mở Telegram, tìm <b>@getmyid_bot</b> và bấm <b>Start</b> để lấy <b>Your user ID</b> (VD: <code>123456789</code>).</li>
                                                    <li>Vào mục <b>Quản lý tài khoản</b> trên web, điền số ID này vào ô <b>Telegram ID</b> của nhân viên.</li>
                                                    <li><i>Lưu ý:</i> Nhân viên cần mở Bot ở Bước 1 và bấm <b>Start</b> ít nhất 1 lần để Bot có quyền gửi tin riêng.</li>
                                                </ul>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1">
                                                    4️⃣ Bước 4: Kiểm tra gửi thử nghiệm
                                                </div>
                                                <div className="text-slate-600">
                                                    Bấm nút <b>"Lưu cấu hình Bot"</b> rồi bấm <b>"🧪 Gửi tin nhắn thử nghiệm (Test Bot)"</b>. Bot sẽ gửi một tin nhắn mẫu kèm nút bấm link trực tiếp vào nhóm Telegram để bạn kiểm tra!
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <Button 
                                        type="link" 
                                        size="small" 
                                        icon={<QuestionCircleOutlined />} 
                                        className="text-blue-600 hover:text-blue-500 font-medium p-0 h-auto flex items-center gap-1"
                                    >
                                        Hướng dẫn thiết lập
                                    </Button>
                                </Popover>
                            </div>
                        }
                        className="border border-slate-200"
                    >
                        <div className="flex flex-col gap-4">
                            <div>
                                <div className="text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span>Bot Token</span>
                                        <Tooltip title="Mã Token nhận được từ @BotFather sau khi tạo bot">
                                            <QuestionCircleOutlined className="text-slate-400 text-xs cursor-pointer hover:text-blue-500" />
                                        </Tooltip>
                                    </div>
                                    <span className="text-xs text-slate-400 font-normal">Từ @BotFather (Chỉ Admin sửa)</span>
                                </div>
                                <Input 
                                    placeholder="Ví dụ: 8587756206:AAHYxJXL37jmpJfPu1mVupK1AYDxeUOsLr8" 
                                    value={telegramBotToken} 
                                    onChange={e => setTelegramBotToken(e.target.value)} 
                                    disabled={user?.role !== 'ADMIN'}
                                />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span>Chat ID Nhóm chung của Phòng</span>
                                        <Tooltip title="ID nhóm Telegram lấy từ @getmyid_bot (bắt đầu bằng dấu trừ - để gửi cho cả phòng)">
                                            <QuestionCircleOutlined className="text-slate-400 text-xs cursor-pointer hover:text-blue-500" />
                                        </Tooltip>
                                    </div>
                                    <span className="text-xs text-slate-400 font-normal">ID nhóm có dấu âm (-)</span>
                                </div>
                                <Input 
                                    placeholder="Ví dụ: -1002345678901 (Nhóm chat của phòng)" 
                                    value={telegramChatId} 
                                    onChange={e => setTelegramChatId(e.target.value)} 
                                    disabled={user?.role !== 'ADMIN'}
                                />
                            </div>

                            {user?.role === 'ADMIN' ? (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="bg-blue-600 hover:bg-blue-500">
                                        Lưu cấu hình Bot & Nhóm
                                    </Button>
                                    <Button 
                                        type="default" 
                                        icon={<SendOutlined />}
                                        loading={testingTelegram}
                                        onClick={handleTestTelegram}
                                        className="border-green-600 text-green-700 hover:text-green-800 hover:border-green-700 bg-green-50"
                                    >
                                        🧪 Gửi tin nhắn thử nghiệm nhóm (Test Bot)
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-[11px] text-slate-400 italic">
                                    * Bot Token và Chat ID Nhóm chung do Quản trị viên (ADMIN) thiết lập.
                                </div>
                            )}

                            {/* Khu vực cấu hình Telegram Cá nhân của Kỹ thuật viên */}
                            <div className="mt-1 pt-3 border-t border-slate-200 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="font-semibold text-blue-900 text-sm flex items-center gap-1.5">
                                        <span>👤 Telegram Cá nhân của bạn ({user?.name || user?.username})</span>
                                        <Tooltip title="Khi có phiếu hỗ trợ được phân công cho bạn, Bot sẽ tự động bắn tin nhắn riêng cho bạn">
                                            <QuestionCircleOutlined className="text-blue-500 text-xs cursor-pointer" />
                                        </Tooltip>
                                    </div>
                                    <span className="text-[11px] bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">Nhận việc cá nhân</span>
                                </div>
                                <p className="text-xs text-slate-600 mb-2.5">
                                    Điền <b>User ID Telegram</b> của bạn (lấy từ <b>@getmyid_bot</b>) để nhận tin nhắn riêng 1-1 từ Bot mỗi khi được giao việc mới.
                                </p>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <Input 
                                        placeholder="Ví dụ: 2123748615 (ID cá nhân của bạn)" 
                                        value={personalTelegramId} 
                                        onChange={e => setPersonalTelegramId(e.target.value)} 
                                        className="flex-1 bg-white font-mono"
                                    />
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            type="primary" 
                                            loading={savingPersonal}
                                            onClick={handleSavePersonalTelegram} 
                                            className="bg-blue-600 hover:bg-blue-500 whitespace-nowrap"
                                        >
                                            💾 Lưu ID của tôi
                                        </Button>
                                        <Button 
                                            type="default" 
                                            icon={<SendOutlined />}
                                            loading={testingPersonal}
                                            onClick={handleTestPersonalTelegram}
                                            className="border-green-600 text-green-700 hover:text-green-800 bg-white whitespace-nowrap"
                                        >
                                            🧪 Gửi thử cho tôi
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Cấu hình Nhóm Zalo */}
                    <Card 
                        size="small" 
                        title={
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">Cấu hình Thông báo Nhóm Zalo</span>
                                    <Switch 
                                        checked={zaloEnabled} 
                                        onChange={checked => setZaloEnabled(checked)} 
                                        checkedChildren="Bật" 
                                        unCheckedChildren="Tắt"
                                        disabled={user?.role !== 'ADMIN'}
                                    />
                                </div>
                                <Popover 
                                    trigger="click"
                                    placement="bottomRight"
                                    title={<span className="font-bold text-blue-700">📘 Hướng dẫn chi tiết tạo Zalo Webhook cho Nhóm</span>}
                                    content={
                                        <div className="max-w-[500px] max-h-[75vh] overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed pr-1">
                                            <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                                                <div className="font-bold text-blue-900 text-xs mb-1">
                                                    💡 Cơ chế hoạt động (Không tốn phí tin ZNS theo lượt)
                                                </div>
                                                <div className="text-slate-700 leading-relaxed">
                                                    Hệ thống gửi dữ liệu thông báo qua cổng <b>Zalo Webhook</b> để đẩy tin nhắn vào <b>Nhóm Zalo chung</b> của bộ phận kỹ thuật.
                                                    Tất cả thành viên trong nhóm Zalo đều nhận được thông báo ngay lập tức khi:
                                                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-600">
                                                        <li>Có yêu cầu mới được gửi từ Khoa/Phòng</li>
                                                        <li>Khoa/Phòng bấm nút hối thúc xử lý (Ping)</li>
                                                        <li>Khoa/Phòng gửi tin nhắn phản hồi trong ticket</li>
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1.5 flex items-center justify-between">
                                                    <span>🌟 Cách 1: Qua nền tảng Chatbot (Dễ nhất - Miễn phí)</span>
                                                    <span className="text-[10px] bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded">Khuyên dùng</span>
                                                </div>
                                                <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                                                    <li>
                                                        <b>Tạo Nick Zalo phụ:</b> Dùng 1 SĐT tạo nick Zalo tên là <i>"Bot Thông Báo BV"</i>, sau đó thêm nick này vào <b>Nhóm Zalo</b> của phòng bạn.
                                                    </li>
                                                    <li>
                                                        <b>Đăng ký dịch vụ:</b> Truy cập <a href="https://fchat.vn" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">fchat.vn</a> hoặc <a href="https://ahachat.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">ahachat.com</a> (miễn phí).
                                                    </li>
                                                    <li>
                                                        <b>Kết nối Zalo:</b> Vào mục <b>Kết nối Zalo cá nhân</b>, dùng app Zalo quét mã QR để đăng nhập Nick Zalo phụ đó.
                                                    </li>
                                                    <li>
                                                        <b>Lấy Webhook URL:</b> Vào mục <b>Cài đặt / Tích hợp Webhook (API)</b> ➔ Chọn hành động <i>"Gửi tin nhắn vào Nhóm Zalo"</i> (chọn đúng nhóm đã thêm bot).
                                                    </li>
                                                    <li>
                                                        <b>Dán vào phần mềm:</b> Sao chép đường link Webhook URL nhận được (dạng <code>https://fchat.vn/api/webhook/...</code>) và dán vào ô <b>Zalo Webhook URL</b> bên dưới.
                                                    </li>
                                                </ol>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1.5">
                                                    🛡️ Cách 2: Tự dựng Bot Zalo nội bộ (Dành cho CNTT - 100% Nội bộ)
                                                </div>
                                                <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                                                    <li>
                                                        Phòng CNTT chạy service mini Bot Zalo (dùng NodeJS với thư viện mã nguồn mở <code>zca-js</code> hoặc <code>zalo-api</code>).
                                                    </li>
                                                    <li>
                                                        Quét mã QR đăng nhập tài khoản Zalo thông báo 1 lần (service tự động lưu phiên).
                                                    </li>
                                                    <li>
                                                        Script mở cổng HTTP Endpoint nội bộ, ví dụ: <code>http://192.168.1.X:5001/send-zalo?groupId=ID_NHOM</code>.
                                                    </li>
                                                    <li>
                                                        Dán link này vào ô cấu hình. Toàn bộ thông báo sẽ truyền trực tiếp trong mạng nội bộ bệnh viện.
                                                    </li>
                                                </ol>
                                            </div>

                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                <div className="font-bold text-slate-800 text-xs mb-1.5">
                                                    🏢 Cách 3: Zalo Doanh nghiệp (Zalo OA chính ngạch)
                                                </div>
                                                <div className="text-slate-600 space-y-1">
                                                    <div>Nếu viện có tài khoản Zalo OA Doanh nghiệp, vào <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">developers.zalo.me</a> ➔ Tạo ứng dụng ➔ Lấy Webhook Endpoint.</div>
                                                    <div className="text-amber-700 text-[11px]"><i>Lưu ý:</i> Zalo OA có tính phí theo lượt tin nhắn (ZNS) theo quy định của Zalo.</div>
                                                </div>
                                            </div>

                                            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                                                <div className="font-bold text-emerald-800 text-xs mb-1">
                                                    ⚡ Kiểm tra gửi thử nghiệm
                                                </div>
                                                <div className="text-slate-600">
                                                    Sau khi dán link, bật công tắc <b>"Bật"</b>, bấm <b>"Lưu cấu hình Zalo"</b> rồi bấm nút <b>"⚡ Gửi tin nhắn thử nghiệm (Test Zalo)"</b> để kiểm tra tin nhắn mẫu bắn vào nhóm Zalo.
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <Button 
                                        type="link" 
                                        size="small" 
                                        icon={<QuestionCircleOutlined />} 
                                        className="text-blue-600 hover:text-blue-500 font-medium p-0 h-auto flex items-center gap-1"
                                    >
                                        Hướng dẫn thiết lập
                                    </Button>
                                </Popover>
                            </div>
                        }
                        className="border border-slate-200"
                    >
                        <div className="flex flex-col gap-4">
                            <div>
                                <div className="text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span>Zalo Webhook URL</span>
                                        <Tooltip title="Đường link webhook đẩy tin nhắn vào nhóm Zalo">
                                            <QuestionCircleOutlined className="text-slate-400 text-xs cursor-pointer hover:text-blue-500" />
                                        </Tooltip>
                                    </div>
                                    <span className="text-xs text-slate-400 font-normal">Endpoint HTTP/HTTPS</span>
                                </div>
                                <Input 
                                    placeholder="Ví dụ: https://webhook.yourdomain.com/zalo-notify hoặc webhook Zalo Bot" 
                                    value={zaloWebhookUrl} 
                                    onChange={e => setZaloWebhookUrl(e.target.value)} 
                                    disabled={user?.role !== 'ADMIN'}
                                />
                            </div>

                            {user?.role === 'ADMIN' && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="bg-blue-600 hover:bg-blue-500">
                                        Lưu cấu hình Zalo
                                    </Button>
                                    <Button 
                                        type="default" 
                                        icon={<SendOutlined />}
                                        loading={testingZalo}
                                        onClick={handleTestZalo}
                                        className="border-blue-600 text-blue-700 hover:text-blue-800 hover:border-blue-700 bg-blue-50"
                                    >
                                        ⚡ Gửi tin nhắn thử nghiệm (Test Zalo)
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )
        },
        {
            key: 'SOUND',
            label: 'Nhạc chuông chung (Khoa/Phòng)',
            children: (
                <div className="space-y-6 w-full mt-4">
                    <Alert 
                        type="info" 
                        showIcon 
                        title="Nhạc chuông cảnh báo chung cho toàn phòng" 
                        description="Đây là âm thanh mặc định khi có yêu cầu mới hoặc nhắc nhở chưa nhận việc. Tất cả tài khoản trong khoa/phòng sẽ nghe chuông này trừ khi cá nhân tự cài chuông riêng."
                        className="mb-4"
                    />

                    <Card size="small" title="Chọn loại âm thanh chung" className="border border-slate-200">
                        <Radio.Group 
                            value={notificationSound.type} 
                            onChange={e => setNotificationSound((prev: SoundConfig) => ({ ...prev, type: e.target.value }))}
                            className="flex flex-col gap-3"
                            disabled={user?.role !== 'ADMIN' && user?.role !== targetDepartment}
                        >
                            <Radio value="DEFAULT">
                                <span className="font-medium text-slate-700">Âm thanh "Ting" mặc định của hệ thống</span>
                                <div className="text-xs text-slate-500">Phát âm thanh tổng hợp trực tiếp bằng Web Audio API nhẹ nhàng, nhanh chóng.</div>
                            </Radio>
                            <Radio value="UPLOAD">
                                <span className="font-medium text-slate-700">Tải lên tệp âm thanh (MP3, WAV)</span>
                                <div className="text-xs text-slate-500">Tải file âm thanh chuông báo riêng của phòng ban (Tối đa 3MB).</div>
                            </Radio>
                            <Radio value="DIRECT_URL">
                                <span className="font-medium text-slate-700">Link âm thanh trực tiếp (Direct Audio URL)</span>
                                <div className="text-xs text-slate-500">Dán đường link chứa file .mp3 / .wav trực tuyến.</div>
                            </Radio>
                            <Radio value="YOUTUBE">
                                <span className="font-medium text-slate-700">Link YouTube (Nhạc chuông từ YouTube)</span>
                                <div className="text-xs text-slate-500">Dán link video/bài hát YouTube. Hệ thống sẽ phát âm thanh và tự ngắt sau số giây cài đặt.</div>
                            </Radio>
                        </Radio.Group>

                        <div className="mt-4 pt-4 border-t border-slate-100">
                            {notificationSound.type === 'UPLOAD' && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <Upload beforeUpload={handleUploadDeptSound} showUploadList={false} accept="audio/*">
                                            <Button icon={<UploadOutlined />}>Chọn tệp âm thanh</Button>
                                        </Upload>
                                        {notificationSound.name && (
                                            <span className="text-sm text-green-600 font-medium">Đã chọn: {notificationSound.name}</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400">Hỗ trợ định dạng MP3, WAV. Dung lượng tối đa 3MB.</div>
                                </div>
                            )}

                            {notificationSound.type === 'DIRECT_URL' && (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-slate-700">Đường dẫn file MP3/WAV:</div>
                                    <Input 
                                        prefix={<LinkOutlined className="text-slate-400" />}
                                        placeholder="https://example.com/sound.mp3"
                                        value={notificationSound.url}
                                        onChange={e => setNotificationSound((prev: SoundConfig) => ({ ...prev, url: e.target.value }))}
                                    />
                                    <div className="text-xs text-slate-400">Ví dụ: đường link âm thanh từ host nội bộ hoặc các trang cung cấp chuông online.</div>
                                </div>
                            )}

                            {notificationSound.type === 'YOUTUBE' && (
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-slate-700">Đường dẫn YouTube:</div>
                                    <Input 
                                        prefix={<YoutubeOutlined className="text-red-500" />}
                                        placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                                        value={notificationSound.url}
                                        onChange={e => setNotificationSound((prev: SoundConfig) => ({ ...prev, url: e.target.value }))}
                                    />
                                    <div className="text-xs text-slate-400">Hỗ trợ link máy tính, link rút gọn youtu.be, Shorts. Hệ thống tự động trích xuất video để phát ngầm.</div>
                                </div>
                            )}

                            {notificationSound.type !== 'DEFAULT' && (
                                <div className="mt-4 flex items-center gap-3">
                                    <span className="text-sm text-slate-700 font-medium">Thời lượng phát chuông:</span>
                                    <InputNumber 
                                        min={3} 
                                        max={30} 
                                        value={notificationSound.duration || 7} 
                                        onChange={val => setNotificationSound((prev: SoundConfig) => ({ ...prev, duration: val || 7 }))}
                                    />
                                    <span className="text-sm text-slate-500">giây (tự dừng sau số giây này)</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                            <Button 
                                icon={isPlayingSound ? <StopOutlined /> : <PlayCircleOutlined />} 
                                onClick={handleTestSound}
                                danger={isPlayingSound}
                            >
                                {isPlayingSound ? 'Dừng nghe thử' : 'Nghe thử âm thanh'}
                            </Button>
                            {isAdmin && (
                                <Button type="primary" onClick={() => handleSaveGeneralConfig()}>
                                    Lưu nhạc chuông chung
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-6 pt-12">
            <div className="max-w-[1200px] mx-auto space-y-6">
                <Breadcrumb items={[
                    { title: <Link href="/"><HomeOutlined /> Trang chủ</Link> }, 
                    { title: <Link href={`/error-management/${targetDepartment === 'CNTT' ? 'it' : targetDepartment.toLowerCase()}-requests`}>Quản lý Yêu cầu {targetDepartment}</Link> }, 
                    { title: 'Cấu hình Danh mục Lỗi' }
                ]} />

                <Card
                    title={<span className="text-xl font-bold text-slate-800">Cấu hình Danh Mục Yêu cầu - {targetDepartment}</span>}
                    extra={
                        canManageErrors ? (
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                setEditingError(null);
                                form.resetFields();
                                form.setFieldsValue({ isVisible: true });
                                setIsDrawerOpen(true);
                            }}>
                                Thêm lỗi mới
                            </Button>
                        ) : null
                    }
                >
                    <Tabs type="card" activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
                </Card>

                <Drawer
                    title={editingError ? "Cập nhật Lỗi" : "Thêm mới Lỗi"}
                    size="large"
                    onClose={() => setIsDrawerOpen(false)}
                    open={isDrawerOpen}
                    extra={
                        <Space>
                            <Button onClick={() => setIsDrawerOpen(false)}>Hủy</Button>
                            <Button type="primary" onClick={() => form.submit()}>Lưu</Button>
                        </Space>
                    }
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <Form.Item
                            name="name"
                            label="Tên lỗi (Hiển thị cho Khoa phòng)"
                            rules={[
                                { required: true, message: 'Vui lòng nhập tên lỗi' },
                                { whitespace: true, message: 'Tên lỗi không được bỏ trống' }
                            ]}
                        >
                            <Input placeholder="Ví dụ: Lấy lại bệnh nhân..." autoFocus />
                        </Form.Item>
                        <Form.Item
                            name="isVisible"
                            label="Trạng thái hiển thị ngoài màn hình tạo"
                            valuePropName="checked"
                            initialValue={true}
                        >
                            <Switch checkedChildren="Hiện ra ngoài cho khoa phòng chọn" unCheckedChildren="Ẩn khỏi màn hình tạo yêu cầu" />
                        </Form.Item>
                    </Form>
                </Drawer>
            </div>
        </div>
    );
}
