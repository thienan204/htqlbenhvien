'use client';

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Spin, Upload, Typography, Result, Tabs } from 'antd';
import { UploadOutlined, LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import PageInstruction from '@/components/shared/PageInstruction';

const { Title, Paragraph } = Typography;

export default function SubmitFormClient({ formId }: { formId: string }) {
    const id = formId;
    const [formConfig, setFormConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    // State to hold the matched row data after successful verification
    const [userData, setUserData] = useState<any>(null);
    const [verificationKeyField, setVerificationKeyField] = useState<any>(null);

    const [form] = Form.useForm();

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Get basePath safely
                const bPath = window.location.pathname.startsWith('/htqlbenhvien') ? '/htqlbenhvien' : '';
                const res = await fetch(`${bPath}/api/dynamic-forms/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setFormConfig(data);
                    
                    // Find if there is a verification key field
                    const vField = data.config?.find((f: any) => f.isVerificationKey);
                    setVerificationKeyField(vField);
                } else {
                    message.error('Form không tồn tại hoặc đã bị đóng');
                }
            } catch (error) {
                message.error('Lỗi tải form');
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [id]);

    const handleVerify = async (values: any) => {
        if (!verificationKeyField) return;
        
        setVerifying(true);
        try {
            const bPath = window.location.pathname.startsWith('/htqlbenhvien') ? '/htqlbenhvien' : '';
            const res = await fetch(`${bPath}/api/dynamic-forms/${id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verificationKey: verificationKeyField.name,
                    verificationValue: values.verificationValue,
                    updatedData: {}
                })
            });

            const populateFormData = (data: any) => {
                const formData = { ...data };
                formConfig.config.forEach((field: any) => {
                    if (field.type === 'image' && typeof formData[field.name] === 'string') {
                        const urls = formData[field.name].split(',').map((u: string) => u.trim()).filter(Boolean);
                        formData[field.name] = urls.map((url: string, index: number) => ({
                            uid: `-${index}`,
                            name: `image-${index + 1}.png`,
                            status: 'done',
                            url: url,
                        }));
                    }
                });
                form.setFieldsValue(formData);
            };

            const result = await res.json();
            if (res.ok && result.row) {
                message.success('Xác thực thành công!');
                setUserData(result.row.data);
                populateFormData(result.row.data);
            } else if (res.status === 404 && result.isNew) {
                message.info('Đây là thông tin mới, vui lòng điền form.');
                const initialData = { [verificationKeyField.name]: values.verificationValue };
                setUserData(initialData);
                populateFormData(initialData);
            } else {
                message.error(result.error || 'Mã xác thực không đúng, không tìm thấy dữ liệu.');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi xác thực');
        } finally {
            setVerifying(false);
        }
    };

    const handleSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            // Merge userData with values to preserve disabled fields (which are not included in values)
            const cleanValues = { ...values };
            Object.keys(cleanValues).forEach(key => {
                if (cleanValues[key] === undefined) {
                    delete cleanValues[key];
                }
            });
            const updatedData = { ...userData, ...cleanValues };
            
            // For file inputs, we need to extract the URLs if uploaded
            formConfig.config.forEach((field: any) => {
                if (field.type === 'image' && Array.isArray(values[field.name])) {
                    const urls = values[field.name].map((file: any) => {
                        if (file.response && file.response.url) return file.response.url;
                        if (file.url) return file.url;
                        return null;
                    }).filter(Boolean);
                    updatedData[field.name] = urls.join(', ');
                } else if (field.type === 'image') {
                    // Fallback to original data if upload failed or nothing was changed
                    updatedData[field.name] = userData?.[field.name] || '';
                }
            });

            const payload: any = {
                updatedData: updatedData
            };

            if (verificationKeyField) {
                payload.verificationKey = verificationKeyField.name;
                payload.verificationValue = userData?.[verificationKeyField.name];
            }

            const bPath = window.location.pathname.startsWith('/htqlbenhvien') ? '/htqlbenhvien' : '';
            const res = await fetch(`${bPath}/api/dynamic-forms/${id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok) {
                message.success('Đã cập nhật dữ liệu thành công!');
                setUserData(result.row.data);
                setIsSubmitted(true);
            } else {
                message.error(result.error || 'Lỗi khi cập nhật dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi cập nhật');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-gray-50 p-10 flex justify-center"><Spin size="large" /></div>;
    if (!formConfig) return <div className="p-10 text-center text-red-500">Không tìm thấy Form</div>;

    // Handle Ant Design upload event extraction
    const normFile = (e: any) => {
        if (Array.isArray(e)) return e;
        return e?.fileList;
    };

    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            // Chỉ nén nếu là ảnh và dung lượng lớn hơn 2MB
            if (!file.type.startsWith('image/') || file.size / 1024 / 1024 <= 2) {
                const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                const ext = file.name.match(/\.[^/.]+$/)?.[0] || '';
                const newName = `${file.name.replace(/\.[^/.]+$/, "")} - Gốc (${sizeMB}MB)${ext}`;
                const newFile = new File([file], newName, { type: file.type, lastModified: file.lastModified });
                resolve(newFile);
                return;
            }

            message.loading({ content: 'Đang nén ảnh...', key: 'compressing' });
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1920;

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
                        if (blob) {
                            const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
                            const newName = `${file.name.replace(/\.[^/.]+$/, "")} - Nén (${sizeMB}MB).jpg`;
                            const newFile = new File([blob], newName, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            message.success({ content: 'Nén ảnh thành công!', key: 'compressing', duration: 2 });
                            resolve(newFile);
                        } else {
                            message.destroy('compressing');
                            resolve(file);
                        }
                    }, 'image/jpeg', 0.85);
                };
                img.onerror = (error) => {
                    message.destroy('compressing');
                    resolve(file); // Fallback to original
                }
            };
            reader.onerror = (error) => {
                message.destroy('compressing');
                resolve(file); // Fallback to original
            }
        });
    };

    // Render Input Element based on type
    const renderInputElement = (field: any) => {
        if (!field.isEditable) {
            return <Input readOnly size="large" className="bg-gray-100 text-gray-900 font-bold border-gray-200 cursor-not-allowed select-none" style={{ opacity: 1 }} />;
        }

        const bPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/htqlbenhvien') ? '/htqlbenhvien' : '';
        
        switch (field.type) {
            case 'number':
            case 'phone':
            case 'cccd':
                // Add suffix={<span/>} to prevent focus loss warning when allowClear adds the clear icon
                return <Input allowClear suffix={<span className="w-0" />} type="number" size="large" className="hover:border-blue-400 focus:border-blue-500 transition-colors" />;
            case 'image':
                return (
                    <Upload
                        action={`${bPath}/api/dynamic-forms/upload`}
                        listType="picture"
                        maxCount={2}
                        accept="image/*"
                        // @ts-ignore
                        capture="environment" // HTML5 attribute for mobile camera
                        multiple
                        beforeUpload={compressImage}
                    >
                        <Button icon={<UploadOutlined />}>Chụp ảnh / Tải lên</Button>
                    </Upload>
                );
            default:
                return <Input allowClear suffix={<span className="w-0" />} size="large" className="hover:border-blue-400 focus:border-blue-500 transition-colors" />;
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 pt-8 pb-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start font-sans">
                <div className="max-w-4xl w-full">
                    <Tabs
                        type="card"
                        items={[
                            {
                                key: 'MAIN',
                                label: 'Thu thập thông tin',
                                children: (
                                    <Card className="shadow-2xl border-0 rounded-b-2xl rounded-tr-2xl overflow-hidden bg-white/80 backdrop-blur-sm mt-0">
                                        <Result
                                            status="success"
                                            title="Cập nhật thông tin thành công!"
                                            subTitle="Cảm ơn bạn đã cung cấp thông tin. Dưới đây là dữ liệu đã được lưu lên hệ thống:"
                                            extra={[
                                                <Button 
                                                    type="primary" 
                                                    key="back" 
                                                    size="large"
                                                    onClick={() => {
                                                        setIsSubmitted(false);
                                                        // We must use populateFormData to convert image strings to file arrays
                                                        const formData = { ...userData };
                                                        formConfig.config.forEach((field: any) => {
                                                            if (field.type === 'image' && typeof formData[field.name] === 'string') {
                                                                const urls = formData[field.name].split(',').map((u: string) => u.trim()).filter(Boolean);
                                                                formData[field.name] = urls.map((url: string, index: number) => ({
                                                                    uid: `-${index}`,
                                                                    name: `image-${index + 1}.png`,
                                                                    status: 'done',
                                                                    url: url,
                                                                }));
                                                            }
                                                        });
                                                        form.setFieldsValue(formData);
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    Quay lại chỉnh sửa
                                                </Button>,
                                            ]}
                                        >
                                            <div className="bg-gray-50/80 backdrop-blur border border-gray-100 p-6 rounded-xl text-left mt-2">
                                                <h3 className="font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Thông tin vừa cập nhật</h3>
                                                <div className="space-y-3">
                                                    {formConfig.config?.map((field: any) => {
                                                        if (field.isVerificationKey || field.isHidden) return null;
                                                        const value = userData[field.name];
                                                        const isImage = field.type === 'image' && value && typeof value === 'string' && (value.startsWith('http') || value.startsWith('/'));
                                                        
                                                        return (
                                                            <div key={field.name} className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
                                                                <span className="text-gray-500 font-medium sm:w-1/3">{field.label}:</span>
                                                                <span className="text-gray-900 font-semibold sm:w-2/3 text-left sm:text-right break-words">
                                                                    {isImage ? (
                                                                        <div className="flex flex-col gap-1 sm:items-end">
                                                                            {value.split(',').map((url: string, idx: number) => (
                                                                                <a key={idx} href={url.trim()} target="_blank" rel="noreferrer" className="text-blue-600 underline">Xem ảnh {idx + 1}</a>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        value || <span className="text-gray-400 font-normal italic">Chưa có thông tin</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </Result>
                                    </Card>
                                )
                            },
                            {
                                key: 'INSTRUCTION',
                                label: 'Hướng dẫn sử dụng',
                                children: (
                                    <div className="mt-4">
                                        <PageInstruction pageId={`dynamic-form-${formConfig?.slug || id}`} />
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 pt-8 pb-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start font-sans">
            <div className="max-w-4xl w-full">
                <Tabs
                    type="card"
                    items={[
                        {
                            key: 'MAIN',
                            label: 'Thu thập thông tin',
                            children: (
                                <Card className="shadow-2xl border-0 rounded-b-2xl rounded-tr-2xl overflow-hidden bg-white/80 backdrop-blur-sm mt-0">
                                    <div className="text-center mb-10">
                                        <div className="inline-block p-3 rounded-full bg-blue-100 mb-4">
                                            <CheckCircleOutlined className="text-3xl text-blue-600" />
                                        </div>
                                        <Title level={2} className="!text-gray-800 !mb-2 !font-bold tracking-tight">{formConfig.name}</Title>
                                        <Paragraph className="text-gray-500 text-lg">{formConfig.description}</Paragraph>
                                    </div>

                                    <div style={{ display: !userData && verificationKeyField ? 'block' : 'none' }}>
                                        <div className="bg-blue-50 p-6 rounded-md border border-blue-100 mb-6">
                                            <div className="flex items-center text-blue-700 mb-4">
                                                <LockOutlined className="text-xl mr-2" />
                                                <span className="font-medium text-lg">Xác thực thông tin</span>
                                            </div>
                                            <p className="text-gray-600 mb-4 text-sm">Vui lòng nhập <b>{verificationKeyField?.label}</b> của bạn để tiếp tục.</p>
                                            
                                            <Form layout="vertical" onFinish={handleVerify}>
                                                <Form.Item
                                                    name="verificationValue"
                                                    rules={[{ required: !userData && !!verificationKeyField, message: `Vui lòng nhập ${verificationKeyField?.label}` }]}
                                                >
                                                    <Input size="large" placeholder={`Nhập ${verificationKeyField?.label}...`} />
                                                </Form.Item>
                                                <Button type="primary" size="large" htmlType="submit" loading={verifying} block>
                                                    Tiếp tục
                                                </Button>
                                            </Form>
                                        </div>
                                    </div>

                                    <div style={{ display: !(!userData && verificationKeyField) ? 'block' : 'none' }}>
                                        <Form
                                            form={form}
                                            layout="vertical"
                                            onFinish={handleSubmit}
                                            className="space-y-4"
                                        >
                                            {userData && (
                                                <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-sm mb-8 flex items-center animate-fade-in">
                                                    <CheckCircleOutlined className="text-xl mr-3" /> 
                                                    <span className="font-medium">Xác thực thành công! Bạn có thể cập nhật thông tin bên dưới.</span>
                                                </div>
                                            )}

                                            <div className="space-y-6">
                                            {/* Editable Fields */}
                                            {formConfig.config?.filter((f: any) => f.isEditable && !f.isVerificationKey && !f.isHidden).map((field: any) => {
                                                const rules = [];
                                                if (field.required) rules.push({ required: true, message: `Vui lòng nhập ${field.label}` });
                                                if (field.type === 'cccd') rules.push({ len: 12, message: 'Số CCCD phải đủ 12 số' });
                                                if (field.type === 'phone') rules.push({ min: 10, max: 11, message: 'Số điện thoại không hợp lệ' });

                                                return (
                                                    <Form.Item
                                                        key={field.name}
                                                        name={field.name}
                                                        label={<span className="font-semibold text-blue-700 text-sm uppercase tracking-wide">{field.label}</span>}
                                                        rules={rules}
                                                        className="mb-0 bg-blue-50/50 p-4 rounded-lg border border-blue-100"
                                                        valuePropName={field.type === 'image' ? 'fileList' : 'value'}
                                                        getValueFromEvent={field.type === 'image' ? normFile : undefined}
                                                    >
                                                        {renderInputElement(field)}
                                                    </Form.Item>
                                                );
                                            })}
                                            
                                            {/* Read-only Fields */}
                                            {formConfig.config?.filter((f: any) => !f.isEditable && !f.isVerificationKey && !f.isHidden).map((field: any) => {
                                                return (
                                                    <Form.Item
                                                        key={field.name}
                                                        name={field.name}
                                                        label={<span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{field.label}</span>}
                                                        tooltip="Trường này chỉ được phép xem, không thể sửa"
                                                        className="mb-0"
                                                    >
                                                        {renderInputElement(field)}
                                                    </Form.Item>
                                                );
                                            })}
                                            </div>

                                            <div className="pt-8 mt-8 border-t border-gray-100">
                                                <Button 
                                                    type="primary" 
                                                    size="large" 
                                                    htmlType="submit" 
                                                    loading={submitting} 
                                                    block 
                                                    className="h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 rounded-xl"
                                                >
                                                    Cập nhật Thông tin
                                                </Button>
                                            </div>
                                        </Form>
                                    </div>
                                </Card>
                            )
                        },
                        {
                            key: 'INSTRUCTION',
                            label: 'Hướng dẫn sử dụng',
                            children: (
                                <div className="mt-4">
                                    <PageInstruction pageId={`dynamic-form-${formConfig?.slug || id}`} />
                                </div>
                            )
                        }
                    ]}
                />
                
                <div className="text-center mt-6 text-gray-400 text-sm">
                    Hệ thống Thu thập thông tin - BVĐK Lạng Sơn
                </div>
            </div>
        </div>
    );
}
