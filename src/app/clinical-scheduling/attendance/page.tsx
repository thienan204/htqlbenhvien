'use client';
import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Switch, Spin, DatePicker, Tag, Row, Col, Radio, Tooltip, ConfigProvider, Button, Alert, Space, App } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';

const { Option } = Select;

interface ClinicalSchedulingAttendancePageProps {
    initialDate?: string;
    initialDept?: string;
    onAttendanceUpdated?: () => void;
}

export default function ClinicalSchedulingAttendancePage({
    initialDate,
    initialDept,
    onAttendanceUpdated
}: ClinicalSchedulingAttendancePageProps = {}) {
    const { message } = App.useApp();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [confirmingBulk, setConfirmingBulk] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(initialDate || dayjs().format('YYYY-MM-DD'));
    const [selectedDept, setSelectedDept] = useState<string | undefined>(initialDept);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [attendanceStatuses, setAttendanceStatuses] = useState<any[]>([]);
    const [hasConfirmedAttendance, setHasConfirmedAttendance] = useState<boolean>(false);
    const [requireAttendance, setRequireAttendance] = useState<boolean>(false);
    const [hasTimesheetData, setHasTimesheetData] = useState<boolean>(true);
    const [timesheetCount, setTimesheetCount] = useState<number>(0);
    const [reloadingTimesheet, setReloadingTimesheet] = useState<boolean>(false);

    // Đồng bộ khi Props từ tab mẹ thay đổi
    useEffect(() => {
        if (initialDate && initialDate !== selectedDate) {
            setSelectedDate(initialDate);
        }
    }, [initialDate]);

    useEffect(() => {
        if (initialDept && initialDept !== selectedDept) {
            setSelectedDept(initialDept);
        }
    }, [initialDept]);

    useEffect(() => {
        fetchData();
    }, [selectedDate, selectedDept, user]);

    const fetchData = async (isReloadTimesheet = false) => {
        try {
            if (isReloadTimesheet) {
                setReloadingTimesheet(true);
            } else {
                setLoading(true);
            }
            let url = `/api/clinical-scheduling/attendance?date=${selectedDate}`;
            if (selectedDept) {
                url += `&maKhoa=${selectedDept}`;
            }
            if (isReloadTimesheet) {
                url += `&reloadFromTimesheet=true`;
            }

            const res = await fetch(url);
            const data = await res.json();
            
            if (data.success) {
                let depts = data.departments || [];
                if (user?.role !== 'ADMIN' && user?.ma_khoa) {
                    depts = depts.filter((d: any) => d.ma_khoa === user.ma_khoa);
                }

                if (departments.length === 0 && depts.length > 0) {
                    setDepartments(depts);
                    
                    // Tự động chọn khoa nếu chỉ có 1 khoa (hoặc user ko phải admin)
                    if (depts.length === 1 && !selectedDept) {
                        setSelectedDept(depts[0].ma_khoa);
                        return; 
                    }
                }
                
                if (attendanceStatuses.length === 0 && data.attendanceStatuses) {
                    setAttendanceStatuses(data.attendanceStatuses);
                }
                
                setStaffList(data.staffList || []);
                setHasConfirmedAttendance(!!data.hasConfirmedAttendance);
                setRequireAttendance(!!data.requireAttendance);
                setHasTimesheetData(!!data.hasTimesheetData);
                setTimesheetCount(data.timesheetCount || 0);

                if (isReloadTimesheet) {
                    if (data.hasTimesheetData) {
                        message.success(`Đã nạp lại thành công từ Bảng Chấm Công! (${data.timesheetCount}/${data.totalStaff || data.staffList?.length} nhân sự có công)`);
                    } else {
                        message.warning(`Bảng Chấm Công ngày ${dayjs(selectedDate).format('DD/MM/YYYY')} chưa có dữ liệu chấm công! Các trạng thái đã được đưa về trống.`);
                    }
                }
            } else {
                message.error('Lỗi tải dữ liệu: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
            setReloadingTimesheet(false);
        }
    };

    // Xác nhận điểm danh toàn khoa ngày này (Bulk Confirm)
    const handleBulkConfirm = async () => {
        if (!selectedDept || !selectedDate) {
            message.warning('Vui lòng chọn ngày và Khoa/Phòng');
            return;
        }
        if (staffList.length === 0) {
            message.warning('Khoa/Phòng chưa có nhân sự nào');
            return;
        }

        // Kiểm tra chặt chẽ khi bật cấu hình requireAttendance
        if (requireAttendance && !hasTimesheetData) {
            message.error(`Khoa chưa có dữ liệu chấm công ngày ${dayjs(selectedDate).format('DD/MM/YYYY')}. Vui lòng chấm công trước khi xác nhận điểm danh!`);
            return;
        }

        const validStaffCount = staffList.filter(s => !!s.statusId).length;
        if (requireAttendance && validStaffCount === 0) {
            message.error('Chưa có nhân sự nào được chấm công. Vui lòng chấm công tại Bảng Chấm Công trước!');
            return;
        }

        setConfirmingBulk(true);
        try {
            const res = await fetch('/api/clinical-scheduling/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bulkConfirm: true,
                    date: selectedDate,
                    maKhoa: selectedDept,
                    staffList: staffList.map(s => ({
                        staffId: s.id,
                        statusId: s.statusId || null,
                        is_thuc_hien_dvkt: s.hasCCHN !== false && !!s.statusId && s.is_thuc_hien_dvkt !== false
                    }))
                })
            });

            const data = await res.json();
            if (data.success) {
                message.success(`Đã xác nhận điểm danh thành công ngày ${dayjs(selectedDate).format('DD/MM/YYYY')} cho ${staffList.length} nhân sự!`);
                setHasConfirmedAttendance(true);
                fetchData();
                onAttendanceUpdated?.();
            } else {
                message.error('Lỗi khi xác nhận điểm danh: ' + data.message);
            }
        } catch (error) {
            message.error('Lỗi kết nối khi xác nhận điểm danh');
        } finally {
            setConfirmingBulk(false);
        }
    };

    const handleChangeStatus = async (staffId: string, statusId: string | null) => {
        const newData = [...staffList];
        const index = newData.findIndex(item => item.id === staffId);
        let oldStatus = null;
        let oldDvkt = true;
        let currentDvkt = true;
        if (index > -1) {
            oldStatus = newData[index].statusId;
            oldDvkt = newData[index].is_thuc_hien_dvkt !== false;

            const stObj = attendanceStatuses.find(s => s.id === statusId);
            if (stObj) {
                // Các trạng thái có đi làm thực tế trong ngày -> Tự động bật quyền DVKT = Có
                if (['DI_LAM', 'TRUC', 'NGHI_BU_NUA_NGAY', 'NGHI_PHEP_NUA_NGAY'].includes(stObj.code)) {
                    currentDvkt = true;
                } else if (['DI_HOC', 'NGHI_PHEP', 'NGHI_OM', 'NGHI_BU', 'NGHI_LE', 'NGHI_THAI_SAN', 'NGHI_KHONG_LUONG'].includes(stObj.code)) {
                    // Nghỉ cả ngày hoặc đi học -> Tự động tắt quyền DVKT để chống xuất toán BHYT
                    currentDvkt = false;
                }
            }

            newData[index].statusId = statusId;
            newData[index].is_thuc_hien_dvkt = currentDvkt;
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
                setHasConfirmedAttendance(true);
                onAttendanceUpdated?.();
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
        const index = staffList.findIndex(s => s.id === staffId);
        if (index > -1 && staffList[index].hasCCHN === false) {
            message.warning('Nhân sự chưa có CCHN trong hệ thống, tuyệt đối không thể cấp quyền thực hiện DVKT!');
            return;
        }

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
            
            if (data.success) {
                setHasConfirmedAttendance(true);
                onAttendanceUpdated?.();
            } else {
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
            width: 110,
        },
        {
            title: 'Họ tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 200,
            render: (name: string, record: any) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">{name}</span>
                    {record.hasCCHN ? (
                        <span className="text-[11px] text-emerald-600 font-medium">
                            ✓ CCHN: {record.so_cchn || 'Có'}
                        </span>
                    ) : (
                        <span className="text-[11px] text-rose-600 font-semibold">
                            🚫 Chưa có CCHN
                        </span>
                    )}
                </div>
            )
        },
        {
            title: 'Chức danh',
            dataIndex: 'chuc_danh',
            key: 'chuc_danh',
            width: 150,
            render: (chucDanh: string, record: any) => (
                <div className="flex flex-col">
                    <span className="text-slate-700">{chucDanh || record.trinh_do || '---'}</span>
                    {!record.hasCCHN && (
                        <Tag color="error" className="w-fit text-[10px] mt-0.5 px-1 py-0 leading-tight">
                            Không có CCHN
                        </Tag>
                    )}
                </div>
            )
        },
        {
            title: 'Trạng thái (Điểm danh theo Danh mục)',
            dataIndex: 'statusId',
            key: 'statusId',
            width: 580,
            render: (statusId: string | null, record: any) => {
                const currentValue = statusId || undefined;

                // Hàm hiển thị nhãn ngắn gọn nhưng thân thiện
                const getLabel = (s: any) => {
                    if (s.code === 'DI_LAM') return 'Đi làm (x/+)';
                    if (s.code === 'TRUC') return 'Trực (T)';
                    if (s.code === 'NGHI_BU') return 'Nghỉ bù (Nb)';
                    if (s.code === 'NGHI_BU_NUA_NGAY') return 'Bù 1/2 (Nb/2)';
                    if (s.code === 'NGHI_PHEP') return 'Phép (P)';
                    if (s.code === 'NGHI_PHEP_NUA_NGAY') return 'Phép 1/2 (P/2)';
                    if (s.code === 'DI_HOC') return 'Đi học (H)';
                    if (s.code === 'NGHI_LE') return 'Lễ (L)';
                    if (s.code === 'NGHI_OM') return 'Ốm (Ô)';
                    if (s.code === 'NGHI_THAI_SAN') return 'Thai sản (TS)';
                    if (s.code === 'NGHI_KHONG_LUONG') return 'Không lương (KL)';
                    return s.name;
                };

                return (
                    <div className="flex flex-col gap-1 py-1">
                        {!statusId && (
                            <div className="mb-1">
                                <Tag color="default" className="text-xs text-slate-500 font-medium">
                                    ⚪ Chưa chấm công (Chưa có công bên Bảng Chấm Công)
                                </Tag>
                            </div>
                        )}
                        <ConfigProvider theme={{ token: { colorPrimary: '#16a34a' } }}>
                            <Radio.Group 
                                value={currentValue} 
                                onChange={(e) => handleChangeStatus(record.id, e.target.value)}
                                buttonStyle="solid"
                                size="small"
                                className="flex flex-wrap gap-1"
                            >
                                {attendanceStatuses.map(status => (
                                    <Tooltip title={`${status.name} (${status.description || status.code})`} key={status.id}>
                                        <Radio.Button value={status.id} className="text-xs px-2 py-0.5 rounded">
                                            {getLabel(status)}
                                        </Radio.Button>
                                    </Tooltip>
                                ))}
                            </Radio.Group>
                        </ConfigProvider>
                    </div>
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
                const hasStatus = !!record.statusId;
                const hasCCHN = record.hasCCHN !== false;
                const isChecked = hasCCHN && hasStatus && val !== false;
                const isDisabled = !hasCCHN || !hasStatus;

                let tooltipMsg = "Có thực hiện dịch vụ kỹ thuật";
                if (!hasCCHN) {
                    tooltipMsg = "Nhân sự KHÔNG CÓ CCHN trong hệ thống, tuyệt đối không được thực hiện DVKT (chống xuất toán BHYT).";
                } else if (!hasStatus) {
                    tooltipMsg = "Nhân sự chưa được chấm công bên Bảng Chấm Công, không thể thực hiện DVKT.";
                } else if (!isChecked) {
                    tooltipMsg = "Không làm dịch vụ kỹ thuật (VD: Làm hành chính).";
                }

                return (
                    <Tooltip title={tooltipMsg}>
                        <Switch 
                            checked={isChecked} 
                            disabled={isDisabled}
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

    const handleSetAllWorking = () => {
        const defaultStatus = attendanceStatuses.find(s => s.code === 'DI_LAM' || s.code === 'DI_LAM_HANH_CHINH');
        const defaultStatusId = defaultStatus ? defaultStatus.id : (attendanceStatuses[0]?.id || null);
        const updated = staffList.map(s => ({
            ...s,
            statusId: defaultStatusId,
            is_thuc_hien_dvkt: s.hasCCHN !== false
        }));
        setStaffList(updated);
        message.info('Đã chuyển tất cả sang "Đi làm". Nhân sự không có CCHN tự động khóa quyền DVKT.');
    };

    const currentWorkingCount = staffList.filter(s => s.is_thuc_hien_dvkt !== false).length;
    const currentOffCount = staffList.length - currentWorkingCount;

    return (
        <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                    <h1 style={{ fontSize: 24, margin: 0, fontWeight: 'bold' }}>Quản lý người thực hiện DVKT (Điểm danh khoa)</h1>
                    <p className="text-xs text-slate-500 mt-1 mb-0">
                        Xác nhận nhân sự đi làm / nghỉ thực tế trong ngày để liên thông sang bộ chia lịch PTTT và chống xuất toán BHYT.
                    </p>
                </div>
                {requireAttendance && (
                    <Tag color="red" className="px-3 py-1 text-sm font-semibold">
                        🔒 ĐANG BẬT CẤU HÌNH: Bắt buộc điểm danh mới được chia lịch
                    </Tag>
                )}
            </div>
            
            <Card style={{ marginBottom: 20 }}>
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

            {selectedDept && (
                <>
                    {requireAttendance && !hasTimesheetData ? (
                        <Alert 
                            type="error"
                            showIcon
                            icon={<ExclamationCircleOutlined />}
                            style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #f87171', backgroundColor: '#fef2f2' }}
                            title={
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <div className="text-sm font-bold text-red-700">
                                            ⚠️ BẢNG CHẤM CÔNG NGÀY {dayjs(selectedDate).format('DD/MM/YYYY')} CHƯA CÓ DỮ LIỆU!
                                        </div>
                                        <div className="text-xs text-red-600 mt-1">
                                            Hệ thống đang BẬT cấu hình bắt buộc chấm công. Khoa bắt buộc phải hoàn thành chấm công tại <strong>Bảng Chấm Công</strong> trước khi điểm danh và chia lịch DVKT/PTTT.
                                        </div>
                                    </div>
                                    <Button
                                        type="primary"
                                        danger
                                        size="middle"
                                        href={`/htqlbenhvien/staff/attendance?maKhoa=${selectedDept}&date=${selectedDate}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontWeight: 600 }}
                                    >
                                        👉 Mở Bảng Chấm Công Khoa để chấm ngay
                                    </Button>
                                </div>
                            }
                        />
                    ) : hasConfirmedAttendance ? (
                        <Alert 
                            type="success"
                            showIcon
                            icon={<CheckCircleOutlined />}
                            style={{ marginBottom: 16, borderRadius: 8 }}
                            title={
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span>
                                        ✓ <strong>Đã xác nhận điểm danh ngày {dayjs(selectedDate).format('DD/MM/YYYY')}:</strong> Có <strong>{currentWorkingCount}</strong> nhân sự làm DVKT (đã loại trừ <strong>{currentOffCount}</strong> nhân sự nghỉ/không làm DVKT).
                                    </span>
                                    <Tag color="success">ĐÃ CHỐT ĐIỂM DANH</Tag>
                                </div>
                            }
                        />
                    ) : (
                        <Alert 
                            type={requireAttendance ? "error" : "warning"}
                            showIcon
                            icon={<ExclamationCircleOutlined />}
                            style={{ marginBottom: 16, borderRadius: 8 }}
                            title={
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span>
                                        <strong>{requireAttendance ? "⚠️ Bắt buộc điểm danh:" : "ℹ️ Chưa xác nhận điểm danh:"}</strong> Ngày <strong>{dayjs(selectedDate).format('DD/MM/YYYY')}</strong> chưa được chốt điểm danh. Hệ thống đã tự động liên thông trạng thái từ Bảng chấm công/trực. Vui lòng kiểm tra lại và bấm <strong>"Xác nhận điểm danh ngày này"</strong> để hoàn tất.
                                    </span>
                                    <Tag color={requireAttendance ? "error" : "warning"}>CHƯA CHỐT ĐIỂM DANH</Tag>
                                </div>
                            }
                        />
                    )}
                </>
            )}

            <Card 
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>Danh sách nhân viên - Ngày {dayjs(selectedDate).format('DD/MM/YYYY')} ({staffList.length} nhân sự)</span>
                        </div>
                        {selectedDept && staffList.length > 0 && (
                            <Space>
                                {!requireAttendance && (
                                    <Button 
                                        size="small" 
                                        onClick={handleSetAllWorking}
                                        title="Đặt tất cả nhân sự sang trạng thái Đi làm"
                                    >
                                        Chấm tất cả đi làm
                                    </Button>
                                )}
                                <Button 
                                    size="small" 
                                    icon={<SyncOutlined spin={reloadingTimesheet} />}
                                    onClick={() => fetchData(true)}
                                    loading={reloadingTimesheet}
                                    title="Tải lại trạng thái từ Bảng Chấm Công & Bảng Trực viện"
                                >
                                    Nạp lại từ Chấm công
                                </Button>
                                <Tooltip title={requireAttendance && !hasTimesheetData ? "Khoa chưa có dữ liệu chấm công. Vui lòng chấm công trước khi xác nhận!" : undefined}>
                                    <Button
                                        type="primary"
                                        icon={<CheckCircleOutlined />}
                                        onClick={handleBulkConfirm}
                                        loading={confirmingBulk}
                                        disabled={requireAttendance && !hasTimesheetData}
                                        style={{ backgroundColor: (requireAttendance && !hasTimesheetData) ? undefined : '#16a34a', borderColor: (requireAttendance && !hasTimesheetData) ? undefined : '#16a34a', fontWeight: 'bold' }}
                                    >
                                        Xác nhận điểm danh ngày này
                                    </Button>
                                </Tooltip>
                            </Space>
                        )}
                    </div>
                }
            >
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
