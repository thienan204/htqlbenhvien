'use client';

import { useState, useEffect } from 'react';
import { ValidationRule, DEFAULT_RULES, ValidationEngine } from '@/lib/validation';
import { HosoRecord } from '@/lib/xml';
import { Modal, Form, Input, Select, Switch, Button, Popconfirm, Table, Badge, Card, Row, Col, Space, Alert, Tag, Tooltip, message, AutoComplete, Checkbox, InputNumber, Collapse } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ToolOutlined, CheckCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { TextArea } = Input;

interface RuleSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    rules: ValidationRule[];
    onSave: (rules: ValidationRule[]) => void;
    sampleRecords?: HosoRecord[];
    isModal?: boolean;
}

const XML_TYPE_LABELS: Record<string, string> = {
    'XML1': 'XML1_TONGHOP',
    'XML2': 'XML2_THUOC',
    'XML3': 'XML3_DVKT_VT',
    'XML4': 'XML4_DICHVULS',
    'XML5': 'XML5_DIENBIENLS',
    'XML6': 'XML6_HIV',
    'XML7': 'XML7_GRV',
    'XML8': 'XML8_TOMTATBA',
    'XML9': 'XML9_GCHUNGSINH',
    'XML10': 'XML10_DUONGTHAI',
    'XML11': 'XML11_NGHIBHXH',
    'XML12': 'XML12_GDYK',
    'XML13': 'XML13_GCV',
    'XML14': 'XML14_HENKHAM',
    'XML15': 'XML15_LAO'
};

const XML_FIELDS: Record<string, string[]> = {
    'XML1': [
        'MA_LK', 'MA_BN', 'HO_TEN', 'NGAY_SINH', 'GIOI_TINH', 'DIA_CHI', 'MA_THE', 'MA_THE_BHYT', 'MA_DKBD',
        'GT_THE_TU', 'GT_THE_DEN', 'MIEN_CUNG_CT', 'TEN_BENH', 'MA_BENH', 'MA_BENHKHAC',
        'MA_LYDO_VVIEN', 'MA_NOI_CHUYEN', 'MA_TAI_NAN', 'NGAY_VAO', 'NGAY_RA', 'SO_NGAY_DTRI',
        'KET_QUA_DTRI', 'TINH_TRANG_RV', 'NGAY_TTOAN', 'T_TONGCHI', 'T_XETNGHIEM', 'T_CDHA',
        'T_THUOC', 'T_MAU', 'T_PTTT', 'T_VTYT', 'T_DVKT_TYLE', 'T_THUOC_TYLE', 'T_VTYT_TYLE',
        'T_KHAM', 'T_GIUONG', 'T_VCHUYEN', 'T_BNTT', 'T_BHTT', 'T_NGUONKHAC', 'T_NGOAIDS',
        'NAM_QT', 'THANG_QT', 'MA_LOAI_KCB', 'MA_KHOA', 'MA_CSKCB', 'MA_KHUVUC', 'MA_PTTT_QT', 'CAN_NANG',
        'MA_TTDV'
    ],
    'XML2': [
        'MA_LK', 'STT', 'MA_THUOC', 'MA_NHOM', 'TEN_THUOC', 'DON_VI_TINH', 'HAM_LUONG',
        'DUONG_DUNG', 'LIEU_DUNG', 'SO_DANG_KY', 'TT_THAU', 'PHAM_VI', 'TY_LE_TT', 'SO_LUONG',
        'DON_GIA', 'THANH_TIEN', 'MUC_HUONG', 'T_NGUONKHAC', 'T_BNTT', 'T_BHTT', 'T_BNCCT',
        'T_NGOAIDS', 'MA_KHOA', 'MA_BAC_SI', 'MA_BENH', 'NGAY_YL', 'NGAY_KQ', 'MA_PTTT'
    ],
    'XML3': [
        'MA_LK', 'STT', 'MA_DICH_VU', 'MA_VAT_TU', 'MA_NHOM', 'GOI_VTYT', 'TEN_VAT_TU', 'TEN_DICH_VU',
        'DON_VI_TINH', 'PHAM_VI', 'SO_LUONG', 'DON_GIA', 'DON_GIA_BH', 'TT_THAU', 'TY_LE_TT', 'TYLE_TT_BH', 'TYLE_TT_DV', 'THANH_TIEN',
        'THANH_TIEN_BH', 'THANH_TIEN_BV', 'T_TRANTT',
        'MUC_HUONG', 'T_NGUONKHAC', 'T_BNTT', 'T_BHTT', 'T_BNCCT', 'T_NGOAIDS', 'MA_KHOA', 'MA_GIUONG',
        'MA_BAC_SI', 'MA_BENH', 'NGAY_YL', 'NGAY_TH_YL', 'NGAY_KQ', 'MA_PTTT', 'MA_MAY', 'NGUOI_THUC_HIEN'
    ],
    'XML4': [
        'MA_LK', 'STT', 'MA_DICH_VU', 'MA_CHI_SO', 'TEN_CHI_SO', 'GIA_TRI', 'DON_VI_DO',
        'MO_TA', 'KET_LUAN', 'NGAY_KQ', 'MA_BS_DOC_KQ', 'NGUOI_THUC_HIEN'
    ],
    'XML5': [
        'MA_LK', 'STT', 'DIEN_BIEN', 'HOI_CHAN', 'PHAU_THUAT', 'NGAY_YL', 'NGUOI_THUC_HIEN'
    ],
    'XML6': [],
    'XML7': [
        'MA_LK', 'SO_LUU_TRU', 'MA_YTE', 'MA_KHOA', 'NGAY_VAO', 'NGAY_RA', 'MA_BENH',
        'CHAN_DOAN', 'PP_DIEU_TRI', 'LOI_DAN_BS', 'GHI_CHU', 'MA_TTDV', 'NGAY_CT', 'MA_THE_TAM',
        'HO_TEN_CHA', 'HO_TEN_ME', 'NGUOI_GIAM_HO', 'MA_BS'
    ],
    'XML8': [
        'MA_LK', 'MA_LOAI_KCB', 'HO_TEN_CHA', 'HO_TEN_ME', 'NGUOI_GIAM_HO',
        'DON_VI', 'NGAY_VAO', 'NGAY_RA', 'CHAN_DOAN_VAO', 'CHAN_DOAN_RV',
        'QT_BENHLY', 'TOMTAT_KQ', 'PP_DIEUTRI', 'NGAY_SINHCON', 'NGAY_CONCHET',
        'SO_CONCHET', 'KET_QUA_DTRI', 'GHI_CHU', 'MA_TTDV', 'NGAY_CT', 'MA_THE_TAM', 'DU_PHONG'
    ],
    'XML9': [
        'MA_LK', 'MA_BHXH_NND', 'MA_THE_NND', 'HO_TEN_NND', 'NGAYSINH_NND', 'MA_DANTOC_NND',
        'SO_CCCD_NND', 'NGAYCAP_CCCD_NND', 'NOICAP_CCCD_NND', 'NOI_CU_TRU_NND', 'MA_QUOCTICH',
        'MATINH_CU_TRU', 'MAXA_CU_TRU', 'HO_TEN_CHA', 'MA_THE_TAM', 'HO_TEN_CON', 'GIOI_TINH_CON',
        'SO_CON', 'LAN_SINH', 'SO_CON_SONG', 'CAN_NANG_CON', 'NGAY_SINH_CON', 'NOI_SINH_CON',
        'TINH_TRANG_CON', 'SINHCON_PHAUTHUAT', 'SINHCON_DUOI32TUAN', 'GHI_CHU', 'NGUOI_DO_DE',
        'NGAY_CT', 'SO', 'QUYEN_SO', 'NGUOI_GHI_PHIEU'
    ],
    'XML10': [],
    'XML11': [
        'MA_LK', 'S0_SERI', 'SO_CT', 'NGAY_CT', 'MA_NHOM', 'MA_DV', 'THANH_TIEN',
        'THUE_SUAT', 'TIEN_THUE', 'TONG_TIEN', 'TY_LE', 'MA_TIEU_CHI'
    ],
    'XML12': [],
    'XML13': ['MA_LK', 'SO_HO_SO', 'MA_TTHC', 'MA_DOI_TUONG_KCB', 'NGAY_KY', 'NGUOI_KY'],
    'XML14': ['MA_LK', 'SO_GIAY_HEN', 'NGAY_HEN'],
    'XML15': [],
};

const XML_TYPES = Array.from({ length: 15 }, (_, i) => `XML${i + 1}`);

export default function RuleSettings({ isOpen, onClose, rules: initialRules, onSave, sampleRecords, isModal = true }: RuleSettingsProps) {
    const [rules, setRules] = useState<ValidationRule[]>(initialRules.length > 0 ? initialRules : DEFAULT_RULES);
    const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedXmlType, setSelectedXmlType] = useState<string>('ALL');
    const [testResult, setTestResult] = useState<{ matched: number, total: number, errors: string[] } | null>(null);
    const [form] = Form.useForm();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isGuideModalVisible, setIsGuideModalVisible] = useState(false);

    useEffect(() => {
        setRules(initialRules);
    }, [initialRules]);

    useEffect(() => {
        if (isEditModalOpen && editingRule) {
            form.resetFields(); // Reset to default/initial values first
            form.setFieldsValue(editingRule);
            setTestResult(null);
        }
    }, [editingRule, form, isEditModalOpen]);

    const handleTestLogic = () => {
        const currentRule = form.getFieldsValue(true) as ValidationRule; // Get current form values
        // We need to merge with existing ID if editing, or mock one if new, but primarily we need the code and xmlType

        if (!sampleRecords || sampleRecords.length === 0) {
            message.warning('Không có dữ liệu mẫu để kiểm tra (cần tải file XML trước).');
            return;
        }

        const validator = new ValidationEngine([]);
        let matchCount = 0;
        const errors: string[] = [];

        sampleRecords.forEach((record, idx) => {
            // Create a temporary rule object for testing
            const tempRule: ValidationRule = {
                ...currentRule,
                id: 'temp-test',
                active: true // Always treat as active for testing
            };

            const result = validator.evaluateRule(tempRule, record);
            if (result.error) {
                if (errors.length < 5) errors.push(`Hồ sơ #${idx + 1}: ${result.error}`);
                else if (errors.length === 5) errors.push('...');
            } else if (result.isMatch) {
                matchCount++;
            }
        });

        setTestResult({ matched: matchCount, total: sampleRecords.length, errors });
        if (errors.length > 0) message.error('Có lỗi khi thực thi logic!');
        else message.success(`Kiểm tra hoàn tất: khớp ${matchCount}/${sampleRecords.length} hồ sơ.`);
    };

    const handleSaveEdit = () => {
        form.validateFields().then(values => {
            console.log('Saving Rule Values:', values); // DEBUG
            const isExisting = rules.some(r => r.id === values.id);
            let newRules;

            const ruleData = { ...values };
            // Ensure ID is set if it was a new rule (though form usually has it from initialValues)
            if (!ruleData.id) ruleData.id = Date.now().toString();

            if (isExisting) {
                newRules = rules.map(r => r.id === ruleData.id ? { ...r, ...ruleData } : r);
            } else {
                newRules = [...rules, { ...ruleData, createdAt: new Date() } as ValidationRule];
            }

            setRules(newRules);

            console.log('Calling onSave/API with:', newRules); // DEBUG

            // Wrap in promise to handle async result if present
            Promise.resolve(onSave(newRules))
                .then(() => {
                    setIsEditModalOpen(false);
                    setEditingRule(null);
                    message.success('Đã lưu quy tắc thành công!');
                })
                .catch(err => {
                    console.error('Save error:', err);
                    message.error(`Lỗi khi lưu vào CSDL: ${err.message}`);
                });

        }).catch(info => {
            console.log('Validate Failed:', info);
        });
    };

    const handleAddNew = () => {
        const newRule: ValidationRule = {
            id: Date.now().toString(),
            active: true,
            type: 'Xuất toán',
            xmlType: selectedXmlType !== 'ALL' ? selectedXmlType : 'XML1',
            name: 'Quy tắc mới',
            code: '',
            mathExpression: '',
            errorMessage: '',
            description: '',
            field: '',
            checkNotNull: false,
            conditionField: '',
            conditionValue: '',
            conditionMaDichVuValue: '',
            isGroupCount: false,
            minCountVal: null,
            maxCountVal: null
        };
        setEditingRule(newRule);
        setIsEditModalOpen(true);
    };

    const handleDelete = (id: string) => {
        const newRules = rules.filter(r => r.id !== id);
        setRules(newRules);
        onSave(newRules);
        message.success('Đã xóa quy tắc.');
    };

    const handleToggleActive = (id: string, checked: boolean) => {
        const newRules = rules.map(r => r.id === id ? { ...r, active: checked } : r);
        setRules(newRules);
        onSave(newRules);
        message.info(`Đã ${checked ? 'bật' : 'tắt'} quy tắc.`);
    };

    const filteredRules = rules.filter(r => {
        const name = r.name || '';
        const xmlType = r.xmlType || '';
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            xmlType.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = selectedXmlType === 'ALL' || xmlType === selectedXmlType;
        return matchesSearch && matchesType;
    });

    const columns: ColumnsType<ValidationRule> = [
        {
            title: 'STT',
            key: 'stt',
            width: 50,
            align: 'center',
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'active',
            key: 'active',
            width: 100,
            render: (active, record) => (
                <Switch
                    size="small"
                    checked={active}
                    onChange={(checked) => handleToggleActive(record.id, checked)}
                />
            )
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (type) => (
                <Tag color={type === 'Xuất toán' ? 'red' : 'orange'}>
                    {type === 'Xuất toán' ? 'Xuất toán' : 'Cảnh báo'}
                </Tag>
            )
        },
        {
            title: 'File XML',
            dataIndex: 'xmlType',
            key: 'xmlType',
            width: 80,
            render: (text) => <Tag color="blue">{XML_TYPE_LABELS[text as string] || text}</Tag>
        },
        {
            title: 'Tên quy tắc',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <div>
                    <div className="font-bold text-slate-700">{text}</div>
                    <div className="text-xs text-slate-500 font-mono">{record.field}</div>
                </div>
            )
        },
        {
            title: 'Thông báo lỗi',
            dataIndex: 'errorMessage',
            key: 'errorMessage',
            render: (text) => <span className="text-red-500">{text}</span>
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 100,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingRule(record);
                            setIsEditModalOpen(true);
                        }}
                    />
                    <Popconfirm
                        title="Xóa quy tắc"
                        description="Bạn có chắc chắn muốn xóa quy tắc này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Có"
                        cancelText="Không"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // Sidebar Content
    const Sidebar = (
        <div className="w-64 border-r h-full bg-gray-50 p-4 overflow-y-auto">
            <Button type="primary" icon={<PlusOutlined />} block onClick={handleAddNew} className="mb-4">
                Thêm quy tắc mới
            </Button>
            <div className="space-y-1">
                <div
                    className={`p-2 rounded cursor-pointer ${selectedXmlType === 'ALL' ? 'bg-blue-100 text-blue-600 font-semibold' : 'hover:bg-gray-100'}`}
                    onClick={() => setSelectedXmlType('ALL')}
                >
                    All Types <Badge count={rules.length} style={{ backgroundColor: '#52c41a' }} offset={[10, 0]} />
                </div>
                {XML_TYPES.map(type => (
                    <div
                        key={type}
                        className={`p-2 rounded cursor-pointer flex justify-between ${selectedXmlType === type ? 'bg-blue-100 text-blue-600 font-semibold' : 'hover:bg-gray-100'}`}
                        onClick={() => setSelectedXmlType(type)}
                    >
                        <span>{XML_TYPE_LABELS[type] || type}</span>
                        <Badge
                            count={rules.filter(r => r.xmlType === type).length}
                            style={{ backgroundColor: selectedXmlType === type ? '#1890ff' : '#d9d9d9' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    const MainContent = (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b bg-white flex justify-between items-center">
                <h2 className="text-lg font-bold m-0 whitespace-nowrap mr-3">Danh sách quy tắc {selectedXmlType !== 'ALL' ? `(${XML_TYPE_LABELS[selectedXmlType] || selectedXmlType})` : ''}</h2>
                <Input
                    placeholder="Tìm kiếm quy tắc..."
                    prefix={<SearchOutlined />}
                    className="w-64"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex-1 overflow-auto p-4">
                <Table
                    columns={columns}
                    dataSource={filteredRules}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                />
            </div>
        </div>
    );

    const modalContent = (
        <div className="flex h-[70vh]">
            {Sidebar}
            {MainContent}
        </div>
    );

    const renderGuideModal = () => (
        <Modal
            title={<div className="font-bold text-lg text-blue-700">📖 Hướng Dẫn Cấu Hình Quy Tắc Đa Hồ Sơ (Cross-Record)</div>}
            open={isGuideModalVisible}
            onCancel={() => setIsGuideModalVisible(false)}
            footer={[
                <Button key="close" type="primary" onClick={() => setIsGuideModalVisible(false)}>
                    Đã hiểu
                </Button>
            ]}
            width={700}
        >
            <div className="space-y-4 text-sm text-slate-700 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                    <h3 className="font-bold text-slate-800 text-base mb-1">1. Mục đích của CHECK_DUPLICATE_DIFF</h3>
                    <p>Trong đa số các trường hợp, hệ thống kiểm tra từng hồ sơ một cách độc lập. Tuy nhiên, có một số quy tắc cần phải quét toàn bộ các hồ sơ đang được nạp để tìm ra sự bất thường.</p>
                    <p className="mt-1">Ví dụ điển hình: Hành vi "Mượn thẻ BHYT". Bệnh nhân sử dụng cùng một thẻ BHYT nhưng lại đi khám dưới 2 mã bệnh nhân khác nhau trong cùng một kỳ báo cáo.</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <h3 className="font-bold text-blue-800 text-base mb-1">2. Cú Pháp Sử Dụng</h3>
                    <p>Tại ô Biểu thức Logic, gõ:</p>
                    <code className="block bg-white p-2 mt-2 rounded border border-blue-200 text-red-600 font-bold overflow-x-auto">CHECK_DUPLICATE_DIFF('BẢNG_1.TRƯỜNG_1', Giá_Trị_1, 'BẢNG_2.TRƯỜNG_2', Giá_Trị_2)</code>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><b>'BẢNG_1.TRƯỜNG_1'</b>: Tên Bảng và Trường cần quét để tìm điểm <b>TRÙNG LẶP</b> (Cần nằm trong nháy đơn).</li>
                        <li><b>Giá_Trị_1</b>: Dữ liệu của hồ sơ hiện tại. (Biến động, KHÔNG có nháy đơn).</li>
                        <li><b>'BẢNG_2.TRƯỜNG_2'</b>: Tên Bảng và Trường đối chiếu sự <b>KHÁC BIỆT</b>.</li>
                        <li><b>Giá_Trị_2</b>: Dữ liệu của hồ sơ hiện tại.</li>
                    </ul>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-base mb-1">3. Các Ví Dụ Thực Tế</h3>
                    
                    <div className="mb-3">
                        <div className="font-semibold text-green-700">Ví dụ 1: Trùng Thẻ BHYT nhưng Khác Mã Bệnh Nhân</div>
                        <ul className="list-disc pl-5">
                            <li>Quy tắc: <code>XML1_TONGHOP</code></li>
                            <li>Logic: <code className="bg-slate-100 px-1 rounded text-red-600">CHECK_DUPLICATE_DIFF('XML1.MA_THE', MA_THE, 'XML1.MA_BN', MA_BN)</code></li>
                        </ul>
                    </div>

                    <div className="mb-3">
                        <div className="font-semibold text-green-700">Ví dụ 2: Trùng Căn Cước Công Dân (CCCD), Khác Thẻ BHYT</div>
                        <ul className="list-disc pl-5">
                            <li>Logic: <code className="bg-slate-100 px-1 rounded text-red-600">CHECK_DUPLICATE_DIFF('XML1.SO_CCCD', SO_CCCD, 'XML1.MA_THE', MA_THE)</code></li>
                        </ul>
                    </div>
                </div>
                <Alert type="warning" title="Mẹo" description="Từ khoá XML1 đại diện cho dữ liệu TỔNG HỢP. Để truy xuất trường thông tin biên bản hãy dùng tiền tố XML1. Hành động quét này kiểm tra trên toàn bộ dữ liệu mà bạn đang nạp vào màn hình. Việc này cho phép phát hiện tức thời hồ sơ bị lỗi khi nạp số lượng lớn." showIcon />
            </div>
        </Modal>
    );

    const logicCheatSheetItems = [
        {
            key: '1',
            label: <span className="font-bold text-yellow-800">💡 Xem Hướng dẫn & Biểu thức Mẫu (Cheatsheet)</span>,
            children: (
                <div className="text-xs space-y-3">
                    <div>
                        <div className="font-bold text-blue-700">1. Kiểm tra danh mục hệ thống (EXISTS_IN)</div>
                        <div className="text-gray-600 mb-1">Dùng để đối chiếu MÃ của File XML với danh sách trong Database hệ thống.</div>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><code className="bg-white px-1 border rounded text-red-600">!EXISTS_IN('Staff.ma_bac_si', MA_BAC_SI)</code> : Báo lỗi nếu Mã Bác sĩ không có trên hệ thống.</li>
                            <li><code className="bg-white px-1 border rounded text-red-600">!EXISTS_IN('Department.ma_khoa', MA_KHOA)</code> : Báo lỗi nếu Mã Khoa không có trên hệ thống.</li>
                            <li><span className="text-gray-500 italic">Mẹo: Bạn có thể đổi 'Staff.ma_bac_si' bằng bất kỳ Tên_Bảng.Tên_Cột nào có trong Database sau này. Nó sẽ tự động hiểu!</span></li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-bold text-blue-700">2. So sánh Ngày Tháng (Date)</div>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><code className="bg-white px-1 border rounded text-red-600">NGAY_RA {"<"} NGAY_VAO</code> : Báo lỗi nếu Ngày ra viện nhỏ hơn Ngày vào viện.</li>
                            <li><code className="bg-white px-1 border rounded text-red-600">NGAY_KQ {"<"} root.XML1.NGAY_VAO</code> : Khi viết luật cho bảng phụ (như XML3), cần truy cập chéo dữ liệu bảng gốc XML1 bằng chữ <code className="bg-white px-1 border rounded">root.XML1.</code> đằng trước.</li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-bold text-blue-700">3. Rỗng / Bắt buộc nhập (Null)</div>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><code className="bg-white px-1 border rounded text-red-600">MA_BENH == null</code> : Không có dữ liệu, báo lỗi.</li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-bold text-blue-700">4. Phép toán Logic ghép</div>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Dùng <code className="font-bold">&&</code> cho "VÀ": <code className="bg-white px-1 border rounded">A {">"} 0 && B {">"} 0</code></li>
                            <li>Dùng <code className="font-bold">||</code> cho "HOẶC": <code className="bg-white px-1 border rounded">A == null || B == null</code></li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-bold text-blue-700 flex items-center justify-between">
                            <span>5. Đối chiếu nâng cao Đa Hồ Sơ (Cross-Record)</span>
                            <Button size="small" type="primary" ghost onClick={() => setIsGuideModalVisible(true)}>📖 Mở sổ tay hướng dẫn</Button>
                        </div>
                        <ul className="list-disc pl-4 space-y-1 mt-2">
                            <li><code className="bg-white px-1 border rounded text-red-600">CHECK_DUPLICATE_DIFF('BẢNG.TRƯỜNG1', GiáTrị1, 'BẢNG.TRƯỜNG2', GiáTrị2)</code> : Dùng để tìm xem có hồ sơ nào khác TRÙNG Trường 1 nhưng lại KHÁC Trường 2 không.</li>
                            <li><span className="text-gray-500 italic">Ví dụ (Trùng Mã Thẻ BHYT nhưng Khác Mã Bệnh nhân):</span> <code className="bg-white px-1 border rounded text-red-600">CHECK_DUPLICATE_DIFF('XML1.MA_THE', MA_THE, 'XML1.MA_BN', MA_BN)</code></li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-bold text-blue-700">6. Kiểm tra sai lệch với BẤT KỲ BẢNG NÀO (Động hoàn toàn)</div>
                        <div className="text-gray-600 mb-1">Dùng để so sánh giá trị của hồ sơ hiện tại với cột bất kỳ trong bảng danh mục bất kỳ. Rất mạnh mẽ! Báo lỗi nếu tìm thấy mã nhưng giá trị bị sai lệch.</div>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Cú pháp: <code className="bg-white px-1 border rounded text-red-600">CHECK_MISMATCH('TênBảng.CộtMã:CộtSoSánh', Giá_Trị_Mã_XML, Giá_Trị_So_Sánh_XML)</code></li>
                            <li><span className="text-gray-500 italic">Ví dụ 1 (Giá Mẫu 05):</span> <code className="bg-white px-1 border rounded text-red-600">CHECK_MISMATCH('Mau05Catalog.MA_DICH_VU:DON_GIA', MA_DICH_VU, DON_GIA_BH)</code></li>
                            <li><span className="text-gray-500 italic">Ví dụ 2 (Tên Bác Sĩ):</span> <code className="bg-white px-1 border rounded text-red-600">CHECK_MISMATCH('Staff.ma_bac_si:ten_bac_si', MA_BAC_SI, TEN_BAC_SI)</code></li>
                        </ul>
                    </div>
                    <div className="mt-2">
                        <div className="font-bold text-blue-700">7. Kiểm tra trùng lặp trong cùng một Hồ sơ (Cùng 1 bệnh nhân - MA_BN)</div>
                        <div className="text-gray-600 mb-1">Dùng để kiểm tra xem trong cùng 1 hồ sơ bệnh nhân hiện tại, có 2 dòng/dịch vụ nào có trùng giá trị hay không. Bạn có thể chắp vá thêm nhiều trường để kiểm tra chung! (Gõ vào ô <b>Biểu thức toán học</b>)</div>
                        <ul className="list-disc pl-4 space-y-2 mt-2">
                            <li>
                                <div className="text-gray-800 font-semibold text-[13px]">Kịch bản 1: Chỉ add field cần bám sát kiểm tra trùng lặp vào đây (Các field khác có thể giống hoặc khác nhau thì tuỳ ý, KHÔNG cần add vào đây)</div>
                                <div className="text-gray-500 italic text-xs mb-1">Ví dụ: Chỉ cần trùng Ngày/Giờ thực hiện là báo lỗi (mặc kệ MA_DICH_VU là gì):</div>
                                <code className="bg-white px-1 border rounded text-red-600">CHECK_DUPLICATE_IN_LIST('NGAY_TH_YL', NGAY_TH_YL)</code>
                            </li>
                            <li>
                                <div className="text-gray-800 font-semibold text-[13px]">Kịch bản 2: Vừa trùng Mã Dịch vụ VÀ trùng cả Ngày/Giờ thực hiện</div>
                                <code className="bg-white px-1 border rounded text-red-600">CHECK_DUPLICATE_IN_LIST('MA_DICH_VU', MA_DICH_VU, 'NGAY_TH_YL', NGAY_TH_YL)</code>
                            </li>
                            <li>
                                <div className="text-gray-800 font-semibold text-[13px]">Kịch bản 3: Đổi sang kiểm tra: Trùng Bác sĩ VÀ trùng Ngày/Giờ thực hiện</div>
                                <code className="bg-white px-1 border rounded text-red-600">CHECK_DUPLICATE_IN_LIST('MA_BAC_SI', MA_BAC_SI, 'NGAY_TH_YL', NGAY_TH_YL)</code>
                            </li>
                            <li>
                                <div className="text-gray-800 font-semibold text-[13px]">Kịch bản 4: Check siêu chặt (Trùng 3 tiêu chí: Bác Sĩ + Dịch Vụ + Ngày Giờ)</div>
                                <code className="bg-white px-1 border rounded text-red-600">CHECK_DUPLICATE_IN_LIST('MA_BAC_SI', MA_BAC_SI, 'MA_DICH_VU', MA_DICH_VU, 'NGAY_TH_YL', NGAY_TH_YL)</code>
                            </li>
                        </ul>
                    </div>
                </div>
            )
        }
    ];

    const logicCheatSheet = (
        <>
            <Collapse size="small" bordered={false} className="mb-4 mt-2 bg-yellow-50 border border-yellow-200" items={logicCheatSheetItems} />
            {renderGuideModal()}
        </>
    );

    // If not using Antd Modal as wrapper (e.g. full page), render directly
    // But requirement is Modal replacement.

    if (!isModal) {
        return (
            <div className="h-full flex flex-col bg-white">
                {modalContent}

                {/* Keep the Edit Modal logic available */}
                <Modal
                    title={editingRule?.id === 'new' || !rules.some(r => r.id === editingRule?.id) ? "Thêm quy tắc mới" : "Chỉnh sửa quy tắc"}
                    open={isEditModalOpen}
                    onCancel={() => { setIsEditModalOpen(false); setEditingRule(null); }}
                    onOk={handleSaveEdit}
                    width={1200}
                    okText="Lưu"
                    cancelText="Hủy"
                >
                    <Form
                        form={form}
                        layout="vertical"
                        initialValues={editingRule || {}}
                    >
                        <Form.Item name="id" hidden><Input /></Form.Item>
                        <Form.Item name="createdAt" hidden><Input /></Form.Item>

                        <Row gutter={16}>
                            <Col span={10}>
                                <Card title="Thông tin chung" size="small" variant="borderless" className="bg-gray-50">
                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Form.Item name="active" label="Trạng thái" valuePropName="checked" style={{ marginBottom: 12 }}>
                                                <Switch />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="type" label="Loại vi phạm" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                                                <Select>
                                                    <Option value="Xuất toán">Xuất toán</Option>
                                                    <Option value="Cảnh báo">Cảnh báo</Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Nhập tên quy tắc' }]} style={{ marginBottom: 12 }}>
                                        <Input placeholder="VD: Kiểm tra ngày vào viện" />
                                    </Form.Item>

                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Form.Item name="xmlType" label="File XML" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                                                <Select onChange={() => {
                                                    // Reset field when type changes
                                                    const currentFields = form.getFieldsValue();
                                                    if (currentFields.field && !XML_FIELDS[currentFields.xmlType]?.includes(currentFields.field)) {
                                                        form.setFieldsValue({ field: '' });
                                                    }
                                                }}>
                                                    {XML_TYPES.map(t => <Option key={t} value={t}>{XML_TYPE_LABELS[t] || t}</Option>)}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item shouldUpdate={(prev, curr) => prev.xmlType !== curr.xmlType} style={{ marginBottom: 12 }}>
                                                {() => {
                                                    const type = form.getFieldValue('xmlType') || 'XML1';
                                                    const fields = XML_FIELDS[type] || [];
                                                    return (
                                                        <Form.Item name="field" label="Trường dữ liệu" style={{ marginBottom: 0 }}>
                                                            <AutoComplete
                                                                placeholder="Chọn hoặc gõ tên trường dữ liệu"
                                                                allowClear
                                                                options={fields.map(f => ({ value: f, label: f }))}
                                                                filterOption={(inputValue, option) =>
                                                                    (option?.value as string)?.toUpperCase().includes(inputValue.toUpperCase())
                                                                }
                                                            />
                                                        </Form.Item>
                                                    );
                                                }}
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item name="errorMessage" label="Nội dung báo lỗi" style={{ marginBottom: 12 }}>
                                        <TextArea rows={2} placeholder="Thông báo hiển thị khi vi phạm..." />
                                    </Form.Item>
                                </Card>
                            </Col>

                            <Col span={14}>
                                <Card title="Thiết lập Logic" size="small" variant="borderless" className="bg-blue-50">
                                    <Form.Item
                                        name="code"
                                        label="Biểu thức logic"
                                        help="Ví dụ: NGAY_YL < XML1.NGAY_VAO"
                                        tooltip="Sử dụng mã trường. Dùng root.XML1... để truy cập chéo bảng."
                                        style={{ marginBottom: 0 }}
                                    >
                                        <TextArea rows={4} className="font-mono bg-sky-50" />
                                    </Form.Item>

                                    {logicCheatSheet}

                                    <div className="mb-4 p-3 bg-white rounded border border-blue-100">
                                        <Space orientation="vertical" style={{ width: '100%' }}>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 text-xs font-bold uppercase">Công cụ kiểm tra</span>
                                                <Button size="small" type="dashed" icon={<ToolOutlined />} onClick={handleTestLogic}>Chạy thử Logic</Button>
                                            </div>
                                            {testResult && (
                                                <div className="mt-2 text-xs">
                                                    {testResult.errors.length > 0 ? (
                                                        <div className="text-red-600">
                                                            <CloseCircleOutlined /> Có lỗi:
                                                            <ul className="list-disc pl-4 mt-1">
                                                                {testResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                                            </ul>
                                                        </div>
                                                    ) : (
                                                        <div className="text-green-600">
                                                            <CheckCircleOutlined /> Khớp {testResult.matched}/{testResult.total} hồ sơ mẫu.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Space>
                                    </div>

                                    <Form.Item name="mathExpression" label="Biểu thức toán học (Tùy chọn)" style={{ marginBottom: 12 }}>
                                        <Input placeholder="VD: (A + B) * C" className="font-mono" />
                                    </Form.Item>

                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Form.Item name="conditionField" label="Trường điều kiện" style={{ marginBottom: 12 }}>
                                                <Input placeholder="VD: MA_NHOM" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="conditionValue" label="Giá trị điều kiện" style={{ marginBottom: 12 }}>
                                                <Input placeholder="VD: 1, 2, 3" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Form.Item name="conditionMaDichVu" label="Trường điều kiện (Mã DV/Thuốc)" style={{ marginBottom: 12 }}>
                                                <Input placeholder="VD: MA_DICH_VU (Mặc định)" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="conditionMaDichVuValue" label="Giá trị mã dịch vụ" style={{ marginBottom: 12 }}>
                                                <TextArea rows={2} placeholder="VD: XN001, TH002" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Form.Item
                                        name="checkNotNull"
                                        valuePropName="checked"
                                        extra={<span className="text-gray-400 text-xs">Nếu tích chọn, hệ thống sẽ báo lỗi khi trường dữ liệu đã chọn bị rỗng hoặc null.</span>}
                                        style={{ marginBottom: 16 }}
                                    >
                                        <Checkbox className="text-red-600 font-medium">
                                            Bắt buộc có dữ liệu (Không được để trống)
                                        </Checkbox>
                                    </Form.Item>

                                    {/* GROUP COUNT CẤU HÌNH */}
                                    <div className="p-3 bg-white rounded border border-orange-200">
                                        <Form.Item
                                            name="isGroupCount"
                                            valuePropName="checked"
                                            style={{ marginBottom: 8 }}
                                        >
                                            <Checkbox className="text-orange-600 font-medium">
                                                Kiểm tra số dòng dữ liệu (Đếm số lượng bản ghi thỏa mãn)
                                            </Checkbox>
                                        </Form.Item>

                                        <Form.Item shouldUpdate={(prev, curr) => prev.isGroupCount !== curr.isGroupCount} style={{ marginBottom: 0 }}>
                                            {({ getFieldValue }) =>
                                                getFieldValue('isGroupCount') ? (
                                                    <Row gutter={8} className="mt-2">
                                                        <Col span={12}>
                                                            <Form.Item
                                                                name="minCountVal"
                                                                label="Số lượng tối thiểu (Báo lỗi nếu <)"
                                                                style={{ marginBottom: 0 }}
                                                            >
                                                                <InputNumber min={0} className="w-full" placeholder="Ví dụ: 1" />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={12}>
                                                            <Form.Item
                                                                name="maxCountVal"
                                                                label="Số lượng tối đa (Báo lỗi nếu >)"
                                                                style={{ marginBottom: 0 }}
                                                            >
                                                                <InputNumber min={0} className="w-full" placeholder="Ví dụ: 1" />
                                                            </Form.Item>
                                                        </Col>
                                                    </Row>
                                                ) : null
                                            }
                                        </Form.Item>
                                    </div>

                                </Card>
                            </Col>
                        </Row>
                    </Form>
                </Modal>
            </div>
        );
    }

    // Default Modal behavior
    return (
        <>
            <Modal
                title="Cài đặt Quy tắc Kiểm tra"
                open={isOpen}
                onCancel={onClose}
                width={1200}
                footer={[
                    <Button key="close" onClick={() => onClose()}>
                        Đóng
                    </Button>
                ]}
                style={{ top: 20 }}
                styles={{ body: { padding: 0 } }}
                destroyOnHidden
            >
                {modalContent}
            </Modal>


            <Modal
                title={editingRule?.id === 'new' || !rules.some(r => r.id === editingRule?.id) ? "Thêm quy tắc mới" : "Chỉnh sửa quy tắc"}
                open={isEditModalOpen}
                onCancel={() => { setIsEditModalOpen(false); setEditingRule(null); }}
                onOk={handleSaveEdit}
                width={1200}
                okText="Lưu"
                cancelText="Hủy"
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={editingRule || {}}
                >
                    <Form.Item name="id" hidden><Input /></Form.Item>
                    <Form.Item name="createdAt" hidden><Input /></Form.Item>

                    <Row gutter={16}>
                        <Col span={10}>
                            <Card title="Thông tin chung" size="small" variant="borderless" className="bg-gray-50">
                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item name="active" label="Trạng thái" valuePropName="checked" style={{ marginBottom: 12 }}>
                                            <Switch />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="type" label="Loại vi phạm" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                                            <Select>
                                                <Option value="Xuất toán">Xuất toán</Option>
                                                <Option value="Cảnh báo">Cảnh báo</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Nhập tên quy tắc' }]} style={{ marginBottom: 12 }}>
                                    <Input placeholder="VD: Kiểm tra ngày vào viện" />
                                </Form.Item>

                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item name="xmlType" label="File XML" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                                            <Select onChange={() => {
                                                // Reset field when type changes
                                                const currentFields = form.getFieldsValue();
                                                if (currentFields.field && !XML_FIELDS[currentFields.xmlType]?.includes(currentFields.field)) {
                                                    form.setFieldsValue({ field: '' });
                                                }
                                            }}>
                                                {XML_TYPES.map(t => <Option key={t} value={t}>{XML_TYPE_LABELS[t] || t}</Option>)}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item shouldUpdate={(prev, curr) => prev.xmlType !== curr.xmlType} style={{ marginBottom: 12 }}>
                                            {() => {
                                                const type = form.getFieldValue('xmlType') || 'XML1';
                                                const fields = XML_FIELDS[type] || [];
                                                return (
                                                    <Form.Item name="field" label="Trường dữ liệu" style={{ marginBottom: 0 }}>
                                                        <AutoComplete
                                                            placeholder="Chọn hoặc gõ tên trường dữ liệu"
                                                            allowClear
                                                            options={fields.map(f => ({ value: f, label: f }))}
                                                            filterOption={(inputValue, option) =>
                                                                (option?.value as string)?.toUpperCase().includes(inputValue.toUpperCase())
                                                            }
                                                        />
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item name="errorMessage" label="Nội dung báo lỗi" style={{ marginBottom: 12 }}>
                                    <TextArea rows={2} placeholder="Thông báo hiển thị khi vi phạm..." />
                                </Form.Item>
                            </Card>
                        </Col>

                        <Col span={14}>
                            <Card title="Thiết lập Logic" size="small" variant="borderless" className="bg-blue-50">
                                <Form.Item
                                    name="code"
                                    label="Biểu thức logic"
                                    help="Ví dụ: NGAY_YL < XML1.NGAY_VAO"
                                    tooltip="Sử dụng mã trường. Dùng root.XML1... để truy cập chéo bảng."
                                    style={{ marginBottom: 0 }}
                                >
                                    <TextArea rows={4} className="font-mono bg-sky-50" />
                                </Form.Item>

                                {logicCheatSheet}

                                <div className="mb-4 p-3 bg-white rounded border border-blue-100">
                                    <Space orientation="vertical" style={{ width: '100%' }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 text-xs font-bold uppercase">Công cụ kiểm tra</span>
                                            <Button size="small" type="dashed" icon={<ToolOutlined />} onClick={handleTestLogic}>Chạy thử Logic</Button>
                                        </div>
                                        {testResult && (
                                            <div className="mt-2 text-xs">
                                                {testResult.errors.length > 0 ? (
                                                    <div className="text-red-600">
                                                        <CloseCircleOutlined /> Có lỗi:
                                                        <ul className="list-disc pl-4 mt-1">
                                                            {testResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                                        </ul>
                                                    </div>
                                                ) : (
                                                    <div className="text-green-600">
                                                        <CheckCircleOutlined /> Khớp {testResult.matched}/{testResult.total} hồ sơ mẫu.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Space>
                                </div>

                                <Form.Item name="mathExpression" label="Biểu thức toán học (Tùy chọn)" style={{ marginBottom: 12 }}>
                                    <Input placeholder="VD: (A + B) * C" className="font-mono" />
                                </Form.Item>

                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item name="conditionField" label="Trường điều kiện" style={{ marginBottom: 12 }}>
                                            <Input placeholder="VD: MA_NHOM" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="conditionValue" label="Giá trị điều kiện" style={{ marginBottom: 12 }}>
                                            <Input placeholder="VD: 1, 2, 3" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item name="conditionMaDichVu" label="Trường điều kiện (Mã DV/Thuốc)" style={{ marginBottom: 12 }}>
                                            <Input placeholder="VD: MA_DICH_VU (Mặc định)" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="conditionMaDichVuValue" label="Giá trị mã dịch vụ" style={{ marginBottom: 12 }}>
                                            <TextArea rows={2} placeholder="VD: XN001, TH002" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item
                                    name="checkNotNull"
                                    valuePropName="checked"
                                    extra={<span className="text-gray-400 text-xs">Nếu tích chọn, hệ thống sẽ báo lỗi khi trường dữ liệu đã chọn bị rỗng hoặc null.</span>}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Checkbox className="text-red-600 font-medium">
                                        Bắt buộc có dữ liệu (Không được để trống)
                                    </Checkbox>
                                </Form.Item>

                                {/* GROUP COUNT CẤU HÌNH (MOBILE/MODAL) */}
                                <div className="p-3 bg-white rounded border border-orange-200">
                                    <Form.Item
                                        name="isGroupCount"
                                        valuePropName="checked"
                                        style={{ marginBottom: 8 }}
                                    >
                                        <Checkbox className="text-orange-600 font-medium">
                                            Kiểm tra số dòng dữ liệu (Đếm số lượng bản ghi thỏa mãn)
                                        </Checkbox>
                                    </Form.Item>

                                    <Form.Item shouldUpdate={(prev, curr) => prev.isGroupCount !== curr.isGroupCount} style={{ marginBottom: 0 }}>
                                        {({ getFieldValue }) =>
                                            getFieldValue('isGroupCount') ? (
                                                <Row gutter={8} className="mt-2">
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="minCountVal"
                                                            label="Số lượng tối thiểu (Báo lỗi nếu <)"
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <InputNumber min={0} className="w-full" placeholder="Ví dụ: 1" />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="maxCountVal"
                                                            label="Số lượng tối đa (Báo lỗi nếu >)"
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <InputNumber min={0} className="w-full" placeholder="Ví dụ: 1" />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>
                                            ) : null
                                        }
                                    </Form.Item>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </>
    );
}
