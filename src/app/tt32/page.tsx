'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Tabs, Button, Input, Space, Popconfirm, message, Modal, Select, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, BookOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;

export default function TT32ManagementPage() {
    const [chapters, setChapters] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit Chapter
    const [editingChapter, setEditingChapter] = useState<any>(null);
    const [chapterName, setChapterName] = useState('');

    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [editingCat, setEditingCat] = useState<any>(null);
    const [catForm] = Form.useForm();

    // Catalog State
    const [catalogData, setCatalogData] = useState<any[]>([]);
    const [catalogTotal, setCatalogTotal] = useState(0);
    const [catalogPage, setCatalogPage] = useState(1);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogFilterCategory, setCatalogFilterCategory] = useState('');
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogCategories, setCatalogCategories] = useState<string[]>([]);

    const fetchCatalog = async (page = 1, search = catalogSearch, category = catalogFilterCategory) => {
        setCatalogLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                pageSize: '20',
                search: search,
                category: category
            });
            const res = await fetch(`/api/tt32/catalog?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setCatalogData(data.data);
                setCatalogTotal(data.total);
                setCatalogPage(data.page);
                setCatalogCategories(data.distinctCategories || []);
            }
        } catch (error) {
            message.error('Lỗi tải từ điển');
        } finally {
            setCatalogLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [chapRes, catRes] = await Promise.all([
                fetch('/api/service-chapters'),
                fetch('/api/tt32')
            ]);
            
            if (chapRes.ok) setChapters(await chapRes.json());
            if (catRes.ok) setCategories(await catRes.json());
        } catch (error) {
            message.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchCatalog();
    }, []);

    const handleSaveChapter = async () => {
        try {
            const res = await fetch('/api/service-chapters', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: editingChapter.code, name: chapterName })
            });
            if (res.ok) {
                message.success('Cập nhật tên Chương thành công');
                setEditingChapter(null);
                fetchData();
            } else {
                message.error('Lỗi cập nhật');
            }
        } catch {
            message.error('Lỗi cập nhật');
        }
    };

    const handleSaveCategory = async (values: any) => {
        try {
            const method = editingCat ? 'PUT' : 'POST';
            const payload = { ...values, id: editingCat?.id };
            
            const res = await fetch('/api/tt32', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success('Lưu Nhóm TT32 thành công');
                setIsCatModalOpen(false);
                fetchData();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi lưu dữ liệu');
            }
        } catch {
            message.error('Lỗi lưu dữ liệu');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        try {
            const res = await fetch(`/api/tt32?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa thành công');
                fetchData();
            }
        } catch {
            message.error('Lỗi khi xóa');
        }
    };

    const chapterColumns = [
        { title: 'Mã Chương', dataIndex: 'code', key: 'code', width: 120, render: (text: string) => <span className="font-bold text-blue-600">{text}</span> },
        { 
            title: 'Tên Chương Dịch vụ', 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string, record: any) => {
                if (editingChapter?.code === record.code) {
                    return (
                        <Space>
                            <Input value={chapterName} onChange={e => setChapterName(e.target.value)} onPressEnter={handleSaveChapter} />
                            <Button type="primary" size="small" onClick={handleSaveChapter}>Lưu</Button>
                            <Button size="small" onClick={() => setEditingChapter(null)}>Hủy</Button>
                        </Space>
                    );
                }
                return text;
            }
        },
        { 
            title: 'Thao tác', 
            key: 'action',
            width: 100,
            render: (_: any, record: any) => (
                <Button size="small" icon={<EditOutlined />} onClick={() => {
                    setEditingChapter(record);
                    setChapterName(record.name);
                }}>Sửa tên</Button>
            )
        }
    ];

    const categoryColumns = [
        { title: 'Mã Nhóm', dataIndex: 'code', key: 'code', width: 150, render: (text: string) => <span className="font-semibold">{text}</span> },
        { title: 'Tên Nhóm (Phụ lục)', dataIndex: 'name', key: 'name' },
        { 
            title: 'Các Chương được phép làm (Prefix)', 
            dataIndex: 'chapterMappings', 
            key: 'chapters',
            render: (mappings: any[]) => (
                <div className="flex flex-wrap gap-1">
                    {mappings.map(m => (
                        <span key={m.chapter_code} className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs font-medium" title={m.chapter?.name}>
                            {m.chapter_code}
                        </span>
                    ))}
                </div>
            )
        },
        { 
            title: 'Thao tác', 
            key: 'action',
            width: 150,
            render: (_: any, record: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => {
                        setEditingCat(record);
                        catForm.setFieldsValue({
                            code: record.code,
                            name: record.name,
                            description: record.description,
                            chapterCodes: record.chapterMappings.map((m: any) => m.chapter_code)
                        });
                        setIsCatModalOpen(true);
                    }}>Sửa</Button>
                    <Popconfirm title="Xóa nhóm này?" onConfirm={() => handleDeleteCategory(record.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const catalogColumns = [
        { title: 'STT (Mã Kỹ thuật)', dataIndex: 'code', key: 'code', width: 150, render: (text: string) => <span className="font-semibold text-blue-600">{text}</span> },
        { title: 'Tên Kỹ thuật', dataIndex: 'name', key: 'name' },
        { title: 'Nhóm Kỹ thuật', dataIndex: 'group_name', key: 'group_name', width: 250 },
        { title: 'Phụ lục', dataIndex: 'category_name', key: 'category_name', width: 250, render: (text: string) => <span className="text-slate-500">{text}</span> }
    ];

    return (
        <div className="w-full h-full p-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">
                        <SettingOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Cấu hình Danh mục TT32</h1>
                        <p className="text-slate-500 m-0">Quản lý các chương dịch vụ và phân quyền thực hiện theo phụ lục TT32.</p>
                    </div>
                </div>
            </div>

            <Card className="shadow-sm rounded-2xl border-slate-100">
                <Tabs type="card" 
                    defaultActiveKey="1"
                    items={[
                        {
                            key: '1',
                            label: <span><BookOutlined /> Nhóm TT32 (Phân quyền)</span>,
                            children: (
                                <>
                                    <div className="mb-4">
                                        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                            setEditingCat(null);
                                            catForm.resetFields();
                                            setIsCatModalOpen(true);
                                        }}>
                                            Thêm Nhóm TT32 Mới
                                        </Button>
                                    </div>
                                    <Table 
                                        dataSource={categories} 
                                        columns={categoryColumns} 
                                        rowKey="id" 
                                        loading={loading}
                                        pagination={false}
                                        bordered
                                        size="middle"
                                    />
                                </>
                            )
                        },
                        {
                            key: '2',
                            label: <span><SettingOutlined /> Từ điển Chương Dịch vụ</span>,
                            children: (
                                <>
                                    <p className="text-slate-500 mb-4">Đây là từ điển 2 ký tự đầu của mã dịch vụ (Mẫu 05). Bạn có thể đổi tên để hiển thị cho dễ nhìn.</p>
                                    <Table 
                                        dataSource={chapters} 
                                        columns={chapterColumns} 
                                        rowKey="code" 
                                        loading={loading}
                                        pagination={{ pageSize: 15 }}
                                        bordered
                                        size="small"
                                    />
                                </>
                            )
                        },
                        {
                            key: '3',
                            label: <span><UnorderedListOutlined /> Từ điển Chi tiết Thông tư 32</span>,
                            children: (
                                <>
                                    <div className="flex justify-between mb-4 gap-4">
                                        <p className="text-slate-500 m-0 self-center">Đây là dữ liệu chi tiết bóc tách từ các file Word TT32.</p>
                                        <Space>
                                            <Select 
                                                allowClear 
                                                placeholder="Lọc theo Phụ lục" 
                                                className="w-64"
                                                value={catalogFilterCategory}
                                                onChange={val => {
                                                    setCatalogFilterCategory(val || '');
                                                    fetchCatalog(1, catalogSearch, val || '');
                                                }}
                                                options={catalogCategories.map(name => ({label: name, value: name}))}
                                            />
                                            <Input.Search 
                                                placeholder="Tìm mã hoặc tên kỹ thuật..." 
                                                allowClear 
                                                onSearch={val => {
                                                    setCatalogSearch(val);
                                                    fetchCatalog(1, val, catalogFilterCategory);
                                                }}
                                            />
                                        </Space>
                                    </div>
                                    <Table 
                                        dataSource={catalogData} 
                                        columns={catalogColumns} 
                                        rowKey="id" 
                                        loading={catalogLoading}
                                        pagination={{ 
                                            current: catalogPage, 
                                            pageSize: 20, 
                                            total: catalogTotal,
                                            onChange: (page) => fetchCatalog(page)
                                        }}
                                        bordered
                                        size="small"
                                    />
                                </>
                            )
                        }
                    ]}
                />
            </Card>

            <Modal
                title={editingCat ? "Cập nhật Nhóm TT32" : "Thêm Nhóm TT32 mới"}
                open={isCatModalOpen}
                onCancel={() => setIsCatModalOpen(false)}
                onOk={() => catForm.submit()}
                width={600}
            >
                <Form form={catForm} layout="vertical" onFinish={handleSaveCategory}>
                    <Form.Item name="code" label="Mã Nhóm (VD: PL5)" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="name" label="Tên Nhóm (VD: Bác sĩ Y khoa)" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="Ghi chú">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="chapterCodes" label="Các Chương dịch vụ được phép thực hiện (Mã Prefix)">
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder="Chọn các chương (01, 02...)"
                            options={chapters.map(c => ({
                                label: `${c.code} - ${c.name}`,
                                value: c.code
                            }))}
                            filterOption={(input, option) => 
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
