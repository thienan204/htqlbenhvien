'use client';
import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Button, InputNumber, Select, message, Spin, Space, TimePicker, Upload, Tag, Checkbox, Tabs } from 'antd';
import { SaveOutlined, SearchOutlined, UploadOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import ExcelTemplateConfig from './ExcelTemplateConfig';
import ExcelTemplateConfig from './ExcelTemplateConfig';
const { Option } = Select;

export default function ClinicalSchedulingConfigPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bufferTime, setBufferTime] = useState<number>(5);
    const [departments, setDepartments] = useState<any[]>([]);
    const [deptHours, setDeptHours] = useState<{ [key: string]: any }>({});
    const [deptSearchText, setDeptSearchText] = useState('');

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
                let depts = data.departments || [];
                if (user?.role !== 'ADMIN' && user?.ma_khoa) {
                    depts = depts.filter((d: any) => d.MA_KHOA === user.ma_khoa);
                }
                setDepartments(depts);
                setDeptHours(data.deptHours || {});
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
            const res = await fetch('/api/clinical-scheduling/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bufferTime,
                    deptHours
                })
            });
            const data = await res.json();
            
            if (data.success) {
                message.success('Đã lưu cấu hình thành công!');
            } else {
                message.error('Lỗi lưu cấu hình: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ khi lưu');
        } finally {
            setSaving(false);
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


        </div>
    );
}
