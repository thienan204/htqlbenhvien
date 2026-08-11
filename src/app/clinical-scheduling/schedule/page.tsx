'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Select, Button, message, DatePicker, Row, Col, Upload, Spin, Alert, Checkbox, Tag, Tabs, Typography, Modal, Space, Popconfirm, Input, AutoComplete, App } from 'antd';
import { UploadOutlined, DownloadOutlined, PlayCircleOutlined, PrinterOutlined, FilePdfOutlined, FileExcelOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx-js-style';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import { getBasePath } from '@/utils/config';
import ClinicalSchedulingConfigPage from '../config/page';
import ClinicalSchedulingAttendancePage from '../attendance/page';
import PageInstruction from '@/components/shared/PageInstruction';
import Mau05Config from '../components/Mau05Config';

const { Option } = Select;

function SavedPdfReportsTab() {
    const { message } = App.useApp();
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
            render: (text: string, record: any) => {
                const isExcel = record.url && record.url.toLowerCase().endsWith('.xlsx');
                return (
                    <a href={`${getBasePath()}/api/download?url=${encodeURIComponent(record.url)}`} target="_blank" rel="noopener noreferrer" style={{color: '#1890ff', fontWeight: 500}}>
                        {isExcel ? (
                            <FileExcelOutlined style={{color: '#16a34a', marginRight: 8}} />
                        ) : (
                            <FilePdfOutlined style={{color: '#ff4d4f', marginRight: 8}} />
                        )}
                        {text}
                    </a>
                );
            },
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
                    <a href={`${getBasePath()}/api/download?url=${encodeURIComponent(record.url)}`} download={record.url.split('/').pop()}>
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
    const { message } = App.useApp();
    const { user } = useAuth();
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedDept, setSelectedDept] = useState<string | undefined>(undefined);
    const reportRef = useRef<HTMLDivElement>(null);
    const patientRef = useRef<HTMLDivElement>(null);
    const [savingReport, setSavingReport] = useState(false);
    
    const [uploadedData, setUploadedData] = useState<any[]>([]);
    const [uniqueServices, setUniqueServices] = useState<string[]>([]);
    const [uniqueServiceCodes, setUniqueServiceCodes] = useState<string[]>([]);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    
    const [scheduledData, setScheduledData] = useState<any[]>([]);
    const [failedData, setFailedData] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [deptHours, setDeptHours] = useState<{ [key: string]: any }>({});
    const [staffList, setStaffList] = useState<any[]>([]);
    const [enableStaffMapping, setEnableStaffMapping] = useState(false);
    const [serviceStaffMappings, setServiceStaffMappings] = useState<{ [key: string]: string[] }>({});

    const [morningPatients, setMorningPatients] = useState<string[]>([]);
    const [afternoonPatients, setAfternoonPatients] = useState<string[]>([]);
    
    const [morningStaffs, setMorningStaffs] = useState<string[]>([]);
    const [afternoonStaffs, setAfternoonStaffs] = useState<string[]>([]);
    const uniquePatients = React.useMemo(() => {
        const map = new Map();
        uploadedData.forEach(item => {
            if (item.ma_ba) {
                map.set(item.ma_ba, item.ten_bn);
            }
        });
        return Array.from(map.entries()).map(([ma_ba, ten_bn]) => ({
            label: `${ma_ba} - ${ten_bn}`,
            value: ma_ba
        }));
    }, [uploadedData]);

    useEffect(() => {
        setSelectedDate(dayjs().format('YYYY-MM-DD'));
    }, []);

    const staffStats = React.useMemo(() => {
        if (!scheduledData.length) return [];
        const stats: Record<string, { patientSet: Set<string>, serviceCount: number, name: string }> = {};
        scheduledData.forEach(item => {
            const key = item.ma_nv || item.nguoi_thuc_hien;
            if (!stats[key]) stats[key] = { patientSet: new Set(), serviceCount: 0, name: item.nguoi_thuc_hien };
            stats[key].serviceCount++;
            stats[key].patientSet.add(item.ma_ba || item.TENBENHNHAN);
        });
        return Object.entries(stats).map(([key, data]) => [
            key,
            { name: data.name, patientCount: data.patientSet.size, serviceCount: data.serviceCount }
        ] as [string, any]).sort((a, b) => b[1].patientCount - a[1].patientCount);
    }, [scheduledData]);

    const groupedScheduledData = React.useMemo(() => {
        if (!scheduledData.length) return [];
        
        const getShift = (timeStr: string) => {
            if (!timeStr) return 'Không xác định';
            const hour = parseInt(timeStr.split(':')[0]);
            return hour < 12 ? 'Buổi Sáng' : 'Buổi Chiều';
        };

        const shiftGroups: Record<string, Record<string, any[]>> = {
            'Buổi Sáng': {},
            'Buổi Chiều': {}
        };
        
        scheduledData.forEach(item => {
            const shift = getShift(item.bat_dau);
            if (!shiftGroups[shift]) shiftGroups[shift] = {};
            
            const staffKey = item.ma_nv ? `${item.nguoi_thuc_hien} (${item.ma_nv})` : item.nguoi_thuc_hien;
            if (!shiftGroups[shift][staffKey]) shiftGroups[shift][staffKey] = [];
            shiftGroups[shift][staffKey].push(item);
        });

        const result: any[] = [];
        let shiftIdx = 0;
        for (const shift of ['Buổi Sáng', 'Buổi Chiều']) {
            const staffs = shiftGroups[shift];
            const staffKeys = Object.keys(staffs).sort();
            
            if (staffKeys.length === 0) continue;
            
            let totalItems = 0;
            const shiftChildren = staffKeys.map((staff, sIdx) => {
                const items = staffs[staff];
                totalItems += items.length;
                return {
                    key: `staff_group_${shiftIdx}_${sIdx}`,
                    nguoi_thuc_hien: `${staff} (${items.length} ca)`,
                    ma_ba: '',
                    ten_bn: '',
                    ten_dich_vu: '',
                    bat_dau: '',
                    ket_thuc: '',
                    thoi_gian_chi_dinh: '',
                    children: items.map((child, cIdx) => ({
                        ...child,
                        key: `staff_child_${shiftIdx}_${sIdx}_${cIdx}`,
                        nguoi_thuc_hien: ''
                    }))
                };
            });
            
            result.push({
                key: `shift_staff_group_${shiftIdx}`,
                nguoi_thuc_hien: `--- ${shift.toUpperCase()} (${totalItems} ca) ---`,
                _isShiftHeader: true,
                children: shiftChildren
            });
            shiftIdx++;
        }
        
        return result;
    }, [scheduledData]);

    // States for Excel column mapping
    const [mappingModalVisible, setMappingModalVisible] = useState(false);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [activeInnerTab, setActiveInnerTab] = useState('basic');
    const [unconfiguredCount, setUnconfiguredCount] = useState(0);
    const [rawExcelData, setRawExcelData] = useState<any[]>([]);
    const [outputMapping, setOutputMapping] = useState<{
        [key: string]: string | undefined;
        out_ma_ba?: string;
        out_ten_bn?: string;
        out_thoi_gian_chi_dinh?: string;
        out_ten_dich_vu?: string;
        out_nguoi_thuc_hien?: string;
        out_ma_nv?: string;
        out_cchn?: string;
        out_ma_may?: string;
        out_ten_may?: string;
        out_bat_dau?: string;
        out_ket_thuc?: string;
    }>({});
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

    const [externalLink, setExternalLink] = useState('');
    const [activeExternalLink, setActiveExternalLink] = useState('');

    const handleAccessLink = () => {
        setActiveExternalLink(externalLink);
        localStorage.setItem('clinical_schedule_external_link', externalLink);
    };

    const groupedByPatientData = React.useMemo(() => {
        if (!scheduledData.length) return [];
        
        const getShift = (timeStr: string) => {
            if (!timeStr) return 'Không xác định';
            const hour = parseInt(timeStr.split(':')[0]);
            return hour < 12 ? 'Buổi Sáng' : 'Buổi Chiều';
        };

        const shiftGroups: Record<string, Record<string, any[]>> = {
            'Buổi Sáng': {},
            'Buổi Chiều': {}
        };
        
        scheduledData.forEach(item => {
            const shift = getShift(item.bat_dau);
            if (!shiftGroups[shift]) shiftGroups[shift] = {};
            
            const patientKey = `${item.ma_ba} - ${item.ten_bn}`;
            if (!shiftGroups[shift][patientKey]) shiftGroups[shift][patientKey] = [];
            shiftGroups[shift][patientKey].push(item);
        });

        const result: any[] = [];
        let shiftIdx = 0;
        for (const shift of ['Buổi Sáng', 'Buổi Chiều']) {
            const patients = shiftGroups[shift];
            const patientKeys = Object.keys(patients).sort();
            
            if (patientKeys.length === 0) continue;
            
            let totalItems = 0;
            const shiftChildren = patientKeys.map((patient, pIdx) => {
                const items = patients[patient];
                totalItems += items.length;
                return {
                    key: `patient_group_${shiftIdx}_${pIdx}`,
                    ten_bn: `${patient} (${items.length} dịch vụ)`,
                    nguoi_thuc_hien: '',
                    ma_ba: '',
                    ten_dich_vu: '',
                    bat_dau: '',
                    ket_thuc: '',
                    thoi_gian_chi_dinh: '',
                    children: items.map((child, cIdx) => ({
                        ...child,
                        key: `patient_child_${shiftIdx}_${pIdx}_${cIdx}`,
                        ten_bn: '',
                        ma_ba: ''
                    }))
                };
            });
            
            result.push({
                key: `shift_group_${shiftIdx}`,
                ten_bn: `--- ${shift.toUpperCase()} (${totalItems} dịch vụ) ---`,
                _isShiftHeader: true,
                children: shiftChildren
            });
            shiftIdx++;
        }
        
        return result;
    }, [scheduledData]);

    const groupedByServiceData = React.useMemo(() => {
        if (!scheduledData.length) return [];
        
        const getShift = (timeStr: string) => {
            if (!timeStr) return 'Không xác định';
            const hour = parseInt(timeStr.split(':')[0]);
            return hour < 12 ? 'Buổi Sáng' : 'Buổi Chiều';
        };

        const shiftGroups: Record<string, Record<string, any[]>> = {
            'Buổi Sáng': {},
            'Buổi Chiều': {}
        };
        
        scheduledData.forEach(item => {
            const shift = getShift(item.bat_dau);
            if (!shiftGroups[shift]) shiftGroups[shift] = {};
            
            const serviceKey = item.ten_dich_vu || item.TENDICHVU || 'Dịch vụ khác';
            if (!shiftGroups[shift][serviceKey]) shiftGroups[shift][serviceKey] = [];
            shiftGroups[shift][serviceKey].push(item);
        });

        const result: any[] = [];
        let shiftIdx = 0;
        for (const shift of ['Buổi Sáng', 'Buổi Chiều']) {
            const services = shiftGroups[shift];
            const serviceKeys = Object.keys(services).sort();
            
            if (serviceKeys.length === 0) continue;
            
            let totalItems = 0;
            const shiftChildren = serviceKeys.map((service, sIdx) => {
                const items = services[service];
                totalItems += items.length;
                return {
                    key: `service_group_${shiftIdx}_${sIdx}`,
                    ten_dich_vu: `${service} (${items.length} ca)`,
                    ten_bn: '',
                    nguoi_thuc_hien: '',
                    ma_ba: '',
                    bat_dau: '',
                    ket_thuc: '',
                    thoi_gian_chi_dinh: '',
                    children: items.map((child, cIdx) => ({
                        ...child,
                        key: `service_child_${shiftIdx}_${sIdx}_${cIdx}`,
                        ten_dich_vu: ''
                    }))
                };
            });
            
            result.push({
                key: `shift_service_group_${shiftIdx}`,
                ten_dich_vu: `--- ${shift.toUpperCase()} (${totalItems} ca) ---`,
                _isShiftHeader: true,
                children: shiftChildren
            });
            shiftIdx++;
        }
        
        return result;
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
            { title: outputMapping.out_ten_bn || columnMapping.ten_bn || 'họ và tên BN', dataIndex: 'ten_bn', key: 'ten_bn', width: 200 },
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
    }, [scheduledData, columnMapping]);

    useEffect(() => {
        const savedMapping = localStorage.getItem('clinical_schedule_column_mapping');
        if (savedMapping) {
            try {
                setColumnMapping(JSON.parse(savedMapping));
            } catch (e) {}
        }
        
        const savedLink = localStorage.getItem('clinical_schedule_external_link');
        if (savedLink) {
            setExternalLink(savedLink);
            setActiveExternalLink(savedLink);
        }
        
        // Fetch config to get deptHours
        fetch('/api/clinical-scheduling/config')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.deptHours) {
                    setDeptHours(data.deptHours);
                }
            })
            .catch(console.error);

        // Fetch templates for auto-recognition
        fetchTemplatesAndMapping();
    }, []);

    const fetchTemplatesAndMapping = () => {
        fetch('/api/clinical-scheduling/excel-templates')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTemplates(data.data);
                    if (selectedTemplateId) {
                        const matched = data.data.find((t: any) => t.id === selectedTemplateId);
                        if (matched) {
                            const outMap: any = {};
                            matched.mappings.forEach((m: any) => {
                                if (m.system_field.startsWith('out_') || m.system_field.startsWith('enable_')) {
                                    outMap[m.system_field] = m.excel_column;
                                }
                            });
                            setOutputMapping(prev => ({ ...prev, ...outMap }));
                        }
                    }
                }
            })
            .catch(console.error);
    };

    useEffect(() => {
        if (selectedDate && selectedDept) {
            fetch(`/api/clinical-scheduling/attendance?date=${selectedDate}&maKhoa=${selectedDept}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.staffList) {
                        setStaffList(data.staffList);
                    }
                })
                .catch(console.error);
        }
    }, [selectedDate, selectedDept]);

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
                const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                
                if (json.length === 0) {
                    return message.error('File Excel không có dữ liệu.');
                }

                // Lấy danh sách cột từ dòng đầu tiên
                const headers = Object.keys(json[0] as object);
                setExcelHeaders(headers);
                setRawExcelData(json);

                // Tự động nhận diện Template
                let matchedTemplate = null;
                
                if (selectedTemplateId) {
                    matchedTemplate = templates.find(t => t.id === selectedTemplateId);
                } else {
                    for (const tmpl of templates) {
                        let isMatch = true;
                        const tmplMappings = tmpl.mappings || [];
                        if (tmplMappings.length === 0) continue;
                        
                        const headerLower = headers.map(h => h.toLowerCase().trim());
                        
                        for (const m of tmplMappings) {
                            if (m.excel_column && !headerLower.includes(m.excel_column.toLowerCase().trim())) {
                                isMatch = false;
                                break;
                            }
                        }
                        if (isMatch) {
                            matchedTemplate = tmpl;
                            break;
                        }
                    }
                }

                if (matchedTemplate) {
                    const autoMap: any = { ...columnMapping };
                    const outMap: any = {};
                    matchedTemplate.mappings.forEach((m: any) => {
                        if (m.system_field.startsWith('out_') || m.system_field.startsWith('enable_')) {
                            outMap[m.system_field] = m.excel_column;
                        } else {
                            // Nếu user chọn cứng Template, cứ nhét tên cột vào.
                            // Nếu tự nhận diện thì tìm chính xác chữ hoa chữ thường.
                            const originalHeader = headers.find(h => h.toLowerCase().trim() === m.excel_column.toLowerCase().trim());
                            autoMap[m.system_field] = originalHeader || m.excel_column;
                        }
                    });
                    
                    setColumnMapping(autoMap);
                    setOutputMapping(outMap);
                    
                    if (processMappedData(autoMap, json)) {
                        message.success(selectedTemplateId ? `Đã áp dụng mẫu: ${matchedTemplate.name}` : `Đã tự động nhận diện mẫu: ${matchedTemplate.name}`);
                    }
                    return;
                }

                // Thử đoán mapping tự động (Fallback)
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

    const processMappedData = (mapping: any, rawData: any[]) => {
        if (!mapping.ma_dich_vu) {
            message.error('Bắt buộc phải chọn cột Mã Dịch Vụ!');
            return false;
        }

        localStorage.setItem('clinical_schedule_column_mapping', JSON.stringify(mapping));

        const mappedData = rawData.map(row => ({
            ma_ba: row[mapping.ma_ba] || '',
            ten_bn: row[mapping.ten_bn] || '',
            thoi_gian_chi_dinh: row[mapping.thoi_gian_chi_dinh] || '',
            ma_dich_vu: row[mapping.ma_dich_vu] || '',
            ten_dich_vu: row[mapping.ten_dich_vu] || '',
            ten_khoa: row[mapping.ten_khoa] || '',
            ma_khoa: row[mapping.ma_khoa] || '',
            phong_thuc_hien: row[mapping.phong_thuc_hien] || '',
            ma_may: row[mapping.ma_may] || '',
            ten_may: row[mapping.ten_may] || '',
            _originalRow: row
        }));

        setUploadedData(mappedData);
        
        const services = Array.from(new Set(mappedData.map(d => d.ten_dich_vu).filter(Boolean)));
        const serviceCodes = Array.from(new Set(mappedData.map(d => d.ma_dich_vu).filter(Boolean)));
        setUniqueServices(services as string[]);
        setUniqueServiceCodes(serviceCodes as string[]);
        setSelectedServices(services as string[]);
        
        setMappingModalVisible(false);
        return true;
    };

    const handleConfirmMapping = () => {
        if (processMappedData(columnMapping, rawExcelData)) {
            message.success('Đã map dữ liệu thành công!');
        }
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

        const patientShifts: Record<string, string> = {};
        morningPatients.forEach(ma_ba => { patientShifts[ma_ba] = 'MORNING'; });
        afternoonPatients.forEach(ma_ba => { patientShifts[ma_ba] = 'AFTERNOON'; });

        const staffShifts: Record<string, string> = {};
        morningStaffs.forEach(staffId => { staffShifts[staffId] = 'MORNING'; });
        afternoonStaffs.forEach(staffId => { staffShifts[staffId] = 'AFTERNOON'; });

        setLoading(true);
        try {
            const res = await fetch('/api/clinical-scheduling/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    maKhoa: selectedDept,
                    services: filteredData,
                    patientShifts,
                    staffShifts,
                    serviceStaffMappings: enableStaffMapping ? serviceStaffMappings : {}
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

    const generateExcelWorkbook = (dataSource: any[], columns: any[], title: string) => {
        if (!dataSource || dataSource.length === 0) return null;
        
        const deptName = departments.find((d: any) => d.ma_khoa === selectedDept)?.ten_khoa || '';
        const dateStr = dayjs(selectedDate || new Date()).format('DD/MM/YYYY');
        const headerTitle = `CHIA THỜI GIAN THỰC HIỆN DVKT NGÀY ${dateStr} CỦA KHOA ${deptName}`.toUpperCase();

        const generateSheet = (data: any[], subTitle: string = '') => {
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

            data.forEach(row => processRow(row));

            const ws = XLSX.utils.json_to_sheet(exportData, { origin: 'A4' } as any);
            ws['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
            
            const finalHeader = subTitle ? `${headerTitle} - ${subTitle}` : headerTitle;
            XLSX.utils.sheet_add_aoa(ws, [
                ['SỞ Y TẾ TỈNH LẠNG SƠN'],
                ['BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN'],
                [finalHeader]
            ], { origin: 'A1' });

            if(!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push(
                { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }
            );

            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
            
            for (let R = 0; R <= 2; R++) {
                const cell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
                if (cell) {
                    cell.s = { font: { bold: true, sz: R === 2 ? 14 : 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
                }
            }

            for (let C = range.s.c; C <= range.e.c; C++) {
                const cell = ws[XLSX.utils.encode_cell({ r: 3, c: C })];
                if (cell && typeof cell === 'object') {
                    cell.s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
                }
            }
            
            ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9 };
            
            if (exportData.length > 0) {
                const colWidths: Record<string, number> = {};
                Object.keys(exportData[0]).forEach(key => { colWidths[key] = key.length; });
                exportData.forEach(row => {
                    Object.keys(row).forEach(key => {
                        const val = row[key] ? String(row[key]) : '';
                        if (val.length > colWidths[key]) colWidths[key] = val.length;
                    });
                });
                const wscols = Object.keys(exportData[0]).map(key => ({
                    wch: Math.min(Math.max(colWidths[key] + 3, 10), 100)
                }));
                ws['!cols'] = wscols;
            }
            return ws;
        };

        const wb = XLSX.utils.book_new();
        
        // 1. Tạo sheet Tổng hợp
        const wsReport = generateSheet(dataSource);
        XLSX.utils.book_append_sheet(wb, wsReport, 'Tổng hợp');

        // 2. Tạo sheet cho từng nhân viên nếu là DanhSachBenhNhan
        if (title === 'DanhSachBenhNhan') {
            const uniqueStaffs = Array.from(new Set(scheduledData.map(item => item.nguoi_thuc_hien).filter(Boolean)));
            
            const filterByStaff = (dataToFilter: any[], staffName: string) => {
                return dataToFilter.map(group => {
                    if (!group.children) return group;
                    const filteredGroup = { ...group };
                    filteredGroup.children = group.children.map((patient: any) => {
                        if (!patient.children) return patient;
                        const filteredPatient = { ...patient };
                        filteredPatient.children = patient.children.filter((service: any) => service.nguoi_thuc_hien === staffName);
                        return filteredPatient;
                    }).filter((patient: any) => patient.children && patient.children.length > 0);
                    return filteredGroup;
                }).filter(group => group.children && group.children.length > 0);
            };

            uniqueStaffs.forEach(staff => {
                const staffData = filterByStaff(dataSource, staff as string);
                if (staffData.length > 0) {
                    const wsStaff = generateSheet(staffData, `BS. ${staff}`);
                    const safeSheetName = String(staff).replace(/[/\\?%*:|"<>]/g, '').substring(0, 31);
                    XLSX.utils.book_append_sheet(wb, wsStaff, safeSheetName);
                }
            });
        }

        const safeDeptName = deptName.replace(/[/\\?%*:|"<>]/g, '-');
        const dateFileStr = dayjs(selectedDate || new Date()).format('DD-MM-YYYY');
        let fileName = `${title}_${dayjs(selectedDate || new Date()).format('YYYYMMDD')}.xlsx`;
        if (title === 'DanhSachBenhNhan') {
            fileName = `Chia_thoi_gian_thuc_hien_dvkt_ngay_${dateFileStr}_cua_khoa_${safeDeptName}.xlsx`;
        } else if (title === 'DanhSachTheoBacSi') {
            fileName = `Danh_sach_chia_thoi_gian_theo_bac_si_${safeDeptName}_ngay_${dateFileStr}.xlsx`;
        }

        return { wb, fileName };
    };

    const handleExportExcelTab = (dataSource: any[], columns: any[], title: string) => {
        const result = generateExcelWorkbook(dataSource, columns, title);
        if (result) {
            XLSX.writeFile(result.wb, result.fileName);
        }
    };

    const generateExcelWorkbookFormat2 = (dataSource: any[], title: string) => {
        if (!dataSource || dataSource.length === 0) return null;
        
        const deptName = departments.find((d: any) => d.ma_khoa === selectedDept)?.ten_khoa || '';
        const dateStr = dayjs(selectedDate || new Date()).format('DD/MM/YYYY');
        const headerTitle = `CHIA THỜI GIAN THỰC HIỆN DVKT NGÀY ${dateStr} CỦA KHOA ${deptName}`.toUpperCase();
        const isPatientView = title === 'DanhSachBenhNhan';
        const isServiceView = title === 'DanhSachTheoDichVu';

        const generateSheetFormat2 = (data: any[], subTitle: string = '') => {
            const exportData: any[][] = [];
            
            let headerCol2 = 'Người thực hiện / Tên bệnh nhân';
            if (isPatientView) headerCol2 = 'Tên Bệnh nhân / Người thực hiện';
            if (isServiceView) headerCol2 = 'Người thực hiện - Tên bệnh nhân';
            
            exportData.push(['STT', headerCol2, 'Tên dịch vụ', 'Mã máy', 'Bắt đầu', 'Kết thúc']);

            const merges: any[] = [];
            let currentRow = 4;
            let stt = 1;

            data.forEach((buoi) => {
                let buoiText = '';
                if (isPatientView) buoiText = buoi.ten_bn;
                else if (isServiceView) buoiText = buoi.ten_dich_vu;
                else buoiText = buoi.nguoi_thuc_hien;

                if (buoiText) {
                    exportData.push([buoiText, '', '', '', '', '']);
                    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } });
                    currentRow++;
                }

                if (buoi.children) {
                    buoi.children.forEach((group2: any) => {
                        let group2Text = '';
                        if (isPatientView) group2Text = group2.ten_bn;
                        else if (isServiceView) group2Text = group2.ten_dich_vu;
                        else group2Text = group2.nguoi_thuc_hien;
                        
                        exportData.push([stt.toString(), group2Text, '', '', '', '']);
                        merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 5 } });
                        stt++;
                        currentRow++;

                        if (group2.children) {
                            group2.children.forEach((dichvu: any) => {
                                const may = dichvu.ten_may ? `${dichvu.ten_may} (${dichvu.ma_may})` : '';
                                
                                let colBText = '';
                                if (isPatientView) colBText = dichvu.nguoi_thuc_hien || '';
                                else if (isServiceView) colBText = (dichvu.nguoi_thuc_hien ? `${dichvu.nguoi_thuc_hien} - ` : '') + (dichvu.ten_bn || dichvu.TENBENHNHAN || '');
                                else colBText = dichvu.ten_bn || dichvu.TENBENHNHAN || '';

                                exportData.push([
                                    '', 
                                    colBText, 
                                    dichvu.ten_dich_vu || dichvu.TENDICHVU || dichvu._originalRow?.TENDICHVU || '', 
                                    may, 
                                    dichvu.bat_dau || dichvu._formatted_start || '', 
                                    dichvu.ket_thuc || dichvu._formatted_end || ''
                                ]);
                                currentRow++;
                            });
                        }
                    });
                }
            });

            exportData.unshift([], [], []);
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            
            const finalHeader = subTitle ? `${headerTitle} - ${subTitle}` : headerTitle;
            XLSX.utils.sheet_add_aoa(ws, [
                ['SỞ Y TẾ TỈNH LẠNG SƠN'],
                ['BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN'],
                [finalHeader]
            ], { origin: 'A1' });

            if(!ws['!merges']) ws['!merges'] = [];
            ws['!merges']!.push(
                { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }
            );
            
            merges.forEach(m => ws['!merges']!.push(m));

            for (let R = 0; R <= 2; R++) {
                const cell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
                if (cell) {
                    cell.s = { font: { bold: true, sz: R === 2 ? 14 : 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
                }
            }

            for (let C = 0; C <= 5; C++) {
                const cell = ws[XLSX.utils.encode_cell({ r: 3, c: C })];
                if (cell) {
                    cell.s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
                }
            }

            for (let R = 4; R < currentRow; R++) {
                const cellA = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
                const cellB = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
                if (cellA && cellA.v && String(cellA.v).includes('BUỔI')) {
                    cellA.s = { font: { bold: true } };
                }
                if (cellA && cellA.v && !isNaN(Number(cellA.v)) && cellB && cellB.v) {
                    cellA.s = { font: { bold: true }, alignment: { horizontal: 'center' } };
                    cellB.s = { font: { bold: true } };
                }
            }

            ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
            ws['!cols'] = [
                { wch: 5 }, { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 10 }
            ];
            
            return ws;
        };

        const wb = XLSX.utils.book_new();
        
        // 1. Tạo sheet Tổng hợp
        const wsReport = generateSheetFormat2(dataSource);
        XLSX.utils.book_append_sheet(wb, wsReport, 'Tổng hợp');

        // 2. Tạo sheet cho từng nhân viên
        if (title === 'DanhSachBenhNhan' || title === 'DanhSachTheoDichVu') {
            const uniqueStaffs = Array.from(new Set(scheduledData.map(item => item.nguoi_thuc_hien).filter(Boolean)));
            
            const filterByStaff = (dataToFilter: any[], staffName: string) => {
                return dataToFilter.map(group => {
                    if (!group.children) return group;
                    const filteredGroup = { ...group };
                    filteredGroup.children = group.children.map((patient: any) => {
                        if (!patient.children) return patient;
                        const filteredPatient = { ...patient };
                        filteredPatient.children = patient.children.filter((service: any) => service.nguoi_thuc_hien === staffName);
                        return filteredPatient;
                    }).filter((patient: any) => patient.children && patient.children.length > 0);
                    return filteredGroup;
                }).filter(group => group.children && group.children.length > 0);
            };

            uniqueStaffs.forEach(staff => {
                const staffData = filterByStaff(dataSource, staff as string);
                if (staffData.length > 0) {
                    const wsStaff = generateSheetFormat2(staffData, `BS. ${staff}`);
                    const safeSheetName = String(staff).replace(/[/\\?%*:|"<>]/g, '').substring(0, 31);
                    XLSX.utils.book_append_sheet(wb, wsStaff, safeSheetName);
                }
            });
        }

        const safeDeptName = deptName.replace(/[/\\?%*:|"<>]/g, '-');
        const dateFileStr = dayjs(selectedDate || new Date()).format('DD-MM-YYYY');
        let fileName = `${title}_Mau2_${dayjs(selectedDate || new Date()).format('YYYYMMDD')}.xlsx`;
        if (title === 'DanhSachBenhNhan') {
            fileName = `Chia_thoi_gian_thuc_hien_dvkt_Mau2_ngay_${dateFileStr}_cua_khoa_${safeDeptName}.xlsx`;
        } else if (title === 'DanhSachTheoBacSi') {
            fileName = `Danh_sach_chia_thoi_gian_theo_bac_si_Mau2_${safeDeptName}_ngay_${dateFileStr}.xlsx`;
        } else if (title === 'DanhSachTheoDichVu') {
            fileName = `Danh_sach_chia_thoi_gian_theo_dich_vu_Mau2_${safeDeptName}_ngay_${dateFileStr}.xlsx`;
        }

        return { wb, fileName };
    };

    const handleExportExcelTabFormat2 = (dataSource: any[], title: string) => {
        const result = generateExcelWorkbookFormat2(dataSource, title);
        if (result) {
            XLSX.writeFile(result.wb, result.fileName);
        }
    };

    const handleSaveExcelToServer = async (dataSource: any[], columns: any[], title: string) => {
        if (!selectedDept) {
            return message.warning('Vui lòng chọn Khoa/Phòng');
        }
        setSavingReport(true);
        try {
            const result = generateExcelWorkbook(dataSource, columns, title);
            if (!result) {
                setSavingReport(false);
                return;
            }
            
            const excelBuffer = XLSX.write(result.wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const formData = new FormData();
            formData.append('file', blob, result.fileName);
            formData.append('ten_bao_cao', `${title} - Ngày ${dayjs(selectedDate || new Date()).format('DD/MM/YYYY')}`);
            formData.append('loai_bao_cao', title);
            formData.append('ma_khoa', selectedDept);
            formData.append('nguoi_tao', (user as any)?.ho_ten || 'Unknown');

            const res = await fetch('/api/clinical-scheduling/save-report', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                message.success('Đã lưu file Excel lên máy chủ thành công!');
            } else {
                message.error('Lỗi: ' + data.message);
            }
        } catch (e) {
            message.error('Lỗi kết nối máy chủ');
        }
        setSavingReport(false);
    };

    const handleExportExcel = () => {
        if (scheduledData.length === 0) return;
        const exportJson = scheduledData.map(item => {
            const row = { ...item._originalRow };
            
            // Hàm tiện ích xử lý các cột gốc (ẩn/đổi tên)
            const processOriginalColumn = (enableKey: string, newNameKey: string, originalColName: string | undefined) => {
                if (!originalColName || !row.hasOwnProperty(originalColName)) return;
                
                if (outputMapping[enableKey] === 'false') {
                    delete row[originalColName];
                } else if (outputMapping[newNameKey]) {
                    const newName = outputMapping[newNameKey];
                    if (newName !== originalColName) {
                        row[newName] = row[originalColName];
                        delete row[originalColName];
                    }
                }
            };

            processOriginalColumn('enable_out_ma_ba', 'out_ma_ba', columnMapping.ma_ba);
            processOriginalColumn('enable_out_ten_bn', 'out_ten_bn', columnMapping.ten_bn);
            processOriginalColumn('enable_out_thoi_gian_chi_dinh', 'out_thoi_gian_chi_dinh', columnMapping.thoi_gian_chi_dinh);
            processOriginalColumn('enable_out_ma_dich_vu', 'out_ma_dich_vu', columnMapping.ma_dich_vu);
            processOriginalColumn('enable_out_ten_dich_vu', 'out_ten_dich_vu', columnMapping.ten_dich_vu);

            if (outputMapping.enable_out_thoi_gian_chi_dinh !== 'false') {
                 const colName = outputMapping.out_thoi_gian_chi_dinh || columnMapping.thoi_gian_chi_dinh || 'Thời gian chỉ định';
                 row[colName] = item.thoi_gian_chi_dinh;
            }

            if (outputMapping.enable_out_nguoi_thuc_hien !== 'false') {
                row[outputMapping.out_nguoi_thuc_hien || 'Người thực hiện (Bác sĩ/Điều dưỡng)'] = item.nguoi_thuc_hien;
            }
            if (outputMapping.out_ma_nv) {
                row[outputMapping.out_ma_nv] = item.ma_nv;
            }
            if (outputMapping.out_cchn) {
                row[outputMapping.out_cchn] = item.cchn;
            }
            if (outputMapping.enable_out_ten_may !== 'false' || outputMapping.enable_out_ma_may !== 'false') {
                row[outputMapping.out_ten_may || outputMapping.out_ma_may || 'Máy thực hiện'] = item.ten_may ? `${item.ten_may} (${item.ma_may})` : '';
            }

            if (outputMapping.enable_out_bat_dau !== 'false') {
                row[outputMapping.out_bat_dau || 'Bắt đầu'] = item.bat_dau;
            }
            
            if (outputMapping.enable_out_ket_thuc !== 'false') {
                row[outputMapping.out_ket_thuc || 'Kết thúc'] = item.ket_thuc;
            }

            return row;
        });
        const ws = XLSX.utils.json_to_sheet(exportJson);
        ws['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
        
        if (exportJson.length > 0) {
            // Tự động tính toán độ rộng cột
            const colWidths: Record<string, number> = {};
            Object.keys(exportJson[0]).forEach(key => { colWidths[key] = key.length; });
            exportJson.forEach(row => {
                Object.keys(row).forEach(key => {
                    const val = row[key] ? String(row[key]) : '';
                    if (val.length > colWidths[key]) colWidths[key] = val.length;
                });
            });
            const wscols = Object.keys(exportJson[0]).map(key => ({
                wch: Math.min(Math.max(colWidths[key] + 3, 10), 60) // Giới hạn width max 60 để không bị quá dài
            }));
            ws['!cols'] = wscols;
            
            // Thiết lập Wrap Text và căn giữa cho tất cả các ô
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
            for (let R = range.s.r; R <= range.e.r; R++) {
                for (let C = range.s.c; C <= range.e.c; C++) {
                    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (cell && typeof cell === 'object') {
                        // Giữ nguyên style in đậm cho dòng header (R=0)
                        if (R === 0) {
                            cell.s = { font: { bold: true }, alignment: { wrapText: true, vertical: 'center', horizontal: 'center' } };
                        } else {
                            cell.s = { alignment: { wrapText: true, vertical: 'center' } };
                        }
                    }
                }
            }
        }
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'KetQuaXepLich');
        XLSX.writeFile(wb, `KetQuaXepLich_${dayjs(selectedDate || new Date()).format('YYYYMMDD')}.xlsx`);
    };

    const handleExportFailedOriginal = () => {
        try {
            if (!failedData || failedData.length === 0) {
                return message.warning('Không có dữ liệu lỗi để xuất.');
            }
            const exportJson = failedData.map(item => ({
                ...(item._originalRow || {}),
                'Lý do lỗi': item.error || ''
            }));
            
            let headers = [...(excelHeaders || [])];
            if (headers.length === 0 && exportJson.length > 0) {
                headers = Object.keys(exportJson[0]).filter(k => k !== 'Lý do lỗi');
            }
            
            const sheetHeaders = [...headers, 'Lý do lỗi'];
            const ws = XLSX.utils.json_to_sheet(exportJson, { header: sheetHeaders });
            ws['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'DichVuLoi');
            
            const fileName = `DanhSachLoi_FileGoc_${dayjs(selectedDate || new Date()).format('YYYYMMDD')}.xlsx`;
            
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            message.success(`Đã tải xuống file: ${fileName}`);
        } catch (error: any) {
            console.error("Lỗi khi xuất file Excel gốc:", error);
            message.error(`Lỗi khi xuất file: ${error.message}`);
        }
    };

    const isColumnEnabled = (key: string) => {
        if (key === 'may_thuc_hien') {
            return outputMapping['enable_out_ma_may'] !== 'false' || outputMapping['enable_out_ten_may'] !== 'false';
        }
        return outputMapping[`enable_out_${key}`] !== 'false';
    };

    const resultColumns = [
        { title: outputMapping.out_nguoi_thuc_hien || 'Người thực hiện', dataIndex: 'nguoi_thuc_hien', key: 'nguoi_thuc_hien', width: '15%', render: (t: string, r: any) => t ? <div className="print-truncate"><strong style={{color: r._isShiftHeader ? '#d9363e' : (r.children ? '#237804' : '#16a34a')}}>{t}</strong></div> : null },
        { title: outputMapping.out_ma_ba || columnMapping.ma_ba || 'Mã BA', dataIndex: 'ma_ba', key: 'ma_ba', width: '10%' },
        { title: outputMapping.out_ten_bn || columnMapping.ten_bn || 'Tên Bệnh nhân', dataIndex: 'ten_bn', key: 'ten_bn', width: '20%' },
        { title: outputMapping.out_thoi_gian_chi_dinh || columnMapping.thoi_gian_chi_dinh || 'TG Chỉ định', dataIndex: 'thoi_gian_chi_dinh', key: 'thoi_gian_chi_dinh', width: '10%', render: (t: string) => <span style={{ whiteSpace: 'nowrap', fontSize: '0.9em' }}>{t}</span> },
        { title: outputMapping.out_ma_dich_vu || columnMapping.ma_dich_vu || 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: '10%' },
        { title: outputMapping.out_ten_dich_vu || columnMapping.ten_dich_vu || 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', width: '25%', render: (t: string) => t ? <div className="print-truncate">{t}</div> : null },
        { title: outputMapping.out_ten_may || outputMapping.out_ma_may || 'Máy', key: 'may_thuc_hien', width: '10%', render: (_: any, r: any) => r.ten_may ? <div className="print-truncate"><span>{r.ten_may} <span className="text-gray-500">({r.ma_may})</span></span></div> : null },
        { title: outputMapping.out_bat_dau || 'Bắt đầu', dataIndex: 'bat_dau', key: 'bat_dau', width: '5%', render: (t: string) => t ? <Tag color="blue">{t}</Tag> : null },
        { title: outputMapping.out_ket_thuc || 'Kết thúc', dataIndex: 'ket_thuc', key: 'ket_thuc', width: '5%', render: (t: string) => t ? <Tag color="cyan">{t}</Tag> : null },
    ].filter(col => isColumnEnabled(col.key as string));

    const serviceColumns = [
        { title: outputMapping.out_ten_dich_vu || columnMapping.ten_dich_vu || 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', width: '25%', render: (t: string, r: any) => t ? <strong style={{color: r._isShiftHeader ? '#d9363e' : (r.children ? '#fa8c16' : '#000')}}>{t}</strong> : null },
        { title: outputMapping.out_nguoi_thuc_hien || 'Người thực hiện', dataIndex: 'nguoi_thuc_hien', key: 'nguoi_thuc_hien', width: '15%', render: (t: string) => t ? <div className="print-truncate"><strong style={{color: '#16a34a'}}>{t}</strong></div> : null },
        { title: outputMapping.out_ten_bn || columnMapping.ten_bn || 'Tên Bệnh nhân', dataIndex: 'ten_bn', key: 'ten_bn', width: '20%', render: (t: string, r: any) => t || r._originalRow?.TENBENHNHAN || '' },
        { title: outputMapping.out_thoi_gian_chi_dinh || columnMapping.thoi_gian_chi_dinh || 'TG Chỉ định', dataIndex: 'thoi_gian_chi_dinh', key: 'thoi_gian_chi_dinh', width: '10%', render: (t: string) => <span style={{ whiteSpace: 'nowrap', fontSize: '0.9em' }}>{t}</span> },
        { title: outputMapping.out_ma_dich_vu || columnMapping.ma_dich_vu || 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: '10%' },
        { title: outputMapping.out_ten_may || outputMapping.out_ma_may || 'Máy', key: 'may_thuc_hien', width: '10%', render: (_: any, r: any) => r.ten_may ? <div className="print-truncate"><span>{r.ten_may} <span className="text-gray-500">({r.ma_may})</span></span></div> : null },
        { title: outputMapping.out_bat_dau || 'Bắt đầu', dataIndex: 'bat_dau', key: 'bat_dau', width: '5%', align: 'center' as const, render: (t: string) => t ? <Tag color="blue">{t}</Tag> : null },
        { title: outputMapping.out_ket_thuc || 'Kết thúc', dataIndex: 'ket_thuc', key: 'ket_thuc', width: '5%', align: 'center' as const, render: (t: string) => t ? <Tag color="cyan">{t}</Tag> : null },
    ].filter(col => isColumnEnabled(col.key as string));

    const patientColumns = [
        { title: outputMapping.out_ten_bn || columnMapping.ten_bn || 'Tên Bệnh nhân', dataIndex: 'ten_bn', key: 'ten_bn', width: '25%', render: (t: string, r: any) => t ? <strong style={{color: r._isShiftHeader ? '#d9363e' : (r.children ? '#0958d9' : '#000')}}>{t}</strong> : null },
        { title: outputMapping.out_nguoi_thuc_hien || 'Người thực hiện', dataIndex: 'nguoi_thuc_hien', key: 'nguoi_thuc_hien', width: '15%', render: (t: string) => t ? <div className="print-truncate"><strong style={{color: '#16a34a'}}>{t}</strong></div> : null },
        { title: outputMapping.out_thoi_gian_chi_dinh || columnMapping.thoi_gian_chi_dinh || 'TG Chỉ định', dataIndex: 'thoi_gian_chi_dinh', key: 'thoi_gian_chi_dinh', width: '10%', render: (t: string) => <span style={{ whiteSpace: 'nowrap', fontSize: '0.9em' }}>{t}</span> },
        { title: outputMapping.out_ma_dich_vu || columnMapping.ma_dich_vu || 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: '10%' },
        { title: outputMapping.out_ten_dich_vu || columnMapping.ten_dich_vu || 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', width: '25%', render: (t: string) => t ? <div className="print-truncate">{t}</div> : null },
        { title: outputMapping.out_ten_may || outputMapping.out_ma_may || 'Máy', key: 'may_thuc_hien', width: '10%', render: (_: any, r: any) => r.ten_may ? <div className="print-truncate"><span>{r.ten_may} <span className="text-gray-500">({r.ma_may})</span></span></div> : null },
        { title: outputMapping.out_bat_dau || 'Bắt đầu', dataIndex: 'bat_dau', key: 'bat_dau', width: '5%', align: 'center' as const, render: (t: string) => t ? <Tag color="blue">{t}</Tag> : null },
        { title: outputMapping.out_ket_thuc || 'Kết thúc', dataIndex: 'ket_thuc', key: 'ket_thuc', width: '5%', align: 'center' as const, render: (t: string) => t ? <Tag color="cyan">{t}</Tag> : null },
    ].filter(col => isColumnEnabled(col.key as string));


    const failedColumns = [
        { title: 'Mã BA', dataIndex: 'ma_ba', key: 'ma_ba' },
        { title: 'Tên BN', dataIndex: 'ten_bn', key: 'ten_bn' },
        { title: 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu' },
        { title: 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', render: (t: string) => t ? t : null },
        { title: 'Lý do lỗi', dataIndex: 'error', key: 'error', render: (t: string) => <strong style={{color: 'red'}}>{t}</strong> },
    ];

    const currentDeptHours = (selectedDept && deptHours[selectedDept]) || { morningStart: '07:30', morningEnd: '11:30', afternoonStart: '13:30', afternoonEnd: '17:30' };

    return (
        <div style={{ padding: 24, width: '100%', maxWidth: 1800, margin: '0 auto' }}>
            <h1 style={{ fontSize: 24, marginBottom: 24, fontWeight: 'bold' }}>Hệ thống tự động chia thời gian thực hiện DVKT</h1>
            <Tabs type="card" defaultActiveKey="1" onChange={(key) => { if (key === '1') { fetchTemplatesAndMapping(); } }} items={[
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
                        <div style={{ marginBottom: 8 }}><strong>3. Chọn Mẫu & Upload Excel:</strong></div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Select
                                allowClear
                                placeholder="Tự động nhận diện mẫu..."
                                style={{ flex: 1 }}
                                value={selectedTemplateId}
                                onChange={(val) => setSelectedTemplateId(val)}
                                options={templates.map(t => ({ label: t.name, value: t.id }))}
                            />
                            <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".xlsx, .xls">
                                <Button icon={<UploadOutlined />} type="primary">
                                    Tải File Lên
                                </Button>
                            </Upload>
                        </div>
                    </Col>
                </Row>
                
                {uploadedData.length > 0 && (
                    <Tabs
                        type="card"
                        style={{ marginTop: 24 }}
                        activeKey={activeInnerTab}
                        onChange={(key) => setActiveInnerTab(key)}
                        items={[
                            {
                                key: 'basic',
                                label: 'Cơ bản',
                                children: (
                                    <>
                                        <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, background: '#fff' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <h3 style={{ margin: 0, color: '#1890ff' }}>Lọc Dịch vụ cần xếp lịch:</h3>
                                                <Space>
                                                    <Button size="small" onClick={() => setSelectedServices(uniqueServices)}>Chọn tất cả</Button>
                                                    <Button size="small" onClick={() => setSelectedServices([])}>Bỏ chọn tất cả</Button>
                                                </Space>
                                            </div>
                                            <Checkbox.Group 
                                                options={uniqueServices} 
                                                value={selectedServices} 
                                                onChange={(checkedValues) => setSelectedServices(checkedValues as string[])}
                                            />
                                        </div>

                                        <div style={{ marginTop: 24, textAlign: 'center', background: '#f6ffed', padding: 16, border: '1px solid #b7eb8f', borderRadius: 8 }}>
                                            <h3 style={{ margin: 0, color: '#389e0d', marginBottom: 8 }}>✅ Đã tải thành công {uploadedData.length} chỉ định dịch vụ</h3>
                                            
                                            {unconfiguredCount > 0 && (
                                                <Alert 
                                                    title={`Phát hiện ${unconfiguredCount} loại dịch vụ trong danh sách chưa được cấu hình (Chưa có thời gian thực hiện)!`}
                                                    description={
                                                        <div>
                                                            Thuật toán xếp lịch sẽ bị lỗi với các dịch vụ này. Vui lòng sang tab <strong>Cấu hình DVKT</strong> để bổ sung thời gian ngay.
                                                            <div style={{ marginTop: 8 }}>
                                                                <Button danger size="small" onClick={() => setActiveInnerTab('mau05')}>Cấu hình ngay</Button>
                                                            </div>
                                                        </div>
                                                    }
                                                    type="error"
                                                    showIcon
                                                    style={{ marginBottom: 16, textAlign: 'left' }}
                                                />
                                            )}

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
                                    </>
                                )
                            },
                            {
                                key: 'advanced',
                                label: 'Tùy chọn nâng cao',
                                children: (
                                    <>
                                        <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, background: '#fff', marginBottom: 24 }}>
                                            <h3 style={{ margin: 0, color: '#fa8c16', marginBottom: 16 }}>Tùy chọn Bệnh nhân ưu tiên xếp lịch theo buổi:</h3>
                                            <Row gutter={24}>
                                                <Col span={12}>
                                                    <div style={{ marginBottom: 8 }}><strong>Ưu tiên buổi Sáng ({currentDeptHours.morningStart} - {currentDeptHours.morningEnd}):</strong></div>
                                                    <Select
                                                        mode="multiple"
                                                        allowClear
                                                        style={{ width: '100%' }}
                                                        placeholder="Chọn bệnh nhân (Để trống = Tự động xếp)"
                                                        value={morningPatients}
                                                        onChange={(vals) => setMorningPatients(vals)}
                                                        options={uniquePatients.filter(p => !afternoonPatients.includes(p.value))}
                                                        filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                                    />
                                                </Col>
                                                <Col span={12}>
                                                    <div style={{ marginBottom: 8 }}><strong>Ưu tiên buổi Chiều ({currentDeptHours.afternoonStart} - {currentDeptHours.afternoonEnd}):</strong></div>
                                                    <Select
                                                        mode="multiple"
                                                        allowClear
                                                        style={{ width: '100%' }}
                                                        placeholder="Chọn bệnh nhân (Để trống = Tự động xếp)"
                                                        value={afternoonPatients}
                                                        onChange={(vals) => setAfternoonPatients(vals)}
                                                        options={uniquePatients.filter(p => !morningPatients.includes(p.value))}
                                                        filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                                    />
                                                </Col>
                                            </Row>
                                            <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
                                                * Lưu ý: Các bệnh nhân không được chọn sẽ được thuật toán tự động xếp vào bất kỳ thời gian rảnh nào trong ngày. Nếu buổi đã chọn kín lịch, sẽ báo lỗi thiếu thời gian.
                                            </div>
                                        </div>

                                        <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, background: '#fff', marginBottom: 24 }}>
                                            <h3 style={{ margin: 0, color: '#13c2c2', marginBottom: 16 }}>Tùy chọn Người thực hiện theo buổi:</h3>
                                            <Row gutter={24}>
                                                <Col span={12}>
                                                    <div style={{ marginBottom: 8 }}><strong>Người thực hiện buổi Sáng ({currentDeptHours.morningStart} - {currentDeptHours.morningEnd}):</strong></div>
                                                    <Select
                                                        mode="multiple"
                                                        allowClear
                                                        showSearch
                                                        style={{ width: '100%' }}
                                                        placeholder="Chọn người thực hiện (Để trống = Cả 2 buổi)"
                                                        value={morningStaffs}
                                                        onChange={(vals) => setMorningStaffs(vals)}
                                                        options={staffList.filter(s => s.is_thuc_hien_dvkt !== false && !afternoonStaffs.includes(s.id)).map(s => ({ label: s.ho_ten, value: s.id }))}
                                                        filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                                    />
                                                </Col>
                                                <Col span={12}>
                                                    <div style={{ marginBottom: 8 }}><strong>Người thực hiện buổi Chiều ({currentDeptHours.afternoonStart} - {currentDeptHours.afternoonEnd}):</strong></div>
                                                    <Select
                                                        mode="multiple"
                                                        allowClear
                                                        showSearch
                                                        style={{ width: '100%' }}
                                                        placeholder="Chọn người thực hiện (Để trống = Cả 2 buổi)"
                                                        value={afternoonStaffs}
                                                        onChange={(vals) => setAfternoonStaffs(vals)}
                                                        options={staffList.filter(s => s.is_thuc_hien_dvkt !== false && !morningStaffs.includes(s.id)).map(s => ({ label: s.ho_ten, value: s.id }))}
                                                        filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                                    />
                                                </Col>
                                            </Row>
                                            <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
                                                * Lưu ý: Khi chọn một Người thực hiện vào một buổi, thuật toán sẽ CHỈ xếp lịch cho người đó trong buổi đã chọn.
                                            </div>
                                        </div>

                                        <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, background: '#fff' }}>
                                            <div style={{ marginBottom: 12 }}>
                                                <Checkbox 
                                                    checked={enableStaffMapping} 
                                                    onChange={e => setEnableStaffMapping(e.target.checked)}
                                                >
                                                    <strong style={{ color: '#0958d9' }}>Bật tuỳ chọn: Gán Dịch vụ cho đích danh người thực hiện</strong>
                                                </Checkbox>
                                            </div>
                                            
                                            {enableStaffMapping && (
                                                <div style={{ marginTop: 16 }}>
                                                    <Row gutter={[16, 16]}>
                                                        {selectedServices.map(serviceName => (
                                                            <Col span={12} key={serviceName}>
                                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                    <div style={{ flex: 1, paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={serviceName}>
                                                                        - {serviceName}
                                                                    </div>
                                                                    <div style={{ width: 250 }}>
                                                                        <Select
                                                                            allowClear
                                                                            showSearch
                                                                            mode="multiple"
                                                                            placeholder="Chọn người thực hiện"
                                                                            style={{ width: '100%' }}
                                                                            value={serviceStaffMappings[serviceName] || []}
                                                                            onChange={(val) => setServiceStaffMappings(prev => ({ ...prev, [serviceName]: val }))}
                                                                            options={staffList.filter(s => s.is_thuc_hien_dvkt !== false).map(s => ({ label: s.ho_ten, value: s.id }))}
                                                                            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </Col>
                                                        ))}
                                                    </Row>
                                                    <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
                                                        * Lưu ý: Nếu không chọn ai, hệ thống sẽ tự động xếp lịch dựa trên chứng chỉ hành nghề và thời gian rảnh như bình thường.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )
                            },
                            {
                                key: 'mau05',
                                label: <strong>Cấu hình DVKT</strong>,
                                children: (
                                    <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, background: '#fff' }}>
                                        <Mau05Config 
                                            externalFilterCodes={uniqueServiceCodes} 
                                            onConfigStatus={(count) => setUnconfiguredCount(count)}
                                        />
                                    </div>
                                )
                            }
                        ]}
                    />
                )}
            </Card>

            {(scheduledData.length > 0 || failedData.length > 0) && (
                <Card 
                    title={<span style={{color: '#16a34a'}}>Kết quả Xếp lịch ({scheduledData.length} dịch vụ thành công, {failedData.length} lỗi)</span>}
                    extra={<Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel}>Tải File Excel Hoàn Chỉnh</Button>}
                    style={{ marginBottom: 24, border: '1px solid #16a34a' }}
                >
                    <Tabs type="card" 
                        defaultActiveKey="2"
                        items={[
                            {
                                key: '2',
                                label: 'Người thực hiện',
                                children: (
                                    <>
                                        <Space style={{ marginBottom: 16 }}>

                                            <Button icon={<FileExcelOutlined />} onClick={() => handleExportExcelTab(groupedScheduledData, resultColumns, 'DanhSachTheoBacSi')}>Tải Excel</Button>
                                            <Button icon={<FileExcelOutlined />} style={{ color: '#eb2f96', borderColor: '#eb2f96' }} onClick={() => handleExportExcelTabFormat2(groupedScheduledData, 'DanhSachTheoBacSi')}>Tải Excel (Mẫu 2)</Button>
                                            <Button type="primary" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveExcelToServer(groupedScheduledData, resultColumns, 'DanhSachTheoBacSi')}>Lưu Excel</Button>
                                        </Space>
                                        <div id="print-doctor" style={{ background: '#fff', padding: '20px' }}>
                                            <div className="print-header" style={{ display: 'none', marginBottom: 20 }}>
                                                <h2 style={{ textAlign: 'center' }}>SỞ Y TẾ TỈNH LẠNG SƠN<br/>BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN</h2>
                                                <h1 style={{ textAlign: 'center', marginTop: 20 }}>DANH SÁCH CHIA THỜI GIAN THEO BÁC SĨ NGÀY {dayjs(selectedDate).format('DD/MM/YYYY')} CỦA KHOA {departments.find((d: any) => d.ma_khoa === selectedDept)?.ten_khoa?.toUpperCase()}</h1>
                                            </div>
                                            <Table 
                                                dataSource={groupedScheduledData} 
                                                columns={resultColumns} 
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
                                key: '1',
                                label: 'Tên Bệnh nhân',
                                children: (
                                    <>
                                        <Space style={{ marginBottom: 16 }}>

                                            <Button icon={<FileExcelOutlined />} onClick={() => handleExportExcelTab(groupedByPatientData, patientColumns, 'DanhSachBenhNhan')}>Tải Excel</Button>
                                            <Button icon={<FileExcelOutlined />} style={{ color: '#eb2f96', borderColor: '#eb2f96' }} onClick={() => handleExportExcelTabFormat2(groupedByPatientData, 'DanhSachBenhNhan')}>Tải Excel (Mẫu 2)</Button>
                                            <Button type="primary" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveExcelToServer(groupedByPatientData, patientColumns, 'DanhSachBenhNhan')}>Lưu Excel</Button>
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
                                key: 'service',
                                label: 'Tên DVKT',
                                children: (
                                    <>
                                        <Space style={{ marginBottom: 16 }}>
                                            <Button icon={<FileExcelOutlined />} onClick={() => handleExportExcelTab(groupedByServiceData, serviceColumns, 'DanhSachTheoDichVu')}>Tải Excel</Button>
                                            <Button icon={<FileExcelOutlined />} style={{ color: '#eb2f96', borderColor: '#eb2f96' }} onClick={() => handleExportExcelTabFormat2(groupedByServiceData, 'DanhSachTheoDichVu')}>Tải Excel (Mẫu 2)</Button>
                                            <Button type="primary" icon={<SaveOutlined />} loading={savingReport} onClick={() => handleSaveExcelToServer(groupedByServiceData, serviceColumns, 'DanhSachTheoDichVu')}>Lưu Excel</Button>
                                        </Space>
                                        <div id="print-service" style={{ background: '#fff', padding: '20px' }}>
                                            <div className="print-header" style={{ display: 'none', marginBottom: 20 }}>
                                                <h2 style={{ textAlign: 'center' }}>SỞ Y TẾ TỈNH LẠNG SƠN<br/>BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN</h2>
                                                <h1 style={{ textAlign: 'center', marginTop: 20 }}>CHIA THỜI GIAN THỰC HIỆN DVKT NGÀY {dayjs(selectedDate).format('DD/MM/YYYY')} CỦA KHOA {departments.find((d: any) => d.ma_khoa === selectedDept)?.ten_khoa?.toUpperCase()}</h1>
                                            </div>
                                            <Table 
                                                dataSource={groupedByServiceData} 
                                                columns={serviceColumns} 
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
                                key: '3',
                                label: 'Thống kê theo Người thực hiện',
                                children: (
                                    <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                                        {staffStats.map(([key, data]) => (
                                            <Col span={6} key={key}>
                                                <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', borderColor: '#b7eb8f' }}>
                                                    <div style={{ fontSize: 15, fontWeight: 'bold', color: '#237804' }}>{data.name} <span style={{fontSize: 12, color: '#8c8c8c'}}>({key})</span></div>
                                                    <div style={{ fontSize: 24, marginTop: 8, color: '#135200' }}>
                                                        {data.patientCount} <span style={{fontSize: 13, color: '#595959', fontWeight: 'normal'}}>bệnh nhân</span>
                                                        <span style={{ fontSize: 18, margin: '0 8px', color: '#8c8c8c' }}>-</span>
                                                        {data.serviceCount} <span style={{fontSize: 13, color: '#595959', fontWeight: 'normal'}}>DVKT</span>
                                                    </div>
                                                </Card>
                                            </Col>
                                        ))}
                                    </Row>
                                )
                            },
                            {
                                key: '4',
                                label: 'Tổng hợp y lệnh',
                                children: (
                                    <div style={{ marginTop: 16 }}>
                                        <Space style={{ marginBottom: 16 }}>

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
                                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                                            <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportFailedOriginal} danger>
                                                Xuất Excel File Gốc
                                            </Button>
                                        </div>
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
                {
                    key: 'INSTRUCTION',
                    label: <strong style={{fontSize: 16}}>Hướng dẫn sử dụng</strong>,
                    children: (
                        <div style={{ marginTop: 16 }}>
                            <PageInstruction pageId="clinical-scheduling-schedule" />
                        </div>
                    )
                }
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
                
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                    <div style={{ marginBottom: 4, color: '#389e0d' }}><strong>Hoặc chọn áp dụng nhanh một Mẫu Excel đã lưu:</strong></div>
                    <Select
                        style={{ width: '100%' }}
                        allowClear
                        placeholder="--- Chọn Mẫu Excel ---"
                        options={templates.map(t => ({ label: t.name, value: t.id }))}
                        onChange={(val) => {
                            if (val) {
                                const tmpl = templates.find(t => t.id === val);
                                if (tmpl) {
                                    const autoMap: any = { ...columnMapping };
                                    tmpl.mappings.forEach((m: any) => {
                                        autoMap[m.system_field] = m.excel_column;
                                    });
                                    setColumnMapping(autoMap);
                                }
                            }
                        }}
                    />
                </div>
                
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
