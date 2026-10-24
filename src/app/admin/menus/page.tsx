'use client';

import React, { useState, useEffect } from 'react';
import { Tree, Card, Button, Form, Input, Select, Switch, message, Modal, Spin, Popconfirm, Tooltip, Divider, AutoComplete, Tag, Radio, Tabs, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ReloadOutlined, EditOutlined, DragOutlined, BookOutlined, SettingOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import * as Icons from '@ant-design/icons';
import { getBasePath } from '@/utils/config';

const { Option } = Select;

interface MenuNode {
    id: string;
    title: string;
    path: string | null;
    targetPath: string | null;
    icon: string | null;
    parentId: string | null;
    order: number;
    permissionCode: string | null;
    isActive: boolean;
    isAdminOnly?: boolean;
    status?: string;
    isSpecialGroup: string | null;
    showInPaths?: string[];
    children?: MenuNode[];
}

import defaultSystemRoutes from '@/config/systemRoutes.json';

// Danh sách các icon phổ biến cho Sidebar
const ICON_LIST = [
    'DashboardOutlined', 'FileExcelOutlined', 'ExperimentOutlined', 'TableOutlined', 
    'SafetyCertificateOutlined', 'BankOutlined', 'TeamOutlined', 'FileTextOutlined',
    'ReconciliationOutlined', 'ExceptionOutlined', 'DesktopOutlined', 'BarChartOutlined',
    'PictureOutlined', 'SettingOutlined', 'AppstoreOutlined', 'UserOutlined', 
    'ProjectOutlined', 'FolderOutlined', 'CheckSquareOutlined'
];

export default function MenuBuilderPage() {
    const [menus, setMenus] = useState<MenuNode[]>([]);
    const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
    const [availablePaths, setAvailablePaths] = useState<{ value: string; label: string }[]>(defaultSystemRoutes || []);
    
    // Edit form state
    const [selectedNode, setSelectedNode] = useState<MenuNode | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [form] = Form.useForm();
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchMenus();
        fetchRoutes();
    }, []);

    const fetchRoutes = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/admin/routes`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setAvailablePaths(data);
                }
            }
        } catch (e) {
            console.error('Lỗi khi tải danh sách routes:', e);
        }
    };

    const fetchMenus = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/menus`);
            if (res.ok) {
                const data = await res.json();
                setMenus(data);
                buildTree(data);
            } else {
                message.error('Lỗi khi tải dữ liệu Menu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    const buildTree = (flatData: MenuNode[]) => {
        const map = new Map<string, MenuNode & { key: string; children: any[] }>();
        const roots: any[] = [];
        const keysToExpand: string[] = [];

        flatData.forEach(item => {
            map.set(item.id, { ...item, key: item.id, children: [] });
        });

        flatData.forEach(item => {
            const node = map.get(item.id)!;
            if (item.parentId && map.has(item.parentId)) {
                map.get(item.parentId)!.children.push(node);
                keysToExpand.push(item.parentId);
            } else {
                roots.push(node);
            }
        });

        // Sort children by order
        const sortRecursive = (nodes: any[]) => {
            nodes.sort((a, b) => a.order - b.order);
            nodes.forEach(n => {
                if (n.children.length > 0) sortRecursive(n.children);
            });
        };
        sortRecursive(roots);

        setTreeData(roots);
        if (expandedKeys.length === 0) {
            setExpandedKeys([...new Set(keysToExpand)]);
        }
    };

    const onDrop: TreeProps['onDrop'] = async (info) => {
        const dropKey = info.node.key as string;
        const dragKey = info.dragNode.key as string;
        const dropPos = info.node.pos.split('-');
        const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

        // Tạo mảng phẳng để sắp xếp lại order
        const loop = (data: TreeDataNode[], key: React.Key, callback: (node: TreeDataNode, i: number, data: TreeDataNode[]) => void) => {
            for (let i = 0; i < data.length; i++) {
                if (data[i].key === key) {
                    return callback(data[i], i, data);
                }
                if (data[i].children) {
                    loop(data[i].children!, key, callback);
                }
            }
        };

        const data = JSON.parse(JSON.stringify(treeData));
        let dragObj: TreeDataNode;
        loop(data, dragKey, (item, index, arr) => {
            arr.splice(index, 1);
            dragObj = item;
        });

        if (!info.dropToGap) {
            // Thả vào trong một node -> biến thành con
            loop(data, dropKey, (item) => {
                item.children = item.children || [];
                item.children.unshift(dragObj);
            });
        } else if ((info.node.children || []).length > 0 && info.node.expanded && dropPosition === 1) {
            // Thả vào dưới cùng một node đang mở
            loop(data, dropKey, (item) => {
                item.children = item.children || [];
                item.children.unshift(dragObj);
            });
        } else {
            // Thả vào giữa 2 node
            let ar: TreeDataNode[] = [];
            let i: number = 0;
            loop(data, dropKey, (_item, index, arr) => {
                ar = arr;
                i = index;
            });
            if (dropPosition === -1) {
                ar.splice(i, 0, dragObj!);
            } else {
                ar.splice(i + 1, 0, dragObj!);
            }
        }

        setTreeData(data);

        // Chuẩn bị dữ liệu gửi lên server
        const updates: { id: string; parentId: string | null; order: number }[] = [];
        
        const traverseAndCollect = (nodes: TreeDataNode[], parentId: string | null = null) => {
            nodes.forEach((node, index) => {
                updates.push({
                    id: node.key as string,
                    parentId,
                    order: index * 10
                });
                if (node.children) {
                    traverseAndCollect(node.children, node.key as string);
                }
            });
        };
        traverseAndCollect(data);

        // Gửi API update batch
        try {
            const res = await fetch(`${getBasePath()}/api/menus`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                message.success('Cập nhật vị trí thành công');
                fetchMenus(); // Tải lại để có data chuẩn
            } else {
                message.error('Lỗi khi lưu vị trí');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleSelect = (selectedKeys: React.Key[], info: any) => {
        if (selectedKeys.length > 0) {
            const id = selectedKeys[0] as string;
            const node = menus.find(m => m.id === id);
            if (node) {
                setSelectedNode(node);
                setIsEditing(true);
                setIsCreating(false);
                form.setFieldsValue({
                    ...node,
                    status: node.status || 'OFFICIAL'
                });
            }
        } else {
            setSelectedNode(null);
            setIsEditing(false);
            form.resetFields();
        }
    };

    const handleAddNode = (parentId: string | null = null) => {
        setIsCreating(true);
        setIsEditing(false);
        setSelectedNode(null);
        form.resetFields();
        form.setFieldsValue({
            parentId,
            isActive: true,
            isAdminOnly: false,
            status: 'TESTING',
            order: 0
        });
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const url = isCreating ? `${getBasePath()}/api/menus` : `${getBasePath()}/api/menus/${selectedNode?.id}`;
            const method = isCreating ? 'POST' : 'PUT';

            // Xử lý parentId nếu bị clear (undefined) thì đưa về null để Prisma có thể update thành Root
            const payload = {
                ...values,
                parentId: values.parentId === undefined ? null : values.parentId
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(isCreating ? 'Đã thêm Menu' : 'Đã cập nhật Menu');
                setIsCreating(false);
                fetchMenus();
            } else {
                message.error('Lỗi khi lưu');
            }
        } catch (error) {
            console.log('Validate failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedNode) return;
        try {
            const res = await fetch(`${getBasePath()}/api/menus/${selectedNode.id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa Menu');
                setSelectedNode(null);
                setIsEditing(false);
                form.resetFields();
                fetchMenus();
            } else {
                message.error('Lỗi khi xóa');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const renderIcon = (iconName: string | null) => {
        if (!iconName) return null;
        const Icon = (Icons as any)[iconName];
        return Icon ? <Icon /> : null;
    };

    return (
        <div className="p-6 max-w-[98%] mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Menu Builder</h1>
                    <p className="text-slate-500">Kéo thả để sắp xếp thanh Sidebar bên trái</p>
                </div>
                <div className="space-x-3">
                    <Button onClick={() => fetchMenus()} icon={<ReloadOutlined />}>Làm mới</Button>
                    <Button type="primary" onClick={() => handleAddNode(null)} icon={<PlusOutlined />}>Tạo Nhóm Mới</Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-1/2">
                    <Card title="Cây Menu Sidebar" className="shadow-sm rounded-xl h-full" styles={{ body: { padding: 16 } }}>
                        {loading && treeData.length === 0 ? (
                            <div className="p-10 flex justify-center"><Spin /></div>
                        ) : (
                            <Tree
                                className="draggable-tree"
                                draggable
                                blockNode
                                onDrop={onDrop}
                                treeData={treeData}
                                onSelect={handleSelect}
                                expandedKeys={expandedKeys}
                                onExpand={setExpandedKeys}
                                titleRender={(nodeData: any) => {
                                    return (
                                        <div className="flex items-center gap-2 py-1 px-2 group">
                                            <span className="text-slate-400">{renderIcon(nodeData.icon) || <DragOutlined />}</span>
                                            <span className={`font-medium ${!nodeData.isActive ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                                {nodeData.title}
                                            </span>
                                            {nodeData.isAdminOnly && (
                                                <Tag color="volcano" className="text-[10px] py-0 px-1.5 leading-4 border-none ml-1">
                                                    Quản trị
                                                </Tag>
                                            )}
                                            {nodeData.status === 'TESTING' && (
                                                <Tag color="warning" className="text-[10px] py-0 px-1.5 leading-4 border-amber-300 ml-1">
                                                    Thử nghiệm
                                                </Tag>
                                            )}
                                            {nodeData.permissionCode && (
                                                <span className="ml-auto text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded border border-blue-100 hidden sm:inline-block">
                                                    {nodeData.permissionCode}
                                                </span>
                                            )}
                                        </div>
                                    );
                                }}
                            />
                        )}
                    </Card>
                </div>

                <div className="w-full lg:w-1/2">
                    {(isEditing || isCreating) ? (
                        <Card 
                            title={isCreating ? "Thêm Menu Mới" : "Chỉnh Sửa Menu"} 
                            className="shadow-sm rounded-xl sticky top-24"
                            extra={
                                isEditing && (
                                    <Popconfirm title="Bạn có chắc chắn muốn xóa Menu này (và tất cả menu con)?" onConfirm={handleDelete} okText="Xóa" cancelText="Hủy">
                                        <Button danger icon={<DeleteOutlined />} type="text">Xóa</Button>
                                    </Popconfirm>
                                )
                            }
                        >
                            <Form form={form} layout="vertical">
                                <Tabs
                                    type="card"
                                    items={[
                                        {
                                            key: 'basic',
                                            label: (
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <SettingOutlined />
                                                    Cấu hình Menu
                                                </span>
                                            ),
                                            children: (
                                                <div className="pt-2">
                                                    <Form.Item name="title" label="Tên Menu" rules={[{ required: true, message: 'Vui lòng nhập tên menu' }]}>
                                                        <Input placeholder="Ví dụ: Đọc dữ liệu Excel" />
                                                    </Form.Item>
                                                    
                                                    <Form.Item name="path" label="Đường dẫn hiển thị (URL Alias)">
                                                        <Input placeholder="Ví dụ: /doc-file-excel-1 (Bỏ trống nếu là Nhóm)" />
                                                    </Form.Item>

                                                    <Form.Item name="targetPath" label={
                                                        <span>
                                                            Đường dẫn gốc (Target URL)
                                                            <Tooltip title="Nếu bạn điền URL Alias khác với mặc định, hãy nhập Đường dẫn gốc vào đây để hệ thống hiển thị đúng nội dung.">
                                                                <Icons.QuestionCircleOutlined className="ml-2 text-gray-400" />
                                                            </Tooltip>
                                                        </span>
                                                    }>
                                                        <AutoComplete 
                                                            options={availablePaths}
                                                            placeholder="Chọn hoặc tìm kiếm route (VD: /xml-checker, lịch lâm sàng, excel...)" 
                                                            filterOption={(inputValue, option) => {
                                                                const search = (inputValue || '').trim().toLowerCase();
                                                                const val = ((option?.value as string) || '').toLowerCase();
                                                                const lbl = ((option?.label as string) || '').toLowerCase();
                                                                return val.includes(search) || lbl.includes(search);
                                                            }}
                                                            allowClear
                                                        />
                                                    </Form.Item>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Form.Item name="icon" label="Biểu tượng (Icon)">
                                                            <Select placeholder="Chọn Icon" allowClear showSearch>
                                                                {ICON_LIST.map(icon => {
                                                                    const IconCmp = (Icons as any)[icon];
                                                                    return (
                                                                        <Option key={icon} value={icon}>
                                                                            <div className="flex items-center gap-3">
                                                                                {IconCmp && <IconCmp className="text-lg text-slate-500" />}
                                                                                <span>{icon}</span>
                                                                            </div>
                                                                        </Option>
                                                                    )
                                                                })}
                                                            </Select>
                                                        </Form.Item>
                                                        
                                                        <Form.Item name="parentId" label="Menu Cha (Nhóm)">
                                                            <Select placeholder="Root (Menu Cấp 1)" allowClear>
                                                                {menus.filter(m => m.id !== selectedNode?.id && m.parentId === null).map(m => (
                                                                    <Option key={m.id} value={m.id}>{m.title}</Option>
                                                                ))}
                                                            </Select>
                                                        </Form.Item>
                                                    </div>

                                                    <Form.Item 
                                                        name="status" 
                                                        label="Trạng thái Vận hành Chức năng"
                                                        tooltip="Chọn Thử nghiệm đối với chức năng mới đang triển khai, Chính thức đối với chức năng đã nghiệm thu"
                                                    >
                                                        <Radio.Group buttonStyle="solid" className="w-full grid grid-cols-2 text-center">
                                                            <Radio.Button value="OFFICIAL" className="text-xs font-semibold">
                                                                🟢 Hoạt động chính thức
                                                            </Radio.Button>
                                                            <Radio.Button value="TESTING" className="text-xs font-semibold">
                                                                🟡 Thử nghiệm (Beta)
                                                            </Radio.Button>
                                                        </Radio.Group>
                                                    </Form.Item>

                                                    <Form.Item 
                                                        name="permissionCode" 
                                                        label="Mã Phân Quyền (Permission Code)"
                                                        tooltip="Mã này sẽ xuất hiện trong phần Quản lý Role để tích chọn cấp quyền. Ví dụ: MENU_DOC_FILE_EXCEL"
                                                    >
                                                        <Input placeholder="Ví dụ: MENU_TEST" style={{ textTransform: 'uppercase' }} />
                                                    </Form.Item>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Form.Item name="isActive" label="Trạng thái hiển thị" valuePropName="checked">
                                                            <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
                                                        </Form.Item>
                                                        <Form.Item 
                                                            name="isAdminOnly" 
                                                            label="Phân loại Menu" 
                                                            valuePropName="checked"
                                                            tooltip="Bật nếu menu này chỉ dành cho Quản trị viên (sẽ hiển thị ở chế độ Quản trị và chỉ ADMIN được vào)"
                                                        >
                                                            <Switch checkedChildren="Quản trị" unCheckedChildren="Người dùng" />
                                                        </Form.Item>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Form.Item 
                                                            name="isSpecialGroup" 
                                                            label="Loại Menu Đặc Biệt"
                                                            tooltip="Dùng để tự động tải các danh sách chuyên đề vào nhóm này"
                                                        >
                                                            <Select placeholder="Bình thường" allowClear>
                                                                <Option value="SPECIALIZED_RULES">Nhóm Danh Sách Chuyên Đề</Option>
                                                            </Select>
                                                        </Form.Item>
                                                    </div>

                                                    <Form.Item 
                                                        name="showInPaths" 
                                                        label="Hiển thị khi truy cập các Module (URL) nào?"
                                                        tooltip="Nhập tiền tố URL (VD: /xml-checker) rồi ấn Enter. Để trống nếu muốn hiển thị ở mọi nơi (giữ tính tương thích)."
                                                    >
                                                        <Select
                                                            mode="tags"
                                                            placeholder="VD: /xml-checker (ấn Enter để thêm)"
                                                            style={{ width: '100%' }}
                                                            tokenSeparators={[',']}
                                                            options={[
                                                                { value: '/xml-checker', label: '/xml-checker (Kiểm tra XML)' },
                                                                { value: '/error-management', label: '/error-management (Xử lý Lỗi IT)' },
                                                                { value: '/staff', label: '/staff (Quản lý Nhân sự)' },
                                                                { value: '/chuyen-de', label: '/chuyen-de (Chuyên đề)' }
                                                            ]}
                                                        />
                                                    </Form.Item>
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'doc',
                                            label: (
                                                <span className="flex items-center gap-1.5 font-medium text-indigo-600">
                                                    <BookOutlined />
                                                    Tài liệu & Hướng dẫn sử dụng
                                                </span>
                                            ),
                                            children: (
                                                <div className="pt-2">
                                                    <Alert
                                                        type="info"
                                                        showIcon
                                                        title="Quy định bắt buộc tài liệu hướng dẫn"
                                                        description="Mỗi chức năng khi tạo mới bắt buộc phải có tài liệu và hướng dẫn sử dụng kèm theo để khoa phòng có thể tra cứu và vận hành ngay."
                                                        className="mb-3 text-xs"
                                                    />

                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-semibold text-slate-700">Nội dung Hướng dẫn (HTML / Text):</span>
                                                        <Button 
                                                            size="small" 
                                                            type="dashed"
                                                            onClick={() => {
                                                                const title = form.getFieldValue('title') || 'Chức năng mới';
                                                                const template = `<h3>TÀI LIỆU & HƯỚNG DẪN SỬ DỤNG: ${title.toUpperCase()}</h3>
<p><em>(Quy trình vận hành chuẩn SOP - Bệnh viện Đa khoa Lạng Sơn)</em></p>
<h4>I. Mục đích & Phạm vi áp dụng:</h4>
<p>Chức năng <strong>${title}</strong> phục vụ công tác chuyên môn, hỗ trợ các khoa phòng bệnh viện thực hiện quản lý và tác nghiệp chính xác.</p>
<h4>II. Đối tượng sử dụng:</h4>
<p>Cán bộ, Bác sĩ, Điều dưỡng, Nhân viên khoa phòng và bộ phận CNTT liên quan.</p>
<h4>III. Quy trình thao tác từng bước:</h4>
<ol>
  <li><strong>Bước 1:</strong> Đăng nhập hệ thống và bấm chọn menu <strong>${title}</strong>.</li>
  <li><strong>Bước 2:</strong> Thiết lập các bộ lọc hoặc kiểm tra danh sách hiển thị trên màn hình.</li>
  <li><strong>Bước 3:</strong> Thực hiện nhập dữ liệu theo đúng biểu mẫu quy định.</li>
  <li><strong>Bước 4:</strong> Bấm nút <strong>Lưu / Xác nhận</strong> để hoàn tất quy trình.</li>
</ol>
<h4>IV. Lưu ý & Đầu mối hỗ trợ kỹ thuật:</h4>
<p>Mọi vướng mắc về mặt phần mềm, vui lòng liên hệ <strong>Phòng Công nghệ Thông tin</strong> (Ext: 115).</p>`;
                                                                form.setFieldsValue({ initialInstruction: template });
                                                                message.success('Đã tự động tạo khung tài liệu SOP chuẩn bệnh viện!');
                                                            }}
                                                            className="text-xs text-blue-600 border-blue-300"
                                                        >
                                                            ⚡ Tự động sinh mẫu tài liệu theo tên Menu
                                                        </Button>
                                                    </div>

                                                    <Form.Item name="initialInstruction">
                                                        <Input.TextArea 
                                                            rows={10} 
                                                            placeholder="Nhập nội dung tài liệu hướng dẫn sử dụng cho chức năng này (hoặc bấm nút Sinh mẫu tự động ở trên)..." 
                                                            className="font-mono text-xs"
                                                        />
                                                    </Form.Item>
                                                </div>
                                            )
                                        }
                                    ]}
                                />
                                <Form.Item name="order" hidden><Input /></Form.Item>

                                <Divider className="my-4" />

                                <div className="flex justify-end gap-3">
                                    {isEditing && selectedNode && (
                                        <Button onClick={() => handleAddNode(selectedNode.parentId)}>Tạo mới cùng cấp</Button>
                                    )}
                                    {isEditing && selectedNode && !selectedNode.parentId && (
                                        <Button onClick={() => handleAddNode(selectedNode.id)}>Thêm menu con</Button>
                                    )}
                                    <Button type="primary" onClick={handleSave} icon={<SaveOutlined />} loading={loading}>
                                        Lưu thay đổi
                                    </Button>
                                </div>
                            </Form>
                        </Card>
                    ) : (
                        <Card className="shadow-sm rounded-xl flex items-center justify-center min-h-[400px] bg-slate-50 border-dashed border-2">
                            <div className="text-center text-slate-400">
                                <EditOutlined className="text-5xl mb-4 opacity-50" />
                                <p className="text-lg">Chọn một menu bên trái để chỉnh sửa</p>
                                <Button type="primary" ghost className="mt-4" onClick={() => handleAddNode(null)} icon={<PlusOutlined />}>Hoặc Tạo Mới</Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
