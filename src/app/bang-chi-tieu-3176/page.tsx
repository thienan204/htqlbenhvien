'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, Table, Tag, Typography, Card, Space, Input, Button, Modal, Form, Select, message, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, BookOutlined, PlusOutlined, EditOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export interface XmlDictionaryItem {
    stt: number;
    chiTieu: string;
    kieuDuLieu: string;
    kichThuocToiDa: string;
    dienGiai130: string;
    dinhChinh4750: string;
    dieuChinh: string;
}

export default function BangChiTieuPage() {
    const [searchText, setSearchText] = useState('');
    const [data, setData] = useState<Record<string, XmlDictionaryItem[]>>({});
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingXmlType, setEditingXmlType] = useState<string>('XML1');
    const [editingItem, setEditingItem] = useState<XmlDictionaryItem | null>(null);
    const [form] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/xml-dictionary');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            message.error('Không thể tải dữ liệu từ điển.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = (xmlType: string) => {
        setEditingXmlType(xmlType);
        setEditingItem(null);
        form.resetFields();
        form.setFieldsValue({
            stt: (data[xmlType]?.length || 0) + 1,
            kieuDuLieu: 'Chuỗi',
            kichThuocToiDa: '',
            dienGiai130: '',
            dinhChinh4750: '',
            dieuChinh: ''
        });
        setIsModalOpen(true);
    };

    const handleEdit = (xmlType: string, record: XmlDictionaryItem) => {
        setEditingXmlType(xmlType);
        setEditingItem(record);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            
            const newData = { ...data };
            if (!newData[editingXmlType]) {
                newData[editingXmlType] = [];
            }

            if (editingItem) {
                // Update
                newData[editingXmlType] = newData[editingXmlType].map(item => 
                    item.chiTieu === editingItem.chiTieu ? { ...values, stt: Number(values.stt) } : item
                );
            } else {
                // Add
                // Check if chiTieu already exists
                if (newData[editingXmlType].some(item => item.chiTieu === values.chiTieu)) {
                    message.error(`Trường ${values.chiTieu} đã tồn tại trong ${editingXmlType}!`);
                    return;
                }
                newData[editingXmlType].push({ ...values, stt: Number(values.stt) });
            }

            // Sort by STT
            newData[editingXmlType].sort((a, b) => a.stt - b.stt);

            // Save to server
            const res = await fetch('/api/xml-dictionary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            });

            if (res.ok) {
                setData(newData);
                message.success('Đã lưu thành công!');
                setIsModalOpen(false);
            } else {
                message.error('Lỗi khi lưu dữ liệu.');
            }
        } catch (error) {
            console.error('Validation Failed:', error);
        }
    };

    const handleDownloadTemplate = (xmlType: string) => {
        const currentData = data[xmlType] || [];
        
        let templateData: any[] = [];
        
        if (currentData.length > 0) {
            templateData = currentData.map(item => ({
                'STT': item.stt,
                'Chỉ tiêu': item.chiTieu,
                'Kiểu dữ liệu': item.kieuDuLieu,
                'Kích thước tối đa': item.kichThuocToiDa || '',
                'Diễn giải theo QĐ 130/4750': item.dienGiai130 || '',
                'Đính chính theo QĐ 3176': item.dinhChinh4750 || '',
                'Điều chỉnh': item.dieuChinh || ''
            }));
        } else {
            templateData = [
                {
                    'STT': 1,
                    'Chỉ tiêu': 'MA_LK',
                    'Kiểu dữ liệu': 'Chuỗi',
                    'Kích thước tối đa': '100',
                    'Diễn giải theo QĐ 130/4750': 'Mã liên kết',
                    'Đính chính theo QĐ 3176': '',
                    'Điều chỉnh': 'Giữ nguyên'
                }
            ];
        }

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, xmlType);
        XLSX.writeFile(workbook, `Mau_Nhap_Chi_Tieu_${xmlType}.xlsx`);
    };

    const handleImportExcel = (file: File, xmlType: string) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const dataBuffer = e.target?.result;
                if (!dataBuffer) return;
                
                const workbook = XLSX.read(dataBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];

                if (!rawData || rawData.length === 0) {
                    message.error('File Excel không có dữ liệu!');
                    return;
                }

                // Map Excel data to XmlDictionaryItem format
                const importedItems: XmlDictionaryItem[] = rawData.map((row, index) => {
                    return {
                        stt: Number(row['STT']) || index + 1,
                        chiTieu: String(row['Chỉ tiêu'] || '').trim(),
                        kieuDuLieu: String(row['Kiểu dữ liệu'] || 'Chuỗi').trim(),
                        kichThuocToiDa: String(row['Kích thước tối đa'] || '').trim(),
                        dienGiai130: String(row['Diễn giải theo QĐ 130/4750'] || '').trim(),
                        dinhChinh4750: String(row['Đính chính theo QĐ 3176'] || '').trim(),
                        dieuChinh: String(row['Điều chỉnh'] || '').trim()
                    };
                }).filter(item => item.chiTieu); // Bỏ qua các dòng trống

                if (importedItems.length === 0) {
                    message.error('Không tìm thấy cột "Chỉ tiêu" hợp lệ trong file Excel.');
                    return;
                }

                // NEW LOGIC: Upsert (Cập nhật & Thêm mới)
                const existingItems = data[xmlType] || [];
                const updatedItemsMap = new Map<string, XmlDictionaryItem>();

                // 1. Giữ lại toàn bộ item cũ
                existingItems.forEach(item => {
                    updatedItemsMap.set(item.chiTieu, item);
                });

                // 2. Ghi đè/Thêm mới từ file Excel (dựa vào chiTieu)
                importedItems.forEach(item => {
                    updatedItemsMap.set(item.chiTieu, item);
                });

                // 3. Lấy danh sách cuối cùng và sắp xếp lại theo STT
                const mergedItems = Array.from(updatedItemsMap.values());
                mergedItems.sort((a, b) => a.stt - b.stt);

                const newData = { ...data, [xmlType]: mergedItems };

                // Lưu lên server
                setLoading(true);
                const res = await fetch('/api/xml-dictionary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newData)
                });

                if (res.ok) {
                    setData(newData);
                    message.success(`Đã import thành công: Cập nhật & Thêm mới cho ${xmlType} (Đã giữ nguyên trường cũ)!`);
                } else {
                    message.error('Lỗi khi lưu dữ liệu lên máy chủ.');
                }
            } catch (error) {
                console.error("Error reading Excel:", error);
                message.error('Lỗi đọc file Excel. Vui lòng kiểm tra lại định dạng file.');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const columns = (xmlType: string): ColumnsType<XmlDictionaryItem> => [
        {
            title: 'Hành động',
            key: 'action',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Button 
                    type="text" 
                    icon={<EditOutlined className="text-blue-500" />} 
                    onClick={() => handleEdit(xmlType, record)} 
                />
            )
        },
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 60,
            align: 'center',
            render: (text) => <Text strong>{text}</Text>
        },
        {
            title: 'Chỉ tiêu',
            dataIndex: 'chiTieu',
            key: 'chiTieu',
            width: 150,
            render: (text) => <Text code className="text-blue-700 font-bold text-sm bg-blue-50 border-blue-100">{text}</Text>
        },
        {
            title: 'Kiểu',
            dataIndex: 'kieuDuLieu',
            key: 'kieuDuLieu',
            width: 100,
            render: (text, record) => (
                <div className="flex flex-col">
                    <Text>{text}</Text>
                    {record.kichThuocToiDa && <Text type="secondary" className="text-xs">Max: {record.kichThuocToiDa}</Text>}
                </div>
            )
        },
        {
            title: 'QĐ 130/4750',
            dataIndex: 'dienGiai130',
            key: 'dienGiai130',
            render: (text) => (
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'Xem thêm' }} className="mb-0 text-sm whitespace-pre-line text-slate-700">
                    {text}
                </Paragraph>
            )
        },
        {
            title: 'QĐ 3176 (Thay đổi)',
            dataIndex: 'dinhChinh4750',
            key: 'dinhChinh4750',
            render: (text) => (
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'Xem thêm' }} className="mb-0 text-sm whitespace-pre-line text-slate-700">
                    {text}
                </Paragraph>
            )
        },
        {
            title: 'Ghi chú',
            dataIndex: 'dieuChinh',
            key: 'dieuChinh',
            width: 100,
            align: 'center',
            render: (text) => {
                if (!text) return null;
                if (text.toLowerCase().includes('sửa đổi')) return <Tag color="gold" className="font-bold">{text}</Tag>;
                if (text.toLowerCase().includes('mới')) return <Tag color="green" className="font-bold">{text}</Tag>;
                if (text.toLowerCase().includes('xóa')) return <Tag color="red" className="font-bold">{text}</Tag>;
                return <Tag color="blue">{text}</Tag>;
            }
        }
    ];

    const tabItems = Object.keys(data).map(xmlType => {
        const xmlData = data[xmlType] || [];
        
        const filteredData = xmlData.filter(item => 
            item.chiTieu.toLowerCase().includes(searchText.toLowerCase()) ||
            (item.dienGiai130 && item.dienGiai130.toLowerCase().includes(searchText.toLowerCase()))
        );

        return {
            key: xmlType,
            label: xmlType,
            children: (
                <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-4">
                    <div className="mb-4 flex justify-between items-center">
                        <Space>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownloadTemplate(xmlType)}
                            >
                                Tải File Mẫu
                            </Button>
                            <Upload
                                accept=".xlsx, .xls"
                                showUploadList={false}
                                beforeUpload={(file) => {
                                    handleImportExcel(file, xmlType);
                                    return false; // Prevent default upload behavior
                                }}
                            >
                                <Button icon={<UploadOutlined />} className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100">
                                    Nhập Excel
                                </Button>
                            </Upload>
                        </Space>
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />} 
                            onClick={() => handleAdd(xmlType)}
                        >
                            Thêm chỉ tiêu {xmlType}
                        </Button>
                    </div>
                    <Table
                        columns={columns(xmlType)}
                        dataSource={filteredData}
                        rowKey="chiTieu"
                        pagination={false}
                        bordered
                        size="small"
                        loading={loading}
                        rowClassName={(record, index) => index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                        scroll={{ y: 'calc(100vh - 330px)', x: 'max-content' }}
                    />
                </div>
            )
        };
    });

    return (
        <div className="min-h-screen bg-slate-100 p-6 flex flex-col">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <BookOutlined className="text-blue-600" />
                        Từ điển Bảng Chỉ Tiêu XML
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Tra cứu các trường dữ liệu theo QĐ 130/4750 và QĐ 3176
                    </p>
                </div>
                <div>
                    <Input
                        placeholder="Tìm kiếm Tên trường, Mô tả..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="w-80 rounded-full shadow-sm"
                        allowClear
                        size="large"
                    />
                </div>
            </div>

            <div className="flex-1 drop-shadow-sm">
                <Tabs 
                    type="card" 
                    items={tabItems} 
                    className="custom-tabs"
                    tabBarStyle={{ marginBottom: 0 }}
                />
            </div>

            <Modal
                title={editingItem ? `Chỉnh sửa ${editingItem.chiTieu} (${editingXmlType})` : `Thêm mới chỉ tiêu (${editingXmlType})`}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={handleSave}
                width={800}
                okText="Lưu lại"
                cancelText="Hủy bỏ"
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <div className="grid grid-cols-4 gap-4">
                        <Form.Item name="stt" label="STT" rules={[{ required: true }]}>
                            <Input type="number" />
                        </Form.Item>
                        <Form.Item name="chiTieu" label="Tên Trường (Chỉ tiêu)" rules={[{ required: true }]} className="col-span-3">
                            <Input disabled={!!editingItem} placeholder="VD: MA_LK" />
                        </Form.Item>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="kieuDuLieu" label="Kiểu dữ liệu" rules={[{ required: true }]}>
                            <Select>
                                <Option value="Chuỗi">Chuỗi</Option>
                                <Option value="Số">Số</Option>
                                <Option value="Ngày tháng">Ngày tháng</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="kichThuocToiDa" label="Kích thước tối đa">
                            <Input placeholder="VD: 100" />
                        </Form.Item>
                    </div>
                    <Form.Item name="dienGiai130" label="Diễn giải theo QĐ 130/4750">
                        <TextArea rows={4} placeholder="Nhập diễn giải chi tiết..." />
                    </Form.Item>
                    <Form.Item name="dinhChinh4750" label="Đính chính theo QĐ 3176">
                        <TextArea rows={2} placeholder="Nội dung thay đổi (nếu có)..." />
                    </Form.Item>
                    <Form.Item name="dieuChinh" label="Điều chỉnh (Ghi chú)">
                        <TextArea rows={2} placeholder="Nhập ghi chú điều chỉnh (nếu có)..." />
                    </Form.Item>
                </Form>
            </Modal>

            <style jsx global>{`
                .custom-tabs .ant-tabs-nav {
                    background: #1e293b; /* slate-800 */
                    border-radius: 8px 8px 0 0;
                    padding: 8px 8px 0 8px;
                }
                .custom-tabs .ant-tabs-tab {
                    border: none !important;
                    background: transparent !important;
                    color: #94a3b8 !important;
                }
                .custom-tabs .ant-tabs-tab-active {
                    background: white !important;
                    color: #0f172a !important;
                    font-weight: bold;
                    border-radius: 6px 6px 0 0 !important;
                }
                .custom-tabs .ant-table-thead > tr > th {
                    background-color: #3b82f6 !important; /* blue-500 */
                    color: white !important;
                    font-weight: bold;
                }
                .custom-tabs .ant-table-wrapper .ant-table-container {
                    border-radius: 8px;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
}
