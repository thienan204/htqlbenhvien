const fs = require('fs');

const files = ['mau02-catalog', 'mau03-catalog', 'mau05-catalog', 'mau06-catalog'];

files.forEach(folder => {
    const path = `src/app/${folder}/page.tsx`;
    let content = fs.readFileSync(path, 'utf8');

    if (!content.includes('const handleDeleteAll = async () =>')) {
        const replaceCode = `    const handleDeleteAll = async () => {
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

    const handleSave = `;
        content = content.replace('    const handleSave = ', replaceCode);
        fs.writeFileSync(path, content, 'utf8');
        console.log(`Patched ${folder}`);
    } else {
        console.log(`Already patched ${folder}`);
    }
});
