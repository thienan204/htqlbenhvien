'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Form, message, Breadcrumb, Card, Space, Drawer, Popconfirm, Tabs, InputNumber, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined } from '@ant-design/icons';
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
    const [telegramBotToken, setTelegramBotToken] = useState<string>('');
    const [telegramChatId, setTelegramChatId] = useState<string>('');

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
                setTelegramBotToken(data.telegramBotToken || '');
                setTelegramChatId(data.telegramChatId || '');
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
                updatedErrors = updatedErrors.map(e => e.id === editingError.id ? { ...e, name: cleanName } : e);
            } else {
                // Check duplicate
                if (updatedErrors.some(e => e.name.toLowerCase() === cleanName.toLowerCase())) {
                    message.error('Lỗi này đã tồn tại!');
                    return;
                }
                // Add new
                updatedErrors.push({
                    id: `${isSoftware ? 'soft' : 'hard'}_${Date.now()}`,
                    name: cleanName
                });
            }

            const stringArray = updatedErrors.map(e => e.name);
            const payload = isSoftware 
                ? { softwareErrors: stringArray, hardwareErrors: hardwareErrors.map(e => e.name), assignmentMode, maxImageSizeMB, targetDepartment }
                : { softwareErrors: softwareErrors.map(e => e.name), hardwareErrors: stringArray, assignmentMode, maxImageSizeMB, targetDepartment };

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
            const updatedErrors = currentErrors.filter(e => e.id !== id);
            const stringArray = updatedErrors.map(e => e.name);

            const payload = isSoftware 
                ? { softwareErrors: stringArray, hardwareErrors: hardwareErrors.map(e => e.name), assignmentMode, maxImageSizeMB, targetDepartment }
                : { softwareErrors: softwareErrors.map(e => e.name), hardwareErrors: stringArray, assignmentMode, maxImageSizeMB, targetDepartment };

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

    const handleSaveGeneralConfig = async () => {
        try {
            const payload = {
                softwareErrors: softwareErrors.map(e => e.name),
                hardwareErrors: hardwareErrors.map(e => e.name),
                assignmentMode,
                maxImageSizeMB,
                targetDepartment,
                telegramBotToken,
                telegramChatId
            };
            const res = await fetch(`/api/error-management/it-request-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                message.success('Đã lưu cấu hình chung');
            } else {
                message.error('Lỗi khi lưu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
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
                            <Button type="primary" onClick={handleSaveGeneralConfig} className="w-fit mt-2">Lưu cấu hình</Button>
                        </div>
                    </Card>

                    <Card size="small" title="Giới hạn ảnh đính kèm" className="border border-slate-200">
                        <div className="flex gap-2 items-center">
                            <InputNumber 
                                min={1} 
                                max={50} 
                                value={maxImageSizeMB} 
                                onChange={val => setMaxImageSizeMB(val || 10)} 
                            />
                            <span className="text-slate-500 font-medium">MB</span>
                            <Button type="default" onClick={handleSaveGeneralConfig}>Lưu thay đổi</Button>
                        </div>
                        <div className="text-xs text-slate-500 mt-2">Dung lượng tối đa (MB) cho mỗi ảnh khi tải lên. Khuyến nghị 10MB để tránh treo trình duyệt. Hệ thống sẽ tự nén lại sau khi chọn.</div>
                    </Card>

                    <Card size="small" title="Cấu hình Thông báo Telegram" className="border border-slate-200">
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className="text-sm font-medium text-slate-700 mb-1">Bot Token</div>
                                <Input 
                                    placeholder="Ví dụ: 123456789:ABCdefGHIjklmNOPqrsTUVwxyz..." 
                                    value={telegramBotToken} 
                                    onChange={e => setTelegramBotToken(e.target.value)} 
                                />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700 mb-1">Chat ID (Nhóm nhận thông báo)</div>
                                <Input 
                                    placeholder="Ví dụ: -100123456789" 
                                    value={telegramChatId} 
                                    onChange={e => setTelegramChatId(e.target.value)} 
                                />
                            </div>
                            <Button type="default" onClick={handleSaveGeneralConfig} className="w-fit">Lưu cấu hình Bot</Button>
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
                    <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
                </Card>

                <Drawer
                    title={editingError ? "Cập nhật Lỗi" : "Thêm mới Lỗi"}
                    size="default"
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
