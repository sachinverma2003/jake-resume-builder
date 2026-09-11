const { escapeLatex } = require('./template.js');
const input = 'saving $2,000 and 100% bonus on C++ & Python project_alpha';
console.log('INPUT :', input);
console.log('OUTPUT:', escapeLatex(input));
