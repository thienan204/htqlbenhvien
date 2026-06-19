import { useState } from 'react';
import { message } from 'antd';
import { getBasePath } from '@/utils/config';

export function useImageUpload(maxImageSizeMB: number) {
    const [fileList, setFileList] = useState<any[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');

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

    const handleFileChange = (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadProps.customRequest({ file: e.target.files[0] });
        }
        e.target.value = '';
    };

    return {
        fileList,
        previewOpen,
        previewImage,
        setPreviewOpen,
        uploadProps,
        handleFileChange
    };
}
