'use client';

import React from 'react';
import {
    HomeOutlined, AppstoreOutlined, DashboardOutlined,
    CarOutlined, TableOutlined, FormOutlined,
    BarChartOutlined, SearchOutlined, BellOutlined,
    MessageOutlined, StarFilled, PlusOutlined,
    RocketOutlined, DollarCircleFilled, GlobalOutlined, BulbFilled, FileTextOutlined
} from '@ant-design/icons';
import { Button, Avatar, Badge, Table, Progress, Tag, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';

// --- Types ---
interface AgentData {
    key: string;
    avatar: string;
    name: string;
    company: string;
    status: 'Canceled' | 'On Hold' | 'In Progress' | 'Completed';
    dueDate: string;
    target: number;
}

// --- Mock Data ---
const AGENTS_DATA: AgentData[] = [
    {
        key: '1',
        avatar: 'https://i.pravatar.cc/150?u=1',
        name: 'Juan C. Cargill',
        company: 'Micro Electronics',
        status: 'Canceled',
        dueDate: '12 Dec',
        target: 71,
    },
    {
        key: '2',
        avatar: 'https://i.pravatar.cc/150?u=2',
        name: 'Johnathan Phelan',
        company: 'Hatchworks',
        status: 'On Hold',
        dueDate: '12 Dec',
        target: 54,
    },
    {
        key: '3',
        avatar: 'https://i.pravatar.cc/150?u=3',
        name: 'Darrell Lowe',
        company: 'Riddle Electronics',
        status: 'In Progress',
        dueDate: '12 Dec',
        target: 97,
    },
    {
        key: '4',
        avatar: 'https://i.pravatar.cc/150?u=4',
        name: 'George T. Cottrell',
        company: 'Pixelcloud',
        status: 'Completed',
        dueDate: '12 Dec',
        target: 88,
    },
];

// --- Components ---

const Sidebar = () => (
    <div className="w-[280px] bg-white h-screen fixed left-0 top-0 border-r border-slate-200 z-20 flex flex-col">
        {/* Logo Area */}
        <div className="h-[60px] flex items-center px-6 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xl tracking-tight">
                <RocketOutlined className="text-blue-500 text-2xl" />
                <span>ArchitectUI</span>
            </div>
            <div className="ml-auto">
                <Button type="text" icon={<AppstoreOutlined className="text-slate-400 text-lg" />} />
            </div>
        </div>

        {/* Scrollable Nav */}
        <div className="flex-1 overflow-y-auto py-4">
            <div className="px-4 mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Navigation</p>
                <div className="bg-blue-50 text-blue-600 rounded-lg px-4 py-2.5 font-semibold flex items-center gap-3 cursor-pointer">
                    <DashboardOutlined className="text-lg" />
                    Dashboard
                </div>
            </div>

            <div className="px-4 mb-2 mt-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Pages</p>
                <div className="text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors">
                    <FileTextOutlined className="text-lg opacity-70" />
                    Pages
                </div>
            </div>

            <div className="px-4 mb-2 mt-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">UI Elements</p>
                <div className="text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors">
                    <CarOutlined className="text-lg opacity-70" />
                    Elements
                </div>
                <div className="text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                    <AppstoreOutlined className="text-lg opacity-70" />
                    Components
                </div>
            </div>

            <div className="px-4 mb-2 mt-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Data</p>
                <div className="text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors">
                    <TableOutlined className="text-lg opacity-70" />
                    Tables
                </div>
                <div className="text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                    <FormOutlined className="text-lg opacity-70" />
                    Forms
                </div>
            </div>

            <div className="px-4 mb-2 mt-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Visualizations</p>
                <div className="text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors">
                    <BarChartOutlined className="text-lg opacity-70" />
                    Charts
                </div>
            </div>
        </div>
    </div>
);



const TopHeader = () => (
    <div className="h-[60px] bg-white/90 backdrop-blur fixed top-0 right-0 left-[280px] z-10 border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
            <Button shape="circle" icon={<AppstoreOutlined className="text-slate-500" />} className="border-none shadow-none bg-transparent hover:bg-slate-100" />
            <Button shape="circle" icon={<SearchOutlined className="text-blue-500 font-bold" />} className="border-none shadow-none bg-transparent hover:bg-slate-100" />
        </div>

        <div className="flex items-center gap-6">
            <Badge count={5} size="small" offset={[-2, 2]}>
                <BellOutlined className="text-slate-400 text-xl cursor-pointer hover:text-slate-600 transition-colors" />
            </Badge>
            <Badge count={2} size="small" color="orange" offset={[-2, 2]}>
                <MessageOutlined className="text-slate-400 text-xl cursor-pointer hover:text-slate-600 transition-colors" />
            </Badge>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                <div className="text-right hidden md:block">
                    <div className="text-sm font-bold text-slate-700">John Doe</div>
                    <div className="text-xs text-slate-400 font-medium">Senior Developer</div>
                </div>
                <Avatar size="large" src="https://i.pravatar.cc/150?u=8" className="border-2 border-white shadow-sm cursor-pointer" />
            </div>
        </div>
    </div>
);

const MetricCard = ({
    title, value, subText, icon, colorClass, increase
}: {
    title: string, value: string, subText: React.ReactNode, icon: React.ReactNode, colorClass: string, increase?: boolean
}) => (
    <div className="bg-white p-6 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-shadow border border-slate-100 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-4">
            <div>
                <div className="text-slate-400 font-bold text-xs uppercase tracking-wide mb-1 opacity-80">{title}</div>
                <div className="text-4xl font-black text-slate-700 tracking-tight flex items-baseline gap-2">
                    {value}
                </div>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm ${colorClass} text-white`}>
                {icon}
            </div>
        </div>
        <div className={`text-sm font-semibold flex items-center gap-1 ${increase ? 'text-green-500' : 'text-red-500'}`}>
            {subText}
        </div>
        {/* Decor bg */}
        <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-5 group-hover:scale-110 transition-transform ${colorClass.replace('bg-', 'bg-')}`}></div>
    </div>
);

export default function ArchitectDemoPage() {
    const columns: ColumnsType<AgentData> = [
        {
            title: '#',
            dataIndex: 'key',
            key: 'key',
            render: (text) => <span className="text-slate-400 font-medium">#{Number(text) + 53}</span>,
            width: 60,
        },
        {
            title: 'Avatar',
            dataIndex: 'avatar',
            key: 'avatar',
            render: (src) => <Avatar src={src} size={40} className="border-2 border-white shadow-sm" />,
            width: 80,
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text) => <div className="font-bold text-slate-700">{text}</div>,
        },
        {
            title: 'Company',
            dataIndex: 'company',
            key: 'company',
            render: (text) => <div className="text-slate-500 font-medium">{text}</div>,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default';
                if (status === 'Completed') color = 'success';
                if (status === 'In Progress') color = 'warning';
                if (status === 'Canceled') color = 'error';
                if (status === 'On Hold') color = 'processing';

                return (
                    <Tag
                        color={color}
                        className="rounded-md px-2 py-0.5 font-bold border-none text-xs uppercase shadow-sm"
                        style={{ lineHeight: '1.8' }}
                    >
                        {status}
                    </Tag>
                );
            },
        },
        {
            title: 'Due Date',
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (text) => <span className="font-semibold text-slate-600">{text}</span>,
        },
        {
            title: 'Target Achievement',
            dataIndex: 'target',
            key: 'target',
            render: (val) => {
                let status: 'success' | 'exception' | 'normal' | 'active' = 'normal';
                let strokeColor = '#1890ff';
                if (val >= 80) { strokeColor = '#10b981'; status = 'success'; } // green
                else if (val >= 60) { strokeColor = '#f59e0b'; status = 'active'; } // yellow
                else if (val < 60 && val > 40) { strokeColor = '#f59e0b'; status = 'active'; } // yellow (same for demo)
                else { strokeColor = '#ef4444'; status = 'exception'; } // red

                return (
                    <div className="w-full max-w-[140px] flex items-center gap-3">
                        <span className={`text-xs font-bold w-8 text-right`} style={{ color: strokeColor }}>{val}%</span>
                        <Progress percent={val} showInfo={false} strokeColor={strokeColor} size="small" status={status} className="m-0 flex-1" />
                    </div>
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Button type="primary" size="small" className="bg-blue-500 hover:bg-blue-600 border-none px-3 font-semibold shadow-sm">Hire</Button>
                    <Button size="small" danger className="px-3 font-semibold border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300">Fire</Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-600">
            <Sidebar />
            <TopHeader />

            <div className="pl-[280px] pt-[60px]">
                <div className="p-8 max-w-[98%] mx-auto space-y-8">

                    {/* Page Title Header */}
                    <div className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-green-500 border border-slate-100">
                                <RocketOutlined className="text-2xl" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 m-0 leading-tight">Analytics Dashboard</h1>
                                <p className="text-slate-500 text-sm mt-1 mb-0 font-medium">This is an example dashboard created using build-in elements and components.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button icon={<StarFilled />} className="bg-slate-700 text-white border-none hover:bg-slate-800 shadow-md" />
                            <Button type="primary" icon={<PlusOutlined />} className="bg-green-500 hover:bg-green-600 border-none h-9 px-4 font-bold shadow-md shadow-green-200">
                                Create New
                            </Button>
                        </div>
                    </div>

                    {/* Stats Cards Row */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-700 mb-4 px-1">Portfolio Performance</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MetricCard
                                title="Cash Deposits"
                                value="1,7M"
                                subText={<><i className="mr-1">↓</i> <span className="font-bold">54.1%</span> less earnings</>}
                                icon={<DollarCircleFilled />}
                                colorClass="bg-yellow-400"
                                increase={false}
                            />
                            <MetricCard
                                title="Invested Dividends"
                                value="9M"
                                subText={<><i className="mr-1">↑</i> <span className="font-bold">14.1%</span> Grow Rate</>}
                                icon={<DashboardOutlined />}
                                colorClass="bg-red-500"
                                increase={true}
                            />
                            <MetricCard
                                title="Capital Gains"
                                value="$563"
                                subText={<><i className="mr-1">↑</i> Increased by <span className="font-bold ml-1">7.35%</span></>}
                                icon={<BulbFilled />}
                                colorClass="bg-green-600"
                                increase={true}
                            />
                        </div>
                        <div className="mt-6 flex justify-center">
                            <Button type="primary" className="bg-blue-600 h-10 px-8 font-bold rounded-lg shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all hover:-translate-y-0.5 border-none">
                                View Complete Report
                            </Button>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-700 mb-4 px-1">Company Agents Status</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <Table
                                columns={columns}
                                dataSource={AGENTS_DATA}
                                // pagination={false} 
                                pagination={{ hideOnSinglePage: true }}
                                className="styled-table"
                                rowClassName="hover:bg-slate-50 transition-colors"
                            />
                        </div>
                    </div>

                </div>
            </div>

            <style jsx global>{`
                .styled-table .ant-table-thead > tr > th {
                    background: transparent;
                    color: #64748b; /* slate-500 */
                    font-weight: 800;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    letter-spacing: 0.05em;
                    padding-top: 20px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .styled-table .ant-table-tbody > tr > td {
                    padding-top: 20px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .styled-table .ant-table {
                    border-radius: 0.75rem;
                }
            `}</style>
        </div>
    );
}
