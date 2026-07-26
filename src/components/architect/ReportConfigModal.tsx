'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Table, Row, Col, Space } from 'antd';
import ExcelJS from 'exceljs';
import dayjs from 'dayjs';

const { Option } = Select;

export interface ReportConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    rawHeaders: string[];
    data: any[];
    mode?: 'CONFIG' | 'EXPORT' | 'BOTH';
}

const REPORT_COLUMNS = [
    { key: 'ma_bn', label: 'Mã BN' },
    { key: 'ho_ten', label: 'Họ tên người bệnh' },
    { key: 'nam_sinh_nam', label: 'Năm sinh (Nam)' },
    { key: 'nam_sinh_nu', label: 'Năm sinh (Nữ)' },
    { key: 'ten_pttt', label: 'Tên thủ thuật' },
    { key: 'ngay_tt', label: 'Ngày thủ thuật' },
    { key: 'ngay_kt', label: 'Ngày KT thủ thuật' },
    { key: 'phan_loai_db', label: 'Phân loại thủ thuật (ĐB)' },
    { key: 'phan_loai_1', label: 'Phân loại thủ thuật (Loại I)' },
    { key: 'phan_loai_2', label: 'Phân loại thủ thuật (Loại II)' },
    { key: 'phan_loai_3', label: 'Phân loại thủ thuật (Loại III)' },
    { key: 'tt_chinh', label: 'Thủ thuật viên chính' },
    { key: 'phu_vt', label: 'Phụ VT' },
    { key: 'phu_vn_1', label: 'Phụ VN 1' },
    { key: 'phu_vn_2', label: 'Phụ VN 2' },
    { key: 'bs_gm', label: 'Bác sĩ Gây mê' },
    { key: 'ktv_gm_1', label: 'KTV GM 1' },
    { key: 'ktv_gm_2', label: 'KTV GM 2' },
    { key: 'vong_trong', label: 'Vòng trong' },
    { key: 'vong_ngoai', label: 'Vòng ngoài' }
];

export default function ReportConfigModal({ isOpen, onClose, rawHeaders, data, mode = 'BOTH' }: ReportConfigModalProps) {
    const [form] = Form.useForm();
    const [columnMappings, setColumnMappings] = useState<Record<string, { type: 'RAW' | 'FIXED', value: string }>>({});
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Load saved config
            const saved = localStorage.getItem('ptttReportConfig');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    form.setFieldsValue({
                        department: parsed.department || '',
                        fromDate: parsed.fromDate || '',
                        toDate: parsed.toDate || ''
                    });
                    setColumnMappings(parsed.columnMappings || {});
                } catch (e) {
                    console.error("Lỗi parse config", e);
                }
            } else {
                // Initialize default mappings
                const initMap: any = {};
                REPORT_COLUMNS.forEach(col => {
                    initMap[col.key] = { type: 'RAW', value: '' };
                });
                setColumnMappings(initMap);
            }
        }
    }, [isOpen, form]);

    const handleMappingChange = (colKey: string, field: 'type' | 'value', val: string) => {
        setColumnMappings(prev => ({
            ...prev,
            [colKey]: {
                ...prev[colKey],
                [field]: val,
                // if switching to FIXED, clear value
                ...(field === 'type' && val === 'FIXED' ? { value: '' } : {})
            }
        }));
    };

    const handleSaveConfig = () => {
        const config = {
            department: form.getFieldValue('department'),
            fromDate: form.getFieldValue('fromDate'),
            toDate: form.getFieldValue('toDate'),
            columnMappings
        };
        localStorage.setItem('ptttReportConfig', JSON.stringify(config));
        message.success("Đã lưu cấu hình ánh xạ cột!");
    };

    const handleExport = async () => {
        try {
            setExporting(true);
            const vals = await form.validateFields();
            
            // Save config before export
            handleSaveConfig();

            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('Báo cáo', {
                views: [{ showGridLines: false }],
                pageSetup: {
                    paperSize: 9, // A4
                    orientation: 'landscape',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: {
                        left: 0.25,
                        right: 0.25,
                        top: 0.5,
                        bottom: 0.5,
                        header: 0.3,
                        footer: 0.3
                    }
                }
            });

            // 1. Build Header rows
            // Row 2
            ws.getCell('A2').value = "Sở Y Tế Lạng Sơn";
            ws.getCell('A2').font = { name: 'Times New Roman', size: 12, bold: true };
            ws.getCell('A2').alignment = { horizontal: 'center' };
            ws.mergeCells('A2:C2');

            ws.getCell('D2').value = "BÁO CÁO THỦ THUẬT";
            ws.getCell('D2').font = { name: 'Times New Roman', size: 16, bold: true };
            ws.getCell('D2').alignment = { horizontal: 'center', vertical: 'middle' };
            ws.mergeCells('D2:U3');

            // Row 3
            ws.getCell('A3').value = "Bệnh Viện Đa khoa Tỉnh Lạng Sơn";
            ws.getCell('A3').font = { name: 'Times New Roman', size: 12, bold: true };
            ws.getCell('A3').alignment = { horizontal: 'center' };
            ws.mergeCells('A3:C3');

            // Row 4
            ws.getCell('D4').value = `Từ ngày: ${vals.fromDate || '...'}    đến ngày: ${vals.toDate || '...'}`;
            ws.getCell('D4').font = { name: 'Times New Roman', size: 12, italic: true };
            ws.getCell('D4').alignment = { horizontal: 'center' };
            ws.mergeCells('D4:U4');

            // Row 5
            ws.getCell('A5').value = `Khoa  - Phòng: ${vals.department || ''}`;
            ws.getCell('A5').font = { name: 'Times New Roman', size: 12, bold: true };
            ws.getCell('A5').alignment = { horizontal: 'left' };
            ws.mergeCells('A5:U5');

            // Row 7 & 8: Table Headers
            const headerFont = { name: 'Times New Roman', size: 11, bold: true };
            const headerAlign = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
            const borderStyle = { style: 'thin' as const };
            const borders = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

            const buildCell = (address: string, value: string, mergeStr?: string) => {
                const cell = ws.getCell(address);
                cell.value = value;
                cell.font = headerFont;
                cell.alignment = headerAlign;
                cell.border = borders;
                if (mergeStr) ws.mergeCells(mergeStr);
            };

            // Column widths mapping (A to V, 1 to 22)
            ws.getColumn(1).width = 5;  // A (STT)
            ws.getColumn(2).width = 12; // B (Mã BN)
            ws.getColumn(3).width = 25; // C (Họ tên)
            ws.getColumn(4).width = 8;  // D (Nam)
            ws.getColumn(5).width = 8;  // E (Nữ)
            ws.getColumn(6).width = 30; // F (Tên TT)
            ws.getColumn(7).width = 15; // G (Ngày TT)
            ws.getColumn(8).width = 15; // H (Ngày KT TT)
            // I to L (Phân loại)
            for (let i = 9; i <= 12; i++) ws.getColumn(i).width = 5;
            // M to U (Nhân viên)
            for (let i = 13; i <= 21; i++) ws.getColumn(i).width = 15;

            // Row 7 (main headers)
            buildCell('A7', 'STT', 'A7:A8');
            buildCell('B7', 'Mã BN', 'B7:B8');
            buildCell('C7', 'Họ tên người bệnh', 'C7:C8');
            buildCell('D7', 'Năm sinh', 'D7:E7');
            buildCell('F7', 'Tên thủ thuật', 'F7:F8');
            buildCell('G7', 'Ngày thủ thuật', 'G7:G8');
            buildCell('H7', 'Ngày KT thủ thuật', 'H7:H8'); 
            
            buildCell('I7', 'Phân loại thủ thuật', 'I7:L7');
            buildCell('M7', 'Nhân viên phục vụ thủ thuật', 'M7:U7');

            for (let r = 7; r <= 8; r++) {
                for (let c = 1; c <= 21; c++) {
                    ws.getCell(r, c).border = borders;
                }
            }

            // Row 8 (sub headers)
            buildCell('D8', 'Nam');
            buildCell('E8', 'Nữ');
            
            buildCell('I8', 'ĐB');
            buildCell('J8', 'I');
            buildCell('K8', 'II');
            buildCell('L8', 'III');

            buildCell('M8', 'TT chính');
            buildCell('N8', 'Phụ VT');
            buildCell('O8', 'Phụ VN');
            buildCell('P8', 'Phụ VN 2');
            buildCell('Q8', 'BS GM');
            buildCell('R8', 'KTV GM 1');
            buildCell('S8', 'KTV GM 2');
            buildCell('T8', 'Vòng trong');
            buildCell('U8', 'Vòng ngoài');

            // Write Data
            const startDataRow = 9;
            const dataFont = { name: 'Times New Roman', size: 11 };
            const dataAlign = { vertical: 'middle' as const, wrapText: true };
            const centerAlign = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };

            const getValue = (row: any, colKey: string) => {
                const map = columnMappings[colKey];
                if (!map) return '';
                if (map.type === 'FIXED') return map.value;
                
                // mapped to raw column name. We need to find the dataIndex of this raw column.
                const rawColIndex = rawHeaders.indexOf(map.value);
                if (rawColIndex === -1) return '';
                return row[rawColIndex] !== undefined ? row[rawColIndex] : '';
            };

            data.forEach((row, index) => {
                const rIdx = startDataRow + index;
                const r = ws.getRow(rIdx);

                // Initialize all borders
                for (let c = 1; c <= 21; c++) {
                    const cell = r.getCell(c);
                    cell.border = borders;
                    cell.font = dataFont;
                    cell.alignment = dataAlign;
                }

                // Map standard cells
                r.getCell('A').value = index + 1;
                r.getCell('A').alignment = centerAlign;

                r.getCell('B').value = getValue(row, 'ma_bn');
                r.getCell('B').alignment = centerAlign;
                
                r.getCell('C').value = getValue(row, 'ho_ten');
                r.getCell('F').value = getValue(row, 'ten_pttt');
                r.getCell('G').value = getValue(row, 'ngay_tt');
                r.getCell('G').alignment = centerAlign;
                r.getCell('H').value = getValue(row, 'ngay_kt');
                r.getCell('H').alignment = centerAlign;
                
                // Nam sinh logic
                r.getCell('D').value = getValue(row, 'nam_sinh_nam'); 
                r.getCell('D').alignment = centerAlign;
                
                r.getCell('E').value = getValue(row, 'nam_sinh_nu'); 
                r.getCell('E').alignment = centerAlign;

                // Phan loai logic (I, J, K, L)
                r.getCell('I').value = getValue(row, 'phan_loai_db');
                r.getCell('I').alignment = centerAlign;
                
                r.getCell('J').value = getValue(row, 'phan_loai_1');
                r.getCell('J').alignment = centerAlign;
                
                r.getCell('K').value = getValue(row, 'phan_loai_2');
                r.getCell('K').alignment = centerAlign;
                
                r.getCell('L').value = getValue(row, 'phan_loai_3');
                r.getCell('L').alignment = centerAlign;

                // Roles (M to U)
                r.getCell('M').value = getValue(row, 'tt_chinh');
                r.getCell('N').value = getValue(row, 'phu_vt');
                r.getCell('O').value = getValue(row, 'phu_vn_1');
                r.getCell('P').value = getValue(row, 'phu_vn_2');
                r.getCell('Q').value = getValue(row, 'bs_gm');
                r.getCell('R').value = getValue(row, 'ktv_gm_1');
                r.getCell('S').value = getValue(row, 'ktv_gm_2');
                r.getCell('T').value = getValue(row, 'vong_trong');
                r.getCell('U').value = getValue(row, 'vong_ngoai');
            });

            // Calculate totals for classification
            let totalDB = 0, total1 = 0, total2 = 0, total3 = 0;
            data.forEach((row) => {
                const db = String(getValue(row, 'phan_loai_db')).trim();
                const v1 = String(getValue(row, 'phan_loai_1')).trim();
                const v2 = String(getValue(row, 'phan_loai_2')).trim();
                const v3 = String(getValue(row, 'phan_loai_3')).trim();
                if (db && db !== 'undefined') totalDB++;
                if (v1 && v1 !== 'undefined') total1++;
                if (v2 && v2 !== 'undefined') total2++;
                if (v3 && v3 !== 'undefined') total3++;
            });

            // Footer - Tổng cộng
            const totalRowIdx = startDataRow + data.length;
            const totalRow = ws.getRow(totalRowIdx);
            
            for (let c = 1; c <= 21; c++) {
                const cell = totalRow.getCell(c);
                cell.border = borders;
                cell.font = { name: 'Times New Roman', size: 11, bold: true };
                cell.alignment = centerAlign;
            }

            totalRow.getCell('A').value = `Tổng cộng ${data.length}`;
            totalRow.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
            ws.mergeCells(`A${totalRowIdx}:H${totalRowIdx}`);
            
            totalRow.getCell('I').value = totalDB > 0 ? totalDB : '';
            totalRow.getCell('J').value = total1 > 0 ? total1 : '';
            totalRow.getCell('K').value = total2 > 0 ? total2 : '';
            totalRow.getCell('L').value = total3 > 0 ? total3 : '';

            // Signatures
            const signRowIdx = totalRowIdx + 2;
            const today = new Date();
            const d = String(today.getDate()).padStart(2, '0');
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const y = today.getFullYear();
            
            ws.getCell(`O${signRowIdx}`).value = `Lạng Sơn, Ngày ${d} tháng ${m} năm ${y}`;
            ws.getCell(`O${signRowIdx}`).font = { name: 'Times New Roman', size: 12, italic: true };
            ws.getCell(`O${signRowIdx}`).alignment = { horizontal: 'center' };
            ws.mergeCells(`O${signRowIdx}:U${signRowIdx}`);

            const titleRowIdx = signRowIdx + 1;
            ws.getCell(`A${titleRowIdx}`).value = 'LÃNH ĐẠO DUYỆT';
            ws.getCell(`A${titleRowIdx}`).font = { name: 'Times New Roman', size: 11, bold: true };
            ws.getCell(`A${titleRowIdx}`).alignment = { horizontal: 'center' };
            ws.mergeCells(`A${titleRowIdx}:D${titleRowIdx}`);

            ws.getCell(`E${titleRowIdx}`).value = 'P. KẾ HOẠCH TỔNG HỢP';
            ws.getCell(`E${titleRowIdx}`).font = { name: 'Times New Roman', size: 11, bold: true };
            ws.getCell(`E${titleRowIdx}`).alignment = { horizontal: 'center' };
            ws.mergeCells(`E${titleRowIdx}:J${titleRowIdx}`);

            ws.getCell(`K${titleRowIdx}`).value = 'TRƯỞNG KHOA';
            ws.getCell(`K${titleRowIdx}`).font = { name: 'Times New Roman', size: 11, bold: true };
            ws.getCell(`K${titleRowIdx}`).alignment = { horizontal: 'center' };
            ws.mergeCells(`K${titleRowIdx}:N${titleRowIdx}`);

            ws.getCell(`O${titleRowIdx}`).value = 'NGƯỜI LẬP BẢNG';
            ws.getCell(`O${titleRowIdx}`).font = { name: 'Times New Roman', size: 11, bold: true };
            ws.getCell(`O${titleRowIdx}`).alignment = { horizontal: 'center' };
            ws.mergeCells(`O${titleRowIdx}:U${titleRowIdx}`);

            // Trigger download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `BaoCao_PTTT_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
            
            message.success("Đã xuất file báo cáo thành công!");
            onClose();
        } catch (e) {
            console.error(e);
            message.error("Lỗi xuất file: " + (e as Error).message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <Modal
            title={mode === 'CONFIG' ? "Cấu hình Ánh xạ Cột Báo cáo" : (mode === 'EXPORT' ? "Xuất Báo cáo chuẩn" : "Cấu hình & Xuất Báo cáo")}
            open={isOpen}
            onCancel={onClose}
            width={mode === 'EXPORT' ? 700 : 900}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Hủy
                </Button>,
                ...(mode === 'CONFIG' || mode === 'BOTH' ? [
                    <Button key="save" onClick={handleSaveConfig}>
                        Lưu cấu hình
                    </Button>
                ] : []),
                ...(mode === 'EXPORT' || mode === 'BOTH' ? [
                    <Button key="export" type="primary" className="bg-green-600 hover:bg-green-700 border-none" loading={exporting} onClick={handleExport}>
                        Xuất Báo cáo Excel
                    </Button>
                ] : [])
            ]}
        >
            <Form form={form} layout="vertical">
                {(mode === 'EXPORT' || mode === 'BOTH') && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
                        <h3 className="font-bold text-blue-800 mb-4">Thông tin Tiêu đề Báo cáo</h3>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="department" label="Khoa - Phòng">
                                <Input placeholder="VD: Khoa Ngoại Tổng hợp" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="fromDate" label="Từ ngày">
                                <Input placeholder="VD: 24/07/2026" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="toDate" label="Đến ngày">
                                <Input placeholder="VD: 24/07/2026" />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>
                )}

                {(mode === 'CONFIG' || mode === 'BOTH') && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-[500px] overflow-y-auto">
                    <h3 className="font-bold text-slate-800 mb-4 flex justify-between items-center">
                        <span>Ánh xạ Cột Dữ liệu</span>
                        <span className="text-sm font-normal text-slate-500">
                            Cấu hình sẽ được tự động lưu lại cho lần sau
                        </span>
                    </h3>
                    
                    <Table
                        dataSource={REPORT_COLUMNS}
                        pagination={false}
                        rowKey="key"
                        size="small"
                        bordered
                        columns={[
                            {
                                title: 'Cột trong Báo cáo (Đích)',
                                dataIndex: 'label',
                                width: 300,
                                render: (text) => <span className="font-medium text-slate-700">{text}</span>
                            },
                            {
                                title: 'Nguồn dữ liệu',
                                dataIndex: 'key',
                                width: 200,
                                render: (key) => (
                                    <Select
                                        value={columnMappings[key]?.type || 'RAW'}
                                        onChange={(val) => handleMappingChange(key, 'type', val)}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="RAW">Từ File gốc</Option>
                                        <Option value="FIXED">Tự nhập tay (Cố định)</Option>
                                    </Select>
                                )
                            },
                            {
                                title: 'Giá trị Ánh xạ',
                                dataIndex: 'key',
                                render: (key) => {
                                    const map = columnMappings[key];
                                    if (map?.type === 'FIXED') {
                                        return (
                                            <Input 
                                                placeholder="Nhập giá trị cố định..." 
                                                value={map.value}
                                                onChange={(e) => handleMappingChange(key, 'value', e.target.value)}
                                            />
                                        );
                                    }
                                    return (
                                        <Select
                                            showSearch
                                            allowClear
                                            placeholder="Chọn cột từ file Excel thô..."
                                            value={map?.value || undefined}
                                            onChange={(val) => handleMappingChange(key, 'value', val || '')}
                                            style={{ width: '100%' }}
                                            options={rawHeaders.map(h => ({ label: h, value: h }))}
                                            filterOption={(input, option) =>
                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                        />
                                    );
                                }
                            }
                        ]}
                    />
                </div>
                )}
            </Form>
        </Modal>
    );
}
