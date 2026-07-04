import React, { useState, useEffect } from 'react';
import { Modal, Switch, Button, Upload, message, Typography, Space, Divider } from 'antd';
import { BellOutlined, AudioOutlined, UploadOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { playNotificationSound } from '@/utils/audioUtils';

const { Text, Title } = Typography;

interface NotificationSettingsModalProps {
    visible: boolean;
    onCancel: () => void;
    targetDepartment?: string;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
    visible,
    onCancel,
    targetDepartment = 'CNTT'
}) => {
    const [isMuted, setIsMuted] = useState(false);
    const [hasCustomAudio, setHasCustomAudio] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (visible) {
            setIsMuted(localStorage.getItem(`${targetDepartment}_notification_muted`) === 'true');
            setHasCustomAudio(!!localStorage.getItem(`${targetDepartment}_notification_audio`));
            if ('Notification' in window) {
                setNotificationPermission(Notification.permission);
            }
        }
    }, [visible]);

    const handleMuteChange = (checked: boolean) => {
        setIsMuted(checked);
        localStorage.setItem(`${targetDepartment}_notification_muted`, checked ? 'true' : 'false');
        if (!checked) {
            playNotificationSound(targetDepartment);
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
        const isAudio = file.type.startsWith('audio/');
        if (!isAudio) {
            message.error('Chỉ hỗ trợ tải lên file âm thanh (mp3, wav, ogg)!');
            return false;
        }
        const isLt1M = file.size / 1024 / 1024 < 1;
        if (!isLt1M) {
            message.error('Kích thước file phải nhỏ hơn 1MB để đảm bảo hiệu suất!');
            return false;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Audio = e.target?.result as string;
            localStorage.setItem(`${targetDepartment}_notification_audio`, base64Audio);
            setHasCustomAudio(true);
            message.success('Đã lưu âm thanh báo động tùy chỉnh!');
        };
        reader.onerror = () => {
            message.error('Lỗi đọc file âm thanh!');
        };
        reader.readAsDataURL(file);

        return false; // Chặn upload tự động của Antd
    };

    const handleRemoveCustomAudio = () => {
        localStorage.removeItem(`${targetDepartment}_notification_audio`);
        setHasCustomAudio(false);
        message.success('Đã khôi phục âm thanh mặc định.');
    };

    return (
        <Modal
            title={<span className="flex items-center gap-2"><BellOutlined className="text-blue-500" /> Cài đặt Cảnh báo & Âm thanh</span>}
            open={visible}
            onCancel={onCancel}
            footer={<Button type="primary" onClick={onCancel}>Đóng</Button>}
            destroyOnHidden
        >
            <div className="py-2 space-y-6">
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

                <div>
                    <Title level={5} className="!mb-2 flex items-center gap-2">
                        <AudioOutlined /> Cài đặt Âm thanh
                    </Title>
                    
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
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <Text strong className="block mb-2">Nhạc chuông tùy chỉnh</Text>
                            <Space className="w-full flex justify-between items-center">
                                {hasCustomAudio ? (
                                    <div className="flex items-center gap-2">
                                        <Text type="success">Đang dùng chuông tùy chỉnh</Text>
                                        <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={handleRemoveCustomAudio} title="Xóa và dùng chuông mặc định" />
                                    </div>
                                ) : (
                                    <Text type="secondary">Đang dùng tiếng "Ting" mặc định</Text>
                                )}
                                
                                <Upload 
                                    accept="audio/*" 
                                    beforeUpload={handleAudioUpload} 
                                    showUploadList={false}
                                >
                                    <Button icon={<UploadOutlined />}>Tải chuông mới</Button>
                                </Upload>
                            </Space>
                            <Text className="text-slate-400 text-xs block mt-2">Hỗ trợ MP3, WAV. Dung lượng tối đa 1MB.</Text>
                        </div>
                    )}
                </div>

                {!isMuted && (
                    <div className="flex justify-end pt-2">
                        <Button icon={<PlayCircleOutlined />} onClick={() => playNotificationSound(targetDepartment)}>
                            Nghe thử âm thanh hiện tại
                        </Button>
                    </div>
                )}
                
                <div className="text-xs text-slate-400 mt-4 italic text-center">
                    Cài đặt âm thanh chỉ lưu trữ cục bộ trên trình duyệt hiện tại.
                </div>
            </div>
        </Modal>
    );
};
