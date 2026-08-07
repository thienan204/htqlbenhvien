'use client';

import React, { useState } from 'react';
import { Modal, Upload, Button, message, Form, Input } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Dragger } = Upload;

interface Props {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

export default function ImportExcelModal({ open, onCancel, onSuccess }: Props) {
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [form] = Form.useForm();

    const handleUpload = async (values: any) => {
        if (fileList.length === 0) {
            message.error('Vui lòng chọn file Excel');
            return;
        }

        setUploading(true);
        try {
            const file = fileList[0];
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Extract raw JSON data from Excel
            // header: 1 means array of arrays, header: 0/undefined means object with keys as first row
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (rawJson.length === 0) {
                message.error('File Excel trống hoặc không đúng định dạng');
                setUploading(false);
                return;
            }

            // 1. Generate Config from the headers of the first row
            const headers = Object.keys(rawJson[0] as object);
            const config = headers.map((header, index) => ({
                id: Date.now().toString() + index,
                name: header,
                label: header,
                type: 'text',
                required: false,
                isEditable: false, // by default imported data is read-only
                isVerificationKey: false
            }));

            // 2. Create the Form via API
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            const createFormRes = await fetch(`${basePath}/api/dynamic-forms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: values.name,
                    slug: values.slug,
                    description: 'Import từ file Excel',
                    config: config
                })
            });

            if (!createFormRes.ok) {
                const err = await createFormRes.json();
                message.error(err.error || 'Lỗi tạo Form');
                setUploading(false);
                return;
            }

            const newForm = await createFormRes.json();

            // 3. Import Data
            const importRes = await fetch(`${basePath}/api/dynamic-forms/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: newForm.id,
                    rows: rawJson
                })
            });

            if (importRes.ok) {
                message.success('Import thành công dữ liệu và tạo cấu trúc Form');
                onSuccess();
                form.resetFields();
                setFileList([]);
            } else {
                message.error('Lỗi khi import dữ liệu');
            }

        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối hoặc đọc file Excel');
        } finally {
            setUploading(false);
        }
    };

    const uploadProps = {
        onRemove: (file: any) => {
            const index = fileList.indexOf(file);
            const newFileList = fileList.slice();
            newFileList.splice(index, 1);
            setFileList(newFileList);
        },
        beforeUpload: (file: any) => {
            setFileList([...fileList, file]);
            return false; // Prevent automatic upload
        },
        fileList,
        maxCount: 1,
        accept: ".xlsx, .xls"
    };

    return (
        <Modal
            title="Tạo nhanh từ File Excel"
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={uploading}
            okText="Import"
            cancelText="Hủy"
            forceRender
        >
            <Form form={form} layout="vertical" onFinish={handleUpload}>
                <Form.Item
                    name="name"
                    label="Tên Form"
                    rules={[{ required: true, message: 'Vui lòng nhập tên form!' }]}
                >
                    <Input placeholder="Ví dụ: Cập nhật TOTP VNPT" />
                </Form.Item>
                <Form.Item
                    name="slug"
                    label="Đường dẫn tĩnh (Slug)"
                    rules={[
                        { required: true, message: 'Vui lòng nhập đường dẫn!' },
                        { pattern: /^[a-z0-9-]+$/, message: 'Chỉ chấp nhận chữ thường, số và gạch ngang' }
                    ]}
                >
                    <Input placeholder="Ví dụ: cap-nhat-totp" />
                </Form.Item>
                
                <div className="mt-4 mb-2 font-medium">Tệp Excel (.xlsx)</div>
                <Dragger {...uploadProps}>
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">Nhấp hoặc kéo thả file Excel vào khu vực này</p>
                    <p className="ant-upload-hint">
                        Hệ thống sẽ quét dòng đầu tiên làm Cột, và tải toàn bộ các dòng còn lại vào CSDL.
                    </p>
                </Dragger>
            </Form>
        </Modal>
    );
}
