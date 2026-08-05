'use client';
import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Button, InputNumber, Select, message, Spin, Space, TimePicker, Upload, Tag, Checkbox, Tabs } from 'antd';
import { SaveOutlined, SearchOutlined, UploadOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import ExcelTemplateConfig from './ExcelTemplateConfig';

const { Option } = Select;

export default function ClinicalSchedulingConfigPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bufferTime, setBufferTime] = useState<number>(5);
    const [services, setServices] = useState<any[]>([]);
    const [filterCodes, setFilterCodes] = useState<string[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [deptHours, setDeptHours] = useState<{ [key: string]: any }>({});
    const [qualifications, setQualifications] = useState<any[]>([]);
    const [deptSearchText, setDeptSearchText] = useState('');
    const [searchText, setSearchText] = useState('');
    const [editedRows, setEditedRows] = useState<{ [id: string]: any }>({});

    useEffect(() => {
        if (user !== undefined) {
            fetchConfig();
        }
    }, [user]);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/clinical-scheduling/config');
            const data = await res.json();
            if (data.success) {
                setBufferTime(data.bufferTime);
                setServices(data.services);
                
                let depts = data.departments || [];
                if (user?.role !== 'ADMIN' && user?.ma_khoa) {
                    depts = depts.filter((d: any) => d.MA_KHOA === user.ma_khoa);
                }
                setDepartments(depts);
                setDeptHours(data.deptHours || {});
                
                // Lọc bỏ các trùng lặp tên trình độ/chức danh
                if (data.qualifications) {
                    const uniqueQuals = Array.from(new Set(data.qualifications.map((q: any) => q.name))).map(name => {
                        return data.qualifications.find((q: any) => q.name === name);
                    });
                    setQualifications(uniqueQuals);
                }
            } else {
                message.error('Lỗi tải dữ liệu: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const updatedServices = Object.values(editedRows);
            
            const res = await fetch('/api/clinical-scheduling/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bufferTime,
                    deptHours,
                    updatedServices: updatedServices.length > 0 ? updatedServices : undefined
                })
            });
            const data = await res.json();
            
            if (data.success) {
                message.success('Đã lưu cấu hình thành công!');
                setEditedRows({}); // Reset edited state
            } else {
                message.error('Lỗi lưu cấu hình: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ khi lưu');
        } finally {
            setSaving(false);
        }
    };

    const handleRowChange = (record: any, field: string, value: any) => {
        const newData = [...services];
        const index = newData.findIndex(item => item.id === record.id);
        if (index > -1) {
            newData[index][field] = value;
            setServices(newData);
            
            // Theo dõi các dòng bị sửa để tối ưu quá trình lưu (chỉ gửi những dòng bị sửa lên API)
            setEditedRows(prev => ({
                ...prev,
                [record.id]: {
                    ...prev[record.id],
                    id: record.id,
                    [field]: value
                }
            }));
        }
    };

    const handleDeptHoursChange = (maKhoa: string, field: string, timeString: string) => {
        setDeptHours(prev => ({
            ...prev,
            [maKhoa]: {
                ...(prev[maKhoa] || { morningStart: '07:30', morningEnd: '11:30', afternoonStart: '13:30', afternoonEnd: '17:30' }),
                [field]: timeString
            }
        }));
    };

    const deptColumns = [
        { title: 'Mã Khoa', dataIndex: 'MA_KHOA', width: 120 },
        { title: 'Tên Khoa', dataIndex: 'TEN_KHOA' },
        {
            title: 'Sáng bắt đầu',
            render: (_: any, record: any) => (
                <TimePicker 
                    format="HH:mm" 
                    value={deptHours[record.MA_KHOA]?.morningStart ? dayjs(deptHours[record.MA_KHOA].morningStart, 'HH:mm') : dayjs('07:30', 'HH:mm')}
                    onChange={(time, timeString) => handleDeptHoursChange(record.MA_KHOA, 'morningStart', timeString as string)}
                    allowClear={false}
                />
            )
        },
        {
            title: 'Sáng kết thúc',
            render: (_: any, record: any) => (
                <TimePicker 
                    format="HH:mm" 
                    value={deptHours[record.MA_KHOA]?.morningEnd ? dayjs(deptHours[record.MA_KHOA].morningEnd, 'HH:mm') : dayjs('11:30', 'HH:mm')}
                    onChange={(time, timeString) => handleDeptHoursChange(record.MA_KHOA, 'morningEnd', timeString as string)}
                    allowClear={false}
                />
            )
        },
        {
            title: 'Chiều bắt đầu',
            render: (_: any, record: any) => (
                <TimePicker 
                    format="HH:mm" 
                    value={deptHours[record.MA_KHOA]?.afternoonStart ? dayjs(deptHours[record.MA_KHOA].afternoonStart, 'HH:mm') : dayjs('13:30', 'HH:mm')}
                    onChange={(time, timeString) => handleDeptHoursChange(record.MA_KHOA, 'afternoonStart', timeString as string)}
                    allowClear={false}
                />
            )
        },
        {
            title: 'Chiều kết thúc',
            render: (_: any, record: any) => (
                <TimePicker 
                    format="HH:mm" 
                    value={deptHours[record.MA_KHOA]?.afternoonEnd ? dayjs(deptHours[record.MA_KHOA].afternoonEnd, 'HH:mm') : dayjs('17:30', 'HH:mm')}
                    onChange={(time, timeString) => handleDeptHoursChange(record.MA_KHOA, 'afternoonEnd', timeString as string)}
                    allowClear={false}
                />
            )
        },
        {
            title: 'Buffer mặc định (Phút)',
            width: 150,
            render: (_: any, record: any) => (
                <InputNumber
                    min={0}
                    value={deptHours[record.MA_KHOA]?.bufferTime !== undefined ? deptHours[record.MA_KHOA].bufferTime : bufferTime}
                    onChange={(val) => handleDeptHoursChange(record.MA_KHOA, 'bufferTime', val)}
                    placeholder="VD: 2"
                    style={{ width: '100%' }}
                />
            )
        }
    ];

    const columns = [
        {
            title: 'Mã Dịch vụ',
            dataIndex: 'MA_DICH_VU',
            key: 'MA_DICH_VU',
            width: 150,
        },
        {
            title: 'Tên Dịch vụ',
            dataIndex: 'TEN_DICH_VU',
            key: 'TEN_DICH_VU',
        },
        {
            title: 'Thời gian thực hiện (Phút)',
            dataIndex: 'thoigian_thuc_hien',
            key: 'thoigian_thuc_hien',
            width: 250,
            render: (text: number, record: any) => (
                <InputNumber
                    min={1}
                    value={text}
                    onChange={(val) => handleRowChange(record, 'thoigian_thuc_hien', val)}
                    placeholder="VD: 5"
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Khoảng nghỉ (Buffer)',
            dataIndex: 'buffer_time',
            key: 'buffer_time',
            width: 150,
            render: (text: number, record: any) => (
                <InputNumber
                    min={0}
                    value={text}
                    onChange={(val) => handleRowChange(record, 'buffer_time', val)}
                    placeholder="Theo khoa"
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Làm song song',
            dataIndex: 'is_concurrent',
            key: 'is_concurrent',
            width: 120,
            align: 'center' as const,
            render: (text: boolean, record: any) => (
                <Checkbox
                    checked={text}
                    onChange={(e) => handleRowChange(record, 'is_concurrent', e.target.checked)}
                />
            )
        },
        {
            title: 'Yêu cầu Máy móc',
            dataIndex: 'yeu_cau_may_moc',
            key: 'yeu_cau_may_moc',
            width: 250,
            render: (text: string, record: any) => (
                <Select
                    value={text || undefined}
                    onChange={(val) => handleRowChange(record, 'yeu_cau_may_moc', val)}
                    placeholder="Chọn loại máy"
                    style={{ width: '100%' }}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                >
                    {qualifications.filter(q => q.type === 'LOAI_MAY').map((q, idx) => (
                        <Option key={idx} value={q.code}>{q.name}</Option>
                    ))}
                </Select>
            )
        }
    ];

    // Hàm hỗ trợ: Chuyển tiếng Việt có dấu thành không dấu và lấy các chữ cái đầu
    const getInitials = (text: string) => {
        if (!text) return '';
        // Xóa dấu tiếng Việt
        const noAccent = text.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D');
        
        // Cắt theo khoảng trắng hoặc dấu gạch ngang, lấy chữ cái đầu
        return noAccent.split(/[\s\-\_]+/)
            .map(word => word.charAt(0))
            .join('')
            .toLowerCase();
    };

    const filteredDepartments = departments.filter(d => {
        const searchLower = deptSearchText.toLowerCase();
        const tenKhoa = d.TEN_KHOA || '';
        const maKhoa = d.MA_KHOA || '';
        const initials = getInitials(tenKhoa);
        
        return tenKhoa.toLowerCase().includes(searchLower) ||
               maKhoa.toLowerCase().includes(searchLower) ||
               initials.includes(searchLower);
    });

    const filteredServices = services.filter(s => {
        const searchLower = searchText.toLowerCase();
        const tenDichVu = s.TEN_DICH_VU || '';
        const maDichVu = s.MA_DICH_VU || '';
        const initials = getInitials(tenDichVu);
        
        // Nếu có list mã dịch vụ từ Excel, chỉ hiển thị những mã nằm trong list đó
        if (filterCodes.length > 0 && !filterCodes.includes(maDichVu)) {
            return false;
        }

        return tenDichVu.toLowerCase().includes(searchLower) ||
               maDichVu.toLowerCase().includes(searchLower) ||
               initials.includes(searchLower); // Tìm theo chữ cái đầu (VD: tcdtd)
    });

    const unconfiguredServices = filteredServices.filter(s => !s.thoigian_thuc_hien || s.thoigian_thuc_hien <= 0);
    const configuredServices = filteredServices.filter(s => s.thoigian_thuc_hien && s.thoigian_thuc_hien > 0);

    const handleUploadExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(firstSheet);
                
                const codes = new Set<string>();
                json.forEach((row: any) => {
                    const lowerRow: any = {};
                    for (const k in row) lowerRow[k.toLowerCase()] = row[k];
                    const code = lowerRow['mã dịch vụ'] || lowerRow['ma_dich_vu'] || lowerRow['madichvu'];
                    if (code) codes.add(code.toString());
                });

                if (codes.size === 0) {
                    message.warning('Không tìm thấy Mã dịch vụ nào trong file Excel (Cột cần có tên là "Mã dịch vụ").');
                } else {
                    setFilterCodes(Array.from(codes));
                    message.success(`Đã tự động lọc ra ${codes.size} dịch vụ dựa trên file Excel của bạn!`);
                }
            } catch (error) {
                message.error('Lỗi khi đọc file Excel.');
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    return (
        <div style={{ padding: 24, maxWidth: '100%', margin: '0 auto' }}>
            <h1 style={{ fontSize: 24, marginBottom: 24, fontWeight: 'bold' }}>Cấu hình Xếp lịch Cận Lâm Sàng</h1>
            
            <ExcelTemplateConfig />

            <Card title="Cấu hình chung" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span><strong>Khoảng cách nghỉ (Buffer Time) giữa 2 ca:</strong></span>
                    <InputNumber 
                        min={0} 
                        value={bufferTime} 
                        onChange={(v) => setBufferTime(v || 0)} 
                    />
                    <span>phút</span>
                </div>
                <div style={{ color: '#888', marginTop: 8, fontSize: 13 }}>
                    * Khoảng thời gian để nhân viên nghỉ ngơi hoặc chuẩn bị máy móc/vật tư trước khi bắt đầu dịch vụ tiếp theo.
                </div>
            </Card>

            <Card title="Cấu hình Khung giờ làm việc theo Khoa" style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 16 }}>
                    <Input
                        placeholder="Tìm kiếm theo Tên hoặc Mã Khoa..."
                        prefix={<SearchOutlined />}
                        value={deptSearchText}
                        onChange={e => setDeptSearchText(e.target.value)}
                        allowClear
                    />
                </div>
                <Table 
                    dataSource={filteredDepartments}
                    columns={deptColumns}
                    rowKey="MA_KHOA"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    bordered
                />
            </Card>

            <Card 
                title="Danh mục Dịch vụ (Mau 05)" 
                extra={
                    <Button 
                        type="primary" 
                        icon={<SaveOutlined />} 
                        onClick={handleSave} 
                        loading={saving}
                    >
                        Lưu Thay Đổi
                    </Button>
                }
            >
                <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                    <Input
                        placeholder="Tìm kiếm theo Tên hoặc Mã Dịch vụ..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        allowClear
                        style={{ width: 400 }}
                    />
                    
                    <Upload beforeUpload={handleUploadExcel} showUploadList={false} accept=".xlsx, .xls">
                        <Button icon={<UploadOutlined />}>Tải File Excel để Lọc nhanh</Button>
                    </Upload>

                    {filterCodes.length > 0 && (
                        <Tag 
                            color="blue" 
                            closable 
                            onClose={() => setFilterCodes([])}
                            style={{ fontSize: 14, padding: '4px 12px' }}
                        >
                            Đang lọc {filterCodes.length} dịch vụ từ Excel
                        </Tag>
                    )}
                </div>
                
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <Tabs
                        type="card"
                        defaultActiveKey="1"
                        items={[
                            {
                                key: '1',
                                label: `Tất cả (${filteredServices.length})`,
                                children: (
                                    <Table 
                                        dataSource={filteredServices} 
                                        columns={columns} 
                                        rowKey="id"
                                        pagination={{ pageSize: 20 }}
                                        bordered
                                        size="middle"
                                    />
                                )
                            },
                            {
                                key: '2',
                                label: <span style={{ color: unconfiguredServices.length > 0 ? '#ff4d4f' : 'inherit' }}>Chưa cấu hình ({unconfiguredServices.length})</span>,
                                children: (
                                    <Table 
                                        dataSource={unconfiguredServices} 
                                        columns={columns} 
                                        rowKey="id"
                                        pagination={{ pageSize: 20 }}
                                        bordered
                                        size="middle"
                                    />
                                )
                            },
                            {
                                key: '3',
                                label: <span style={{ color: '#52c41a' }}>Đã cấu hình ({configuredServices.length})</span>,
                                children: (
                                    <Table 
                                        dataSource={configuredServices} 
                                        columns={columns} 
                                        rowKey="id"
                                        pagination={{ pageSize: 20 }}
                                        bordered
                                        size="middle"
                                    />
                                )
                            }
                        ]}
                    />
                )}
            </Card>
        </div>
    );
}
