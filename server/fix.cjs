const fs = require('fs');
let content = fs.readFileSync('src/queues/workers/emailWorker.js', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\${/g, '${');
fs.writeFileSync('src/queues/workers/emailWorker.js', content);
