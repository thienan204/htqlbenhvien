import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Radio, message, Space, Button, Upload } from 'antd';
import { Ticket } from '../types';
import { useImageUpload } from '../create/hooks/useImageUpload';
import { PlusOutlined, CameraOutlined, PictureOutlined } from '@ant-design/icons';

interface EditTicketModalProps {
    visible: boolean;
    ticket: Ticket | null;
    onCancel: () => void;
    onSuccess: () => void;
}

export const EditTicketModal: React.FC<EditTicketModalProps> = ({
    visible,
    ticket,
    onCancel,
    onSuccess
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const {
        fileList,
        setFileList,
        uploadProps,
        previewOpen,
        previewImage,
        setPreviewOpen,
        handleFileChange
    } = useImageUpload(10); // Hardcode 10MB cho đơn giản ở Modal sửa

    useEffect(() => {
        if (visible && ticket) {
            // Sử dụng setTimeout để đợi Form trong Modal render xong
            setTimeout(() => {
                form.setFieldsValue({
                    category: ticket.category || 'SOFTWARE',
                    ten_loi: ticket.ten_loi,
                    nguoi_bao: ticket.dynamicFields?.['Người báo'] || '',
                    sdt: ticket.dynamicFields?.['SĐT'] || '',
                    ghi_chu: ticket.dynamicFields?.['Ghi chú'] || ''
                });
            }, 0);

            // Set initial fileList from ticket if exists
            if (ticket.dynamicFields?.['Hình ảnh đính kèm'] && Array.isArray(ticket.dynamicFields['Hình ảnh đính kèm'])) {
                const existingFiles = ticket.dynamicFields['Hình ảnh đính kèm'].map((url: string, index: number) => ({
                    uid: `existing-${index}`,
                    name: `image-${index}.jpg`,
                    status: 'done',
                    url: url,
                    thumbUrl: url
                }));
                setFileList(existingFiles);
            } else {
                setFileList([]);
            }
        } else {
            setFileList([]);
        }
    }, [visible, ticket, form, setFileList]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (!ticket) return;

            setLoading(true);
            const dynamicFieldsUpdate = {
                'Người báo': values.nguoi_bao,
                'SĐT': values.sdt,
                'Ghi chú': values.ghi_chu,
                'Hình ảnh đính kèm': fileList.map(f => f.url)
            };

            const res = await fetch('/api/error-management/it-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: ticket.id,
                    action: 'EDIT_REQUEST',
                    category: values.category,
                    ten_loi: values.ten_loi,
                    dynamicFields: dynamicFieldsUpdate
                })
            });

            if (res.ok) {
                message.success('Đã cập nhật yêu cầu thành công!');
                onSuccess();
            } else {
                const data = await res.json();
                message.error(data.error || 'Cập nhật thất bại');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Modal
                title="Sửa Nội Dung Yêu Cầu"
                open={visible}
                onCancel={onCancel}
                footer={
                    <Space>
                        <Button onClick={onCancel} disabled={loading}>Hủy</Button>
                        <Button type="primary" onClick={handleOk} loading={loading}>
                            Lưu thay đổi
                        </Button>
                    </Space>
                }
                destroyOnHidden
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        name="category"
                        label="Loại sự cố"
                        rules={[{ required: true, message: 'Vui lòng chọn loại sự cố' }]}
                    >
                        <Radio.Group buttonStyle="solid" className="flex">
                            <Radio.Button value="SOFTWARE" className="flex-1 text-center">Phần mềm (BAĐT)</Radio.Button>
                            <Radio.Button value="HARDWARE" className="flex-1 text-center">Thiết bị/Sửa chữa</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="ten_loi"
                        label="Mô tả sự cố / Lỗi cần báo"
                        rules={[{ required: true, message: 'Vui lòng nhập mô tả sự cố' }]}
                    >
                        <Input.TextArea rows={3} placeholder="Mô tả chi tiết sự cố đang gặp phải..." />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="nguoi_bao"
                            label="Người báo"
                        >
                            <Input placeholder="Tên người báo" />
                        </Form.Item>

                        <Form.Item
                            name="sdt"
                            label="Số điện thoại"
                        >
                            <Input placeholder="Số điện thoại liên hệ" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="ghi_chu"
                        label="Ghi chú thêm"
                    >
                        <Input.TextArea rows={2} placeholder="Các ghi chú bổ sung nếu có..." />
                    </Form.Item>
                    
                    <Form.Item label="Hình ảnh đính kèm (Tuỳ chọn)">
                        <div className="flex flex-wrap gap-2 mb-3">
                            <Upload {...uploadProps} showUploadList={false}>
                                <Button icon={<PictureOutlined />}>Chọn từ máy</Button>
                            </Upload>
                            <Button 
                                icon={<CameraOutlined />} 
                                onClick={() => {
                                    document.getElementById('camera-input-edit')?.click();
                                }}
                            >
                                Chụp ảnh
                            </Button>
                            <input 
                                id="camera-input-edit"
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                style={{ display: 'none' }} 
                                onChange={(e) => {
                                    handleFileChange(e);
                                    // Reset value to allow capturing the same file again
                                    e.target.value = '';
                                }} 
                            />
                        </div>
                        <Upload
                            {...uploadProps}
                            listType="picture-card"
                            className="upload-list-inline"
                            fileList={fileList}
                        >
                            {/* Ẩn nút Upload mặc định của listType="picture-card" vì đã có 2 nút ở trên */}
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
            
            <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} centered>
                <img alt="Preview" style={{ width: '100%', marginTop: '20px', borderRadius: '8px' }} src={previewImage} />
            </Modal>
        </>
    );
};
