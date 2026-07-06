import React, { useState, useRef } from 'react';
import { Select, Radio, Upload, Dropdown, Button, Input, Tooltip, message } from 'antd';
import { BugOutlined, PictureOutlined, CameraOutlined, AudioOutlined, SendOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

interface ChatTabProps {
    user: any;
    isAdmin: boolean;
    softwareErrors: string[];
    hardwareErrors: string[];
    departmentStaff: any[];
    departments: any[];
    savedStaffId: string | null;
    setSavedStaffId: (id: string | null) => void;
    fileList: any[];
    uploadProps: any;
    handleFileChange: (e: any) => void;
    form: any;
    setActiveTab: (tab: string) => void;
    targetDepartment?: string;
}

export function ChatTab({
    user,
    isAdmin,
    softwareErrors,
    hardwareErrors,
    departmentStaff,
    departments,
    savedStaffId,
    setSavedStaffId,
    fileList,
    uploadProps,
    handleFileChange,
    setActiveTab,
    form,
    targetDepartment = 'CNTT'
}: ChatTabProps) {
    const router = useRouter();
    const [chatText, setChatText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [chatCategory, setChatCategory] = useState<string>(targetDepartment === 'CNTT' ? 'SOFTWARE' : 'HARDWARE');
    const [staffSearchValue, setStaffSearchValue] = useState('');
    const [isSearchListening, setIsSearchListening] = useState(false);
    const searchRecognitionRef = useRef<any>(null);

    const handleSearchVoiceInput = () => {
        if (isSearchListening && searchRecognitionRef.current) {
            searchRecognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            message.warning("Trình duyệt không hỗ trợ nhận diện giọng nói!");
            return;
        }

        const recognition = new SpeechRecognition();
        searchRecognitionRef.current = recognition;
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        
        recognition.onstart = () => setIsSearchListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            // Clean up the text (remove trailing dot if any)
            const cleanText = transcript.replace(/\.$/, '');
            setStaffSearchValue(cleanText);
        };
        recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            setIsSearchListening(false);
            if (event.error === 'not-allowed') {
                message.error("Vui lòng cấp quyền sử dụng Micro cho trình duyệt!");
            } else if (event.error === 'network') {
                message.error("Trình duyệt chặn dịch vụ giọng nói. Vui lòng dùng Google Chrome!");
            }
        };
        recognition.onend = () => setIsSearchListening(false);
        
        try {
            recognition.start();
        } catch (error) {
            setIsSearchListening(false);
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
            console.warn('Speech recognition error:', event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                message.error("Vui lòng cấp quyền sử dụng Micro cho trình duyệt!");
            } else if (event.error === 'network') {
                message.error("Trình duyệt (hoặc mạng bệnh viện) chặn dịch vụ giọng nói. Vui lòng dùng Google Chrome hoặc nhập tay!");
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

        let category = chatCategory;

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
                    ma_khoa: isAdmin ? (staff?.ma_khoa || user?.ma_khoa || departments[0]?.ma_khoa) : 'KHOA_HIENTAI', 
                    assigneeId: null, // Auto assign
                    dynamicFields: dynamicObj,
                    nguoi_bao_id: staffId,
                    sdt: staff?.so_dien_thoai || '',
                    targetDepartment
                })
            });

            if (res.ok) {
                message.success('Gửi yêu cầu thành công!');
                if (targetDepartment === 'VTYT') router.push('/error-management/vtyt-requests');
                else if (targetDepartment === 'HCQT') router.push('/error-management/hcqt-requests');
                else router.push('/error-management/it-requests');
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

    return (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-inner flex flex-col min-h-[400px]">
            {/* Thanh thông tin người báo trong Chat Tab */}
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm mb-4">
                <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                    <span>👤 Người báo:</span>
                    {user?.staffId && !isAdmin ? (
                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            {departmentStaff.find((s: any) => s.id === user.staffId)?.ho_ten || 'Tài khoản cá nhân'}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1 border border-slate-200 rounded bg-slate-50 px-1 py-0.5 min-w-[250px] max-w-full">
                            <Select
                                size="small"
                                value={departmentStaff.some((s: any) => s.id === savedStaffId) ? savedStaffId : undefined}
                                onChange={(val) => {
                                    setSavedStaffId(val);
                                    localStorage.setItem('last_it_request_staff_id', val);
                                    form.setFieldsValue({ nguoi_bao_id: val });
                                    setStaffSearchValue('');
                                }}
                                searchValue={staffSearchValue}
                                onSearch={setStaffSearchValue}
                                onBlur={() => setStaffSearchValue('')}
                                className="flex-1"
                                popupMatchSelectWidth={false}
                                placeholder="Chọn tên nhân viên"
                                variant="borderless"
                                virtual={false}
                                options={departmentStaff.map((s: any) => ({
                                    value: s.id,
                                    label: isAdmin ? `${s.ho_ten} - ${s.department?.ten_khoa || s.ma_khoa}` : s.ho_ten
                                }))}
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            />
                            <Tooltip title="Tìm bằng giọng nói">
                                <AudioOutlined 
                                    className={`cursor-pointer text-[16px] px-1 transition-colors ${isSearchListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-blue-500'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSearchVoiceInput();
                                    }}
                                />
                            </Tooltip>
                        </div>
                    )}
                </div>
            </div>

            {/* Category Selection for Chat Tab */}
            {targetDepartment === 'CNTT' ? (
                <Radio.Group 
                    value={chatCategory} 
                    onChange={(e) => setChatCategory(e.target.value)}
                    className="w-full mb-4 flex rounded-lg p-1 bg-white border border-slate-200 shadow-sm" 
                    optionType="button" 
                    buttonStyle="solid"
                >
                    <Radio.Button value="SOFTWARE" className={`flex-1 text-center border-none shadow-none font-medium !text-[13px] sm:!text-[14px] h-auto min-h-[40px] flex items-center justify-center py-1 ${chatCategory === 'SOFTWARE' ? 'bg-blue-50 text-blue-600' : 'bg-transparent'}`}>
                        Bệnh án
                    </Radio.Button>
                    <Radio.Button value="HARDWARE" className={`flex-1 text-center border-none shadow-none font-medium !text-[13px] sm:!text-[14px] h-auto min-h-[40px] flex items-center justify-center py-1 ${chatCategory === 'HARDWARE' ? 'bg-blue-50 text-blue-600' : 'bg-transparent'}`}>
                        Thiết bị/Sửa chữa
                    </Radio.Button>
                </Radio.Group>
            ) : null}

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
            <div className="flex flex-wrap gap-2 mb-2">
                {(chatCategory === 'SOFTWARE' ? softwareErrors : hardwareErrors).map(reply => (
                    <div 
                        key={reply} 
                        onClick={() => setChatText(reply)}
                        className={`max-w-full whitespace-normal leading-relaxed text-center px-4 py-2 rounded-2xl text-[13px] font-medium border cursor-pointer transition-colors shadow-sm
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
}
