'use client';
import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Switch, message, Spin, DatePicker, Tag, Row, Col, Radio, Tooltip, ConfigProvider } from 'antd';
import dayjs from 'dayjs';

const { Option } = Select;

export default function ClinicalSchedulingAttendancePage() {
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
    const [selectedDept, setSelectedDept] = useState<string | undefined>(undefined);
    const [staffList, setStaffList] = useState<any[]>([]);

    const [attendanceStatuses, setAttendanceStatuses] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, [selectedDate, selectedDept]);

    const fetchData = async () => {
        try {
            setLoading(true);
            let url = `/api/clinical-scheduling/attendance?date=${selectedDate}`;
            if (selectedDept) {
                url += `&maKhoa=${selectedDept}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            
            if (data.success) {
                if (departments.length === 0 && data.departments) {
                    setDepartments(data.departments);
                }
                if (attendanceStatuses.length === 0 && data.attendanceStatuses) {
                    setAttendanceStatuses(data.attendanceStatuses);
                }
                setStaffList(data.staffList || []);
            } else {
                message.error('Lỗi tải dữ liệu: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeStatus = async (staffId: string, statusId: string | null) => {
        const newData = [...staffList];
        const index = newData.findIndex(item => item.id === staffId);
        let oldStatus = null;
        let currentDvkt = true;
        if (index > -1) {
            oldStatus = newData[index].statusId;
            currentDvkt = newData[index].is_thuc_hien_dvkt !== false;
            newData[index].statusId = statusId;
            setStaffList(newData);
        }

        try {
            const res = await fetch('/api/clinical-scheduling/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    staffId: staffId,
                    statusId: statusId,
                    is_thuc_hien_dvkt: currentDvkt
                })
            });
            const data = await res.json();
            
            if (data.success) {
                // message.success(`Đã cập nhật trạng thái thành công`);
            } else {
                message.error('Lỗi cập nhật: ' + data.message);
                if (index > -1) {
                    const revertedData = [...staffList];
                    revertedData[index].statusId = oldStatus;
                    setStaffList(revertedData);
                }
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ khi lưu');
            if (index > -1) {
                const revertedData = [...staffList];
                revertedData[index].statusId = oldStatus;
                setStaffList(revertedData);
            }
        }
    };

    const handleChangeDvkt = async (staffId: string, checked: boolean) => {
        // Optimistic UI update
        const index = staffList.findIndex(s => s.id === staffId);
        const oldState = index > -1 ? staffList[index].is_thuc_hien_dvkt : true;
        let currentStatusId = null;
        
        if (index > -1) {
            currentStatusId = staffList[index].statusId;
            const newData = [...staffList];
            newData[index].is_thuc_hien_dvkt = checked;
            setStaffList(newData);
        }

        try {
            const res = await fetch('/api/clinical-scheduling/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    staffId: staffId,
                    is_thuc_hien_dvkt: checked,
                    statusId: currentStatusId
                })
            });
            const data = await res.json();
            
            if (!data.success) {
                message.error('Lỗi cập nhật DVKT: ' + data.message);
                if (index > -1) {
                    const revertedData = [...staffList];
                    revertedData[index].is_thuc_hien_dvkt = oldState;
                    setStaffList(revertedData);
                }
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ khi lưu trạng thái DVKT');
            if (index > -1) {
                const revertedData = [...staffList];
                revertedData[index].is_thuc_hien_dvkt = oldState;
                setStaffList(revertedData);
            }
        }
    };

    const columns = [
        {
            title: 'Mã NV',
            dataIndex: 'ma_nv',
            key: 'ma_nv',
            width: 120,
        },
        {
            title: 'Họ tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
        },
        {
            title: 'Chức danh',
            dataIndex: 'chuc_danh',
            key: 'chuc_danh',
            width: 150,
        },
        {
            title: 'Trạng thái (Điểm danh)',
            dataIndex: 'statusId',
            key: 'statusId',
            width: 400,
            render: (statusId: string | null, record: any) => {
                // Tìm ID của trạng thái DI_LAM làm mặc định nếu chưa điểm danh
                const defaultStatus = attendanceStatuses.find(s => s.code === 'DI_LAM' || s.code === 'DI_LAM_HANH_CHINH');
                const defaultStatusId = defaultStatus ? defaultStatus.id : (attendanceStatuses.length > 0 ? attendanceStatuses[0].id : null);
                const currentValue = statusId || defaultStatusId;

                return (
                    <ConfigProvider theme={{ token: { colorPrimary: '#16a34a' } }}>
                        <Radio.Group 
                            value={currentValue} 
                            onChange={(e) => handleChangeStatus(record.id, e.target.value)}
                            buttonStyle="solid"
                            size="middle"
                        >
                            {attendanceStatuses.map(status => (
                                <Tooltip title={status.name} key={status.id}>
                                    <Radio.Button value={status.id}>
                                        {status.code}
                                    </Radio.Button>
                                </Tooltip>
                            ))}
                        </Radio.Group>
                    </ConfigProvider>
                );
            }
        },
        {
            title: 'Thực hiện DVKT',
            dataIndex: 'is_thuc_hien_dvkt',
            key: 'is_thuc_hien_dvkt',
            width: 150,
            align: 'center' as const,
            render: (val: boolean, record: any) => {
                const isChecked = val !== false; // Mặc định true
                return (
                    <Tooltip title={isChecked ? "Có thực hiện dịch vụ kỹ thuật" : "Không làm dịch vụ kỹ thuật (VD: Làm hành chính)"}>
                        <Switch 
                            checked={isChecked} 
                            onChange={(checked) => handleChangeDvkt(record.id, checked)}
                            checkedChildren="Có"
                            unCheckedChildren="Không"
                            style={isChecked ? { backgroundColor: '#16a34a' } : undefined}
                        />
                    </Tooltip>
                );
            }
        }
    ];

    return (
        <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
            <h1 style={{ fontSize: 24, marginBottom: 24, fontWeight: 'bold' }}>Quản lý Nhân sự Điểm danh (Khoa/Phòng)</h1>
            
            <Card style={{ marginBottom: 24 }}>
                <Row gutter={24} align="middle">
                    <Col span={8}>
                        <div style={{ marginBottom: 8 }}><strong>Chọn ngày:</strong></div>
                        <DatePicker 
                            value={dayjs(selectedDate)}
                            onChange={(date) => {
                                if (date) {
                                    setSelectedDate(date.format('YYYY-MM-DD'));
                                }
                            }}
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                            allowClear={false}
                        />
                    </Col>
                    <Col span={16}>
                        <div style={{ marginBottom: 8 }}><strong>Chọn Khoa/Phòng:</strong></div>
                        <Select
                            value={selectedDept}
                            onChange={(val) => setSelectedDept(val)}
                            placeholder="--- Vui lòng chọn Khoa/Phòng ---"
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                            virtual={false}
                        >
                            {departments.map(dept => (
                                <Option key={dept.ma_khoa} value={dept.ma_khoa}>
                                    [{dept.ma_khoa}] {dept.ten_khoa}
                                </Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </Card>

            <Card title={`Danh sách nhân viên - Ngày ${dayjs(selectedDate).format('DD/MM/YYYY')}`}>
                {!selectedDept ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                        Vui lòng chọn Khoa/Phòng ở phía trên để xem danh sách nhân viên.
                    </div>
                ) : loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <Table 
                        dataSource={staffList} 
                        columns={columns} 
                        rowKey="id"
                        pagination={false}
                        bordered
                        size="small"
                    />
                )}
            </Card>
        </div>
    );
}
