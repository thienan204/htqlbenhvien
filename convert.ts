import { xmlDictionaryData } from './src/data/xml-dictionary';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(
    path.join(dataDir, 'xml-dictionary.json'),
    JSON.stringify(xmlDictionaryData, null, 2),
    'utf8'
);

console.log('JSON File created at:', path.join(dataDir, 'xml-dictionary.json'));
