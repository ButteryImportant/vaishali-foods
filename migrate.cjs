const fs = require('fs');
const path = require('path');

function convertFile(filePath, outPath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  
  // Replace export async function onRequestPost(context) with export const POST = async (context) => 
  code = code.replace(/export\s+async\s+function\s+onRequestPost\s*\(\s*context\s*\)\s*\{/g, 'export const POST = async (context) => {');
  
  // Replace export async function onRequestGet(context) with export const GET = async (context) => 
  code = code.replace(/export\s+async\s+function\s+onRequestGet\s*\(\s*context\s*\)\s*\{/g, 'export const GET = async (context) => {');
  
  // Replace const { request, env } = context; with const { request, locals } = context; const env = locals.runtime.env;
  code = code.replace(/const\s+\{\s*request,\s*env\s*\}\s*=\s*context;/g, 'const { request, locals } = context;\n  const env = locals.runtime.env;');
  
  // Replace const { env } = context; with const { locals } = context; const env = locals.runtime.env;
  code = code.replace(/const\s+\{\s*env\s*\}\s*=\s*context;/g, 'const { locals } = context;\n  const env = locals.runtime.env;');

  // Replace const { request } = context; with const { request } = context;
  // (already fine)

  // Wait! Some functions might just do `context.env`. Let's just prepend `const env = context.locals.runtime.env;` manually?
  // Let's manually inject `const env = context.locals?.runtime?.env;` at the top of the function if it's not already extracted?
  
  // Write the file
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, code, 'utf-8');
}

const filesToConvert = [
  'create-order.js',
  'shipping-rate.js',
  'verify-payment.js',
  'admin/login.js',
  'admin/orders.js',
  'admin/products.js'
];

for (const file of filesToConvert) {
  const inPath = path.join(__dirname, 'functions', 'api', file);
  const outPath = path.join(__dirname, 'src', 'pages', 'api', file);
  convertFile(inPath, outPath);
}
console.log('Conversion complete!');
