const fs = require('fs');
const pdfParse = require('pdf-parse');

const dataBuffer = fs.readFileSync('mau/06-byt-kem.pdf');

pdfParse(dataBuffer).then(function(data) {
    const text = data.text;
    const lines = text.split('\n');
    console.log(`Total pages: ${data.numpages}`);
    
    console.log("--- START OF DOCUMENT ---");
    for(let i=0; i<Math.min(100, lines.length); i++) {
        console.log(lines[i]);
    }

    console.log("--- DATA SAMPLE ---");
    for(let i=1000; i<Math.min(1050, lines.length); i++) {
        console.log(lines[i]);
    }
});
