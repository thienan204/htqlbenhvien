'use client';

import React, { useState, useEffect } from 'react';
import { 
    Tabs, Card, Upload, Button, Table, Tag, Modal, Form, 
    Input, Select, Space, Alert, message, Spin, Statistic, 
    Row, Col, Tooltip, Empty, Popconfirm, Checkbox 
} from 'antd';
import { 
    InboxOutlined, SaveOutlined, DiffOutlined, HistoryOutlined, 
    CheckCircleOutlined, ExclamationCircleOutlined, FileExcelOutlined, 
    ReloadOutlined, SearchOutlined, EyeOutlined, ArrowUpOutlined, 
    ArrowDownOutlined, SwapOutlined, AuditOutlined, CloudUploadOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { parseXmlContent, ExtendedHosoRecord, getXmlDataList } from '@/lib/xml';
import { getBasePath } from '@/utils/config';

const { Dragger } = Upload;

// Helper ưu tiên lấy mã khoa ra viện từ XML7, nếu không có mới lấy XML1
function getDepartmentFromRecord(record: any): string {
    if (!record) return '';
    // 1. Ưu tiên tìm trong XML7 (MA_KHOA_RV)
    const xml7Group = record.groups?.find((g: any) => g.type === 'XML7');
    if (xml7Group) {
        const xml7List = getXmlDataList(xml7Group);
        const firstXml7 = xml7List?.[0] || xml7Group.data?.CHITIEU_DU_LIEU_GIAY_RA_VIEN?.GIAY_RA_VIEN || xml7Group.data?.GIAY_RA_VIEN || xml7Group.data;
        const target = Array.isArray(firstXml7) ? firstXml7[0] : firstXml7;
        const maKhoaRv = target?.MA_KHOA_RV || target?.ma_khoa_rv;
        if (maKhoaRv && String(maKhoaRv).trim() !== '') {
            return String(maKhoaRv).trim();
        }
    }

    // 2. Fallback: Lấy từ XML1 (MA_KHOA)
    const xml1Group = record.groups?.find((g: any) => g.type === 'XML1');
    const xml1Data = xml1Group ? (getXmlDataList(xml1Group)?.[0] || xml1Group.data?.TONG_HOP || xml1Group.data) : null;
    const maKhoaXml1 = record.summary?.MA_KHOA || xml1Data?.MA_KHOA || xml1Data?.ma_khoa;
    if (maKhoaXml1 && String(maKhoaXml1).trim() !== '') {
        return String(maKhoaXml1).trim();
    }

    return '';
}

export default function XmlSuaBaPage() {
    const { user, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState<'UPLOAD' | 'DIFF' | 'HISTORY'>('UPLOAD');

    // Phân quyền
    const allowedRoles = ['ADMIN', 'CNTT', 'BHYT'];
    const hasRoleAccess = user?.role && (allowedRoles.includes(user.role) || hasPermission('MENU_XML_SUA_BA'));

    // --- STATE TAB 1: TIẾP NHẬN & LƯU BẢN TRƯỚC SỬA ---
    const [uploadedRecords, setUploadedRecords] = useState<ExtendedHosoRecord[]>([]);
    const [selectedMaLks, setSelectedMaLks] = useState<string[]>([]);
    const [allowSaveNonPayment, setAllowSaveNonPayment] = useState<boolean>(true);
    const [paymentStatuses, setPaymentStatuses] = useState<Record<string, any>>({});
    const [isCheckingPayment, setIsCheckingPayment] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveForm] = Form.useForm();
    const [departments, setDepartments] = useState<{ ma_khoa: string, ten_khoa: string }[]>([]);

    // --- STATE TAB 2: SO SÁNH ĐỐI CHIẾU (DIFF) ---
    const [diffMaLk, setDiffMaLk] = useState<string>('');
    const [postEditRecords, setPostEditRecords] = useState<ExtendedHosoRecord[]>([]);
    const [isComparing, setIsComparing] = useState(false);
    const [diffResult, setDiffResult] = useState<any>(null);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // --- STATE TAB 3: SỔ THEO DÕI ---
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(1);
    const [historySearch, setHistorySearch] = useState('');
    const [historyDept, setHistoryDept] = useState<string>('ALL');

    // Fetch danh mục khoa với isMounted guard
    useEffect(() => {
        let isMounted = true;
        const fetchDepts = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/departments`);
                if (res.ok && isMounted) {
                    const data = await res.json();
                    if (isMounted) setDepartments(data || []);
                }
            } catch (e) {
                console.error("Lỗi lấy danh mục khoa:", e);
            }
        };
        fetchDepts();
        return () => { isMounted = false; };
    }, []);

    // Load Tab 3 khi chuyển tab
    useEffect(() => {
        let isMounted = true;
        if (activeTab === 'HISTORY') {
            loadHistory(historyPage, historySearch, historyDept);
        }
        return () => { isMounted = false; };
    }, [activeTab]);

    // 1. Xử lý tải file XML Tab 1 (Bản trước sửa)
    const handlePreEditFileUpload = async (files: File[]) => {
        if (!files || files.length === 0) return;

        message.loading({ content: 'Đang giải mã file XML...', key: 'parseXml' });
        try {
            const allRecords: ExtendedHosoRecord[] = [];
            for (const file of files) {
                const text = await file.text();
                const parsed = parseXmlContent(text);
                if (parsed.records) {
                    parsed.records.forEach(r => {
                        allRecords.push({
                            ...r,
                            sourceFile: file.name
                        });
                    });
                }
            }

            if (allRecords.length === 0) {
                message.warning({ content: 'Không tìm thấy hồ sơ hợp lệ trong file XML', key: 'parseXml' });
                return;
            }

            setUploadedRecords(allRecords);
            message.success({ content: `Đã đọc thành công ${allRecords.length} hồ sơ. Đang kiểm tra trạng thái Cổng BHYT...`, key: 'parseXml' });

            // Tự động kiểm tra Đề nghị thanh toán với Cổng BHYT
            await checkPaymentStatusBatch(allRecords);

        } catch (err: any) {
            console.error(err);
            message.error({ content: `Lỗi đọc file: ${err.message}`, key: 'parseXml' });
        }
    };

    // Kiểm tra trạng thái ĐNTT
    const checkPaymentStatusBatch = async (recordsToCheck: ExtendedHosoRecord[]) => {
        setIsCheckingPayment(true);
        try {
            const maLkList = recordsToCheck.map(r => String(r.id || r.summary?.MA_LK)).filter(Boolean);
            const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/check-status-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maLienKetList: maLkList })
            });

            if (res.ok) {
                const json = await res.json();
                const results = json.results || {};
                setPaymentStatuses(results);

                // Tự động tick chọn: ưu tiên các hồ sơ ĐÃ ĐNTT, nếu không có hồ sơ nào ĐNTT thì chọn tất cả hồ sơ nạp vào
                const daDeNghiKeys = maLkList.filter(mlk => results[mlk]?.daDeNghiTT);
                if (daDeNghiKeys.length > 0) {
                    setSelectedMaLks(daDeNghiKeys);
                } else {
                    setSelectedMaLks(maLkList);
                }

                message.success(`Đã kiểm tra đối soát Cổng BHYT: ${json.summary?.totalDaDeNghiTT || 0} hồ sơ ĐÃ ĐỀ NGHỊ TT, ${json.summary?.totalChuaDeNghiTT || 0} hồ sơ chưa ĐNTT.`);
            } else {
                message.error('Kiểm tra Cổng BHYT thất bại');
            }
        } catch (e: any) {
            message.error(`Lỗi kết nối kiểm tra: ${e.message}`);
        } finally {
            setIsCheckingPayment(false);
        }
    };

    // Các hồ sơ ĐÃ ĐỀ NGHỊ THANH TOÁN
    const eligibleRecords = uploadedRecords.filter(r => {
        const mlk = String(r.id || r.summary?.MA_LK);
        return paymentStatuses[mlk]?.daDeNghiTT;
    });

    // Các hồ sơ được người dùng chọn để lưu
    const recordsToSave = uploadedRecords.filter(r => {
        const mlk = String(r.id || r.summary?.MA_LK);
        return selectedMaLks.includes(mlk);
    });

    const selectedDaDeNghiCount = recordsToSave.filter(r => paymentStatuses[String(r.id || r.summary?.MA_LK)]?.daDeNghiTT).length;
    const selectedChuaDeNghiCount = recordsToSave.length - selectedDaDeNghiCount;

    // Gán dữ liệu form khi modal mở an toàn
    useEffect(() => {
        if (isSaveModalOpen && recordsToSave.length > 0) {
            const defaultKhoa = getDepartmentFromRecord(recordsToSave[0]);
            saveForm.setFieldsValue({
                editDept: defaultKhoa,
                editReason: 'Khoa yêu cầu sửa đổi bệnh án'
            });
        }
    }, [isSaveModalOpen]);

    // Mở modal lưu bản trước sửa
    const openSaveModal = () => {
        if (recordsToSave.length === 0) {
            Modal.warning({
                title: 'Chưa chọn hồ sơ để lưu',
                content: 'Vui lòng tích chọn ít nhất 1 hồ sơ trên danh sách trước khi thực hiện Lưu bản XML gốc.'
            });
            return;
        }

        setIsSaveModalOpen(true);
    };

    // Xác nhận lưu vào CSDL
    const handleConfirmSavePreEdit = async () => {
        try {
            const values = await saveForm.validateFields();
            setIsSaving(true);
            message.loading({ content: 'Đang lưu bản XML gốc vào CSDL...', key: 'savePreEdit' });

            const payload = {
                records: recordsToSave,
                editReason: values.editReason,
                editDept: values.editDept,
                paymentStatuses: paymentStatuses,
                allowNonPayment: allowSaveNonPayment || selectedChuaDeNghiCount > 0
            };

            const res = await fetch(`${getBasePath()}/api/xml1/save-pre-edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (res.ok && json.success) {
                setIsSaveModalOpen(false);
                Modal.success({
                    title: '✅ ĐÃ LƯU BẢN XML GỐC THÀNH CÔNG',
                    content: (
                        <div className="space-y-2 mt-2">
                            <p>Đã lưu <b>{json.savedCount}</b> hồ sơ vào CSDL làm bản gốc trước sửa.</p>
                            {json.alreadySavedCount > 0 && (
                                <p className="text-amber-600 text-xs">⚠️ {json.alreadySavedCount} hồ sơ đã được lưu trước đó (không bị trùng lặp).</p>
                            )}
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                                <b>Thông báo an toàn:</b> Dữ liệu gốc đã được bảo toàn trong hệ thống (bảng Xml1). Bạn có thể kiểm tra tại tab <b>3. Sổ theo dõi Bệnh án sửa</b> hoặc trang <b>Quản lý XML (DB)</b>, sau đó <b>thực hiện lấy bệnh án về trên HIS</b> để khoa phòng sửa đổi!
                            </div>
                        </div>
                    ),
                    okText: 'Đã hiểu'
                });
                message.success({ content: json.message, key: 'savePreEdit' });
                // Tải lại sổ theo dõi nếu cần
                loadHistory();
            } else {
                message.error({ content: json.error || 'Lưu thất bại', key: 'savePreEdit' });
            }
        } catch (e: any) {
            console.error(e);
            message.error({ content: `Lỗi: ${e.message}`, key: 'savePreEdit' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- TAB 2: THỰC HIỆN SO SÁNH (DIFF) ---
    const handlePostEditFileUpload = async (files: File[]) => {
        if (!files || files.length === 0) return;
        message.loading({ content: 'Đang đọc file XML sau sửa...', key: 'parsePostXml' });
        try {
            const allRecords: ExtendedHosoRecord[] = [];
            for (const file of files) {
                const text = await file.text();
                const parsed = parseXmlContent(text);
                if (parsed.records) {
                    parsed.records.forEach(r => {
                        allRecords.push({ ...r, sourceFile: file.name });
                    });
                }
            }

            if (allRecords.length === 0) {
                message.warning({ content: 'Không tìm thấy hồ sơ hợp lệ', key: 'parsePostXml' });
                return;
            }

            setPostEditRecords(allRecords);
            const firstMlk = String(allRecords[0]?.summary?.MA_LK || allRecords[0]?.id || '');
            setDiffMaLk(firstMlk);
            message.success({ content: `Đã nạp ${allRecords.length} hồ sơ sau sửa. Đang bắt đầu so sánh...`, key: 'parsePostXml' });

            // Tự động chạy so sánh hồ sơ đầu tiên
            if (firstMlk) {
                runComparison(firstMlk, allRecords[0]);
            }

        } catch (err: any) {
            message.error({ content: `Lỗi đọc file sau sửa: ${err.message}`, key: 'parsePostXml' });
        }
    };

    const runComparison = async (maLkToCompare: string, postRecord?: ExtendedHosoRecord) => {
        if (!maLkToCompare) {
            message.warning('Vui lòng nhập Mã liên kết cần so sánh');
            return;
        }

        setIsComparing(true);
        message.loading({ content: `Đang đối chiếu dữ liệu hồ sơ ${maLkToCompare}...`, key: 'diffLoading' });
        try {
            const payload: any = { maLk: maLkToCompare.trim() };
            if (postRecord) {
                payload.postEditRecord = postRecord;
            } else {
                const found = postEditRecords.find(r => String(r.summary?.MA_LK || r.id) === maLkToCompare.trim());
                if (found) payload.postEditRecord = found;
            }

            const res = await fetch(`${getBasePath()}/api/xml1/compare-pre-post-edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (res.ok && json.success) {
                setDiffResult(json);
                message.success({ content: 'Đã hoàn tất đối chiếu dữ liệu!', key: 'diffLoading' });
            } else {
                setDiffResult(null);
                message.error({ content: json.error || 'Không thể so sánh hồ sơ', key: 'diffLoading', duration: 4 });
            }
        } catch (e: any) {
            message.error({ content: `Lỗi kết nối so sánh: ${e.message}`, key: 'diffLoading' });
        } finally {
            setIsComparing(false);
        }
    };

    // Xuất Excel đối chiếu
    const handleExportDiffExcel = async () => {
        if (!diffResult) return;
        setIsExportingExcel(true);
        try {
            const res = await fetch(`${getBasePath()}/api/xml1/export-diff-excel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(diffResult)
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `BienBan_DoiChieu_SuaBA_${diffResult.summary?.maLk}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                message.success('Đã tải xuống file Excel biên bản đối chiếu!');
            } else {
                message.error('Lỗi khi xuất file Excel');
            }
        } catch (e: any) {
            message.error(`Lỗi: ${e.message}`);
        } finally {
            setIsExportingExcel(false);
        }
    };

    // --- TAB 3: LOAD SỔ THEO DÕI ---
    const loadHistory = async (p = historyPage, s = historySearch, dept = historyDept) => {
        setHistoryLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(p),
                limit: '15',
                search: s,
                maKhoa: dept
            });
            const res = await fetch(`${getBasePath()}/api/xml1/pre-edit-list?${params}`);
            if (res.ok) {
                const json = await res.json();
                setHistoryList(json.data || []);
                setHistoryTotal(json.total || 0);
            }
        } catch (e) {
            console.error(e);
            message.error('Lỗi tải sổ theo dõi');
        } finally {
            setHistoryLoading(false);
        }
    };

    // Nếu không có quyền truy cập
    if (user && !hasRoleAccess) {
        return (
            <div className="p-8 max-w-2xl mx-auto">
                <Alert
                    type="error"
                    showIcon
                    title="KHÔNG CÓ QUYỀN TRUY CẬP"
                    description="Chức năng Quản lý XML Sửa Bệnh Án chỉ dành cho Quản trị viên, Tổ CNTT và Tổ Giám định BHYT. Vui lòng liên hệ quản trị hệ thống nếu bạn cần phân quyền."
                    className="rounded-xl shadow-md p-6"
                />
            </div>
        );
    }

    // --- CẤU TRÚC GIAO DIỆN CHÍNH ---
    return (
        <div className="w-full px-3 sm:px-6 py-4 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <AuditOutlined className="text-blue-600" />
                        Quản lý & Đối soát XML Sửa Bệnh Án
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Lưu snapshot bản XML gốc (hồ sơ đã đề nghị thanh toán) trước khi lấy về sửa trên HIS và so sánh chênh lệch sau khi sửa
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Tag color="purple" className="px-3 py-1 text-xs font-semibold rounded-full border-purple-200">
                        Vai trò: {user?.role || 'Khách'}
                    </Tag>
                </div>
            </div>

            {/* TAB CHÍNH (Tuân thủ rule: Luôn dùng type="card") */}
            <Tabs 
                type="card" 
                activeKey={activeTab} 
                onChange={(key: any) => setActiveTab(key)}
                className="bg-white rounded-xl shadow-xs p-2 sm:p-4 border border-slate-200"
                items={[
                    {
                        key: 'UPLOAD',
                        label: (
                            <span className="flex items-center gap-2 font-medium px-2 py-1">
                                <SaveOutlined className="text-amber-500" />
                                1. Lưu bản XML trước sửa (Gốc)
                            </span>
                        ),
                        children: (
                            <div className="space-y-4 pt-2">
                                {/* Khung Upload Dragger */}
                                <Card className="border-dashed border-2 border-blue-300 bg-blue-50/30 rounded-xl">
                                    <Dragger
                                        multiple
                                        accept=".xml"
                                        showUploadList={false}
                                        beforeUpload={(file, fileList) => {
                                            if (fileList.length > 0 && file === fileList[0]) {
                                                handlePreEditFileUpload(fileList);
                                            }
                                            return false;
                                        }}
                                        className="py-4"
                                    >
                                        <p className="ant-upload-drag-icon">
                                            <CloudUploadOutlined className="text-4xl text-blue-500" />
                                        </p>
                                        <p className="ant-upload-text font-semibold text-slate-800 text-base">
                                            Kéo thả hoặc bấm để nạp file XML (Bản chưa sửa xuất từ HIS)
                                        </p>
                                        <p className="ant-upload-hint text-xs text-slate-500 max-w-xl mx-auto">
                                            Hệ thống sẽ tự động quét đối chiếu với Cổng BHYT để phát hiện các hồ sơ <b>ĐÃ ĐỀ NGHỊ THANH TOÁN</b> và chuẩn bị lưu snapshot an toàn trước khi mở khóa HIS.
                                        </p>
                                    </Dragger>
                                </Card>

                                {/* Bảng Thống kê & Nút Hành động */}
                                {uploadedRecords.length > 0 && (
                                    <Card className="shadow-xs rounded-xl border-slate-200">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                                            <div className="flex flex-wrap items-center gap-4">
                                                <Statistic 
                                                    title={<span className="text-xs text-slate-500 font-medium">Tổng nạp</span>} 
                                                    value={uploadedRecords.length} 
                                                    styles={{ content: { fontSize: '18px', fontWeight: 'bold' } }} 
                                                />
                                                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                                                <Statistic 
                                                    title={<span className="text-xs text-red-600 font-semibold">ĐÃ ĐỀ NGHỊ TT</span>} 
                                                    value={eligibleRecords.length} 
                                                    styles={{ content: { fontSize: '18px', fontWeight: 'bold', color: '#dc2626' } }} 
                                                />
                                                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                                                <Statistic 
                                                    title={<span className="text-xs text-emerald-600 font-medium">Chưa ĐNTT</span>} 
                                                    value={uploadedRecords.length - eligibleRecords.length} 
                                                    styles={{ content: { fontSize: '18px', fontWeight: 'bold', color: '#16a34a' } }} 
                                                />
                                                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                                                <Statistic 
                                                    title={<span className="text-xs text-amber-600 font-bold">ĐÃ CHỌN LƯU</span>} 
                                                    value={recordsToSave.length} 
                                                    styles={{ content: { fontSize: '18px', fontWeight: 'bold', color: '#d97706' } }} 
                                                />
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <Checkbox 
                                                    checked={allowSaveNonPayment} 
                                                    onChange={(e) => setAllowSaveNonPayment(e.target.checked)}
                                                    className="text-xs text-slate-700 font-medium select-none bg-slate-50 px-2 py-1 rounded border border-slate-200"
                                                >
                                                    Cho phép lưu cả hồ sơ Chưa ĐNTT
                                                </Checkbox>
                                                <Button 
                                                    icon={<ReloadOutlined />} 
                                                    onClick={() => checkPaymentStatusBatch(uploadedRecords)}
                                                    loading={isCheckingPayment}
                                                >
                                                    Kiểm tra Cổng
                                                </Button>
                                                <Button 
                                                    type="primary" 
                                                    icon={<SaveOutlined />} 
                                                    onClick={openSaveModal}
                                                    disabled={recordsToSave.length === 0}
                                                    className="bg-amber-600 hover:bg-amber-500 font-semibold shadow-xs"
                                                >
                                                    Lưu bản XML trước sửa ({recordsToSave.length} hồ sơ)
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Bảng chi tiết hồ sơ nạp */}
                                        <Table 
                                            size="small"
                                            rowKey={(r) => String(r.id || r.summary?.MA_LK)}
                                            dataSource={uploadedRecords}
                                            className="mt-3"
                                            pagination={{ pageSize: 8 }}
                                            rowSelection={{
                                                selectedRowKeys: selectedMaLks,
                                                onChange: (selectedKeys) => setSelectedMaLks(selectedKeys as string[]),
                                                selections: [
                                                    Table.SELECTION_ALL,
                                                    Table.SELECTION_INVERT,
                                                    {
                                                        key: 'select-da-dntt',
                                                        text: 'Chỉ chọn hồ sơ ĐÃ ĐNTT',
                                                        onSelect: () => {
                                                            const daDnttKeys = uploadedRecords
                                                                .filter(r => paymentStatuses[String(r.id || r.summary?.MA_LK)]?.daDeNghiTT)
                                                                .map(r => String(r.id || r.summary?.MA_LK));
                                                            setSelectedMaLks(daDnttKeys);
                                                        }
                                                    }
                                                ]
                                            }}
                                            columns={[
                                                { title: 'STT', width: 50, render: (_, __, idx) => idx + 1, align: 'center' },
                                                { 
                                                    title: 'Mã Liên Kết', 
                                                    dataIndex: ['summary', 'MA_LK'], 
                                                    render: (v) => <span className="font-mono font-bold text-blue-700">{v}</span> 
                                                },
                                                { title: 'Mã BN', dataIndex: ['summary', 'MA_BN'], width: 100 },
                                                { title: 'Họ tên người bệnh', dataIndex: ['summary', 'HO_TEN'], render: (v) => <b>{v}</b> },
                                                { 
                                                    title: 'Khoa ra', 
                                                    width: 110,
                                                    render: (_, record) => {
                                                        const deptCode = getDepartmentFromRecord(record);
                                                        const deptObj = departments.find(d => d.ma_khoa === deptCode);
                                                        return (
                                                            <Tooltip title={deptObj ? `${deptObj.ma_khoa} - ${deptObj.ten_khoa}` : deptCode}>
                                                                <Tag color="cyan" className="font-semibold cursor-pointer">
                                                                    {deptCode || '-'}
                                                                </Tag>
                                                            </Tooltip>
                                                        );
                                                    }
                                                },
                                                { 
                                                    title: 'Trạng thái Cổng BHYT', 
                                                    align: 'center',
                                                    width: 220,
                                                    render: (_, record) => {
                                                        const mlk = String(record.id || record.summary?.MA_LK);
                                                        const pInfo = paymentStatuses[mlk];
                                                        if (!pInfo) return <Tag>Đang kiểm tra...</Tag>;
                                                        if (pInfo.daDeNghiTT) {
                                                            return (
                                                                <Tooltip title={`Ngày ĐNTT: ${pInfo.ngayDeNghiTT || 'Đã gửi'}. Cần lưu snapshot trước khi sửa trên HIS!`}>
                                                                    <Tag color="error" className="font-semibold px-2 py-0.5 border-red-300">
                                                                        ⚠️ ĐÃ ĐỀ NGHỊ TT {pInfo.ngayDeNghiTT ? `(${pInfo.ngayDeNghiTT})` : ''}
                                                                    </Tag>
                                                                </Tooltip>
                                                            );
                                                        }
                                                        return <Tag color="success">Chưa đề nghị TT</Tag>;
                                                    }
                                                },
                                                { 
                                                    title: 'Tổng chi phí', 
                                                    dataIndex: ['summary', 'T_TONGCHI_BV'], 
                                                    align: 'right',
                                                    render: (v, r) => Number(v || r.summary?.T_TONGCHI_BH || 0).toLocaleString('vi-VN') + ' đ'
                                                },
                                                { 
                                                    title: 'Bảo hiểm TT', 
                                                    dataIndex: ['summary', 'T_BHTT'], 
                                                    align: 'right',
                                                    render: (v) => <span className="font-semibold text-emerald-700">{Number(v || 0).toLocaleString('vi-VN')} đ</span>
                                                }
                                            ]}
                                        />
                                    </Card>
                                )}
                            </div>
                        )
                    },
                    {
                        key: 'DIFF',
                        label: (
                            <span className="flex items-center gap-2 font-medium px-2 py-1">
                                <DiffOutlined className="text-blue-500" />
                                2. So sánh đối chiếu 2 bản (Diff Viewer)
                            </span>
                        ),
                        children: (
                            <div className="space-y-4 pt-2">
                                {/* Thanh điều khiển So sánh */}
                                <Card className="shadow-xs rounded-xl border-slate-200">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex-1 w-full">
                                            <div className="text-xs font-semibold text-slate-700 mb-1">
                                                Nạp file XML sau khi khoa phòng đã sửa trên HIS:
                                            </div>
                                            <Upload
                                                accept=".xml"
                                                showUploadList={false}
                                                beforeUpload={(file, fileList) => {
                                                    if (fileList.length > 0 && file === fileList[0]) {
                                                        handlePostEditFileUpload(fileList);
                                                    }
                                                    return false;
                                                }}
                                            >
                                                <Button icon={<CloudUploadOutlined />} type="dashed" className="w-full sm:w-auto">
                                                    Chọn file XML sau sửa
                                                </Button>
                                            </Upload>
                                            {postEditRecords.length > 0 && (
                                                <span className="text-xs text-emerald-600 font-medium ml-3">
                                                    ✅ Đã nạp {postEditRecords.length} hồ sơ sau sửa
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <Input 
                                                placeholder="Nhập Mã LK cần so sánh..." 
                                                value={diffMaLk}
                                                onChange={(e) => setDiffMaLk(e.target.value)}
                                                className="w-48 font-mono"
                                                allowClear
                                            />
                                            <Button 
                                                type="primary" 
                                                icon={<SwapOutlined />} 
                                                onClick={() => runComparison(diffMaLk)}
                                                loading={isComparing}
                                                className="bg-blue-600 hover:bg-blue-500"
                                            >
                                                So sánh thay đổi
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                {/* KẾT QUẢ SO SÁNH DIFF */}
                                {diffResult && diffResult.summary && (
                                    <div className="space-y-4">
                                        {/* Card Thống kê biến động */}
                                        <Card className="shadow-xs rounded-xl border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-blue-100 gap-2">
                                                <div>
                                                    <span className="text-xs text-slate-500 font-medium">BỆNH NHÂN:</span>{' '}
                                                    <b className="text-base text-blue-900">{diffResult.summary.hoTen}</b>{' '}
                                                    <span className="font-mono text-xs text-slate-600">({diffResult.summary.maLk})</span>
                                                    <span className="ml-3 text-xs text-slate-500">Khoa: <b>{diffResult.summary.editDept}</b></span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        icon={<FileExcelOutlined />} 
                                                        type="primary"
                                                        onClick={handleExportDiffExcel}
                                                        loading={isExportingExcel}
                                                        className="bg-emerald-600 hover:bg-emerald-500"
                                                    >
                                                        Xuất Excel biên bản đối chiếu
                                                    </Button>
                                                </div>
                                            </div>

                                            <Row gutter={[16, 16]} className="mt-4">
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" className="bg-white rounded-lg shadow-2xs border-slate-200">
                                                        <div className="text-xs text-slate-500">Tổng chi phí KCB</div>
                                                        <div className="text-base font-bold text-slate-800">
                                                            {Number(diffResult.summary.postTongChi || 0).toLocaleString('vi-VN')} đ
                                                        </div>
                                                        <div className={`text-xs font-semibold flex items-center gap-1 ${diffResult.summary.diffTongChi >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {diffResult.summary.diffTongChi >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                                            Chênh lệch: {Number(diffResult.summary.diffTongChi || 0).toLocaleString('vi-VN')} đ
                                                        </div>
                                                    </Card>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" className="bg-white rounded-lg shadow-2xs border-slate-200">
                                                        <div className="text-xs text-slate-500">Bảo hiểm thanh toán (BHTT)</div>
                                                        <div className="text-base font-bold text-emerald-700">
                                                            {Number(diffResult.summary.postBhtt || 0).toLocaleString('vi-VN')} đ
                                                        </div>
                                                        <div className={`text-xs font-semibold flex items-center gap-1 ${diffResult.summary.diffBhtt >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                                                            {diffResult.summary.diffBhtt >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                                            Chênh lệch: {Number(diffResult.summary.diffBhtt || 0).toLocaleString('vi-VN')} đ
                                                        </div>
                                                    </Card>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" className="bg-white rounded-lg shadow-2xs border-slate-200">
                                                        <div className="text-xs text-slate-500">Biến động Thuốc (XML2)</div>
                                                        <div className="text-xs text-slate-700 font-medium mt-1">
                                                            <span className="text-emerald-600 font-bold">+{diffResult.summary.soThuocThem}</span> thêm mới,{' '}
                                                            <span className="text-red-600 font-bold">-{diffResult.summary.soThuocXoa}</span> đã xóa,{' '}
                                                            <span className="text-amber-600 font-bold">~{diffResult.summary.soThuocSua}</span> sửa đổi
                                                        </div>
                                                    </Card>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Card size="small" className="bg-white rounded-lg shadow-2xs border-slate-200">
                                                        <div className="text-xs text-slate-500">Biến động DVKT/VT (XML3)</div>
                                                        <div className="text-xs text-slate-700 font-medium mt-1">
                                                            <span className="text-emerald-600 font-bold">+{diffResult.summary.soDvktThem}</span> thêm mới,{' '}
                                                            <span className="text-red-600 font-bold">-{diffResult.summary.soDvktXoa}</span> đã xóa,{' '}
                                                            <span className="text-amber-600 font-bold">~{diffResult.summary.soDvktSua}</span> sửa đổi
                                                        </div>
                                                    </Card>
                                                </Col>
                                            </Row>
                                        </Card>

                                        {/* Sub-Tabs so sánh chi tiết (Tuân thủ rule: Luôn dùng type="card") */}
                                        <Tabs
                                            type="card"
                                            className="bg-white rounded-xl shadow-xs p-3 border border-slate-200"
                                            items={[
                                                {
                                                    key: 'SUB_XML1',
                                                    label: '1. Thông tin chung & Chẩn đoán (XML1)',
                                                    children: (
                                                        <Table
                                                            size="small"
                                                            rowKey="field"
                                                            dataSource={diffResult.xml1Diff || []}
                                                            pagination={false}
                                                            columns={[
                                                                { title: 'Chỉ số / Trường', dataIndex: 'label', width: 220, render: (v: any) => <b>{v}</b> },
                                                                { 
                                                                    title: 'Bản trước sửa (Gốc)', 
                                                                    dataIndex: 'preValue',
                                                                    render: (v: any) => <span className="text-slate-600">{v || '(Trống)'}</span>
                                                                },
                                                                { 
                                                                    title: 'Bản sau sửa (Mới)', 
                                                                    dataIndex: 'postValue',
                                                                    render: (v: any, r: any) => (
                                                                        <span className={r.isChanged ? 'text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded' : 'text-slate-800'}>
                                                                            {v || '(Trống)'}
                                                                        </span>
                                                                    )
                                                                },
                                                                { 
                                                                    title: 'Trạng thái', 
                                                                    width: 140,
                                                                    align: 'center',
                                                                    render: (_: any, r: any) => r.isChanged 
                                                                        ? <Tag color="warning" className="font-semibold">CÓ THAY ĐỔI</Tag> 
                                                                        : <Tag color="default">Giữ nguyên</Tag>
                                                                }
                                                            ]}
                                                        />
                                                    )
                                                },
                                                {
                                                    key: 'SUB_XML2',
                                                    label: `2. Chi tiết Thuốc (${diffResult.xml2Diff?.length || 0})`,
                                                    children: (
                                                        <Table
                                                            size="small"
                                                            rowKey={(r: any, idx?: number) => `${r.maThuoc}_${idx}`}
                                                            dataSource={diffResult.xml2Diff || []}
                                                            pagination={{ pageSize: 10 }}
                                                            rowClassName={(r: any) => {
                                                                if (r.type === 'ADDED') return 'bg-emerald-50/70';
                                                                if (r.type === 'REMOVED') return 'bg-red-50/70';
                                                                if (r.type === 'MODIFIED') return 'bg-amber-50/70';
                                                                return '';
                                                            }}
                                                            columns={[
                                                                { 
                                                                    title: 'Biến động', 
                                                                    dataIndex: 'type', 
                                                                    width: 120,
                                                                    align: 'center',
                                                                    render: (t: any) => {
                                                                        if (t === 'ADDED') return <Tag color="success" className="font-bold">+ THÊM MỚI</Tag>;
                                                                        if (t === 'REMOVED') return <Tag color="error" className="font-bold">- BỊ XÓA</Tag>;
                                                                        if (t === 'MODIFIED') return <Tag color="warning" className="font-bold">~ SỬA ĐỔI</Tag>;
                                                                        return <Tag>Không đổi</Tag>;
                                                                    }
                                                                },
                                                                { title: 'Mã thuốc', dataIndex: 'maThuoc', width: 110, render: (v: any) => <span className="font-mono font-medium">{v}</span> },
                                                                { title: 'Tên thuốc', dataIndex: 'tenThuoc', render: (v: any) => <b>{v}</b> },
                                                                { title: 'ĐVT', dataIndex: 'donViTinh', width: 70 },
                                                                { 
                                                                    title: 'Đơn giá', 
                                                                    dataIndex: 'donGia', 
                                                                    align: 'right',
                                                                    render: (v: any) => Number(v || 0).toLocaleString('vi-VN') + ' đ' 
                                                                },
                                                                { 
                                                                    title: 'Số lượng Trước', 
                                                                    dataIndex: 'preSoLuong', 
                                                                    align: 'right',
                                                                    render: (v: any) => <span className="text-slate-500">{v}</span>
                                                                },
                                                                { 
                                                                    title: 'Số lượng Sau', 
                                                                    dataIndex: 'postSoLuong', 
                                                                    align: 'right',
                                                                    render: (v: any, r: any) => (
                                                                        <span className={r.diffSoLuong !== 0 ? 'font-bold text-blue-700' : ''}>{v}</span>
                                                                    )
                                                                },
                                                                { 
                                                                    title: 'Chênh lệch Tiền', 
                                                                    dataIndex: 'diffThanhTien', 
                                                                    align: 'right',
                                                                    render: (v: any) => (
                                                                        <span className={v > 0 ? 'text-red-600 font-bold' : v < 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                                                                            {v > 0 ? `+${Number(v).toLocaleString('vi-VN')}` : Number(v).toLocaleString('vi-VN')} đ
                                                                        </span>
                                                                    )
                                                                }
                                                            ]}
                                                        />
                                                    )
                                                },
                                                {
                                                    key: 'SUB_XML3',
                                                    label: `3. Chi tiết DVKT & Vật tư (${diffResult.xml3Diff?.length || 0})`,
                                                    children: (
                                                        <Table
                                                            size="small"
                                                            rowKey={(r: any, idx?: number) => `${r.maDichVu}_${idx}`}
                                                            dataSource={diffResult.xml3Diff || []}
                                                            pagination={{ pageSize: 10 }}
                                                            rowClassName={(r: any) => {
                                                                if (r.type === 'ADDED') return 'bg-emerald-50/70';
                                                                if (r.type === 'REMOVED') return 'bg-red-50/70';
                                                                if (r.type === 'MODIFIED') return 'bg-amber-50/70';
                                                                return '';
                                                            }}
                                                            columns={[
                                                                { 
                                                                    title: 'Biến động', 
                                                                    dataIndex: 'type', 
                                                                    width: 120,
                                                                    align: 'center',
                                                                    render: (t: any) => {
                                                                        if (t === 'ADDED') return <Tag color="success" className="font-bold">+ THÊM MỚI</Tag>;
                                                                        if (t === 'REMOVED') return <Tag color="error" className="font-bold">- BỊ XÓA</Tag>;
                                                                        if (t === 'MODIFIED') return <Tag color="warning" className="font-bold">~ SỬA ĐỔI</Tag>;
                                                                        return <Tag>Không đổi</Tag>;
                                                                    }
                                                                },
                                                                { title: 'Mã DV/VT', dataIndex: 'maDichVu', width: 120, render: (v: any) => <span className="font-mono font-medium">{v}</span> },
                                                                { title: 'Tên dịch vụ / Vật tư', dataIndex: 'tenDichVu', render: (v: any) => <b>{v}</b> },
                                                                { title: 'Khoa CĐ', dataIndex: 'maKhoa', width: 90 },
                                                                { 
                                                                    title: 'Đơn giá', 
                                                                    dataIndex: 'donGia', 
                                                                    align: 'right',
                                                                    render: (v: any) => Number(v || 0).toLocaleString('vi-VN') + ' đ' 
                                                                },
                                                                { 
                                                                    title: 'Số lượng Trước', 
                                                                    dataIndex: 'preSoLuong', 
                                                                    align: 'right',
                                                                    render: (v: any) => <span className="text-slate-500">{v}</span>
                                                                },
                                                                { 
                                                                    title: 'Số lượng Sau', 
                                                                    dataIndex: 'postSoLuong', 
                                                                    align: 'right',
                                                                    render: (v: any, r: any) => (
                                                                        <span className={r.diffSoLuong !== 0 ? 'font-bold text-blue-700' : ''}>{v}</span>
                                                                    )
                                                                },
                                                                { 
                                                                    title: 'Chênh lệch Tiền', 
                                                                    dataIndex: 'diffThanhTien', 
                                                                    align: 'right',
                                                                    render: (v: any) => (
                                                                        <span className={v > 0 ? 'text-red-600 font-bold' : v < 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                                                                            {v > 0 ? `+${Number(v).toLocaleString('vi-VN')}` : Number(v).toLocaleString('vi-VN')} đ
                                                                        </span>
                                                                    )
                                                                }
                                                            ]}
                                                        />
                                                    )
                                                }
                                            ]}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    },
                    {
                        key: 'HISTORY',
                        label: (
                            <span className="flex items-center gap-2 font-medium px-2 py-1">
                                <HistoryOutlined className="text-purple-500" />
                                3. Sổ theo dõi Bệnh án sửa ({historyTotal})
                            </span>
                        ),
                        children: (
                            <div className="space-y-4 pt-2">
                                <Card className="shadow-xs rounded-xl border-slate-200">
                                    {/* Thanh bộ lọc */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                            <Input 
                                                placeholder="Tìm Mã LK, Mã BN, Họ tên..." 
                                                value={historySearch}
                                                onChange={(e) => setHistorySearch(e.target.value)}
                                                onPressEnter={() => { setHistoryPage(1); loadHistory(1, historySearch, historyDept); }}
                                                className="w-64"
                                                allowClear
                                            />
                                            <Select
                                                placeholder="Lọc theo Khoa"
                                                value={historyDept}
                                                onChange={(v) => { setHistoryDept(v); setHistoryPage(1); loadHistory(1, historySearch, v); }}
                                                className="w-48"
                                            >
                                                <Select.Option value="ALL">-- Tất cả các khoa --</Select.Option>
                                                {departments.map(d => (
                                                    <Select.Option key={d.ma_khoa} value={d.ma_khoa}>
                                                        {d.ma_khoa} - {d.ten_khoa}
                                                    </Select.Option>
                                                ))}
                                            </Select>
                                            <Button 
                                                icon={<SearchOutlined />} 
                                                onClick={() => { setHistoryPage(1); loadHistory(1, historySearch, historyDept); }}
                                            >
                                                Tìm kiếm
                                            </Button>
                                        </div>

                                        <Button 
                                            icon={<ReloadOutlined />} 
                                            onClick={() => loadHistory(historyPage, historySearch, historyDept)}
                                            loading={historyLoading}
                                        >
                                            Làm mới
                                        </Button>
                                    </div>

                                    {/* Bảng danh sách sổ theo dõi */}
                                    <Table 
                                        size="small"
                                        rowKey="id"
                                        dataSource={historyList}
                                        loading={historyLoading}
                                        className="mt-3"
                                        pagination={{
                                            current: historyPage,
                                            pageSize: 15,
                                            total: historyTotal,
                                            onChange: (p) => { setHistoryPage(p); loadHistory(p, historySearch, historyDept); }
                                        }}
                                        columns={[
                                            { title: 'STT', width: 50, render: (_, __, idx) => (historyPage - 1) * 15 + idx + 1, align: 'center' },
                                            { 
                                                title: 'Mã Liên Kết', 
                                                dataIndex: 'MA_LK', 
                                                render: (v) => <span className="font-mono font-bold text-blue-700">{v}</span> 
                                            },
                                            { title: 'Mã BN', dataIndex: 'MA_BN', width: 90 },
                                            { title: 'Họ tên', dataIndex: 'HO_TEN', render: (v) => <b>{v}</b> },
                                            { title: 'Khoa xin sửa', dataIndex: 'editDept', width: 100, render: (v, r) => v || r.MA_KHOA },
                                            { 
                                                title: 'Ngày ĐNTT Cổng', 
                                                dataIndex: 'ngayDeNghiTT', 
                                                width: 120,
                                                render: (v) => <Tag color="error" className="font-semibold">{v || 'Đã ĐNTT'}</Tag>
                                            },
                                            { title: 'Lý do xin sửa', dataIndex: 'editReason', ellipsis: true },
                                            { 
                                                title: 'Người lưu', 
                                                dataIndex: 'preEditSavedBy', 
                                                width: 120,
                                                render: (v) => <span className="text-xs text-slate-600 font-medium">{v || 'Quản trị'}</span>
                                            },
                                            { 
                                                title: 'Thời gian lưu', 
                                                dataIndex: 'createdAt', 
                                                width: 140,
                                                render: (v) => new Date(v).toLocaleString('vi-VN')
                                            },
                                            { 
                                                title: 'Trạng thái bản mới', 
                                                align: 'center',
                                                width: 140,
                                                render: (_, r) => r.hasPostEditVersion 
                                                    ? <Tag color="success">Đã có bản sửa mới</Tag> 
                                                    : <Tag color="warning">Đang chờ sửa lại</Tag>
                                            },
                                            {
                                                title: 'Thao tác',
                                                width: 110,
                                                align: 'center',
                                                render: (_, r) => (
                                                    <Button 
                                                        size="small" 
                                                        icon={<SwapOutlined />}
                                                        type="primary"
                                                        ghost
                                                        onClick={() => {
                                                            setActiveTab('DIFF');
                                                            setDiffMaLk(r.MA_LK);
                                                            // Gọi sau khi render xong để đảm bảo component đã mount
                                                            setTimeout(() => {
                                                                runComparison(r.MA_LK);
                                                            }, 100);
                                                        }}
                                                    >
                                                        Đối chiếu
                                                    </Button>
                                                )
                                            }
                                        ]}
                                    />
                                </Card>
                            </div>
                        )
                    }
                ]}
            />

            {/* MODAL XÁC NHẬN LƯU BẢN TRƯỚC SỬA */}
            <Modal
                title={
                    <span className="flex items-center gap-2 text-amber-700">
                        <SaveOutlined />
                        Xác nhận Lưu Bản XML Gốc Trước Sửa
                    </span>
                }
                open={isSaveModalOpen}
                destroyOnHidden
                onCancel={() => setIsSaveModalOpen(false)}
                onOk={handleConfirmSavePreEdit}
                confirmLoading={isSaving}
                okText="Xác nhận Lưu Snapshot"
                cancelText="Hủy bỏ"
                okButtonProps={{ className: 'bg-amber-600 hover:bg-amber-500 font-semibold' }}
            >
                <div className="space-y-3 pt-2">
                    <Alert 
                        type="warning"
                        showIcon
                        title={<b>Chuẩn bị lưu {recordsToSave.length} hồ sơ đã chọn làm bản XML gốc trước sửa</b>}
                        description={
                            <div className="text-xs space-y-1 mt-1">
                                <div>• <b>{selectedDaDeNghiCount}</b> hồ sơ <b>ĐÃ ĐỀ NGHỊ THANH TOÁN</b> BHYT (Khuyến nghị bảo toàn).</div>
                                {selectedChuaDeNghiCount > 0 && (
                                    <div className="text-amber-800">• <b>{selectedChuaDeNghiCount}</b> hồ sơ <b>Chưa đề nghị TT</b> (Được lưu chủ động theo yêu cầu của bạn).</div>
                                )}
                                <div className="text-slate-600 mt-1">Hệ thống sẽ lưu trọn vẹn toàn bộ dữ liệu gốc (XML1 - XML15) vào CSDL làm bằng chứng đối soát trước khi mở khóa HIS.</div>
                            </div>
                        }
                    />

                    <Form form={saveForm} layout="vertical" className="mt-3">
                        <Form.Item 
                            name="editDept" 
                            label={<span className="font-semibold text-slate-700">Khoa phòng yêu cầu sửa</span>}
                            rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập khoa yêu cầu' }]}
                        >
                            <Select placeholder="Chọn khoa phòng..." showSearch optionFilterProp="label">
                                {departments.map(d => (
                                    <Select.Option key={d.ma_khoa} value={d.ma_khoa} label={`${d.ma_khoa} - ${d.ten_khoa}`}>
                                        {d.ma_khoa} - {d.ten_khoa}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item 
                            name="editReason" 
                            label={<span className="font-semibold text-slate-700">Lý do xin sửa bệnh án</span>}
                            rules={[{ required: true, message: 'Vui lòng nhập lý do sửa bệnh án' }]}
                        >
                            <Input.TextArea 
                                rows={3} 
                                placeholder="Ví dụ: Bổ sung chẩn đoán kèm theo, điều chỉnh số lượng thuốc do khoa kê nhầm..." 
                            />
                        </Form.Item>
                    </Form>
                </div>
            </Modal>
        </div>
    );
}
