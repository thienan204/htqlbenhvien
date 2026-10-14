'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Form, message, Breadcrumb, Card, Space, Drawer, Popconfirm, Tabs, InputNumber, Radio, Upload, Alert, Popover, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined, YoutubeOutlined, LinkOutlined, SendOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { SoundConfig, playSoundByConfig, stopAllNotificationSounds, extractYouTubeId } from '@/utils/audioUtils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ITError {
    id: string; // Virtual ID for table key
    name: string;
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
    const [maxImageSizeMB, setMaxImageSizeMB] = useState<number>(10);
    const [maBaLength, setMaBaLength] = useState<number>(11);
    const [telegramBotToken, setTelegramBotToken] = useState<string>('');
    const [telegramChatId, setTelegramChatId] = useState<string>('');
    const [testingTelegram, setTestingTelegram] = useState(false);
    const [notificationSound, setNotificationSound] = useState<SoundConfig>({
        type: 'DEFAULT',
        url: '',
        duration: 7,
        name: ''
    });
    const [isPlayingSound, setIsPlayingSound] = useState(false);

    const searchParams = useSearchParams();
    const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';

    const isAdmin = user?.role === 'ADMIN' || user?.role === targetDepartment;

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/error-management/it-request-config?targetDepartment=${targetDepartment}`);
            if (res.ok) {
                const data = await res.json();
                const mappedSoftwareErrors = (data.softwareErrors || []).map((err: string, index: number) => ({
                    id: `soft_${index}_${Date.now()}`,
                    name: err
                }));
                const mappedHardwareErrors = (data.hardwareErrors || []).map((err: string, index: number) => ({
                    id: `hard_${index}_${Date.now()}`,
                    name: err
                }));
                setSoftwareErrors(mappedSoftwareErrors);
                setHardwareErrors(mappedHardwareErrors);
                setAssignmentMode(data.assignmentMode || 'A');
                setMaxImageSizeMB(data.maxImageSizeMB || 10);
                setMaBaLength(data.maBaLength || 11);
                setTelegramBotToken(data.telegramBotToken || '');
                setTelegramChatId(data.telegramChatId || '');
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

    const handleSave = async (values: { name: string }) => {
        try {
            const isSoftware = activeTab === 'SOFTWARE';
            const currentErrors = isSoftware ? softwareErrors : hardwareErrors;
            let updatedErrors = [...currentErrors];
            const cleanName = values.name.trim();
            
            if (editingError) {
                // Update
                updatedErrors = updatedErrors.map((e: any) => e.id === editingError.id ? { ...e, name: cleanName } : e);
            } else {
                // Check duplicate
                if (updatedErrors.some((e: any) => e.name.toLowerCase() === cleanName.toLowerCase())) {
                    message.error('Lỗi này đã tồn tại!');
                    return;
                }
                // Add new
                updatedErrors.push({
                    id: `${isSoftware ? 'soft' : 'hard'}_${Date.now()}`,
                    name: cleanName
                });
            }

            const stringArray = updatedErrors.map((e: any) => e.name);
            const payload = isSoftware 
                ? { softwareErrors: stringArray, hardwareErrors: hardwareErrors.map((e: any) => e.name), assignmentMode, maxImageSizeMB, targetDepartment }
                : { softwareErrors: softwareErrors.map((e: any) => e.name), hardwareErrors: stringArray, assignmentMode, maxImageSizeMB, targetDepartment };

            const res = await fetch(`/api/error-management/it-request-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (res.ok) {
                message.success('Lưu thành công');
                setIsDrawerOpen(false);
                form.resetFields();
                setEditingError(null);
                fetchConfig();
            } else {
                message.error('Lỗi khi lưu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const isSoftware = activeTab === 'SOFTWARE';
            const currentErrors = isSoftware ? softwareErrors : hardwareErrors;
            const updatedErrors = currentErrors.filter((e: any) => e.id !== id);
            const stringArray = updatedErrors.map((e: any) => e.name);

            const payload = isSoftware 
                ? { softwareErrors: stringArray, hardwareErrors: hardwareErrors.map((e: any) => e.name), assignmentMode, maxImageSizeMB, targetDepartment }
                : { softwareErrors: softwareErrors.map((e: any) => e.name), hardwareErrors: stringArray, assignmentMode, maxImageSizeMB, targetDepartment };

            const res = await fetch(`/api/error-management/it-request-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (res.ok) {
                message.success('Xóa thành công');
                fetchConfig();
            } else {
                message.error('Lỗi khi xóa');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleSaveGeneralConfig = async (soundToSave?: any) => {
        try {
            const currentSound = (soundToSave && typeof soundToSave === 'object' && 'type' in soundToSave) ? soundToSave : notificationSound;
            const payload = {
                softwareErrors: softwareErrors.map((e: any) => e.name),
                hardwareErrors: hardwareErrors.map((e: any) => e.name),
                assignmentMode,
                maxImageSizeMB,
                maBaLength,
                targetDepartment,
                telegramBotToken,
                telegramChatId,
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
            width: 80,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Tên lỗi',
            dataIndex: 'name',
            key: 'name',
            sorter: (a: ITError, b: ITError) => a.name.localeCompare(b.name),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 150,
            render: (_: any, record: ITError) => (
                <Space size="middle">
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingError(record);
                            form.setFieldsValue({ name: record.name });
                            setIsDrawerOpen(true);
                        }}
                    />
                    <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    if (!isAdmin) {
        return <div className="p-10 text-center text-red-500">Bạn không có quyền truy cập trang này.</div>;
    }

    const tabItems = [
        {
            key: 'SOFTWARE',
            label: 'Lỗi Phần mềm (BAĐT)',
            children: (
                <>
                    <div className="mb-4 text-slate-500">
                        Danh sách các lỗi nghiệp vụ phần mềm (Ví dụ: Hủy ký số, Sai thông tin hành chính, ...) để các khoa phòng chọn nhanh khi báo lỗi.
                    </div>
                    <Table
                        columns={columns}
                        dataSource={softwareErrors}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 20 }}
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
                    <div className="mb-4 text-slate-500">
                        Danh sách các lỗi phần cứng, mạng, thiết bị (Ví dụ: Mất mạng, Kẹt giấy máy in, Lỗi chuột bàn phím, ...).
                    </div>
                    <Table
                        columns={columns}
                        dataSource={hardwareErrors}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 20 }}
                        bordered
                    />
                </>
            )
        },
        {
            key: 'GENERAL',
            label: 'Cấu hình chung',
            children: (
                <div className="space-y-6 max-w-lg mt-4">
                    <Card size="small" title="Chế độ phân công công việc" className="border border-slate-200">
                        <div className="flex flex-col gap-3">
                            <Radio.Group 
                                value={assignmentMode} 
                                onChange={e => setAssignmentMode(e.target.value)}
                                className="flex flex-col gap-2"
                                disabled={user?.role !== 'ADMIN'}
                            >
                                <Radio value="A">
                                    <span className="font-medium text-slate-700">Tự do nhận việc</span>
                                    <div className="text-xs text-slate-500">Ticket gửi lên ở trạng thái chờ, nhân viên {targetDepartment} ai rảnh thì chủ động click "Nhận việc".</div>
                                </Radio>
                                <Radio value="B">
                                    <span className="font-medium text-slate-700">Trưởng nhóm điều phối</span>
                                    <div className="text-xs text-slate-500">Ticket gửi lên không phân công ai. Chỉ Admin/Trưởng phòng mới có quyền gán việc cho nhân viên.</div>
                                </Radio>
                                <Radio value="C">
                                    <span className="font-medium text-slate-700">Tự động phân công (Thông minh)</span>
                                    <div className="text-xs text-slate-500">Hệ thống tự động tìm nhân viên đang Online và rảnh việc nhất trong ngày để gán ngay lập tức.</div>
                                </Radio>
                            </Radio.Group>
                            {user?.role === 'ADMIN' && (
                                <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="w-fit mt-2">Lưu cấu hình</Button>
                            )}
                        </div>
                    </Card>

                    <Card size="small" title="Giới hạn ảnh đính kèm" className="border border-slate-200">
                        <div className="flex gap-2 items-center">
                            <InputNumber 
                                min={1} 
                                max={50} 
                                value={maxImageSizeMB} 
                                onChange={val => setMaxImageSizeMB(val || 10)} 
                                disabled={user?.role !== 'ADMIN'}
                            />
                            <span className="text-slate-500 font-medium">MB</span>
                            {user?.role === 'ADMIN' && (
                                <Button type="default" onClick={() => handleSaveGeneralConfig()}>Lưu thay đổi</Button>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 mt-2">Dung lượng tối đa (MB) cho mỗi ảnh khi tải lên. Khuyến nghị 10MB để tránh treo trình duyệt. Hệ thống sẽ tự nén lại sau khi chọn.</div>
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
                                    <span className="text-xs text-slate-400 font-normal">Từ @BotFather</span>
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
                                        <span>Chat ID (Nhóm hoặc Cá nhân)</span>
                                        <Tooltip title="ID nhóm Telegram lấy từ @getmyid_bot (thường bắt đầu bằng dấu trừ -)">
                                            <QuestionCircleOutlined className="text-slate-400 text-xs cursor-pointer hover:text-blue-500" />
                                        </Tooltip>
                                    </div>
                                    <span className="text-xs text-slate-400 font-normal">ID nhóm có dấu âm (-)</span>
                                </div>
                                <Input 
                                    placeholder="Ví dụ: -1002345678901 hoặc 123456789" 
                                    value={telegramChatId} 
                                    onChange={e => setTelegramChatId(e.target.value)} 
                                    disabled={user?.role !== 'ADMIN'}
                                />
                            </div>

                            {user?.role === 'ADMIN' && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button type="primary" onClick={() => handleSaveGeneralConfig()} className="bg-blue-600 hover:bg-blue-500">
                                        Lưu cấu hình Bot
                                    </Button>
                                    <Button 
                                        type="default" 
                                        icon={<SendOutlined />}
                                        loading={testingTelegram}
                                        onClick={handleTestTelegram}
                                        className="border-green-600 text-green-700 hover:text-green-800 hover:border-green-700 bg-green-50"
                                    >
                                        🧪 Gửi tin nhắn thử nghiệm (Test Bot)
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
                <div className="space-y-6 max-w-xl mt-4">
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
                            {(user?.role === 'ADMIN' || user?.role === targetDepartment) && (
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
            <div className="max-w-[1000px] mx-auto space-y-6">
                <Breadcrumb items={[
                    { title: <Link href="/"><HomeOutlined /> Trang chủ</Link> }, 
                    { title: <Link href={`/error-management/${targetDepartment === 'CNTT' ? 'it' : targetDepartment.toLowerCase()}-requests`}>Quản lý Yêu cầu {targetDepartment}</Link> }, 
                    { title: 'Cấu hình Danh mục Lỗi' }
                ]} />

                <Card
                    title={<span className="text-xl font-bold text-slate-800">Cấu hình Danh Mục Yêu cầu - {targetDepartment}</span>}
                    extra={
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                            setEditingError(null);
                            form.resetFields();
                            setIsDrawerOpen(true);
                        }}>
                            Thêm lỗi mới
                        </Button>
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
                    </Form>
                </Drawer>
            </div>
        </div>
    );
}
