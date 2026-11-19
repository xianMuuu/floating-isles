// 由 floating-isles.html 生成 GitHub Pages 用的自包含 index.html。
// 源文件走 jsDelivr（可双击直接玩），站点版把 three.js 换成仓库内的 ./libs/，
// 避免国内网络访问不到 CDN 时整页空白。
import { readFile, writeFile } from 'node:fs/promises';

const src = await readFile('floating-isles.html', 'utf8');

const swaps = [
  ['"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"',
   '"three": "./libs/three/three.module.js"'],
  ['"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"',
   '"three/addons/": "./libs/three/jsm/"'],
  ['唯一外部依赖：three.js r160（CDN importmap，含官方 addons 后处理模块）',
   '唯一外部依赖：three.js r160（本文件为站点构建产物，库已打包在 ./libs/three/；源文件见 floating-isles.html）'],
];

let out = src;
for (const [from, to] of swaps) {
  if (!out.includes(from)) throw new Error(`源文件里找不到待替换片段，floating-isles.html 可能已改动：\n${from}`);
  out = out.replace(from, to);
}
if (out.includes('cdn.jsdelivr')) throw new Error('仍残留 CDN 地址');

await writeFile('index.html', out, 'utf8');
console.log(`index.html 已生成：${Buffer.byteLength(out)} 字节`);
