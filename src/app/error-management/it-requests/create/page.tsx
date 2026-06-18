'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Button, Radio, message, Card, Upload, Modal, Tabs, Tooltip, Dropdown } from 'antd';
import { ArrowLeftOutlined, BugOutlined, PlusOutlined, CameraOutlined, PictureOutlined, MessageOutlined, FormOutlined, SendOutlined, AudioOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { getBasePath } from '@/utils/config';

export default function CreateITRequestPage() {
    const [form] = Form.useForm();
    const router = useRouter();
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'CNTT';

    const [softwareErrors, setSoftwareErrors] = useState<string[]>([]);
    const [hardwareErrors, setHardwareErrors] = useState<string[]>([]);
    const [allStaffs, setAllStaffs] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [departmentStaff, setDepartmentStaff] = useState<any[]>([]);
    const [itUsers, setItUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [maxImageSizeMB, setMaxImageSizeMB] = useState<number>(10);
    
    // Image Upload State
    const [fileList, setFileList] = useState<any[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');

    // Chat UI State
    const [activeTab, setActiveTab] = useState('chat');
    const [chatText, setChatText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [selectedQuickReply, setSelectedQuickReply] = useState('');
    const [savedStaffId, setSavedStaffId] = useState<string | null>(null);

    const quickReplies = [
        '🖨️ Máy in hỏng / kẹt giấy',
        '🌐 Mất kết nối mạng',
        '💻 Máy tính không lên nguồn',
        '🏥 Lỗi bệnh án / Thanh toán',
        '🔑 Quên mật khẩu HIS'
    ];

    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas conversion failed'));
                    }, 'image/jpeg', 0.7);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const uploadProps = {
        onRemove: (file: any) => {
            setFileList(prev => prev.filter(item => item.uid !== file.uid));
        },
        customRequest: async ({ file, onSuccess, onError }: any) => {
            try {
                // Giới hạn file tối đa dựa trên cấu hình (mặc định 10MB)
                if (file.size > maxImageSizeMB * 1024 * 1024) {
                    message.error(`File ảnh quá lớn! Vui lòng chọn ảnh dưới ${maxImageSizeMB}MB.`);
                    onError && onError(new Error('File too large'));
                    return;
                }

                const resizedBlob = await resizeImage(file as File);
                const formData = new FormData();
                formData.append('file', resizedBlob, file.name || 'upload.jpg');

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await res.json();
                if (res.ok) {
                    setFileList(prev => [...prev, {
                        uid: file.uid || Date.now().toString(),
                        name: file.name,
                        status: 'done',
                        url: data.url,
                        thumbUrl: `${getBasePath()}${data.url}`
                    }]);
                    onSuccess && onSuccess(data.url);
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                message.error('Lỗi tải ảnh lên máy chủ!');
                onError && onError(error);
            }
        },
        fileList,
        listType: "picture-card" as const,
        accept: "image/*",
        onPreview: async (file: any) => {
            setPreviewImage(file.url || file.preview);
            setPreviewOpen(true);
        }
    };

    useEffect(() => {
        const initData = async () => {
            try {
                fetchConfiguredFields();
                fetchStaffs();
                fetchDepartments();
                if (isAdmin) {
                    fetchITUsers();
                }
            } catch (e) {
                console.error(e);
            }
        };
        initData();
        
        const lastStaffId = user?.staffId || localStorage.getItem('last_it_request_staff_id');
        setSavedStaffId(lastStaffId);
        form.setFieldsValue({
            category: 'SOFTWARE',
            trang_thai_ba: 'Đang điều trị',
            nguoi_bao_id: lastStaffId || undefined
        });
    }, [form, isAdmin, user?.staffId]);

    const fetchConfiguredFields = async () => {
        try {
            const res = await fetch('/api/error-management/it-request-config');
            if (res.ok) {
                const configData = await res.json();
                setSoftwareErrors(configData.softwareErrors || []);
                setHardwareErrors(configData.hardwareErrors || [
                    'Máy tính không lên',
                    'Hết mực in / Kẹt giấy',
                    'Mất mạng Internet',
                    'Lỗi bàn phím / Chuột',
                    'Khác'
                ]);
                if (configData.maxImageSizeMB) {
                    setMaxImageSizeMB(configData.maxImageSizeMB);
                }
            }
        } catch (error) {
            console.error('Failed to fetch config', error);
        }
    };

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments');
            if (res.ok) {
                const data = await res.json();
                setDepartments(data);
            }
        } catch (error) {
            console.error('Failed to fetch departments', error);
        }
    };

    const fetchStaffs = async () => {
        try {
            const res = await fetch('/api/staff');
            if (res.ok) {
                const data = await res.json();
                setAllStaffs(data);
                let currentStaffList = data;
                if (user && user.role === 'KHOA') {
                    currentStaffList = data.filter((s: any) => s.ma_khoa === user.ma_khoa);
                }
                setDepartmentStaff(currentStaffList);

                // Verify if the saved staff ID is still valid
                const lastId = form.getFieldValue('nguoi_bao_id');
                if (lastId && !currentStaffList.some((s: any) => s.id === lastId)) {
                    form.setFieldsValue({ nguoi_bao_id: undefined });
                    setSavedStaffId(null);
                    localStorage.removeItem('last_it_request_staff_id');
                }
            }
        } catch (error) {
            console.error('Failed to fetch staffs', error);
        }
    };

    const fetchITUsers = async () => {
        try {
            const res = await fetch('/api/error-management/duty-roster');
            if (res.ok) {
                const data = await res.json();
                setItUsers(data.filter((u: any) => u.isAvailable));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateTicket = async (values: any) => {
        setLoading(true);
        const dynamicObj: any = {};
        
        let finalTenLoi = '';

        if (values.category === 'SOFTWARE') {
            dynamicObj['Trạng thái BA'] = values.trang_thai_ba;
            dynamicObj['Ghi chú'] = values.ghi_chu;
            finalTenLoi = Array.isArray(values.ten_loi_software) ? values.ten_loi_software.join(', ') : (values.ten_loi_software || '');
        } else {
            dynamicObj['Ghi chú'] = values.ghi_chu;
            finalTenLoi = values.ten_loi_hardware || '';
        }

        const staff = departmentStaff.find(s => s.id === values.nguoi_bao_id);
        const autoSdt = staff?.so_dien_thoai || '';
        
        dynamicObj['SĐT'] = autoSdt;

        if (staff) {
            dynamicObj['Người báo'] = staff.ho_ten;
            localStorage.setItem('last_it_request_staff_id', staff.id);
        }

        if (fileList.length > 0) {
            dynamicObj['Hình ảnh đính kèm'] = fileList.map(f => f.url);
        }

        try {
            const res = await fetch('/api/error-management/it-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_ba: values.category === 'SOFTWARE' ? values.ma_ba : null,
                    category: values.category || 'SOFTWARE',
                    ten_loi: finalTenLoi,
                    ma_khoa: isAdmin ? values.ma_khoa : 'KHOA_HIENTAI', 
                    assigneeId: values.assigneeId,
                    dynamicFields: dynamicObj,
                    nguoi_bao_id: values.nguoi_bao_id,
                    sdt: autoSdt
                })
            });

            if (res.ok) {
                message.success('Gửi yêu cầu thành công!');
                router.push('/error-management/it-requests');
            } else {
                const err = await res.json();
                message.error(err.error || 'Gửi yêu cầu thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    const handleVoiceInput = () => {
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            message.warning("Trình duyệt không hỗ trợ nhận diện giọng nói!");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setChatText(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                message.error("Vui lòng cấp quyền sử dụng Micro cho trình duyệt!");
            } else if (event.error !== 'no-speech') {
                message.error("Lỗi nhận diện giọng nói: " + event.error);
            }
        };
        recognition.onend = () => setIsListening(false);
        
        try {
            recognition.start();
        } catch (error) {
            console.error("Error starting speech recognition", error);
            setIsListening(false);
        }
    };

    const handleFileChange = (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadProps.customRequest({ file: e.target.files[0] });
        }
        e.target.value = '';
    };

    const handleCreateFromChat = async () => {
        if (!chatText.trim()) return message.warning("Vui lòng nhập mô tả sự cố!");
        
        let staffId = savedStaffId;
        if (!staffId && departmentStaff.length > 0) {
            staffId = departmentStaff[0].id;
            setSavedStaffId(staffId);
            localStorage.setItem('last_it_request_staff_id', staffId as string);
        }
        
        if (!staffId) return message.warning("Không xác định được người báo, vui lòng kiểm tra lại thông tin!");
        
        setChatLoading(true);

        // Auto parser
        let category = 'SOFTWARE';
        const lowerText = chatText.toLowerCase();
        const hardwareKeywords = ['máy in', 'in', 'chuột', 'phím', 'bàn phím', 'mạng', 'màn hình', 'nguồn', 'máy tính', 'ổ cứng'];
        if (hardwareKeywords.some(kw => lowerText.includes(kw))) {
            category = 'HARDWARE';
        }

        // Extract patientCode (8-10 digits)
        const patientMatch = chatText.match(/\b\d{8,10}\b/);
        const ma_ba = patientMatch ? patientMatch[0] : null;

        const staff = departmentStaff.find(s => s.id === staffId);
        
        const dynamicObj: any = {
            'Ghi chú': 'Tạo tự động từ Chat',
            'SĐT': staff?.so_dien_thoai || '',
            'Người báo': staff?.ho_ten || ''
        };

        if (fileList.length > 0) {
            dynamicObj['Hình ảnh đính kèm'] = fileList.map(f => f.url);
        }

        try {
            const res = await fetch('/api/error-management/it-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_ba: ma_ba,
                    category: category,
                    ten_loi: chatText,
                    ma_khoa: isAdmin ? (user?.ma_khoa || departments[0]?.ma_khoa) : 'KHOA_HIENTAI', 
                    assigneeId: null, // Auto assign
                    dynamicFields: dynamicObj,
                    nguoi_bao_id: staffId,
                    sdt: staff?.so_dien_thoai || ''
                })
            });

            if (res.ok) {
                message.success('Gửi yêu cầu thành công!');
                router.push('/error-management/it-requests');
            } else {
                const err = await res.json();
                message.error(err.error || 'Gửi yêu cầu thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setChatLoading(false);
        }
    };

    const renderChatTab = () => (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-inner flex flex-col min-h-[400px]">
            {/* Thanh thông tin người báo trong Chat Tab */}
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm mb-4">
                <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                    <span>👤 Người báo:</span>
                    {user?.staffId ? (
                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            {departmentStaff.find((s: any) => s.id === user.staffId)?.ho_ten || 'Tài khoản cá nhân'}
                        </span>
                    ) : (
                        <Select
                            size="small"
                            value={departmentStaff.some((s: any) => s.id === savedStaffId) ? savedStaffId : undefined}
                            onChange={(val) => {
                                setSavedStaffId(val);
                                localStorage.setItem('last_it_request_staff_id', val);
                                form.setFieldsValue({ nguoi_bao_id: val });
                            }}
                            className="min-w-[150px]"
                            placeholder="Chọn tên nhân viên"
                            variant="borderless"
                            options={departmentStaff.map((s: any) => ({
                                value: s.id,
                                label: s.ho_ten
                            }))}
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        <BugOutlined />
                    </div>
                    <div className="bg-white p-3 sm:p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 text-[14px] sm:text-[15px] text-slate-700 max-w-[85%]">
                        Chào bạn! Bạn đang gặp sự cố gì? 
                        <br/><span className="text-slate-500 text-[13px] mt-1 block">Hãy chọn nhanh gợi ý bên dưới, đọc vào Micro, hoặc gõ chữ nhé.</span>
                    </div>
                </div>
            </div>

            {/* Quick Replies */}
            <div className="flex overflow-x-auto gap-2 pb-2 mb-2 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                {quickReplies.map(reply => (
                    <div 
                        key={reply} 
                        onClick={() => setChatText(reply)}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-medium border cursor-pointer transition-colors shadow-sm shrink-0
                            ${chatText === reply ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}
                        `}
                    >
                        {reply}
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                {fileList.length > 0 && (
                    <div className="px-3 pt-2 pb-1">
                        <Upload {...uploadProps} />
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <div className="flex gap-1 sm:gap-2 px-1 pb-1">
                        <Dropdown 
                            trigger={['click']}
                            menu={{
                                items: [
                                    {
                                        key: '1',
                                        label: (
                                            <label className="flex items-center gap-3 py-1 cursor-pointer w-full text-slate-700">
                                                <PictureOutlined className="text-lg text-blue-500" />
                                                <span className="font-medium text-[14px]">Chọn từ thư viện</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                            </label>
                                        )
                                    },
                                    {
                                        key: '2',
                                        label: (
                                            <label className="flex items-center gap-3 py-1 cursor-pointer w-full text-slate-700">
                                                <CameraOutlined className="text-lg text-green-500" />
                                                <span className="font-medium text-[14px]">Chụp ảnh (Điện thoại)</span>
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                                            </label>
                                        )
                                    }
                                ]
                            }}
                        >
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors">
                                <PictureOutlined className="text-xl" />
                            </div>
                        </Dropdown>
                    </div>

                    <Input.TextArea 
                        value={chatText}
                        onChange={e => setChatText(e.target.value)}
                        placeholder="Mô tả sự cố của bạn ở đây..." 
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        className="flex-1 !border-none !shadow-none !ring-0 !bg-transparent text-[15px] py-2 px-1"
                        onPressEnter={(e) => {
                            if (!e.shiftKey) {
                                e.preventDefault();
                                handleCreateFromChat();
                            }
                        }}
                    />

                    <div className="flex gap-2 p-1">
                        <Tooltip title="Nhập bằng giọng nói">
                            <Button 
                                type={isListening ? 'primary' : 'default'} 
                                danger={isListening}
                                shape="circle" 
                                size="large" 
                                icon={<AudioOutlined className={isListening ? 'animate-pulse' : ''} />} 
                                onClick={handleVoiceInput}
                                className="border-none bg-slate-100 hover:bg-slate-200 shadow-none"
                            />
                        </Tooltip>
                        <Button 
                            type="primary" 
                            shape="circle" 
                            size="large" 
                            icon={<SendOutlined />} 
                            onClick={handleCreateFromChat}
                            loading={chatLoading}
                            className="bg-blue-600"
                        />
                    </div>
                </div>
            </div>
            
            {!savedStaffId && departmentStaff.length > 0 && (
                 <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800 flex items-center justify-between">
                     <span>Lần đầu sử dụng, vui lòng chọn tên của bạn (tại tab Điền Form) để hệ thống ghi nhớ nhé!</span>
                     <Button size="small" onClick={() => setActiveTab('form')}>Sang Tab Form</Button>
                 </div>
            )}
        </div>
    );


    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        <BugOutlined />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Tạo Yêu Cầu Mới</h1>
                        <p className="text-sm sm:text-base text-slate-500 m-0">Điền thông tin sự cố để gửi cho phòng CNTT</p>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto items-center">
                    <Link href="/error-management/it-requests">
                        <Button size="large" icon={<ArrowLeftOutlined />} className="w-full sm:w-auto">Quay Lại</Button>
                    </Link>
                </div>
            </div>

            <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab}
                type="card" 
                className="mt-2"
                items={[
                    {
                        key: 'chat',
                        label: <span className="font-medium px-2 py-1 flex items-center gap-2"><MessageOutlined /> Tạo Nhanh (Khuyên dùng)</span>,
                        children: renderChatTab()
                    },
                    {
                        key: 'form',
                        label: <span className="font-medium px-2 py-1 flex items-center gap-2"><FormOutlined /> Điền Form (Truyền thống)</span>,
                        forceRender: true,
                        children: (
                            <Card className="shadow-sm rounded-b-2xl rounded-tr-2xl border-slate-200 border-t-0">
                                <Form form={form} layout="vertical" onFinish={handleCreateTicket}>
                    <Form.Item name="category" noStyle>
                        <Radio.Group className="w-full mb-6 flex rounded-lg p-1 bg-slate-100" optionType="button" buttonStyle="solid">
                            <Radio.Button value="SOFTWARE" className="flex-1 text-center border-none shadow-none bg-transparent font-medium !text-[13px] sm:!text-[14px] h-auto min-h-[40px] flex items-center justify-center py-1">
                                Bệnh án
                            </Radio.Button>
                            <Radio.Button value="HARDWARE" className="flex-1 text-center border-none shadow-none bg-transparent font-medium !text-[13px] sm:!text-[14px] h-auto min-h-[40px] flex items-center justify-center py-1">
                                Thiết bị/Sửa chữa
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                        {({ getFieldValue }) => {
                            const isSoftware = getFieldValue('category') === 'SOFTWARE';
                            return (
                                <>
                                    {isSoftware && (
                                        <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 mb-6 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <Form.Item name="ma_ba" label={<span className="font-semibold">Mã Bệnh Án</span>} rules={[{ required: true, message: 'Vui lòng nhập mã bệnh án' }]} className="mb-0">
                                                    <Input placeholder="Nhập mã BA" />
                                                </Form.Item>
                                                <Form.Item name="trang_thai_ba" label={<span className="font-semibold">Trạng thái bệnh án</span>} className="mb-0">
                                                    <Radio.Group className="flex pt-2">
                                                        <Radio value="Đang điều trị">Đang điều trị</Radio>
                                                        <Radio value="Đã ra viện">Đã ra viện</Radio>
                                                    </Radio.Group>
                                                </Form.Item>
                                            </div>
                                            
                                            <Form.Item name="ten_loi_software" label={<span className="font-semibold">Vấn đề cần hỗ trợ (Lỗi nghiệp vụ)</span>} rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập vấn đề' }]} className="mb-0">
                                                <Select mode="tags" placeholder="Chọn hoặc gõ thêm lỗi..." options={softwareErrors.map(e => ({ label: e, value: e }))} />
                                            </Form.Item>
                                        </div>
                                    )}

                                    {!isSoftware && (
                                        <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 mb-6">
                                            <Form.Item name="ten_loi_hardware" label={<span className="font-semibold">Vấn đề cần hỗ trợ (Sửa chữa)</span>} rules={[{ required: true, message: 'Vui lòng chọn sự cố' }]} className="mb-0">
                                                <Radio.Group className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                                                    {hardwareErrors.map(t => (
                                                        <Radio.Button key={t} value={t} className="rounded-xl sm:rounded-full h-10 sm:h-auto flex items-center justify-center sm:inline-flex px-4 !text-[14px]">{t}</Radio.Button>
                                                    ))}
                                                </Radio.Group>
                                            </Form.Item>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
                                        <Form.Item name="ghi_chu" label={<span className="font-semibold">Ghi chú thêm / Mô tả chi tiết (Tuỳ chọn)</span>} className="mb-0">
                                            <Input.TextArea rows={3} placeholder="Mô tả cụ thể hoặc cho biết vị trí máy bị lỗi..." />
                                        </Form.Item>

                                        <Form.Item label={<span className="font-semibold">Đính kèm hình ảnh (Bắt lỗi màn hình, thiết bị)</span>} className="mb-0">
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <div className="hidden sm:block">
                                                    <Upload {...uploadProps}>
                                                        {fileList.length >= 3 ? null : (
                                                            <div className="flex flex-col items-center justify-center text-slate-500">
                                                                <PictureOutlined className="text-2xl mb-1" />
                                                                <div className="text-xs">Tải ảnh lên</div>
                                                            </div>
                                                        )}
                                                    </Upload>
                                                </div>
                                                
                                                {/* Giao diện Upload/Chụp ảnh cho Mobile */}
                                                <div className="sm:hidden flex flex-col gap-3">
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 relative overflow-hidden bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center p-3 cursor-pointer">
                                                            <PictureOutlined className="mr-2" /> <span>Thư viện</span>
                                                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                                if(e.target.files && e.target.files.length > 0) {
                                                                    // Mock up the customRequest params
                                                                    const fileObj = e.target.files[0];
                                                                    uploadProps.customRequest({ file: fileObj });
                                                                }
                                                                e.target.value = '';
                                                            }} />
                                                        </div>
                                                        <div className="flex-1 relative overflow-hidden bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center p-3 cursor-pointer">
                                                            <CameraOutlined className="mr-2" /> <span>Chụp ảnh</span>
                                                            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                                if(e.target.files && e.target.files.length > 0) {
                                                                    const fileObj = e.target.files[0];
                                                                    uploadProps.customRequest({ file: fileObj });
                                                                }
                                                                e.target.value = '';
                                                            }} />
                                                        </div>
                                                    </div>
                                                    {fileList.length > 0 && (
                                                        <Upload {...uploadProps} />
                                                    )}
                                                </div>
                                            </div>
                                        </Form.Item>

                                        {isAdmin && (
                                            <Form.Item name="ma_khoa" label={<span className="font-semibold">Khoa phòng yêu cầu</span>} rules={[{ required: true, message: 'Vui lòng chọn khoa' }]} className="mb-0">
                                                <Select
                                                    showSearch
                                                    placeholder="Chọn khoa phòng"
                                                    virtual={false}
                                                    optionFilterProp="children"
                                                    onChange={(val) => {
                                                        setDepartmentStaff(allStaffs.filter(s => s.ma_khoa === val));
                                                        form.setFieldsValue({ nguoi_bao_id: undefined });
                                                    }}
                                                >
                                                    {departments.map(d => (
                                                        <Select.Option key={d.ma_khoa} value={d.ma_khoa}>{d.ten_khoa}</Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        )}

                                        <Form.Item name="nguoi_bao_id" label={<span className="font-semibold">{isAdmin ? "Người báo" : "Người báo"}</span>} rules={[{ required: true, message: 'Vui lòng chọn tên' }]} className="mb-0">
                                            <Select 
                                                showSearch 
                                                placeholder="Tìm tên nhân viên..." 
                                                virtual={false}
                                                disabled={!!user?.staffId}
                                                optionFilterProp="children"
                                                onChange={(val) => {
                                                    if (!user?.staffId) {
                                                        localStorage.setItem('last_it_request_staff_id', val);
                                                        setSavedStaffId(val);
                                                    }
                                                }}
                                            >
                                                {departmentStaff.map(s => (
                                                    <Select.Option key={s.id} value={s.id}>{s.ho_ten} {s.chuc_danh ? `(${s.chuc_danh})` : ''}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </div>
                                    
                                    {isAdmin && (
                                        <div className="mt-6">
                                            <Form.Item name="assigneeId" label={<span className="font-semibold">Chỉ định người xử lý (Tùy chọn)</span>} className="mb-0">
                                                <Select placeholder="Để trống hệ thống tự chia việc" allowClear>
                                                    {itUsers.map(u => (
                                                        <Select.Option key={u.id} value={u.id}>{u.name || u.username}</Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        </div>
                                    )}

                                    <div className="mt-8 flex justify-end">
                                        <Button type="primary" htmlType="submit" size="large" className="px-8 font-semibold bg-blue-600 hover:bg-blue-500" loading={loading}>
                                            Gửi Yêu Cầu Hỗ Trợ
                                        </Button>
                                    </div>
                                </>
                            );
                        }}
                    </Form.Item>
                </Form>
            </Card>
                        )
                    }
                ]}
            />

            <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} centered>
                <img alt="Preview" style={{ width: '100%', marginTop: '20px', borderRadius: '8px' }} src={previewImage?.startsWith('http') || previewImage?.startsWith('blob') || previewImage?.startsWith('data') ? previewImage : `${getBasePath()}${previewImage}`} />
            </Modal>
        </div>
    );
}
