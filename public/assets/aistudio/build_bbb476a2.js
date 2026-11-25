const fs = require('fs');
const path = require('path');
const sass = require('sass');

const scssPath = path.join(__dirname, 'scss', 'nia.scss');
const distDir = path.join(__dirname, 'dist', 'css');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Build expanded CSS
console.log('📦 Compiling nia.css...');
try {
  const result = sass.compile(scssPath, {
    style: 'expanded',
    loadPaths: [__dirname]
  });
  
  fs.writeFileSync(path.join(distDir, 'nia.css'), result.css);
  console.log('✅ Compiled nia.css');
} catch (err) {
  console.error('❌ Error compiling nia.css:', err);
}

// Build minified CSS
console.log('📦 Compiling nia.min.css...');
try {
  const minResult = sass.compile(scssPath, {
    style: 'compressed',
    loadPaths: [__dirname]
  });
  
  fs.writeFileSync(path.join(distDir, 'nia.min.css'), minResult.css);
  console.log('✅ Compiled nia.min.css');
} catch (err) {
  console.error('❌ Error compiling nia.min.css:', err);
}

console.log('🎉 Build complete!');