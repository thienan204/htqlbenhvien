import React, { useState, useEffect } from 'react';
import { Modal, Switch, Button, Upload, message, Typography, Space, Divider, Radio, Input, InputNumber, Alert, Tag } from 'antd';
import { 
    BellOutlined, 
    AudioOutlined, 
    UploadOutlined, 
    PlayCircleOutlined, 
    StopOutlined, 
    YoutubeOutlined, 
    LinkOutlined, 
    CustomerServiceOutlined, 
    SaveOutlined 
} from '@ant-design/icons';
import { 
    SoundConfig, 
    playNotificationSound, 
    playSoundByConfig, 
    stopAllNotificationSounds, 
    extractYouTubeId 
} from '@/utils/audioUtils';

const { Text, Title } = Typography;

interface NotificationSettingsModalProps {
    visible: boolean;
    onCancel: () => void;
    targetDepartment?: string;
    user?: any;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
    visible,
    onCancel,
    targetDepartment = 'CNTT',
    user
}) => {
    const [isMuted, setIsMuted] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    
    // Mode: 'DEPARTMENT' (Dùng chuông chung) hoặc 'CUSTOM' (Chuông riêng)
    const [soundMode, setSoundMode] = useState<'DEPARTMENT' | 'CUSTOM'>('DEPARTMENT');
    
    // Cấu hình chuông riêng của tài khoản
    const [customConfig, setCustomConfig] = useState<SoundConfig>({
        mode: 'CUSTOM',
        type: 'DEFAULT',
        url: '',
        duration: 7,
        name: ''
    });

    // Thông tin chuông chung của phòng ban hiện tại
    const [deptSoundConfig, setDeptSoundConfig] = useState<SoundConfig | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            // Tắt tiếng
            const userMutedKey = user ? `user_${user.id}_notification_muted` : `${targetDepartment}_notification_muted`;
            setIsMuted(localStorage.getItem(userMutedKey) === 'true');

            // Quyền thông báo
            if ('Notification' in window) {
                setNotificationPermission(Notification.permission);
            }

            // Lấy chuông chung của phòng ban từ localStorage
            const deptSoundStr = localStorage.getItem(`${targetDepartment}_department_notification_sound`);
            if (deptSoundStr) {
                try {
                    setDeptSoundConfig(JSON.parse(deptSoundStr));
                } catch (e) {}
            }

            // Lấy cấu hình chuông riêng của tài khoản
            const userKey = user ? `user_${user.id}_notification_audio_config` : null;
            let loadedFromLocal = false;
            if (userKey) {
                const localStr = localStorage.getItem(userKey);
                if (localStr) {
                    try {
                        const parsed = JSON.parse(localStr);
                        setSoundMode(parsed.mode || 'DEPARTMENT');
                        setCustomConfig(prev => ({
                            ...prev,
                            ...parsed,
                            mode: 'CUSTOM'
                        }));
                        loadedFromLocal = true;
                    } catch (e) {}
                }
            }

            // Tải cấu hình từ Server (nếu đã đăng nhập)
            if (user?.id) {
                fetch('/api/user/notification-settings')
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.mode) {
                            setSoundMode(data.mode);
                            setCustomConfig({
                                mode: 'CUSTOM',
                                type: data.type || 'DEFAULT',
                                url: data.url || '',
                                duration: data.duration || 7,
                                name: data.name || ''
                            });
                            // Đồng bộ lại local
                            localStorage.setItem(userKey!, JSON.stringify(data));
                        } else {
                            // Nếu server chưa có, kiểm tra legacy audio
                            const legacyAudio = localStorage.getItem(`${targetDepartment}_notification_audio`);
                            if (!loadedFromLocal && legacyAudio) {
                                setSoundMode('CUSTOM');
                                setCustomConfig({
                                    mode: 'CUSTOM',
                                    type: 'UPLOAD',
                                    url: legacyAudio,
                                    name: 'File chuông tùy chỉnh đã lưu trước đó',
                                    duration: 7
                                });
                            }
                        }
                    })
                    .catch(err => {
                        console.warn('Lỗi lấy cấu hình chuông cá nhân từ server:', err);
                        const legacyAudio = localStorage.getItem(`${targetDepartment}_notification_audio`);
                        if (!loadedFromLocal && legacyAudio) {
                            setSoundMode('CUSTOM');
                            setCustomConfig({
                                mode: 'CUSTOM',
                                type: 'UPLOAD',
                                url: legacyAudio,
                                name: 'File chuông tùy chỉnh đã lưu trước đó',
                                duration: 7
                            });
                        }
                    });
            } else {
                const legacyAudio = localStorage.getItem(`${targetDepartment}_notification_audio`);
                if (!loadedFromLocal && legacyAudio) {
                    setSoundMode('CUSTOM');
                    setCustomConfig({
                        mode: 'CUSTOM',
                        type: 'UPLOAD',
                        url: legacyAudio,
                        name: 'File chuông tùy chỉnh đã lưu trước đó',
                        duration: 7
                    });
                }
            }
        } else {
            stopAllNotificationSounds();
            setIsPlaying(false);
        }
    }, [visible, user, targetDepartment]);

    const handleMuteChange = (checked: boolean) => {
        setIsMuted(checked);
        const userMutedKey = user ? `user_${user.id}_notification_muted` : `${targetDepartment}_notification_muted`;
        localStorage.setItem(userMutedKey, checked ? 'true' : 'false');
        if (!checked) {
            handleTestCurrentSound();
        }
    };

    const handleRequestPermission = async () => {
        if (!('Notification' in window)) {
            message.error('Trình duyệt của bạn không hỗ trợ thông báo Native!');
            return;
        }
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                message.success('Đã cấp quyền hiển thị thông báo!');
                new Notification('Cài đặt thành công', {
                    body: 'Bạn sẽ nhận được thông báo lỗi ngay cả khi thu nhỏ trình duyệt.',
                });
            } else {
                message.warning('Bạn đã từ chối cấp quyền thông báo.');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    };

    const handleAudioUpload = (file: File) => {
        const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav');
        if (!isAudio) {
            message.error('Chỉ hỗ trợ file âm thanh (MP3, WAV)!');
            return false;
        }
        const isLt3M = file.size / 1024 / 1024 < 3;
        if (!isLt3M) {
            message.error('Kích thước file tối đa 3MB để đảm bảo hiệu suất!');
            return false;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Audio = e.target?.result as string;
            // Lưu cả key legacy để luôn phát được âm thanh nguyên bản
            localStorage.setItem(`${targetDepartment}_notification_audio`, base64Audio);
            setCustomConfig(prev => ({
                ...prev,
                type: 'UPLOAD',
                url: base64Audio,
                name: file.name
            }));
            message.success(`Đã chọn file: ${file.name}`);
        };
        reader.readAsDataURL(file);

        return false;
    };

    // Nghe thử âm thanh hiện tại theo lựa chọn trong Modal
    const handleTestCurrentSound = () => {
        if (isPlaying) {
            stopAllNotificationSounds();
            setIsPlaying(false);
            return;
        }

        if (soundMode === 'DEPARTMENT') {
            setIsPlaying(true);
            playNotificationSound(targetDepartment, user?.id);
            const dur = (deptSoundConfig?.duration || 7) * 1000;
            setTimeout(() => setIsPlaying(false), dur);
        } else {
            if (customConfig.type === 'YOUTUBE' && customConfig.url && !extractYouTubeId(customConfig.url)) {
                message.error('Link YouTube không hợp lệ!');
                return;
            }
            setIsPlaying(true);
            playSoundByConfig(customConfig);
            const dur = (customConfig.duration || 7) * 1000;
            setTimeout(() => setIsPlaying(false), dur);
        }
    };

    // Lưu cài đặt âm thanh cá nhân
    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const configToSave: SoundConfig = {
                mode: soundMode,
                type: soundMode === 'CUSTOM' ? customConfig.type : (deptSoundConfig?.type || 'DEFAULT'),
                url: soundMode === 'CUSTOM' ? customConfig.url : (deptSoundConfig?.url || ''),
                duration: soundMode === 'CUSTOM' ? (customConfig.duration || 7) : (deptSoundConfig?.duration || 7),
                name: soundMode === 'CUSTOM' ? customConfig.name : (deptSoundConfig?.name || '')
            };

            // Nếu là upload file âm thanh, đồng bộ luôn vào key legacy
            if (configToSave.type === 'UPLOAD' && configToSave.url) {
                localStorage.setItem(`${targetDepartment}_notification_audio`, configToSave.url);
            }

            // Lưu local cache
            if (user?.id) {
                localStorage.setItem(`user_${user.id}_notification_audio_config`, JSON.stringify(configToSave));
                // Lưu lên Server để đồng bộ
                await fetch('/api/user/notification-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ soundConfig: configToSave })
                });
            } else {
                localStorage.setItem(`${targetDepartment}_notification_audio_config`, JSON.stringify(configToSave));
            }

            message.success('Đã lưu cấu hình âm thanh thành công!');
            onCancel();
        } catch (error) {
            console.error('Lỗi khi lưu cài đặt âm thanh:', error);
            message.error('Lỗi khi lưu cài đặt!');
        } finally {
            setSaving(false);
        }
    };

    // Hiển thị nhãn mô tả chuông chung của phòng ban
    const renderDeptSoundDescription = () => {
        if (!deptSoundConfig || deptSoundConfig.type === 'DEFAULT') {
            return <Tag color="blue">Chuông "Ting" mặc định của phòng</Tag>;
        }
        if (deptSoundConfig.type === 'UPLOAD') {
            return <Tag color="green">File âm thanh chung ({deptSoundConfig.name || 'File MP3'})</Tag>;
        }
        if (deptSoundConfig.type === 'DIRECT_URL') {
            return <Tag color="cyan">Link âm thanh MP3 trực tiếp</Tag>;
        }
        if (deptSoundConfig.type === 'YOUTUBE') {
            return <Tag color="red">Nhạc YouTube chung của phòng ({deptSoundConfig.duration || 7}s)</Tag>;
        }
        return <Tag color="default">Mặc định</Tag>;
    };

    return (
        <Modal
            title={<span className="flex items-center gap-2"><BellOutlined className="text-blue-500" /> Cài đặt Cảnh báo & Âm thanh</span>}
            open={visible}
            onCancel={() => {
                stopAllNotificationSounds();
                setIsPlaying(false);
                onCancel();
            }}
            footer={[
                <Button key="cancel" onClick={onCancel}>Đóng</Button>,
                <Button 
                    key="save" 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    loading={saving} 
                    onClick={handleSaveSettings}
                >
                    Lưu cài đặt
                </Button>
            ]}
            width={580}
            destroyOnHidden
        >
            <div className="py-2 space-y-6">
                {/* 1. Quyền thông báo Native trình duyệt */}
                <div>
                    <Title level={5} className="!mb-2 flex items-center gap-2">
                        <BellOutlined /> Cảnh báo trình duyệt (Background)
                    </Title>
                    <Text className="text-slate-500 block mb-3">
                        Hiển thị Popup thông báo của hệ điều hành ngay cả khi bạn đang mở tab khác hoặc thu nhỏ trình duyệt.
                    </Text>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                            <Text strong>Trạng thái quyền:</Text>
                            {notificationPermission === 'granted' ? (
                                <Text type="success" className="font-medium">Đã cấp quyền</Text>
                            ) : notificationPermission === 'denied' ? (
                                <Text type="danger" className="font-medium">Bị chặn</Text>
                            ) : (
                                <Text type="warning" className="font-medium">Chưa cấp quyền</Text>
                            )}
                            {notificationPermission === 'default' && (
                                <Button size="small" type="primary" onClick={handleRequestPermission}>
                                    Cấp quyền ngay
                                </Button>
                            )}
                        </div>
                        {notificationPermission === 'denied' && (
                            <Text type="secondary" className="text-xs bg-red-50 p-2 rounded border border-red-100">
                                💡 Bạn đã lỡ chặn thông báo từ trước. Để mở lại, vui lòng bấm vào biểu tượng <b>Ổ khóa (🔒)</b> hoặc <b>Chữ i (ⓘ)</b> trên thanh địa chỉ của trình duyệt ➡️ Tìm mục <b>Thông báo (Notifications)</b> ➡️ Chọn <b>Cho phép (Allow)</b> ➡️ F5 tải lại trang.
                            </Text>
                        )}
                    </div>
                </div>

                <Divider className="my-0" />

                {/* 2. Cài đặt Âm thanh */}
                <div>
                    <Title level={5} className="!mb-2 flex items-center gap-2">
                        <AudioOutlined /> Cài đặt Âm thanh Cảnh báo
                    </Title>
                    
                    {/* Bật/Tắt chuông */}
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                        <div>
                            <Text strong className="block">Phát âm thanh cảnh báo</Text>
                            <Text className="text-slate-500 text-xs">Đổ chuông khi có yêu cầu mới hoặc cảnh báo chưa nhận việc.</Text>
                        </div>
                        <Switch 
                            checked={!isMuted} 
                            onChange={(checked) => handleMuteChange(!checked)} 
                            checkedChildren="Bật" 
                            unCheckedChildren="Tắt" 
                        />
                    </div>

                    {!isMuted && (
                        <div className="space-y-4">
                            {/* Lựa chọn 2 tầng: Chuông chung vs Chuông riêng */}
                            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                                <Text strong className="block mb-3 text-slate-800">Chọn chế độ nhạc chuông:</Text>
                                <Radio.Group 
                                    value={soundMode} 
                                    onChange={e => setSoundMode(e.target.value)}
                                    className="flex flex-col gap-3"
                                >
                                    <Radio value="DEPARTMENT">
                                        <div>
                                            <span className="font-medium text-slate-700">
                                                Sử dụng nhạc chuông chung của phòng {targetDepartment}
                                            </span>
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Đang áp dụng:</span>
                                                {renderDeptSoundDescription()}
                                            </div>
                                        </div>
                                    </Radio>

                                    <Radio value="CUSTOM">
                                        <div>
                                            <span className="font-medium text-slate-700">
                                                Tùy chỉnh nhạc chuông riêng cho tài khoản của tôi
                                            </span>
                                            <div className="text-xs text-slate-500">
                                                Cài đặt này sẽ ưu tiên áp dụng cho tài khoản <b>{user?.name || user?.username || 'hiện tại'}</b>.
                                            </div>
                                        </div>
                                    </Radio>
                                </Radio.Group>
                            </div>

                            {/* Cấu hình chi tiết chuông riêng */}
                            {soundMode === 'CUSTOM' && (
                                <div className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 text-blue-600 font-medium">
                                        <CustomerServiceOutlined /> Tùy chọn nguồn âm thanh riêng:
                                    </div>

                                    <Radio.Group 
                                        value={customConfig.type} 
                                        onChange={e => setCustomConfig(prev => ({ ...prev, type: e.target.value }))}
                                        className="flex flex-col gap-2.5"
                                    >
                                        <Radio value="DEFAULT">
                                            <span className="text-sm font-medium text-slate-700">Tiếng "Ting" mặc định</span>
                                        </Radio>
                                        <Radio value="UPLOAD">
                                            <span className="text-sm font-medium text-slate-700">Tải file âm thanh (MP3, WAV)</span>
                                        </Radio>
                                        <Radio value="DIRECT_URL">
                                            <span className="text-sm font-medium text-slate-700">Dán Link âm thanh trực tiếp (Direct Audio URL)</span>
                                        </Radio>
                                        <Radio value="YOUTUBE">
                                            <span className="text-sm font-medium text-slate-700">Dán Link YouTube (Nhạc chuông từ YouTube)</span>
                                        </Radio>
                                    </Radio.Group>

                                    {/* Chi tiết từng kiểu nguồn */}
                                    <div className="pt-2 border-t border-slate-100">
                                        {customConfig.type === 'UPLOAD' && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <Upload beforeUpload={handleAudioUpload} showUploadList={false} accept="audio/*">
                                                        <Button icon={<UploadOutlined />}>Tải chuông mới</Button>
                                                    </Upload>
                                                    {customConfig.name && (
                                                        <span className="text-xs text-green-600 font-medium">
                                                            Đã chọn: {customConfig.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400">Hỗ trợ MP3, WAV. Dung lượng tối đa 3MB.</div>
                                            </div>
                                        )}

                                        {customConfig.type === 'DIRECT_URL' && (
                                            <div className="space-y-1.5">
                                                <div className="text-xs text-slate-500 font-medium">Đường dẫn file MP3/WAV online:</div>
                                                <Input 
                                                    prefix={<LinkOutlined className="text-slate-400" />}
                                                    placeholder="https://example.com/sound.mp3"
                                                    value={customConfig.url}
                                                    onChange={e => setCustomConfig(prev => ({ ...prev, url: e.target.value }))}
                                                />
                                            </div>
                                        )}

                                        {customConfig.type === 'YOUTUBE' && (
                                            <div className="space-y-1.5">
                                                <div className="text-xs text-slate-500 font-medium">Link video/bài hát YouTube:</div>
                                                <Input 
                                                    prefix={<YoutubeOutlined className="text-red-500" />}
                                                    placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                                                    value={customConfig.url}
                                                    onChange={e => setCustomConfig(prev => ({ ...prev, url: e.target.value }))}
                                                />
                                                <div className="text-xs text-slate-400">
                                                    Hệ thống phát ngầm qua YouTube API và tự dừng sau số giây cài đặt.
                                                </div>
                                            </div>
                                        )}

                                        {customConfig.type !== 'DEFAULT' && (
                                            <div className="mt-3 flex items-center gap-3">
                                                <span className="text-xs text-slate-600 font-medium">Thời lượng phát:</span>
                                                <InputNumber 
                                                    min={3} 
                                                    max={30} 
                                                    value={customConfig.duration || 7} 
                                                    onChange={val => setCustomConfig(prev => ({ ...prev, duration: val || 7 }))}
                                                />
                                                <span className="text-xs text-slate-500">giây</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Nút Nghe thử */}
                            <div className="flex justify-between items-center pt-2">
                                <Button 
                                    icon={isPlaying ? <StopOutlined /> : <PlayCircleOutlined />} 
                                    onClick={handleTestCurrentSound}
                                    danger={isPlaying}
                                >
                                    {isPlaying ? 'Dừng nghe thử' : 'Nghe thử âm thanh'}
                                </Button>
                                <span className="text-xs text-slate-400 italic">
                                    Đang thử: {soundMode === 'DEPARTMENT' ? 'Chuông chung' : 'Chuông riêng'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="text-xs text-slate-400 mt-2 italic text-center">
                    Cài đặt chuông sẽ được lưu trữ và tự động đồng bộ theo tài khoản của bạn.
                </div>
            </div>
        </Modal>
    );
};
