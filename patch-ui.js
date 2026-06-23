const fs = require('fs');

const files = ['mau01-catalog'];

files.forEach(folder => {
    const path = `src/app/${folder}/page.tsx`;
    let content = fs.readFileSync(path, 'utf8');

    // 1. Insert handleDeleteAll
    const handleDeleteRegex = /(const handleDelete = async \(id: string\) => \{[\s\S]*?\n    \};\n)/;
    if (content.includes('const handleDeleteAll = async () =>')) {
        console.log(`Skipping handleDeleteAll for ${folder}`);
    } else {
        const replaceCode = `$1
    const handleDeleteAll = async () => {
        try {
            setLoading(true);
            const res = await fetch(\`\${getBasePath()}/api/${folder}\`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa toàn bộ danh mục');
                fetchData();
            } else {
                message.error('Xóa thất bại');
            }
        } catch (error) {
            message.error('Xóa thất bại');
        } finally {
            setLoading(false);
        }
    };
`;
        content = content.replace(handleDeleteRegex, replaceCode);
    }

    // 2. Insert Delete All button
    const buttonRegex = /<Button type="default" icon={<DownloadOutlined \/>} onClick={handleDownloadTemplate}/;
    if (content.includes('Xóa toàn bộ')) {
        console.log(`Skipping Delete All button for ${folder}`);
    } else {
        const replaceBtn = `<Popconfirm
                            title="Xóa toàn bộ danh mục?"
                            description="Hành động này sẽ xóa sạch dữ liệu hiện tại. Bạn có chắc chắn?"
                            onConfirm={handleDeleteAll}
                            okText="Có, Xóa hết"
                            cancelText="Không"
                            okButtonProps={{ danger: true }}
                        >
                            <Button danger type="primary" icon={<DeleteOutlined />}>
                                Xóa toàn bộ
                            </Button>
                        </Popconfirm>
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}`;
        content = content.replace(buttonRegex, replaceBtn);
    }

    fs.writeFileSync(path, content, 'utf8');
    console.log(`Patched ${folder}`);
});
