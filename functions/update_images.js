const fs = require('fs');
const fetch = require('node-fetch');

async function run() {
  const potholeBuf = await fetch('https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=400&auto=format&fit=crop').then(r => r.buffer());
  const catBuf = await fetch('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400&auto=format&fit=crop').then(r => r.buffer());
  
  const potholeB64 = 'data:image/jpeg;base64,' + potholeBuf.toString('base64');
  const catB64 = 'data:image/jpeg;base64,' + catBuf.toString('base64');
  
  let text = fs.readFileSync('src/test/testCF1.ts', 'utf8');
  text = text.replace(/const potholeImageUrl = '[^']+';/, "const potholeImageUrl = '" + potholeB64 + "';");
  text = text.replace(/const catImageUrl = '[^']+';/, "const catImageUrl = '" + catB64 + "';");
  
  fs.writeFileSync('src/test/testCF1.ts', text);
}

run();
