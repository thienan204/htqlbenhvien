import sys

content = open('src/app/clinical-scheduling/schedule/page.tsx', 'r', encoding='utf-8').read()
content = content.replace("import { FileExcelOutlined, FilePdfOutlined, PrinterOutlined, EditOutlined, DeleteOutlined, FileAddOutlined, SaveOutlined } from '@ant-design/icons';", "import { FileExcelOutlined, FilePdfOutlined, PrinterOutlined, EditOutlined, DeleteOutlined, FileAddOutlined, SaveOutlined, TableOutlined } from '@ant-design/icons';")
open('src/app/clinical-scheduling/schedule/page.tsx', 'w', encoding='utf-8').write(content)
print('Done add import')
