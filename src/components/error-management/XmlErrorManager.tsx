'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Tag, Modal, Form, Input, Select, message, Segmented, Card, Space, Statistic, Typography } from 'antd';
const { Text } = Typography;
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
                'Loại lỗi': sourceType === 'XML' ? 'Lỗi XML' : 'Lỗi Chuyên đề trùng thời gian',
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

    const stats = useMemo(() => {
        const total = filteredErrors.length;
        const pending = filteredErrors.filter(e => e.status === 'PENDING').length;
        const resolved = filteredErrors.filter(e => e.status !== 'PENDING').length;
        return { total, pending, resolved };
    }, [filteredErrors]);


    const chuyenDeColumns = [
        {
            title: 'Mã LK', dataIndex: 'ma_lk', key: 'ma_lk', width: 110,
            render: (text: string) => <span className="font-semibold text-blue-600">{text || '-'}</span>
        },
        { title: 'Mã BN', dataIndex: 'ma_bn', key: 'ma_bn', width: 100 },
        { title: 'Họ Tên BN', dataIndex: 'ho_ten', key: 'ho_ten', width: 160, className: 'uppercase font-bold text-blue-800' },
        { title: 'Khoa', dataIndex: 'ten_khoa', key: 'ten_khoa', width: 150, ellipsis: true },
        {
            title: 'Tên DV / Thuốc', dataIndex: 'ten_dv', key: 'ten_dv', width: 220, ellipsis: true,
            render: (text: string) => <span className="font-medium">{text || '-'}</span>
        },
        {
            title: 'Bác sĩ / Máy', key: 'bs_may', width: 140,
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-0.5">
                    {record.ten_bac_si && record.ten_bac_si !== 'null' && <div className="text-indigo-700 font-semibold text-xs leading-tight" title="Bác sĩ">{record.ten_bac_si}</div>}
                    {record.ma_may && record.ma_may !== 'null' && <div className="text-purple-700 font-semibold text-xs leading-tight" title="Máy/Giường">Mã: {record.ma_may}</div>}
                    {(!record.ten_bac_si || record.ten_bac_si === 'null') && (!record.ma_may || record.ma_may === 'null') && '-'}
                </div>
            )
        },
        {
            title: 'Ngày Y Lệnh', dataIndex: 'ngay_yl', key: 'ngay_yl', width: 120,
            render: (text: string) => text ? <span className="font-medium text-slate-700">{dayjs(text).format('DD/MM/YY HH:mm')}</span> : '-'
        },
        {
            title: 'Ngày TH YL', dataIndex: 'ngay_th_yl', key: 'ngay_th_yl', width: 120,
            render: (text: string) => text ? <span className="font-medium text-slate-700">{dayjs(text).format('DD/MM/YY HH:mm')}</span> : '-'
        },
        {
            title: 'Ngày KQ', dataIndex: 'ngay_kq', key: 'ngay_kq', width: 120,
            render: (text: string) => text ? <span className="font-medium text-slate-700">{dayjs(text).format('DD/MM/YY HH:mm')}</span> : '-'
        },
        {
            title: 'Khoảng trùng', dataIndex: 'khoang_thoi_gian_trung', key: 'khoang_thoi_gian_trung', width: 170,
            render: (text: string) => text ? <div className="text-red-600 font-bold bg-white/60 p-1.5 border border-red-200 rounded leading-tight">{text}</div> : '-'
        },
        {
            title: 'Chi tiết lỗi', dataIndex: 'chi_tiet_loi', key: 'chi_tiet_loi', width: 200,
            render: (text: string) => <div className="text-red-700 font-medium whitespace-pre-wrap text-xs">{text || '-'}</div>
        },
        {
            title: 'Trao đổi & Xử lý',
            key: 'exchange',
            width: 250,
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-1 py-1">
                    {record.departmentNote ? (
                        <div className="bg-blue-50/80 border border-blue-100 p-2 rounded-lg shadow-sm">
                            <div className="text-[11px] font-bold text-blue-800 mb-1 flex items-center gap-1">✉ Khoa giải trình:</div>
                            <div className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{record.departmentNote}</div>
                        </div>
                    ) : (
                        <div className="text-slate-400 text-[11px] italic px-1">Chưa giải trình</div>
                    )}
                    {record.adminNote && (
                        <div className="bg-green-50/80 border border-green-100 p-2 rounded-lg mt-1 shadow-sm">
                            <div className="text-[11px] font-bold text-green-700 mb-1 flex items-center gap-1">✔ CNTT / Admin:</div>
                            <div className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{record.adminNote}</div>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 120,
            fixed: 'right' as const,
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-1.5 py-1">
                    <Tag 
                        color={record.status === 'PENDING' ? 'warning' : 'success'} 
                        className="w-full text-center m-0 py-0.5 font-semibold border-transparent text-xs"
                    >
                        {record.status === 'PENDING' ? '⏳ Chờ xử lý' : '✓ Đã xử lý'}
                    </Tag>
                    <Button 
                        size="small" 
                        type={record.status === 'PENDING' ? 'primary' : 'default'}
                        className={record.status === 'PENDING' ? "bg-blue-600 hover:bg-blue-700 text-xs" : "bg-white text-xs"}
                        onClick={() => {
                            if (!isAdmin) {
                                setSelectedErrorForIT(record);
                                itForm.resetFields();
                                if (user?.staffId) itForm.setFieldsValue({ nguoi_bao_id: user.staffId });
                                setIsITModalVisible(true);
                            } else {
                                setSelectedError(record);
                                form.setFieldsValue({
                                    status: record.status,
                                    departmentNote: record.departmentNote,
                                    adminNote: record.adminNote
                                });
                                setIsModalVisible(true);
                            }
                        }}
                    >
                        {isAdmin ? 'Xử lý' : 'Gửi CNTT'}
                    </Button>
                </div>
            )
        }
    ];

    const columns = [
        {
            title: 'Hồ sơ Bệnh nhân',
            key: 'patient',
            width: 250,
            fixed: 'left' as const,
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-1 py-2">
                    <div className="font-bold text-blue-700 text-base leading-tight">{record.ho_ten || 'Chưa rõ tên'}</div>
                    <div className="text-sm text-slate-600">Mã LK: <span className="font-semibold">{record.ma_lk || '-'}</span></div>
                    <div className="text-sm text-slate-600">Mã BN: {record.ma_bn || '-'}</div>
                    {record.ma_khoa && (
                        <div className="mt-1">
                            <Tag color="cyan" className="m-0 border-transparent bg-cyan-50 text-cyan-700">{record.ten_khoa || departments[record.ma_khoa] || record.ma_khoa}</Tag>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Thông tin Dịch vụ / Thuốc',
            key: 'service',
            width: 250,
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-1 py-2">
                    <div className="font-medium text-slate-800 break-words leading-snug">{record.ten_dv || '-'}</div>
                    {record.ma_dv && <div className="text-xs text-slate-500 font-mono">Mã: {record.ma_dv}</div>}
                    {record.don_gia_bh && <div className="text-xs text-amber-600 font-semibold">Giá BH: {Number(record.don_gia_bh).toLocaleString('vi-VN')} đ</div>}
                    {record.ma_may && (
                        <div className="mt-1">
                            <Tag color="purple" className="m-0 border-transparent bg-purple-50 text-purple-700 whitespace-normal break-words leading-tight">Máy/Giường: {record.ma_may}</Tag>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Thông tin Thời gian',
            key: 'time',
            width: 180,
            render: (_: any, record: any) => {
                const isCheckingYL = record.chi_tiet_loi?.includes('Trùng thời gian') || record.chi_tiet_loi?.includes('Trùng bác sĩ');
                const isCheckingTH = record.chi_tiet_loi?.includes('Trùng mã máy') || record.chi_tiet_loi?.includes('Trùng giường');
                return (
                    <div className="flex flex-col gap-1.5 text-xs py-2">
                        {record.ngay_vao && <div><span className="text-slate-400 font-medium w-14 inline-block">Vào NT:</span> <span className="text-slate-700">{dayjs(record.ngay_vao).format('DD/MM/YY HH:mm')}</span></div>}
                        {record.ngay_ra && <div><span className="text-slate-400 font-medium w-14 inline-block">Ra NT:</span> <span className="text-slate-700">{dayjs(record.ngay_ra).format('DD/MM/YY HH:mm')}</span></div>}
                        {record.ngay_yl && <div className={isCheckingYL ? "text-red-600 font-bold bg-red-50 p-1 -ml-1 rounded" : ""}><span className="text-slate-400 font-medium w-14 inline-block">Y Lệnh:</span> {dayjs(record.ngay_yl).format('DD/MM/YY HH:mm')}</div>}
                        {record.ngay_th_yl && <div className={isCheckingTH ? "text-red-600 font-bold bg-red-50 p-1 -ml-1 rounded" : ""}><span className="text-slate-400 font-medium w-14 inline-block">TH YL:</span> {dayjs(record.ngay_th_yl).format('DD/MM/YY HH:mm')}</div>}
                        {record.ngay_kq && <div className={isCheckingTH ? "text-red-600 font-bold bg-red-50 p-1 -ml-1 rounded" : ""}><span className="text-slate-400 font-medium w-14 inline-block">Ngày KQ:</span> {dayjs(record.ngay_kq).format('DD/MM/YY HH:mm')}</div>}
                    </div>
                );
            }
        },
        {
            title: 'Chi tiết Lỗi',
            key: 'error_detail',
            dataIndex: 'chi_tiet_loi',
            width: 280,
            render: (text: string, record: any) => (
                <div className="flex flex-col gap-2 py-2">
                    <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg text-red-700 font-medium whitespace-pre-wrap text-sm leading-relaxed shadow-sm">
                        {text || '-'}
                    </div>
                    {record.khoang_thoi_gian_trung && (
                        <Tag color="volcano" className="w-fit m-0 border-transparent font-medium">Trùng: {record.khoang_thoi_gian_trung}</Tag>
                    )}
                </div>
            )
        },
        {
            title: 'Trao đổi & Xử lý',
            key: 'notes',
            width: 280,
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-2 py-2">
                    {record.departmentNote ? (
                        <div className="bg-blue-50/50 border border-blue-100 p-2.5 rounded-lg shadow-sm">
                            <div className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">🗣️ Khoa báo:</div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{record.departmentNote}</div>
                        </div>
                    ) : (
                        <div className="text-slate-400 text-xs italic px-1">Chưa có giải trình từ Khoa</div>
                    )}
                    {record.adminNote && (
                        <div className="bg-green-50/50 border border-green-100 p-2.5 rounded-lg mt-1 shadow-sm">
                            <div className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1">🛠️ CNTT / Admin:</div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{record.adminNote}</div>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 140,
            fixed: 'right' as const,
            render: (_: any, record: any) => (
                <div className="flex flex-col gap-2.5 py-2 items-stretch">
                    <Tag 
                        color={record.status === 'PENDING' ? 'warning' : 'success'} 
                        className="w-full text-center m-0 py-1 font-semibold border-transparent"
                    >
                        {record.status === 'PENDING' ? '⏳ Chờ xử lý' : '✅ Đã xử lý'}
                    </Tag>
                    <Button 
                        size="small" 
                        type={record.status === 'PENDING' ? 'primary' : 'default'}
                        className={record.status === 'PENDING' ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200" : "bg-white"}
                        onClick={() => {
                            if (!isAdmin) {
                                setSelectedErrorForIT(record);
                                itForm.resetFields();
                                if (user?.staffId) itForm.setFieldsValue({ nguoi_bao_id: user.staffId });
                                setIsITModalVisible(true);
                            } else {
                                setSelectedError(record);
                                form.setFieldsValue({
                                    status: record.status,
                                    departmentNote: record.departmentNote,
                                    adminNote: record.adminNote
                                });
                                setIsModalVisible(true);
                            }
                        }}
                    >
                        {isAdmin ? 'Xử lý' : 'Gửi CNTT'}
                    </Button>
                    
                    {canDelete && (
                        <Button size="small" danger type="text" className="hover:bg-red-50" onClick={() => handleDelete([record.id])}>
                            Xóa
                        </Button>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="w-full px-4 sm:px-6 py-4 sm:py-6 space-y-6 bg-slate-50/50 min-h-screen pb-12">
            {/* Header & Stats */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2 leading-tight">Danh sách Lỗi Hồ sơ</h1>
                    <p className="text-slate-500 m-0">Quản lý và giải trình các lỗi quét từ hệ thống XML / Chuyên đề</p>
                </div>
                
                <div className="flex gap-4 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
                    <Card className="flex-1 min-w-[140px] shadow-sm border-slate-200 rounded-2xl bg-white" styles={{ body: { padding: '16px 24px' } }}>
                        <Statistic title={<span className="text-slate-500 font-medium">Tổng hồ sơ lỗi</span>} value={stats.total} styles={{ content: { color: '#1e293b', fontWeight: 700 } }} />
                    </Card>
                    <Card className="flex-1 min-w-[140px] shadow-sm border-orange-100 rounded-2xl bg-orange-50/50" styles={{ body: { padding: '16px 24px' } }}>
                        <Statistic title={<span className="text-orange-600 font-medium">Chờ xử lý</span>} value={stats.pending} styles={{ content: { color: '#ea580c', fontWeight: 700 } }} />
                    </Card>
                    <Card className="flex-1 min-w-[140px] shadow-sm border-green-100 rounded-2xl bg-green-50/50" styles={{ body: { padding: '16px 24px' } }}>
                        <Statistic title={<span className="text-green-600 font-medium">Đã khắc phục</span>} value={stats.resolved} styles={{ content: { color: '#16a34a', fontWeight: 700 } }} />
                    </Card>
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="shadow-sm border-slate-200 rounded-2xl bg-white" styles={{ body: { padding: '20px' } }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <Space size="middle" className="flex-wrap">
                        <Segmented
                            options={[
                                { label: '🔴 Chờ xử lý', value: 'PENDING' },
                                { label: '✅ Đã xử lý', value: 'EXPLAINED' },
                                { label: 'Tất cả trạng thái', value: 'ALL' }
                            ]}
                            value={statusFilter}
                            onChange={(val: any) => setStatusFilter(val)}
                            className="bg-slate-100 p-1 font-medium"
                        />
                        <Segmented
                            options={[
                                { label: 'Lỗi XML', value: 'XML' },
                                { label: 'Lỗi Chuyên đề trùng thời gian', value: 'CHUYEN_DE' }
                            ]}
                            value={sourceType}
                            onChange={(val: any) => {
                                setSourceType(val);
                                setChuyenDeFilter('ALL');
                            }}
                            className="bg-slate-100 p-1 font-medium"
                        />
                        {sourceType === 'CHUYEN_DE' && (
                            <Select
                                value={chuyenDeFilter}
                                onChange={setChuyenDeFilter}
                                style={{ width: 300 }}
                                options={[
                                    { value: 'ALL', label: 'Tất cả Lỗi Chuyên đề trùng thời gian' },
                                    ...uniqueChuyenDeRules.map(rule => ({ value: rule, label: rule }))
                                ]}
                                className="font-medium"
                            />
                        )}
                    </Space>
                    
                    <Space size="small" className="flex-wrap">
                        <Button  
                            onClick={() => router.push('/error-management/xml-summary')}
                            className="rounded-lg font-medium"
                        >
                            Báo cáo Tổng hợp
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<FileExcelOutlined />} 
                            onClick={handleExportExcel}
                            className="bg-green-600 hover:bg-green-700 rounded-lg font-medium shadow-md shadow-green-200"
                        >
                            Xuất Excel
                        </Button>
                        {canDelete && selectedRowKeys.length > 0 && (
                            <Button 
                                danger 
                                type="primary" 
                                onClick={() => handleDelete(selectedRowKeys as string[])}
                                className="rounded-lg font-medium shadow-md shadow-red-200"
                            >
                                Xóa ({selectedRowKeys.length})
                            </Button>
                        )}
                    </Space>
                </div>
                
                {paramKhoa && (
                    <div className="mt-5 pt-4 border-t border-slate-100">
                        <Tag closable onClose={() => router.push(`/error-management/xml-errors?sourceType=${sourceType}`)} color="blue" className="text-sm py-1.5 px-3 m-0 rounded-lg border-blue-200">
                            Đang lọc theo Khoa: <b className="text-blue-700">{departments[paramKhoa] || paramKhoa}</b> 
                            {paramDetail && <span className="ml-2 text-slate-500">| Lỗi: <b className="text-slate-700">{paramDetail}</b></span>}
                        </Tag>
                    </div>
                )}
            </Card>

            {/* Table Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <Table
                    rowSelection={canDelete ? {
                        selectedRowKeys,
                        onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
                    } : undefined}
                    dataSource={filteredErrors}
                    columns={sourceType === 'CHUYEN_DE' ? chuyenDeColumns : columns}
                    rowClassName={(record) => sourceType === 'CHUYEN_DE' ? (record.groupColor || '') : ''}
                    rowKey="id"
                    bordered={sourceType === 'CHUYEN_DE'}
                    loading={loading}
                    pagination={{ 
                        defaultPageSize: 15, 
                        showSizeChanger: true, 
                        className: "px-6 py-4 border-t border-slate-100 m-0",
                        showTotal: (total, range) => <span className="text-slate-500 font-medium">Đang hiển thị {range[0]}-{range[1]} / {total} lỗi</span>
                    }}
                    scroll={{ x: 1300 }}
                    rowClassName={(record: any) => record.itResolved ? 'bg-green-50/50' : (record.groupColor || '')}
                />
            </div>

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
