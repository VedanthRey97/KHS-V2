import fs from 'fs';

let content = fs.readFileSync('App.tsx', 'utf-8');

const replacements = [
  ['bg-white', 'bg-[#1a1a1a]'],
  ['bg-[#1a1a1a]/70', 'bg-[#121212]/70'],
  ['bg-[#1a1a1a]/40', 'bg-[#121212]/40'],
  ['bg-[#1a1a1a]/50', 'bg-[#121212]/50'],
  ['bg-[#1a1a1a]/5', 'bg-white/5'],
  ['bg-[#1a1a1a]/10', 'bg-white/10'],
  ['border-[#1a1a1a]/5', 'border-white/5'],
  ['border-[#1a1a1a]/10', 'border-white/10'],
  ['text-[#1a1a1a]', 'text-white'],
  ['bg-[#121212]', 'bg-white'],
  ['text-[#121212]', 'text-[#121212]'], // wait, if I change bg-[#121212] to bg-white, I should change text-white to text-[#121212] on those buttons
  ['bg-gray-50', 'bg-[#222]'],
  ['bg-gray-100', 'bg-[#2a2a2a]'],
  ['border-gray-50', 'border-[#2a2a2a]'],
  ['border-gray-100', 'border-[#333]'],
  ['border-gray-200', 'border-[#444]'],
  ['text-gray-200', 'text-[#666]'],
  ['text-gray-300', 'text-[#888]'],
  ['text-gray-400', 'text-[#aaa]'],
  ['text-gray-500', 'text-[#ccc]'],
  ['text-gray-600', 'text-[#eee]'],
  ['text-gray-800', 'text-white'],
  ['bg-[#fdfdfd]', 'bg-[#111]'],
  ['bg-[#fcfcfc]', 'bg-[#151515]'],
  ['bg-black', 'bg-[#0a0a0a]'],
  ['text-black', 'text-white'],
  ['hover:bg-gray-50', 'hover:bg-[#333]'],
  ['hover:bg-gray-100', 'hover:bg-[#444]'],
  ['hover:text-black', 'hover:text-white'],
  ['border-white/5', 'border-white/10'],
  ['border-white/10', 'border-white/20'],
];

// First, fix the bg-white replacements that were already done by npx replace-in-file
// Actually, let's just read the original file if we can, or just apply on top of the current one.
// The current one has `bg-[#1a1a1a]` instead of `bg-white`.

let newContent = content;

// Let's do a more precise replacement
newContent = newContent.replace(/bg-\[#121212\] text-white/g, 'bg-white text-[#121212]');
newContent = newContent.replace(/text-\[#121212\]/g, 'text-white');
newContent = newContent.replace(/bg-white text-\[#121212\]/g, 'bg-white text-[#121212]'); // revert the previous if it matched
newContent = newContent.replace(/bg-\[#121212\]/g, 'bg-white');

newContent = newContent.replace(/bg-gray-50/g, 'bg-[#222]');
newContent = newContent.replace(/bg-gray-100/g, 'bg-[#2a2a2a]');
newContent = newContent.replace(/border-gray-50/g, 'border-[#2a2a2a]');
newContent = newContent.replace(/border-gray-100/g, 'border-[#333]');
newContent = newContent.replace(/border-gray-200/g, 'border-[#444]');
newContent = newContent.replace(/text-gray-200/g, 'text-[#666]');
newContent = newContent.replace(/text-gray-300/g, 'text-[#888]');
newContent = newContent.replace(/text-gray-400/g, 'text-[#aaa]');
newContent = newContent.replace(/text-gray-500/g, 'text-[#ccc]');
newContent = newContent.replace(/text-gray-600/g, 'text-[#eee]');
newContent = newContent.replace(/text-gray-800/g, 'text-white');
newContent = newContent.replace(/bg-\[#fdfdfd\]/g, 'bg-[#111]');
newContent = newContent.replace(/bg-\[#fcfcfc\]/g, 'bg-[#151515]');
newContent = newContent.replace(/bg-black/g, 'bg-[#0a0a0a]');
newContent = newContent.replace(/text-black/g, 'text-white');

// Fix the bg-[#1a1a1a] opacity variants
newContent = newContent.replace(/bg-\[#1a1a1a\]\/70/g, 'bg-[#121212]/70');
newContent = newContent.replace(/bg-\[#1a1a1a\]\/40/g, 'bg-[#121212]/40');
newContent = newContent.replace(/bg-\[#1a1a1a\]\/50/g, 'bg-[#121212]/50');
newContent = newContent.replace(/bg-\[#1a1a1a\]\/5/g, 'bg-white/5');
newContent = newContent.replace(/bg-\[#1a1a1a\]\/10/g, 'bg-white/10');
newContent = newContent.replace(/border-\[#1a1a1a\]\/5/g, 'border-white/5');
newContent = newContent.replace(/border-\[#1a1a1a\]\/10/g, 'border-white/10');
newContent = newContent.replace(/text-\[#1a1a1a\]/g, 'text-white');

fs.writeFileSync('App.tsx', newContent);
console.log('Done replacing in App.tsx');
