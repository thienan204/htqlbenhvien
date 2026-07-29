'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Tag, Modal, Form, Input, Select, message, Segmented, Card, Space } from 'antd';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FileExcelOutlined } from '@ant-design/icons';

export default function XmlErrorManager() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'CNTT';
    const canDelete = user?.role === 'ADMIN';

    const searchParams = useSearchParams();
    const router = useRouter();
    
    // Đọc URL params để lọc nếu có
    const initialSourceType = searchParams.get('sourceType') || 'XML';
    const paramKhoa = searchParams.get('ma_khoa');
    const paramDetail = searchParams.get('detail');

    const [errors, setErrors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [sourceType, setSourceType] = useState(initialSourceType); // XML or CHUYEN_DE
    const [departments, setDepartments] = useState<Record<string, string>>({});
    const [staffList, setStaffList] = useState<any[]>([]);
    const [chuyenDeFilter, setChuyenDeFilter] = useState<string>('ALL'); // Lọc chuyên đề
    const [statusFilter, setStatusFilter] = useState<string>('ALL'); // Lọc trạng thái
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedError, setSelectedError] = useState<any>(null);
    const [form] = Form.useForm();

    const [isITModalVisible, setIsITModalVisible] = useState(false);
    const [selectedErrorForIT, setSelectedErrorForIT] = useState<any>(null);
    const [itForm] = Form.useForm();

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const res = await fetch('/api/departments');
                if (res.ok) {
                    const data = await res.json();
                    const map: Record<string, string> = {};
                    data.forEach((d: any) => map[d.ma_khoa] = d.ten_khoa);
                    setDepartments(map);
                }
            } catch (e) {
                console.error("Error fetching departments", e);
            }
        };
        const fetchStaff = async () => {
            try {
                const res = await fetch('/api/staff');
                if (res.ok) {
                    const data = await res.json();
                    setStaffList(data);
                }
            } catch (e) {
                console.error("Error fetching staff", e);
            }
        };
        fetchDepts();
        fetchStaff();
    }, []);

    const fetchErrors = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/error-management/xml-errors?sourceType=${sourceType}`);
            if (res.ok) {
                let data = await res.json();
                
                // Nhóm màu cho các lỗi chuyên đề
                if (sourceType === 'CHUYEN_DE') {
                    // Trích xuất GroupId và RuleName từ chi_tiet_loi
                    data.forEach((e: any) => {
                        const matchGroup = e.chi_tiet_loi?.match(/\[Nhóm:\s*(.*?)\]/);
                        e._groupId = matchGroup ? matchGroup[1] : 'ungrouped';
                        
                        const ruleMatch = e.chi_tiet_loi?.match(/\[CHUYEN_DE\]\s*(.*?)\s*-/);
                        e._ruleName = ruleMatch ? ruleMatch[1].trim() : '';
                    });

                    // Sắp xếp theo Rule -> Mã máy -> Group ID -> Mã BN -> Ngày vào
                    data.sort((a: any, b: any) => {
                        if (a._ruleName !== b._ruleName) return a._ruleName.localeCompare(b._ruleName);
                        
                        const maMayA = a.ma_may || '';
                        const maMayB = b.ma_may || '';
                        if (maMayA !== maMayB) return maMayA.localeCompare(maMayB);

                        if (a._groupId !== b._groupId) return a._groupId.localeCompare(b._groupId, undefined, { numeric: true });
                        
                        if (a.ma_bn !== b.ma_bn) return (a.ma_bn || '').localeCompare(b.ma_bn || '');

                        return new Date(a.ngay_vao || 0).getTime() - new Date(b.ngay_vao || 0).getTime();
                    });

                    // Đánh dấu màu xen kẽ cho các nhóm
                    let currentColorIndex = 0;
                    const groupColors = [
                        'bg-orange-50/70 hover:bg-orange-100/70', 
                        'bg-teal-50/70 hover:bg-teal-100/70', 
                        'bg-rose-50/70 hover:bg-rose-100/70',
                        'bg-amber-50/70 hover:bg-amber-100/70',
                        'bg-indigo-50/70 hover:bg-indigo-100/70'
                    ];
                    const excelColors = ['FFFCE4D6', 'FFE0F2F1', 'FFFDE0DF', 'FFF4E6CE', 'FFE8EAF6'];
                    
                    let currentGroupKey = data.length > 0 ? `${data[0]._ruleName}_${data[0].ma_may}_${data[0]._groupId}` : '';

                    data.forEach((row: any) => {
                        const groupKey = `${row._ruleName}_${row.ma_may}_${row._groupId}`;
                        if (groupKey !== currentGroupKey) {
                            currentGroupKey = groupKey;
                            // Đổi màu nếu khác nhóm (bỏ qua ungrouped để không tốn màu)
                            if (row._groupId !== 'ungrouped') {
                                currentColorIndex = (currentColorIndex + 1) % groupColors.length;
                            }
                        }
                        
                        if (row._groupId !== 'ungrouped') {
                            row.groupColor = groupColors[currentColorIndex];
                            row.excelColor = excelColors[currentColorIndex];
                        } else {
                            row.groupColor = '';
                            row.excelColor = '';
                        }
                    });
                }
                
                setErrors(data);
            } else {
                message.error('Lỗi khi tải dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchErrors();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, sourceType]);

    // Extract unique Chuyên đề rules
    const uniqueChuyenDeRules = useMemo(() => {
        if (sourceType !== 'CHUYEN_DE') return [];
        const rules = new Set<string>();
        errors.forEach(e => {
            if (e.chi_tiet_loi) {
                const match = e.chi_tiet_loi.match(/\[.*?\]\s*(.*?)\s*-/);
                if (match) rules.add(match[1].trim());
                else rules.add(e.chi_tiet_loi.substring(0, 50));
            }
        });
        return Array.from(rules).sort();
    }, [errors, sourceType]);

    // Lọc dữ liệu theo URL params và Chuyên đề filter
    const filteredErrors = useMemo(() => {
        return errors.filter(e => {
            if (paramKhoa && e.ma_khoa !== paramKhoa) return false;
            if (paramDetail && !e.chi_tiet_loi?.toLowerCase().includes(paramDetail.toLowerCase())) return false;
            if (chuyenDeFilter !== 'ALL') {
                if (!e.chi_tiet_loi?.includes(chuyenDeFilter)) return false;
            }
            if (statusFilter !== 'ALL') {
                if (e.status !== statusFilter) return false;
            }
            return true;
        });
    }, [errors, paramKhoa, paramDetail, chuyenDeFilter, statusFilter]);

    const handleUpdate = async (values: any) => {
        if (!selectedError) return;
        try {
            const res = await fetch('/api/error-management/xml-errors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedError.id,
                    ...values
                })
            });

            if (res.ok) {
                message.success('Cập nhật thành công');
                setIsModalVisible(false);
                fetchErrors();
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleSendITRequest = async (values: any) => {
        if (!selectedErrorForIT) return;
        
        try {
            message.loading({ content: 'Đang gửi yêu cầu...', key: 'sendIT' });
            
            // Tách tên lỗi chuyên đề nếu có
            let tenLoiGoc = selectedErrorForIT.chi_tiet_loi || '';
            let ruleName = '';
            const ruleMatch = tenLoiGoc.match(/\[CHUYEN_DE\]\s*(.*?)\s*-/);
            if (ruleMatch) {
                ruleName = ruleMatch[1].trim();
            }

            const nguoiBaoId = values.nguoi_bao_id;
            let nguoiBaoName = '';
            let sdt = '';
            if (nguoiBaoId) {
                const staff = staffList.find(s => s.id === nguoiBaoId);
                if (staff) {
                    nguoiBaoName = staff.ho_ten;
                    sdt = staff.so_dien_thoai || '';
                }
            }

            const dynamicFields = {
                'Người báo': nguoiBaoName,
                'Loại lỗi': sourceType === 'XML' ? 'Lỗi XML' : 'Lỗi Chuyên đề',
                'Tên chuyên đề': ruleName,
                'Mã máy/Giường': selectedErrorForIT.ma_may || '',
                'Chi tiết vi phạm': tenLoiGoc,
                'Ghi chú': values.yeu_cau_khoa || ''
            };

            const payload = {
                ma_ba: selectedErrorForIT.ma_lk || '',
                ten_loi: `[Hỗ trợ Lỗi Hồ sơ] Bệnh nhân: ${selectedErrorForIT.ho_ten || 'Không rõ'}`,
                ma_khoa: selectedErrorForIT.ma_khoa || '',
                category: 'SOFTWARE',
                nguoi_bao_id: nguoiBaoId,
                sdt: sdt,
                xmlErrorId: selectedErrorForIT.id,
                dynamicFields
            };

            const res = await fetch('/api/error-management/it-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success({ content: 'Gửi yêu cầu IT thành công!', key: 'sendIT' });
                setIsITModalVisible(false);
                itForm.resetFields();
                
                // Cập nhật tự động dòng "Đã gửi Yêu cầu IT" vào departmentNote
                const updateRes = await fetch('/api/error-management/xml-errors', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        id: selectedErrorForIT.id, 
                        departmentNote: selectedErrorForIT.departmentNote 
                            ? `${selectedErrorForIT.departmentNote}\n[Đã gửi Yêu cầu IT]` 
                            : '[Đã gửi Yêu cầu IT]' 
                    })
                });
                
                if (updateRes.ok) {
                    fetchErrors(); // Tải lại bảng để thấy note mới
                }
            } else {
                const err = await res.json();
                message.error({ content: `Lỗi: ${err.error}`, key: 'sendIT' });
            }
        } catch (error) {
            message.error({ content: 'Lỗi kết nối', key: 'sendIT' });
        }
    };

    const handleDelete = async (ids: string[]) => {
        if (!user || user.role !== 'ADMIN') return;
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: `Bạn có chắc chắn muốn xóa ${ids.length} lỗi này không?`,
            okText: 'Xóa',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    const res = await fetch('/api/error-management/xml-errors', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids })
                    });
                    
                    if (res.ok) {
                        message.success('Đã xóa dữ liệu thành công');
                        setSelectedRowKeys([]);
                        fetchErrors();
                    } else {
                        const data = await res.json();
                        message.error(data.error || 'Xóa thất bại');
                    }
                } catch (e) {
                    message.error('Lỗi kết nối khi xóa');
                }
            }
        });
    };

    const handleExportExcel = async () => {
        if (errors.length === 0) {
            message.warning("Không có dữ liệu để xuất");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách Lỗi');
        
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Mã LK', key: 'ma_lk', width: 14 },
            { header: 'Mã BN', key: 'ma_bn', width: 14 },
            { header: 'Mã Khoa', key: 'ma_khoa', width: 10 },
            { header: 'Tên Khoa', key: 'ten_khoa', width: 25 },
            { header: 'Họ tên', key: 'ho_ten', width: 25 },
            { header: 'Ngày vào', key: 'ngay_vao', width: 16 },
            { header: 'Ngày ra', key: 'ngay_ra', width: 16 },
            { header: 'Ngày YL', key: 'ngay_yl', width: 16 },
            { header: 'Ngày TH YL', key: 'ngay_th_yl', width: 16 },
            { header: 'Ngày KQ', key: 'ngay_kq', width: 16 },
            { header: 'Mã Bác sĩ', key: 'ma_bac_si', width: 15 },
            { header: 'Tên Bác sĩ', key: 'ten_bac_si', width: 25 },
            { header: 'Mã Người TH', key: 'nguoi_th', width: 15 },
            { header: 'Tên Người TH', key: 'ten_nguoi_th', width: 25 },
            { header: 'Mã máy/Giường', key: 'ma_may', width: 25 },
            { header: 'Ngày Vào NT', key: 'ngay_vao_noi_tru', width: 16 },
            { header: 'Mã DV/Thuốc', key: 'ma_dv', width: 15 },
            { header: 'Tên DV/Thuốc', key: 'ten_dv', width: 40 },
            { header: 'Đơn giá BH', key: 'don_gia_bh', width: 15 },
            { header: 'Chi tiết lỗi', key: 'chi_tiet_loi', width: 60 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Giải trình khoa', key: 'departmentNote', width: 30 },
            { header: 'Ghi chú Admin', key: 'adminNote', width: 30 },
        ];
        
        worksheet.getRow(1).font = { bold: true };

        const safeDateStr = (date: any) => date ? dayjs(date).format('DD/MM/YYYY HH:mm') : '';

        filteredErrors.forEach((row, idx) => {
            const addedRow = worksheet.addRow({
                stt: idx + 1,
                ma_lk: row.ma_lk,
                ma_bn: row.ma_bn,
                ma_khoa: row.ma_khoa,
                ten_khoa: row.ten_khoa || departments[row.ma_khoa] || '',
                ho_ten: row.ho_ten,
                ngay_vao: safeDateStr(row.ngay_vao),
                ngay_ra: safeDateStr(row.ngay_ra),
                ngay_yl: safeDateStr(row.ngay_yl),
                ngay_th_yl: safeDateStr(row.ngay_th_yl),
                ngay_kq: safeDateStr(row.ngay_kq),
                ma_bac_si: row.ma_bac_si || '',
                ten_bac_si: row.ten_bac_si || '',
                nguoi_th: row.nguoi_th || '',
                ten_nguoi_th: row.ten_nguoi_th || '',
                ma_may: row.ma_may || '',
                ngay_vao_noi_tru: safeDateStr(row.ngay_vao_noi_tru),
                ma_dv: row.ma_dv,
                ten_dv: row.ten_dv,
                don_gia_bh: row.don_gia_bh,
                chi_tiet_loi: row.chi_tiet_loi,
                status: row.status === 'PENDING' ? 'Chờ xử lý' : 'Đã xử lý',
                departmentNote: row.departmentNote || '',
                adminNote: row.adminNote || '',
            });

            // Nếu có màu nhóm, tô màu cho dòng đó
            if (row.excelColor) {
                addedRow.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: row.excelColor }
                    };
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Danh_sach_loi_${sourceType}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    };

    const columns = [
        {
            title: 'Thao tác',
            width: 180,
            fixed: 'left' as const,
            render: (_: any, record: any) => (
                <Space>
                    <Button size="small" type="primary" onClick={() => {
                        setSelectedError(record);
                        form.setFieldsValue({
                            status: record.status,
                            departmentNote: record.departmentNote,
                            adminNote: record.adminNote
                        });
                        setIsModalVisible(true);
                    }}>Xử lý</Button>
                    
                    <Button 
                        size="small" 
                        type="primary"
                        className="bg-amber-500 hover:bg-amber-600 border-none"
                        onClick={() => {
                            if (record.itRequestId) {
                                Modal.confirm({
                                    title: 'Xác nhận Nhắc nhở IT',
                                    content: `Yêu cầu này đã được gửi (đã hối thúc ${record.itRequestPingCount || 1} lần). Bạn có muốn gửi thông báo hối thúc (Ping) cho IT không?`,
                                    okText: 'Gửi nhắc nhở',
                                    cancelText: 'Hủy',
                                    onOk: async () => {
                                        try {
                                            message.loading({ content: 'Đang gửi...', key: 'pingIT' });
                                            const res = await fetch('/api/error-management/it-requests', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ xmlErrorId: record.id, action: 'PING', ma_ba: record.ma_lk, ten_loi: record.chi_tiet_loi, ma_khoa: record.ma_khoa })
                                            });
                                            if (res.ok) {
                                                message.success({ content: 'Đã nhắc nhở IT!', key: 'pingIT' });
                                                fetchErrors();
                                            } else {
                                                message.error({ content: 'Lỗi khi gửi', key: 'pingIT' });
                                            }
                                        } catch (e) {
                                            message.error({ content: 'Lỗi kết nối', key: 'pingIT' });
                                        }
                                    }
                                });
                            } else {
                                setSelectedErrorForIT(record);
                                itForm.resetFields();
                                if (user?.staffId) {
                                    itForm.setFieldsValue({ nguoi_bao_id: user.staffId });
                                }
                                setIsITModalVisible(true);
                            }
                        }}
                    >
                        {record.itRequestId ? 'Gửi lại' : 'Gửi IT'}
                    </Button>

                    {canDelete && (
                        <Button 
                            size="small" 
                            danger 
                            onClick={() => handleDelete([record.id])}
                        >
                            Xóa
                        </Button>
                    )}
                </Space>
            )
        },
        {
            title: 'Mã LK / BN',
            key: 'ma',
            width: 150,
            render: (_: any, record: any) => (
                <div>
                    <div className="font-bold text-blue-600">{record.ma_lk}</div>
                    <div className="text-xs text-slate-500">BN: {record.ma_bn}</div>
                </div>
            )
        },
        { title: 'Khoa RV', dataIndex: 'ma_khoa', width: 100 },
        { 
            title: 'Tên Khoa RV', 
            dataIndex: 'ten_khoa', 
            width: 200,
            render: (text: string, record: any) => text || departments[record.ma_khoa] || ''
        },
        { title: 'Họ tên', dataIndex: 'ho_ten', width: 180 },
        { title: 'Ngày vào', dataIndex: 'ngay_vao', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Ngày ra', dataIndex: 'ngay_ra', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { 
            title: 'Ngày YL', 
            dataIndex: 'ngay_yl', 
            width: 150, 
            render: (d: string, record: any) => {
                const isChecking = record.chi_tiet_loi?.includes('Trùng thời gian - Bác sĩ') || record.chi_tiet_loi?.includes('Trùng bác sĩ');
                return d ? <div className={isChecking ? "bg-red-50 text-red-700 p-1 rounded font-medium text-center border border-red-200" : ""}>{dayjs(d).format('DD/MM/YYYY HH:mm')}</div> : '';
            }
        },
        { 
            title: 'Ngày TH YL', 
            dataIndex: 'ngay_th_yl', 
            width: 150, 
            render: (d: string, record: any) => {
                const isChecking = record.chi_tiet_loi?.includes('Trùng mã máy') || record.chi_tiet_loi?.includes('Trùng giường');
                return d ? <div className={isChecking ? "bg-red-50 text-red-700 p-1 rounded font-medium text-center border border-red-200" : ""}>{dayjs(d).format('DD/MM/YYYY HH:mm')}</div> : '';
            }
        },
        { 
            title: 'Ngày KQ', 
            dataIndex: 'ngay_kq', 
            width: 150, 
            render: (d: string, record: any) => {
                const isChecking = record.chi_tiet_loi?.includes('Trùng KQ') || record.chi_tiet_loi?.includes('Ngày KQ');
                return d ? <div className={isChecking ? "bg-red-50 text-red-700 p-1 rounded font-medium text-center border border-red-200" : ""}>{dayjs(d).format('DD/MM/YYYY HH:mm')}</div> : '';
            }
        },
        { 
            title: 'Khoảng TG trùng', 
            dataIndex: 'khoang_thoi_gian_trung', 
            width: 140,
            render: (text: string) => text ? <Tag color="purple">{text}</Tag> : '-'
        },
        {
            title: 'Mã Bác sĩ',
            dataIndex: 'ma_bac_si',
            width: 160,
            render: (text: string) => {
                if (!text) return '-';
                return (
                    <div className="flex flex-wrap gap-1">
                        {text.split(/[,;]/).map((t, i) => t.trim() ? <Tag key={i} className="whitespace-normal break-all m-0">{t.trim()}</Tag> : null)}
                    </div>
                );
            }
        },
        { 
            title: 'Tên Bác sĩ', 
            dataIndex: 'ten_bac_si', 
            width: 200,
            render: (text: string) => {
                if (!text) return '-';
                return (
                    <div className="flex flex-col gap-1">
                        {text.split(/[,;]/).map((t, i) => t.trim() ? <div key={i} className="whitespace-normal break-words leading-tight">{t.trim()}</div> : null)}
                    </div>
                );
            }
        },
        {
            title: 'Mã Người TH',
            dataIndex: 'nguoi_th',
            width: 180,
            render: (text: string) => {
                if (!text) return '-';
                return (
                    <div className="flex flex-wrap gap-1">
                        {text.split(/[,;]/).map((t, i) => t.trim() ? <Tag color="orange" key={i} className="whitespace-normal break-all m-0">{t.trim()}</Tag> : null)}
                    </div>
                );
            }
        },
        { 
            title: 'Tên Người TH', 
            dataIndex: 'ten_nguoi_th', 
            width: 200,
            render: (text: string) => {
                if (!text) return '-';
                return (
                    <div className="flex flex-col gap-1">
                        {text.split(/[,;]/).map((t, i) => t.trim() ? <div key={i} className="whitespace-normal break-words leading-tight">{t.trim()}</div> : null)}
                    </div>
                );
            }
        },
        { 
            title: 'Mã Máy / Giường', 
            dataIndex: 'ma_may', 
            width: 180,
            render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-'
        },
        { title: 'Ngày Vào NT', dataIndex: 'ngay_vao_noi_tru', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Mã DV', dataIndex: 'ma_dv', width: 120 },
        { title: 'Tên DV', dataIndex: 'ten_dv', width: 200, ellipsis: true },
        { title: 'Đơn giá BH', dataIndex: 'don_gia_bh', width: 120 },
        {
            title: 'Chi tiết lỗi',
            dataIndex: 'chi_tiet_loi',
            width: 250,
            render: (text: string) => <div className="text-red-600 font-medium whitespace-pre-wrap">{text}</div>
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 120,
            render: (status: string) => (
                <Tag color={status === 'PENDING' ? 'warning' : 'success'}>
                    {status === 'PENDING' ? 'Chờ xử lý' : 'Đã xử lý'}
                </Tag>
            )
        },
        {
            title: 'Giải trình của Khoa',
            dataIndex: 'departmentNote',
            width: 200,
            render: (text: string) => <div className="text-slate-600 italic whitespace-pre-wrap">{text || '-'}</div>
        },
        {
            title: 'Ghi chú CNTT',
            dataIndex: 'adminNote',
            width: 200,
            render: (text: string) => <div className="text-slate-600 italic whitespace-pre-wrap">{text || '-'}</div>
        },
        {
            title: 'Ngày lưu',
            dataIndex: 'createdAt',
            width: 150,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
        }
    ];

    return (
        <div className="w-full px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Danh sách Lỗi Hồ sơ</h1>
                    <p className="text-sm sm:text-base text-slate-500 m-0">Quản lý và giải trình các lỗi quét từ XML / Chuyên đề</p>
                </div>
                
                <Space>
                    <Space>
                        <Select
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ width: 150 }}
                            options={[
                                { value: 'ALL', label: 'Tất cả trạng thái' },
                                { value: 'PENDING', label: 'Chờ xử lý' },
                                { value: 'EXPLAINED', label: 'Đã xử lý' }
                            ]}
                        />
                        <Segmented
                            options={[
                                { label: 'Lỗi XML', value: 'XML' },
                                { label: 'Lỗi Chuyên đề', value: 'CHUYEN_DE' }
                            ]}
                            value={sourceType}
                            onChange={(val: any) => {
                                setSourceType(val);
                                setChuyenDeFilter('ALL'); // Reset filter
                            }}
                        />
                        {sourceType === 'CHUYEN_DE' && (
                            <Select
                                value={chuyenDeFilter}
                                onChange={setChuyenDeFilter}
                                style={{ width: 250 }}
                                options={[
                                    { value: 'ALL', label: 'Tất cả Lỗi Chuyên đề' },
                                    ...uniqueChuyenDeRules.map(rule => ({ value: rule, label: rule }))
                                ]}
                            />
                        )}
                    </Space>
                    <Button  
                        type="default" 
                        onClick={() => router.push('/error-management/xml-summary')}
                    >
                        Báo cáo Tổng hợp
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<FileExcelOutlined />} 
                        onClick={handleExportExcel}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        Xuất Excel
                    </Button>
                    {canDelete && selectedRowKeys.length > 0 && (
                        <Button 
                            danger 
                            type="primary" 
                            onClick={() => handleDelete(selectedRowKeys as string[])}
                        >
                            Xóa đã chọn ({selectedRowKeys.length})
                        </Button>
                    )}
                </Space>
            </div>

            {paramKhoa && (
                <div className="mb-2">
                    <Tag closable onClose={() => router.push(`/error-management/xml-errors?sourceType=${sourceType}`)} color="blue" className="text-sm py-1 px-3">
                        Đang lọc theo Khoa: <b>{departments[paramKhoa] || paramKhoa}</b> 
                        {paramDetail && <span> | Lỗi: <b>{paramDetail}</b></span>}
                    </Tag>
                </div>
            )}

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <Table
                    rowSelection={canDelete ? {
                        selectedRowKeys,
                        onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
                    } : undefined}
                    dataSource={filteredErrors}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ defaultPageSize: 15 }}
                    scroll={{ x: 1200 }}
                    rowClassName={(record: any) => record.itResolved ? 'bg-green-100 hover:bg-green-200' : (record.groupColor || '')}
                />
            </Card>

            <Modal
                title="Xử lý Lỗi"
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
                okText="Lưu lại"
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical" onFinish={handleUpdate}>
                    <Form.Item name="status" label="Trạng thái">
                        <Select>
                            <Select.Option value="PENDING">Chờ xử lý</Select.Option>
                            <Select.Option value="EXPLAINED">Đã xử lý</Select.Option>
                        </Select>
                    </Form.Item>
                    
                    <Form.Item name="departmentNote" label="Giải trình của khoa">
                        <Input.TextArea rows={4} placeholder="Nhập lý do hoặc giải trình..." />
                    </Form.Item>

                    {isAdmin && (
                        <Form.Item name="adminNote" label="Ghi chú của CNTT/Admin">
                            <Input.TextArea rows={4} placeholder="Ghi chú nội bộ..." />
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            <Modal
                title="Gửi Yêu cầu IT"
                open={isITModalVisible}
                onCancel={() => setIsITModalVisible(false)}
                onOk={() => itForm.submit()}
                okText="Gửi yêu cầu"
                cancelText="Hủy"
            >
                {selectedErrorForIT && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                        <p className="mb-1"><b>Bệnh nhân:</b> {selectedErrorForIT.ho_ten} (Mã LK: {selectedErrorForIT.ma_lk})</p>
                        <p className="mb-0 text-red-600"><b>Lỗi:</b> {selectedErrorForIT.chi_tiet_loi}</p>
                    </div>
                )}
                <Form form={itForm} layout="vertical" onFinish={handleSendITRequest}>
                    <Form.Item 
                        name="nguoi_bao_id" 
                        label="Người gửi yêu cầu (Nhân viên khoa)"
                        rules={[{ required: true, message: 'Vui lòng chọn tên người gửi' }]}
                    >
                        <Select 
                            showSearch
                            placeholder="Chọn tên nhân viên..."
                            optionFilterProp="children"
                            disabled={!!user?.staffId && !isAdmin}
                        >
                            {staffList.filter(s => s.ma_khoa === selectedErrorForIT?.ma_khoa || s.id === user?.staffId).map(staff => (
                                <Select.Option key={staff.id} value={staff.id}>
                                    {staff.ho_ten} {staff.so_dien_thoai ? `(${staff.so_dien_thoai})` : ''}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    
                    <Form.Item 
                        name="yeu_cau_khoa" 
                        label="Yêu cầu xử lý chi tiết"
                        rules={[{ required: true, message: 'Vui lòng nhập yêu cầu của bạn để IT dễ xử lý' }]}
                    >
                        <Input.TextArea rows={4} placeholder="Ví dụ: Nhờ IT hỗ trợ sửa lại giờ y lệnh của ca này trên phần mềm..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
