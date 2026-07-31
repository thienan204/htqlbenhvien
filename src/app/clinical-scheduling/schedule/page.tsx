'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Select, Button, message, DatePicker, Row, Col, Upload, Spin, Alert, Checkbox, Tag, Tabs, Typography, Modal, Space, Popconfirm } from 'antd';
import { UploadOutlined, DownloadOutlined, PlayCircleOutlined, PrinterOutlined, FilePdfOutlined, FileExcelOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx-js-style';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import ClinicalSchedulingConfigPage from '../config/page';
import ClinicalSchedulingAttendancePage from '../attendance/page';

const { Option } = Select;

function SavedPdfReportsTab() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/pdf-reports');
            if (res.ok) {
                const response = await res.json();
                if (response.success) {
                    setData(response.data);
                }
            }
        } catch (error) {
            console.error('Error fetching files:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/pdf-reports?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    message.success('Đã xóa báo cáo thành công');
                    fetchFiles();
                } else {
                    message.error('Lỗi khi xóa: ' + result.message);
                }
            }
        } catch (error) {
            message.error('Có lỗi xảy ra khi xóa file');
        }
    };

    const columns = [
        {
            title: 'Tên Báo Cáo',
            dataIndex: 'ten_bao_cao',
            key: 'ten_bao_cao',
            render: (text: string, record: any) => (
                <a href={record.url} target="_blank" rel="noopener noreferrer" style={{color: '#1890ff', fontWeight: 500}}>
                    <FilePdfOutlined style={{color: '#ff4d4f', marginRight: 8}} />
                    {text}
                </a>
            ),
        },
        { title: 'Loại', dataIndex: 'loai_bao_cao', key: 'loai_bao_cao', render: (val: string) => val ? <Tag color="blue">{val}</Tag> : '-' },
        { title: 'Khoa / Phòng', dataIndex: 'ma_khoa', key: 'ma_khoa', render: (val: string) => val ? <Tag color="green">{val}</Tag> : '-' },
        { title: 'Người tạo', dataIndex: 'nguoi_tao', key: 'nguoi_tao' },
        { title: 'Ngày lưu', dataIndex: 'createdAt', key: 'createdAt', render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN') },
        {
            title: 'Hành động',
            key: 'action',
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Space>
                    <a href={record.url} download={record.url.split('/').pop()}>
                        <Button type="primary" icon={<DownloadOutlined />} size="small" style={{ background: '#10b981', borderColor: '#10b981' }}>Tải</Button>
                    </a>
                    <Popconfirm title="Xóa báo cáo này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
                        <Button danger icon={<DeleteOutlined />} size="small">Xóa</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card style={{ marginTop: 16 }} title="Danh sách Báo cáo PDF đã lưu trữ" extra={<Button onClick={fetchFiles}>Làm mới</Button>}>
            <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{ defaultPageSize: 10 }} bordered size="small" />
        </Card>
    );
}

export default function ClinicalSchedulingPage() {
    const { user } = useAuth();
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedDept, setSelectedDept] = useState<string | undefined>(undefined);
    const reportRef = useRef<HTMLDivElement>(null);
    const patientRef = useRef<HTMLDivElement>(null);
    const [savingReport, setSavingReport] = useState(false);
    
    const [uploadedData, setUploadedData] = useState<any[]>([]);
    const [uniqueServices, setUniqueServices] = useState<string[]>([]);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    
    const [scheduledData, setScheduledData] = useState<any[]>([]);
    const [failedData, setFailedData] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setSelectedDate(dayjs().format('YYYY-MM-DD'));
    }, []);

    const staffStats = React.useMemo(() => {
        if (!scheduledData.length) return [];
        const stats: Record<string, number> = {};
        scheduledData.forEach(item => {
            const name = item.nguoi_thuc_hien;
            if (!stats[name]) stats[name] = 0;
            stats[name]++;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    }, [scheduledData]);

    const groupedScheduledData = React.useMemo(() => {
        if (!scheduledData.length) return [];
        const groups: Record<string, any[]> = {};
        scheduledData.forEach(item => {
            if (!groups[item.nguoi_thuc_hien]) groups[item.nguoi_thuc_hien] = [];
            groups[item.nguoi_thuc_hien].push(item);
        });

        return Object.keys(groups).sort().map((staff, idx) => ({
            key: `group_${idx}`,
            nguoi_thuc_hien: `${staff} (${groups[staff].length} ca)`,
            ma_ba: '',
            ten_bn: '',
            ten_dich_vu: '',
            bat_dau: '',
            ket_thuc: '',
            thoi_gian_chi_dinh: '',
            children: groups[staff].map((child, cIdx) => ({
                ...child,
                key: `child_${idx}_${cIdx}`,
                nguoi_thuc_hien: ''
            }))
        }));
    }, [scheduledData]);

    const groupedByPatientData = React.useMemo(() => {
        if (!scheduledData.length) return [];
        const groups: Record<string, any[]> = {};
        scheduledData.forEach(item => {
            const patientKey = `${item.ma_ba} - ${item.ten_bn}`;
            if (!groups[patientKey]) groups[patientKey] = [];
            groups[patientKey].push(item);
        });

        return Object.keys(groups).sort().map((patient, idx) => ({
            key: `patient_group_${idx}`,
            ten_bn: `${patient} (${groups[patient].length} dịch vụ)`,
            nguoi_thuc_hien: '',
            ma_ba: '',
            ten_dich_vu: '',
            bat_dau: '',
            ket_thuc: '',
            thoi_gian_chi_dinh: '',
            children: groups[patient].map((child, cIdx) => ({
                ...child,
                key: `patient_child_${idx}_${cIdx}`,
                ten_bn: '',
                ma_ba: ''
            }))
        }));
    }, [scheduledData]);

    const reportData = React.useMemo(() => {
        if (!scheduledData.length) return { dataSource: [], columns: [] };
        
        const serviceNames = Array.from(new Set(scheduledData.map(item => item.ten_dich_vu))).sort();
        
        const groups: Record<string, any> = {};
        scheduledData.forEach(item => {
            const patientKey = item.ma_ba; 
            if (!groups[patientKey]) {
                groups[patientKey] = {
                    key: patientKey,
                    ma_ba: item.ma_ba,
                    ten_bn: item.ten_bn,
                };
            }
            if (!groups[patientKey][item.ten_dich_vu]) {
                groups[patientKey][item.ten_dich_vu] = 0;
            }
            groups[patientKey][item.ten_dich_vu]++;
        });

        let index = 1;
        const dataSource = Object.values(groups).map((row: any) => {
            const newRow: any = { ...row, stt: index++ };
            serviceNames.forEach(srv => {
                if (newRow[srv]) {
                    newRow[srv] = "X";
                } else {
                    newRow[srv] = "";
                }
            });
            return newRow;
        });

        const columns = [
            { title: 'stt', dataIndex: 'stt', key: 'stt', width: 60, align: 'center' as const },
            { title: 'họ và tên BN', dataIndex: 'ten_bn', key: 'ten_bn', width: 200 },
            {
                title: 'Dịch vụ kỹ thuật',
                children: serviceNames.map(srv => ({
                    title: srv,
                    dataIndex: srv,
                    key: srv,
                    align: 'center' as const,
                    width: 150
                }))
            }
        ];

        return { dataSource, columns };
    }, [scheduledData]);
    
    // States for Excel column mapping
    const [mappingModalVisible, setMappingModalVisible] = useState(false);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [rawExcelData, setRawExcelData] = useState<any[]>([]);
    const [columnMapping, setColumnMapping] = useState<{
        ma_ba: string;
        ten_bn: string;
        ma_dich_vu: string;
        ten_dich_vu: string;
        thoi_gian_chi_dinh: string;
        ten_khoa?: string;
        ma_khoa?: string;
        phong_thuc_hien?: string;
    }>({
        ma_ba: '',
        ten_bn: '',
        ma_dich_vu: '',
        ten_dich_vu: '',
        thoi_gian_chi_dinh: ''
    });

    useEffect(() => {
        const savedMapping = localStorage.getItem('clinical_schedule_column_mapping');
        if (savedMapping) {
            try {
                setColumnMapping(JSON.parse(savedMapping));
            } catch (e) {}
        }
    }, []);

    useEffect(() => {
        if (user === undefined) return;
        
        // Fetch departments for the dropdown
        fetch('/api/clinical-scheduling/attendance?date=' + selectedDate)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.departments) {
                    let depts = data.departments;
                    if (user?.role !== 'ADMIN' && user?.ma_khoa) {
                        depts = depts.filter((d: any) => d.ma_khoa === user.ma_khoa);
                    }
                    setDepartments(depts);
                    
                    // Tự động chọn khoa nếu chỉ có 1 khoa (hoặc user ko phải admin)
                    if (depts.length === 1) {
                        setSelectedDept(depts[0].ma_khoa);
                    }
                }
            })
            .catch(err => console.error(err));
    }, [selectedDate, user]);

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                if (json.length === 0) {
                    return message.error('File Excel không có dữ liệu.');
                }

                // Lấy danh sách cột từ dòng đầu tiên
                const headers = Object.keys(json[0] as object);
                setExcelHeaders(headers);
                setRawExcelData(json);

                // Thử đoán mapping tự động
                const autoMap = { ...columnMapping };
                headers.forEach(h => {
                    const upper = h.toUpperCase();
                    if (upper.includes('MÃ HS') || upper.includes('MÃ HỒ SƠ') || upper.includes('MAHOSO')) autoMap.ma_ba = h;
                    if (upper.includes('TÊN BN') || upper.includes('TÊN BỆNH NHÂN') || upper.includes('TENBENHNHAN')) autoMap.ten_bn = h;
                    if (upper.includes('THỜI GIAN') || upper.includes('NGÀY Y LỆNH') || upper.includes('THOIGIAN')) autoMap.thoi_gian_chi_dinh = h;
                    if (upper.includes('MÃ DỊCH VỤ') || upper.includes('MÃ DV') || upper === 'MADICHVU') autoMap.ma_dich_vu = h;
                    if (upper.includes('TÊN DỊCH VỤ') || upper.includes('TÊN DV') || upper === 'TENDICHVU') autoMap.ten_dich_vu = h;
                    if (upper.includes('TÊN KHOA') || upper === 'TENKHOA') autoMap.ten_khoa = h;
                    if (upper.includes('MÃ KHOA') || upper === 'MAKHOA') autoMap.ma_khoa = h;
                    if (upper.includes('PHÒNG THỰC HIỆN') || upper === 'PHONGTHUCHIEN') autoMap.phong_thuc_hien = h;
                });
                setColumnMapping(autoMap);
                setMappingModalVisible(true);
            } catch (error) {
                message.error('Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng.');
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    const handleConfirmMapping = () => {
        if (!columnMapping.ma_dich_vu) {
            message.error('Bắt buộc phải chọn cột Mã Dịch Vụ!');
            return;
        }

        localStorage.setItem('clinical_schedule_column_mapping', JSON.stringify(columnMapping));

        const mappedData = rawExcelData.map(row => ({
            ma_ba: row[columnMapping.ma_ba] || '',
            ten_bn: row[columnMapping.ten_bn] || '',
            thoi_gian_chi_dinh: row[columnMapping.thoi_gian_chi_dinh] || '',
            ma_dich_vu: row[columnMapping.ma_dich_vu] || '',
            ten_dich_vu: row[columnMapping.ten_dich_vu] || '',
            ten_khoa: row[columnMapping.ten_khoa as string] || '',
            ma_khoa: row[columnMapping.ma_khoa as string] || '',
            phong_thuc_hien: row[columnMapping.phong_thuc_hien as string] || '',
            _originalRow: row
        }));

        setUploadedData(mappedData);
        
        const services = Array.from(new Set(mappedData.map(d => d.ten_dich_vu).filter(Boolean)));
        setUniqueServices(services as string[]);
        setSelectedServices(services as string[]);
        
        setMappingModalVisible(false);
        message.success('Đã map dữ liệu thành công!');
    };

    const handleGenerateSchedule = async () => {
        if (!selectedDate || !selectedDept) {
            message.error("Vui lòng chọn ngày và Khoa/Phòng");
            return;
        }

        const filteredData = uploadedData.filter(d => selectedServices.includes(d.ten_dich_vu));
        
        if (filteredData.length === 0) {
            message.warning("Không có dịch vụ nào để xếp lịch");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/clinical-scheduling/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    maKhoa: selectedDept,
                    services: filteredData
                })
            });
            
            const data = await res.json();
            if (data.success) {
                setScheduledData(data.scheduled);
                setFailedData(data.failed.map((item: any, i: number) => ({ ...item, key: `failed_${i}` })));
                message.success(`Đã xếp lịch thành công ${data.scheduled.length} dịch vụ!`);
            } else {
                message.error("Lỗi: " + data.message);
            }
        } catch (error) {
            console.error(error);
            message.error("Có lỗi xảy ra khi gọi API");
        } finally {
            setLoading(false);
        }
    };

    const generatePDFBlob = async (elementId: string): Promise<Blob | null> => {
        const element = document.getElementById(elementId);
        if (!element) return null;
        try {
            const { toJpeg } = await import('html-to-image');
            const dataUrl = await toJpeg(element, { quality: 0.95, backgroundColor: '#ffffff' });
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const img = new Image();
            img.src = dataUrl;
            await new Promise((resolve) => { img.onload = resolve; });
            const pdfHeight = (img.height * pdfWidth) / img.width;
            pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            return pdf.output('blob');
        } catch (e) {
            console.error('Lỗi khi tạo PDF:', e);
            message.error('Lỗi render hình ảnh, vui lòng thử lại.');
            return null;
        }
    };

    const pageStyleForPrint = `
        @page { margin: 10mm; }
        body { padding: 0; font-size: 11px; background: #fff !important; color: #000 !important; }
        .ant-table { width: 100% !important; }
        table { width: 100% !important; border-collapse: collapse; table-layout: fixed !important; }
        .ant-table-wrapper .ant-table-cell, .ant-table th, .ant-table td { padding: 2px 4px !important; word-wrap: break-word; font-size: 11px !important; color: #000 !important; }
        .ant-table-thead > tr > th { font-weight: bold; background-color: #fafafa !important; color: #000 !important; text-align: center !important; }
        .ant-table-row-expand-icon { display: none !important; }
        .ant-table-wrapper, .ant-table-container, .ant-table-body, .ant-table-content, .ant-spin-nested-loading, .ant-spin-container { display: block !important; overflow: visible !important; height: auto !important; max-height: none !important; position: static !important; }
        .ant-table-tbody { display: table-row-group !important; }
        tr { display: table-row !important; page-break-inside: avoid; }
        .print-header { display: block !important; margin-bottom: 20px; text-align: center; }
        .print-truncate { display: -webkit-box !important; -webkit-line-clamp: 1 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; white-space: normal !important; word-break: break-word !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    `;

    const handlePrintPatient = useReactToPrint({
        contentRef: patientRef,
        documentTitle: 'Danh Sách Bệnh Nhân',
        pageStyle: pageStyleForPrint,
    });

    const handlePrintReport = useReactToPrint({
        contentRef: reportRef,
        documentTitle: 'Tổng Hợp Y Lệnh Thủ Thuật',
        pageStyle: pageStyleForPrint,
    });

    const handlePrint = (elementId: string) => {
        if (elementId === 'print-patient') {
            handlePrintPatient();
        } else if (elementId === 'print-report') {
            handlePrintReport();
        }
    };

    const handleExportPDF = async (elementId: string, title: string) => {
        const blob = await generatePDFBlob(elementId);
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title}_${dayjs(selectedDate || new Date()).format('YYYYMMDD')}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const handleSaveReport = async (elementId: string, title: string) => {
        if (!selectedDept) {
            return message.warning('Vui lòng chọn Khoa/Phòng');
        }
        setSavingReport(true);
        const blob = await generatePDFBlob(elementId);
        if (blob) {
            const formData = new FormData();
            formData.append('file', blob, `${title}.pdf`);
            formData.append('ten_bao_cao', `${title} - Ngày ${dayjs(selectedDate || new Date()).format('DD/MM/YYYY')}`);
            formData.append('loai_bao_cao', title);
            formData.append('ma_khoa', selectedDept);
            formData.append('nguoi_tao', (user as any)?.ho_ten || 'Unknown');

            try {
                const res = await fetch('/api/clinical-scheduling/save-report', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    message.success('Đã lưu báo cáo lên máy chủ');
                } else {
                    message.error('Lỗi: ' + data.message);
                }
            } catch (e) {
                message.error('Lỗi kết nối máy chủ');
            }
        }
        setSavingReport(false);
    };

    const handleExportExcelTab = (dataSource: any[], columns: any[], title: string) => {
        if (!dataSource || dataSource.length === 0) return;
        
        const exportData: any[] = [];
        
        const processRow = (row: any) => {
            const newRow: any = {};
            columns.forEach((col: any) => {
                if (col.children) {
                    col.children.forEach((c: any) => {
                        newRow[c.title] = row[c.dataIndex] || '';
                    });
                } else {
                    let dataKey = col.dataIndex || col.key;
                    if (dataKey) {
                        let val = row[dataKey] !== undefined && row[dataKey] !== null ? row[dataKey] : '';
                        if (col.key === 'ten_dich_vu' && row.ma_dich_vu) {
                            val = `[${row.ma_dich_vu}] ${val}`;
                        }
                        if (col.key === 'may_thuc_hien' && row.ten_may) {
                            val = `${row.ten_may} (${row.ma_may})`;
                        }
                        newRow[col.title] = val;
                    }
                }
            });
            exportData.push(newRow);
            
            if (row.children && row.children.length > 0) {
                row.children.forEach((child: any) => processRow(child));
            }
        };

        dataSource.forEach(row => processRow(row));

        const ws = XLSX.utils.json_to_sheet(exportData, { origin: 'A4' });
        
        // Thêm Header
        const deptName = departments.find((d: any) => d.ma_khoa === selectedDept)?.ten_khoa || '';
        const dateStr = dayjs(selectedDate || new Date()).format('DD/MM/YYYY');
        const headerTitle = `CHIA THỜI GIAN THỰC HIỆN DVKT NGÀY ${dateStr} CỦA KHOA ${deptName}`.toUpperCase();

        XLSX.utils.sheet_add_aoa(ws, [
            ['SỞ Y TẾ TỈNH LẠNG SƠN'],
            ['BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN'],
            [headerTitle]
        ], { origin: 'A1' });

        if(!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push(
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }
        );

        // Styling for headers and page setup
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        
        // Căn giữa 3 dòng tiêu đề đầu
        for (let R = 0; R <= 2; R++) {
            const cell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
            if (cell) {
                cell.s = { font: { bold: true, sz: R === 2 ? 14 : 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
            }
        }

        // In đậm dòng tiêu đề các cột (dòng số 3, do data bắt đầu từ A4)
        for (let C = range.s.c; C <= range.e.c; C++) {
            const cell = ws[XLSX.utils.encode_cell({ r: 3, c: C })];
            if (cell && typeof cell === 'object') {
                cell.s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
            }
        }
        
        // Mặc định xuất Excel ngang khổ A4
        ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9 };
        
        // Tính toán độ rộng tự động cho các cột (Auto Width)
        if (exportData.length > 0) {
            const colWidths: Record<string, number> = {};
            // Khởi tạo width bằng độ dài của header
            Object.keys(exportData[0]).forEach(key => {
                colWidths[key] = key.length; 
            });
            // Duyệt qua dữ liệu để tìm nội dung dài nhất
            exportData.forEach(row => {
                Object.keys(row).forEach(key => {
                    const val = row[key] ? String(row[key]) : '';
                    if (val.length > colWidths[key]) {
                        colWidths[key] = val.length;
                    }
                });
            });
            // Áp dụng vào sheet, giới hạn max 100, min 10
            const wscols = Object.keys(exportData[0]).map(key => ({
                wch: Math.min(Math.max(colWidths[key] + 3, 10), 100)
            }));
            ws['!cols'] = wscols;
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${title}_${dayjs(selectedDate || new Date()).format('YYYYMMDD')}.xlsx`);
    };

    const handleExportExcel = () => {
        if (scheduledData.length === 0) return;
        const exportJson = scheduledData.map(item => ({
            ...item._originalRow,
            'Thời gian chỉ định': item.thoi_gian_chi_dinh,
            'Người thực hiện (Bác sĩ/Điều dưỡng)': item.nguoi_thuc_hien,
            'Máy thực hiện': item.ten_may ? `${item.ten_may} (${item.ma_may})` : '',
            'Bắt đầu': item.bat_dau,
            'Kết thúc': item.ket_thuc
        }));
        const ws = XLSX.utils.json_to_sheet(exportJson);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'KetQuaXepLich');
        XLSX.writeFile(wb, `KetQuaXepLich_${dayjs(selectedDate || new Date()).format('YYYYMMDD')}.xlsx`);
    };

    const resultColumns = [
        { title: 'Người thực hiện', dataIndex: 'nguoi_thuc_hien', key: 'nguoi_thuc_hien', width: '15%', render: (t: string, r: any) => t ? <div className="print-truncate"><strong style={{color: r.children ? '#237804' : '#16a34a'}}>{t}</strong></div> : null },
        { title: 'Mã BA', dataIndex: 'ma_ba', key: 'ma_ba', width: '10%' },
        { title: 'Tên Bệnh nhân', dataIndex: 'ten_bn', key: 'ten_bn', width: '20%' },
        { title: 'TG Chỉ định', dataIndex: 'thoi_gian_chi_dinh', key: 'thoi_gian_chi_dinh', width: '10%', render: (t: string) => <span style={{ whiteSpace: 'nowrap', fontSize: '0.9em' }}>{t}</span> },
        { title: 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', width: '25%', render: (t: string, r: any) => t ? <div className="print-truncate">{r.ma_dich_vu ? `[${r.ma_dich_vu}] ${t}` : t}</div> : null },
        { title: 'Máy', key: 'may_thuc_hien', width: '10%', render: (_: any, r: any) => r.ten_may ? <div className="print-truncate"><span>{r.ten_may} <span className="text-gray-500">({r.ma_may})</span></span></div> : null },
        { title: 'Bắt đầu', dataIndex: 'bat_dau', key: 'bat_dau', width: '5%', render: (t: string) => t ? <Tag color="blue">{t}</Tag> : null },
        { title: 'Kết thúc', dataIndex: 'ket_thuc', key: 'ket_thuc', width: '5%', render: (t: string) => t ? <Tag color="cyan">{t}</Tag> : null },
    ];

    const patientColumns = [
        { title: 'Tên Bệnh nhân', dataIndex: 'ten_bn', key: 'ten_bn', width: '25%', render: (t: string, r: any) => t ? <strong style={{color: r.children ? '#0958d9' : '#000'}}>{t}</strong> : null },
        { title: 'Người thực hiện', dataIndex: 'nguoi_thuc_hien', key: 'nguoi_thuc_hien', width: '15%', render: (t: string) => t ? <div className="print-truncate"><strong style={{color: '#16a34a'}}>{t}</strong></div> : null },
        { title: 'TG Chỉ định', dataIndex: 'thoi_gian_chi_dinh', key: 'thoi_gian_chi_dinh', width: '10%', render: (t: string) => <span style={{ whiteSpace: 'nowrap', fontSize: '0.9em' }}>{t}</span> },
        { title: 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', width: '30%', render: (t: string, r: any) => t ? <div className="print-truncate">{r.ma_dich_vu ? `[${r.ma_dich_vu}] ${t}` : t}</div> : null },
        { title: 'Máy', key: 'may_thuc_hien', width: '10%', render: (_: any, r: any) => r.ten_may ? <div className="print-truncate"><span>{r.ten_may} <span className="text-gray-500">({r.ma_may})</span></span></div> : null },
        { title: 'Bắt đầu', dataIndex: 'bat_dau', key: 'bat_dau', width: '5%', align: 'center' as const, render: (t: string) => t ? <Tag color="blue">{t}</Tag> : null },
        { title: 'Kết thúc', dataIndex: 'ket_thuc', key: 'ket_thuc', width: '5%', align: 'center' as const, render: (t: string) => t ? <Tag color="cyan">{t}</Tag> : null },
    ];

    const failedColumns = [
        { title: 'Mã BA', dataIndex: 'ma_ba', key: 'ma_ba' },
        { title: 'Tên BN', dataIndex: 'ten_bn', key: 'ten_bn' },
        { title: 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', render: (t: string, r: any) => t ? (r.ma_dich_vu ? `[${r.ma_dich_vu}] ${t}` : t) : null },
        { title: 'Lý do lỗi', dataIndex: 'error', key: 'error', render: (t: string) => <strong style={{color: 'red'}}>{t}</strong> },
    ];

    return (
        <div style={{ padding: 24, width: '100%', maxWidth: 1800, margin: '0 auto' }}>
            <h1 style={{ fontSize: 24, marginBottom: 24, fontWeight: 'bold' }}>Hệ thống tự động chia thời gian thực hiện DVKT</h1>
            <Tabs type="card" defaultActiveKey="1" items={[
                {
                    key: '1',
                    label: <strong style={{fontSize: 16}}>Công cụ xếp thời gian</strong>,
                    children: (
                        <div style={{ marginTop: 16 }}>
            <Card style={{ marginBottom: 24 }}>
                <Row gutter={24} align="middle">
                    <Col span={6}>
                        <div style={{ marginBottom: 8 }}><strong>1. Chọn ngày thực hiện:</strong></div>
                        <DatePicker 
                            value={selectedDate ? dayjs(selectedDate) : null}
                            onChange={(date) => { if (date) setSelectedDate(date.format('YYYY-MM-DD')) }}
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                            allowClear={false}
                        />
                    </Col>
                    <Col span={8}>
                        <div style={{ marginBottom: 8 }}><strong>2. Chọn Khoa/Phòng (Lấy danh sách điểm danh):</strong></div>
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
                    <Col span={10}>
                        <div style={{ marginBottom: 8 }}><strong>3. Upload File Excel (Danh sách chỉ định):</strong></div>
                        <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".xlsx, .xls">
                            <Button icon={<UploadOutlined />} type="dashed" style={{ width: '100%' }}>
                                Bấm vào đây để tải file thô lên
                            </Button>
                        </Upload>
                    </Col>
                </Row>
                
                {uploadedData.length > 0 && (
                    <div style={{ marginTop: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                        <h3 style={{ margin: 0, marginBottom: 12, color: '#1890ff' }}>Lọc Dịch vụ cần xếp lịch:</h3>
                        <Checkbox.Group 
                            options={uniqueServices} 
                            value={selectedServices} 
                            onChange={(checkedValues) => setSelectedServices(checkedValues as string[])}
                        />
                    </div>
                )}

                {uploadedData.length > 0 && (
                    <div style={{ marginTop: 24, textAlign: 'center', background: '#f6ffed', padding: 16, border: '1px solid #b7eb8f', borderRadius: 8 }}>
                        <h3 style={{ margin: 0, color: '#389e0d' }}>✅ Đã tải thành công {uploadedData.length} chỉ định dịch vụ</h3>
                        <p style={{ color: '#595959', marginBottom: 16 }}>Hệ thống đã sẵn sàng tính toán lịch cho <strong>{selectedServices.length}</strong> loại dịch vụ đã chọn.</p>
                        <Button 
                            type="primary" 
                            size="large" 
                            icon={<PlayCircleOutlined />} 
                            onClick={handleGenerateSchedule}
                            loading={loading}
                        >
                            CHẠY THUẬT TOÁN XẾP LỊCH
                        </Button>
                    </div>
                )}
            </Card>

            {(scheduledData.length > 0 || failedData.length > 0) && (
                <Card 
                    title={<span style={{color: '#16a34a'}}>Kết quả Xếp lịch ({scheduledData.length} dịch vụ thành công, {failedData.length} lỗi)</span>}
                    extra={<Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel}>Tải File Excel Hoàn Chỉnh</Button>}
                    style={{ marginBottom: 24, border: '1px solid #16a34a' }}
                >
                    <Tabs type="card" 
                        defaultActiveKey="1"
                        items={[
                            {
                                key: '1',
                                label: 'Tên Bệnh nhân',
                                children: (
                                    <>
                                        <Space style={{ marginBottom: 16 }}>
                                            <Button icon={<PrinterOutlined />} onClick={() => handlePrint('print-patient')}>In Báo Cáo</Button>
                                            <Button icon={<FilePdfOutlined />} onClick={() => handleExportPDF('print-patient', 'DanhSachBenhNhan')}>Tải PDF</Button>
                                            <Button icon={<FileExcelOutlined />} onClick={() => handleExportExcelTab(groupedByPatientData, patientColumns, 'DanhSachBenhNhan')}>Tải Excel</Button>
                                            <Button type="primary" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveReport('print-patient', 'Danh Sách Bệnh Nhân')}>Lưu Báo Cáo</Button>
                                        </Space>
                                        <div id="print-patient" ref={patientRef} style={{ background: '#fff', padding: '20px' }}>
                                            <div className="print-header" style={{ display: 'none', marginBottom: 20 }}>
                                                <h2 style={{ textAlign: 'center' }}>SỞ Y TẾ TỈNH LẠNG SƠN<br/>BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN</h2>
                                                <h1 style={{ textAlign: 'center', marginTop: 20 }}>CHIA THỜI GIAN THỰC HIỆN DVKT NGÀY {dayjs(selectedDate).format('DD/MM/YYYY')} CỦA KHOA {departments.find((d: any) => d.ma_khoa === selectedDept)?.ten_khoa?.toUpperCase()}</h1>
                                            </div>
                                            <Table 
                                                dataSource={groupedByPatientData} 
                                                columns={patientColumns} 
                                                rowKey="key"
                                                pagination={{ pageSize: 50 }}
                                                defaultExpandAllRows
                                                size="small"
                                                bordered
                                            />
                                        </div>
                                        <div style={{ marginTop: 12, color: '#595959', fontStyle: 'italic' }}>
                                            File Excel xuất ra sẽ giữ nguyên toàn bộ các cột gốc của hệ thống (bao gồm MAHOSOBENHAN, SOPHIEU, v.v.) và <strong>tự động thêm các cột Bắt đầu, Kết thúc, Người thực hiện vào cuối.</strong>
                                        </div>
                                    </>
                                )
                            },
                            {
                                key: '2',
                                label: 'Bác sĩ / Điều dưỡng',
                                children: (
                                    <>
                                        <Table 
                                            dataSource={groupedScheduledData} 
                                            columns={resultColumns} 
                                            rowKey="key"
                                            pagination={{ pageSize: 50 }}
                                            defaultExpandAllRows
                                            size="small"
                                            bordered
                                        />
                                        <div style={{ marginTop: 12, color: '#595959', fontStyle: 'italic' }}>
                                            File Excel xuất ra sẽ giữ nguyên toàn bộ các cột gốc của hệ thống (bao gồm MAHOSOBENHAN, SOPHIEU, v.v.) và <strong>tự động thêm các cột Bắt đầu, Kết thúc, Người thực hiện vào cuối.</strong>
                                        </div>
                                    </>
                                )
                            },
                            {
                                key: '3',
                                label: 'Thống kê lượng việc theo Bác sĩ/Điều dưỡng',
                                children: (
                                    <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                                        {staffStats.map(([name, count]) => (
                                            <Col span={6} key={name}>
                                                <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', borderColor: '#b7eb8f' }}>
                                                    <div style={{ fontSize: 15, fontWeight: 'bold', color: '#237804' }}>{name}</div>
                                                    <div style={{ fontSize: 24, marginTop: 8, color: '#135200' }}>
                                                        {count} <span style={{fontSize: 13, color: '#595959', fontWeight: 'normal'}}>bệnh nhân</span>
                                                    </div>
                                                </Card>
                                            </Col>
                                        ))}
                                    </Row>
                                )
                            },
                            {
                                key: '4',
                                label: 'Tổng hợp Y lệnh Thủ thuật',
                                children: (
                                    <div style={{ marginTop: 16 }}>
                                        <Space style={{ marginBottom: 16 }}>
                                            <Button icon={<PrinterOutlined />} onClick={() => handlePrint('print-report')}>In Báo Cáo</Button>
                                            <Button icon={<FilePdfOutlined />} onClick={() => handleExportPDF('print-report', 'TongHopYLenh')}>Tải PDF</Button>
                                            <Button icon={<FileExcelOutlined />} onClick={() => handleExportExcelTab(reportData.dataSource, reportData.columns as any, 'TongHopYLenh')}>Tải Excel</Button>
                                            <Button type="primary" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveReport('print-report', 'Tổng Hợp Y Lệnh Thủ Thuật')}>Lưu Báo Cáo</Button>
                                        </Space>
                                        <div id="print-report" ref={reportRef} style={{ background: '#fff', padding: '20px' }}>
                                            <div className="print-header" style={{ display: 'none', marginBottom: 20 }}>
                                                <h2 style={{ textAlign: 'center' }}>SỞ Y TẾ TỈNH LẠNG SƠN<br/>BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN</h2>
                                                <h1 style={{ textAlign: 'center', marginTop: 20 }}>TỔNG HỢP Y LỆNH THỦ THUẬT - Ngày {dayjs(selectedDate).format('DD/MM/YYYY')}</h1>
                                            </div>
                                            <Table 
                                                dataSource={reportData.dataSource} 
                                                columns={reportData.columns as any} 
                                                rowKey="key"
                                                pagination={{ pageSize: 50 }}
                                                size="small"
                                                bordered
                                                scroll={{ x: 'max-content' }}
                                            />
                                        </div>
                                    </div>
                                )
                            },
                            ...(failedData.length > 0 ? [{
                                key: '5',
                                label: <span style={{ color: 'red' }}>Dịch vụ không thể xếp lịch ({failedData.length})</span>,
                                children: (
                                    <div style={{ marginTop: 16 }}>
                                        <Alert 
                                            title="Lưu ý" 
                                            description="Những dịch vụ này bị loại vì không tìm thấy nhân sự phù hợp (sai trình độ, hoặc khoa đã hết sạch giờ trống trong ngày)." 
                                            type="warning" 
                                            showIcon 
                                            style={{ marginBottom: 16 }}
                                        />
                                        <Table 
                                            dataSource={failedData} 
                                            columns={failedColumns} 
                                            rowKey="key"
                                            pagination={{ pageSize: 10 }}
                                            size="small"
                                            bordered
                                        />
                                    </div>
                                )
                            }] : [])
                        ]}
                    />
                </Card>
            )}
                        </div>
                    )
                },
                {
                    key: '3',
                    label: <strong style={{fontSize: 16, color: '#16a34a'}}>Lịch sử lưu báo cáo</strong>,
                    children: <SavedPdfReportsTab />
                },
                {
                    key: '4',
                    label: <strong style={{fontSize: 16}}>Người thực hiện</strong>,
                    children: <ClinicalSchedulingAttendancePage />
                },
                {
                    key: '5',
                    label: <strong style={{fontSize: 16}}>Cấu hình</strong>,
                    children: <ClinicalSchedulingConfigPage />
                },
                {
                    key: '2',
                    label: <strong style={{fontSize: 16}}>Hướng dẫn & Nguyên tắc</strong>,
                    children: (
                        <Card style={{ marginTop: 16 }}>
                            <Typography.Title level={3} style={{ color: '#1890ff', marginTop: 0 }}>Nguyên tắc Xếp lịch Tự động</Typography.Title>
                            
                            <Typography.Paragraph style={{ fontSize: 15 }}>
                                Hệ thống tự động phân bổ lịch dựa trên các nguyên tắc và ràng buộc sau:
                            </Typography.Paragraph>

                            <ul>
                                <li style={{ marginBottom: 12, fontSize: 15 }}>
                                    <strong>1. Khung giờ làm việc:</strong> Thuật toán chỉ xếp lịch vào trong các khoảng thời gian làm việc (Sáng/Chiều) đã được thiết lập sẵn trong phần <i>Cấu hình</i>. Các khoảng nghỉ trưa hoặc ngoài giờ sẽ bị bỏ qua.
                                </li>
                                <li style={{ marginBottom: 12, fontSize: 15 }}>
                                    <strong>2. Khoảng cách nghỉ (Buffer Time):</strong> Giữa 2 ca thực hiện dịch vụ của cùng 1 nhân viên, hệ thống sẽ tự động chèn thêm một khoảng thời gian nghỉ để nhân viên dọn dẹp, chuẩn bị dụng cụ. Thời gian nghỉ được ưu tiên lấy theo cấu hình của từng <i>Dịch vụ</i> {'->'} <i>Khoa</i> {'->'} <i>Cấu hình chung hệ thống</i>.
                                </li>
                                <li style={{ marginBottom: 12, fontSize: 15 }}>
                                    <strong>3. Nhân sự Khả dụng & Chuyên môn:</strong> Thuật toán tự động quét những nhân viên <strong>có đi làm và có bật "Thực hiện DVKT"</strong> tại phần Điểm danh. Sau đó, nó <strong>chỉ phân công</strong> công việc cho những người có Trình độ/Chức danh phù hợp với yêu cầu của Dịch vụ (Ví dụ: Bác sĩ, Điều dưỡng, Kỹ thuật viên...).
                                </li>
                                <li style={{ marginBottom: 12, fontSize: 15 }}>
                                    <strong>4. Tối ưu Thời gian chờ:</strong> Nhân viên nào đang có khung giờ trống sớm nhất sẽ được ưu tiên phân công trước nhằm phân tải đều công việc và giảm thiểu thời gian chờ đợi.
                                </li>
                                <li style={{ marginBottom: 12, fontSize: 15 }}>
                                    <strong>5. Dịch vụ làm song song:</strong> Một số dịch vụ đặc thù (VD: Điện châm, truyền dịch...) có thể được cấu hình cho phép "Làm song song". Với các dịch vụ này, bác sĩ chỉ bị chiếm dụng một khoảng thời gian ngắn lúc đầu (bằng đúng khoảng nghỉ Buffer Time hoặc tối thiểu 5 phút) để thao tác, sau đó có thể đi làm dịch vụ khác ngay trong khi bệnh nhân cũ vẫn đang nằm chờ đủ thời gian của dịch vụ.
                                </li>
                                <li style={{ marginBottom: 12, fontSize: 15 }}>
                                    <strong>6. Tránh trùng lặp Bệnh nhân:</strong> Hệ thống có kiểm tra chéo (Cross-check) lịch của Bệnh nhân. Một Bệnh nhân sẽ không bị xếp 2 dịch vụ trùng vào cùng 1 khung giờ. Thuật toán sẽ quét đến khi tìm được 1 khung giờ mà <strong>CẢ Bệnh nhân và Nhân viên</strong> đều rảnh.
                                </li>
                                <li style={{ marginBottom: 12, fontSize: 15 }}>
                                    <strong>7. Danh sách Thất bại (Ngoại lệ):</strong> Dịch vụ sẽ không thể xếp lịch nếu: Khoa không có nhân sự đáp ứng đủ yêu cầu chuyên môn trong ngày, hoặc lịch của Khoa/Bệnh nhân trong ngày hôm đó đã kín hoàn toàn không còn chỗ trống.
                                </li>
                            </ul>
                            
                            <Alert 
                                title="Ghi chú thêm" 
                                description="Bạn có thể chủ động thay đổi thời gian chuẩn của từng loại Dịch vụ và yêu cầu bằng cấp trong thẻ [Cấu hình]. Mọi thay đổi sẽ có tác dụng ngay ở lần chạy thuật toán kế tiếp." 
                                type="info" 
                                showIcon 
                                style={{ marginTop: 24 }}
                            />
                        </Card>
                    )
                },
            ]} />

            <Modal
                title={<span style={{color: '#1890ff', fontSize: 18}}>Cấu hình Cột Dữ liệu Excel</span>}
                open={mappingModalVisible}
                onOk={handleConfirmMapping}
                onCancel={() => setMappingModalVisible(false)}
                okText="Xác nhận Cấu hình"
                cancelText="Hủy bỏ"
                maskClosable={false}
                width={600}
            >
                <Alert title="Hướng dẫn" description="Hệ thống đã phát hiện các cột trong file Excel của bạn. Vui lòng nối đúng cột tương ứng (Hệ thống đã cố gắng tự động nhận diện các cột quen thuộc):" type="info" showIcon style={{ marginBottom: 20 }} />
                
                <Row gutter={16}>
                    <Col span={12} style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 4 }}><strong>Mã Bệnh Án / Hồ Sơ:</strong></div>
                        <Select
                            style={{ width: '100%' }}
                            value={columnMapping.ma_ba || undefined}
                            onChange={v => setColumnMapping({...columnMapping, ma_ba: v})}
                            options={excelHeaders.map(h => ({ label: h, value: h }))}
                            showSearch
                            allowClear
                            placeholder="Chọn cột Mã BA"
                        />
                    </Col>
                    <Col span={12} style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 4 }}><strong>Tên Bệnh Nhân:</strong></div>
                        <Select
                            style={{ width: '100%' }}
                            value={columnMapping.ten_bn || undefined}
                            onChange={v => setColumnMapping({...columnMapping, ten_bn: v})}
                            options={excelHeaders.map(h => ({ label: h, value: h }))}
                            showSearch
                            allowClear
                            placeholder="Chọn cột Tên BN"
                        />
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12} style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 4 }}><strong>Thời gian chỉ định (Nếu có):</strong></div>
                        <Select
                            style={{ width: '100%' }}
                            value={columnMapping.thoi_gian_chi_dinh || undefined}
                            onChange={v => setColumnMapping({...columnMapping, thoi_gian_chi_dinh: v})}
                            options={excelHeaders.map(h => ({ label: h, value: h }))}
                            showSearch
                            allowClear
                            placeholder="Chọn cột Thời gian"
                        />
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12} style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 4 }}><strong>Mã Dịch Vụ:</strong> <span style={{color: 'red'}}>*</span></div>
                        <Select
                            style={{ width: '100%' }}
                            value={columnMapping.ma_dich_vu || undefined}
                            onChange={v => setColumnMapping({...columnMapping, ma_dich_vu: v})}
                            options={excelHeaders.map(h => ({ label: h, value: h }))}
                            showSearch
                            placeholder="Bắt buộc chọn"
                        />
                    </Col>
                    <Col span={12} style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 4 }}><strong>Tên Dịch Vụ:</strong> <span style={{color: 'red'}}>*</span></div>
                        <Select
                            style={{ width: '100%' }}
                            value={columnMapping.ten_dich_vu || undefined}
                            onChange={v => setColumnMapping({...columnMapping, ten_dich_vu: v})}
                            options={excelHeaders.map(h => ({ label: h, value: h }))}
                            showSearch
                            placeholder="Bắt buộc chọn"
                        />
                    </Col>
                </Row>
            </Modal>
        </div>
    );
}
