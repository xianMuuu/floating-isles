# 浮光群岛 · Isles of Drifting Light

> 一个**单 HTML 文件**的 3D 体素治愈探索游戏。零构建、零打包、零美术资源——地形、贴图、粒子、音乐音效全部在浏览器里程序化生成。

打开浏览器，落到一座云海之上的浮空岛，收集微光、点亮灯塔、看远方的岛屿从雾里升起来。没有敌人，没有死亡，没有背包格子。

| | |
|---|---|
| 文件 | [`floating-isles.html`](./floating-isles.html)（约 2100 行，112 KB） |
| 依赖 | 仅 [three.js r160](https://threejs.org)（CDN import map，含官方后处理 addons） |
| 资源 | 0 个图片 / 0 个音频文件，全部运行时合成 |
| 许可证 | GPL-3.0-only，详见 [LICENSE](./LICENSE) |

---

## 目录

- [快速开始](#快速开始)
- [操作](#操作)
- [玩法闭环](#玩法闭环)
- [代码地图](#代码地图)
- [核心技术拆解](#核心技术拆解)
  - [1. 体积高度雾：改写内置 shader chunk](#1-体积高度雾改写内置-shader-chunk)
  - [2. 体素数据结构：一个 Map 装下整个世界](#2-体素数据结构一个-map-装下整个世界)
  - [3. 岛屿生成：一条公式造出浮空岛](#3-岛屿生成一条公式造出浮空岛)
  - [4. 实例化渲染：只画暴露面 + O(1) 增量更新](#4-实例化渲染只画暴露面--o1-增量更新)
  - [5. 粒子：三套系统三种成本模型](#5-粒子三套系统三种成本模型)
  - [6. 玩家物理：固定步长、上台阶补偿与永远不会死的坠落](#6-玩家物理固定步长上台阶补偿与永远不会死的坠落)
  - [7. 音频：一台 WebAudio 合成器](#7-音频一台-webaudio-合成器)
  - [8. 进度曲线：一个几何级数决定情绪节奏](#8-进度曲线一个几何级数决定情绪节奏)
- [实测数据](#实测数据)
- [调参指南](#调参指南)
- [确定性](#确定性)
- [已知限制](#已知限制)

---

## 快速开始

**方式一：本地静态服务器（推荐）**

```bash
# 任选其一
python -m http.server 8080
npx serve .
```

然后访问 <http://localhost:8080/floating-isles.html>。

**方式二：直接双击 HTML**

现代浏览器通常可以直接打开（内联 `<script type="module">` + CDN 的 `Access-Control-Allow-Origin: *`）。但部分浏览器会对 `file://` 源下的 ES Module 施加限制，如果白屏就换方式一。

**方式三：GitHub Pages**

仓库设置 → *Pages* → Source 选 `Deploy from a branch` → 分支 `main` / 目录 `/ (root)` → 保存。约一分钟后即可通过 Pages 域名直接玩。

> 需要联网：three.js 从 jsDelivr 加载。想完全离线请把 `three.module.js` 与 `examples/jsm/postprocessing/` 下到本地并改写 import map。

---

## 操作

| 动作 | 桌面 | 移动端 |
|---|---|---|
| 移动 | `W A S D` / 方向键 | 左半屏动态摇杆 |
| 视角 | 鼠标（点击锁定指针） | 右半屏拖拽 |
| 冲刺 | `Shift` | 摇杆推到底 |
| 跳跃 | `空格` | 「跳 / 滑翔」按钮 |
| **滑翔** | 空中**按住** `空格` | 空中按住跳跃键 |
| 挖掘 | 鼠标**左键** | 「挖」按钮 |
| 放置 | 鼠标**右键** | 「放」按钮 |
| 切换方块 | `1` `2` `3` / 滚轮 | 点底部色块 |
| 性能面板 | `F3` | — |

点亮灯塔**不需要按键**：带着足够的微光走近就会自动开始。

---

## 玩法闭环

```
        ┌──────────────────────────────────────────────────┐
        │                                                  │
   收集微光碎片 ──→ 凑够配额 ──→ 走近灯塔自动点亮            │
        ↑                          │                       │
        │                          ├──→ 世界天色 黎明 → 白昼 │
   新岛上的碎片                     ├──→ 光柱产生上升气流     │
        ↑                          │                       │
   远方岛屿从云海升起  ←────────────┘                       │
        │                                                  │
        └────→ 在光柱中滑翔乘风而上 → 抵达更高更远的岛 ──────┘
```

**滑翔 + 上升气流是唯一的上行手段**，所以"先点亮一座灯塔才能去更高的岛"是机制层面强制的，不靠剧情 gating。

掉进云海不会被惩罚：云朵把你托起来，沿一条贝塞尔弧线送回最近的安全落脚点。

---

## 代码地图

单文件内部按 25 个编号分区组织，可以按需跳读：

| 分区 | 内容 |
|---|---|
| `0` | `CONFIG` —— 全部可调参数集中在此 |
| `1` | 通用工具：`damp` / `mulberry32` / 2D Simplex / FBM |
| `2` | **体积高度雾**（改写 `THREE.ShaderChunk`） |
| `3` | 渲染器 / 场景 / `EffectComposer` 后处理链 |
| `4` | 程序化贴图（Canvas 2D 画方块、草、花、光晕） |
| `5` | 天空球 / 云海 / 云团 / 光照 |
| `6` | 体素数据结构（`Map` + 位打包 key） |
| `7` | 岛屿地形 / 灯塔 / 树木生成 |
| `8` | **方块实例化渲染与增量维护** |
| `9` | 草丛与花（交叉广告牌 + 风摆） |
| `10` | 灯塔视觉与光柱 shader |
| `11` | **粒子系统**（浮尘 / 特效池 / 微光碎片 / 速度线） |
| `12` | 角色与斗篷顶点变形 |
| `13` | 光灵 NPC |
| `14` | **WebAudio 音频引擎** |
| `15` | 输入（键盘 / 指针锁定 / 触屏摇杆） |
| `16` | **玩家物理**（AABB 碰撞 / 滑翔 / 气流 / 托回） |
| `17` | 体素射线 DDA |
| `18` | 建造（挖 / 放） |
| `19` | 收集 / 点亮 / 升岛 / 光灵逻辑 |
| `20` | 提示文字队列 |
| `21` | 第三人称相机 |
| `22` | 开场 5 秒运镜 |
| `23` | 世界光照随进度渐变 |
| `24` | 渲染帧更新 |
| `25` | 初始化与**主循环**（固定步长 + 插值） |

---

## 核心技术拆解

### 1. 体积高度雾：改写内置 shader chunk

没有增加雾 pass，也没有 raymarch。直接覆盖 three 的四个 `ShaderChunk.fog_*`，让**所有内置材质免费获得"指数距离雾 + 高度雾"**：

顶点着色器里最难的一步是"怎么拿到世界高度"。three 在顶点阶段只给你视空间坐标，而且不提供 `inverse(viewMatrix)` 这个 uniform。这里的做法：

```glsl
vFogHeight = cameraPosition.y + ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).y;
```

view 矩阵是刚体变换 $v = R(w-c)$，GLSL 的 `vec * mat4` 等价于 $V^{T}v$；而

$$V^{T}=\begin{bmatrix}R^{T}&0\\-c^{T}R^{T}&1\end{bmatrix}$$

用 `w = 0` 的齐次坐标乘上去，**平移分量被彻底消掉**，只剩 $R^{T}v = w - c$。取 `.y` 得到 `worldY - camY`，再加回 `cameraPosition.y` 就是精确的世界高度——全程零次矩阵求逆。

片元里的混合：

```glsl
fogFactor = 1.0 - exp( -fogDensity * fogDensity * vFogDepth * vFogDepth );  // 原 FogExp2
float hFog = exp( -max( vFogHeight - 2.0, 0.0 ) * 0.07 );                   // 以云海高度为基准
fogFactor += hFog * 0.5 * ( 1.0 - exp( -vFogDepth * 0.03 ) );               // ← 近处不生效
```

最后那个 `(1 - exp(-d·0.03))` 是关键：高度雾**在相机脚下为 0**，随距离在约 33 m 处饱和。少了它，脚下的地面会被整片洗白。

雾色每帧同步为天空的地平线色，且天空球与云海平面 `fog: false` —— 远景永远融进地平线，不会出现"雾和天空两个颜色"的割裂。

**开销**：每片元多 2 次 `exp`。没有 render target、没有深度图重采样。

---

### 2. 体素数据结构：一个 Map 装下整个世界

```js
const voxels = new Map();
const vkey = (x, y, z) => ((x + 2048) * 4096 + (z + 2048)) * 512 + (y + 256);
setRaw(x, y, z, type, islandId) → voxels.set(key, type | (islandId << 8));
```

- **位打包**：低 8 位是方块类型（上限 256 种），高位是岛屿归属 → 「这个方块属于哪座岛」不需要第二个数据结构。
- **key 的数值安全**：最大约 8.59e9，超过 2³² 但远小于 2⁵³，作为 JS Number 做 Map key 完全安全。
- 未浮现的岛屿**地形早已生成并在内存里**，靠一个 `Uint8Array` 开关同时关掉碰撞与可见性：

```js
function isSolid(x, y, z) {
  const v = voxels.get(vkey(x, y, z));
  return v !== undefined && islandSolid[v >> 8] === 1;   // 一座岛一个布尔
}
```

「隐藏」「不能踩」「射线打不到」三件事由同一个标志控制，不存在状态不同步的可能。

---

### 3. 岛屿生成：一条公式造出浮空岛

```js
// ① 域扭曲 domain warp：把正圆海岸线揉成不规则团块
const warp = n(wx*0.09 + 11.3, wz*0.09 - 4.1)*0.22 + n(wx*0.21, wz*0.21)*0.07;
const d = Math.hypot(x, z) / R + warp;      // d = 归一化到"岛内半径"，>1 在岛外
if (d > 1) continue;

// ② 顶面：大尺度丘陵（靠边衰减）+ 边缘抬升（形成浅碗沿）
const surf = baseY + Math.round(hills*2.6*(1 - d*0.5) + (1 - d)*2.2 - 1);

// ③ 底部：倒锥 + 噪声 → 钟乳石状岛底
const depth = 1 + Math.floor(Math.pow(1 - d, 0.85) * R*0.95 + (n(...)*0.5+0.5)*3*(1 - d));

// ④ 分层材质：草皮 / 沙滩环 → 泥土 ×2 → 石头核心
type = y === surf ? (d > 0.86 ? SAND : GRASS) : (y >= surf - 2 ? DIRT : STONE);
```

几个讲究的地方：

- `(1-d)^0.85` 的指数**小于 1** → 底部比线性收缩得更快，中间鼓、往下收尖，正是浮空岛的经典剪影。
- `d > 0.86` 出沙 → 岛沿自动出现一圈沙滩，不需要单独的海滩逻辑。
- 丘陵噪声 `fbm2` 用的是**全局共享的一条 simplex 场**，所有岛屿采样同一片连续噪声 → 起伏风格统一，但因为位置不同而绝不雷同。
- 岛屿顶面先算，树木再用 `surfaceAt(x, z)` 找落脚点；灯塔先清空 3×3×8 的 airspace 再砌塔基，避免地形/树穿插。
- 树的位置是**带拒绝的采样**：距灯塔 <4.5 m、距出生点 <3.5 m、树间 <4.5 m 一律重来。

---

### 4. 实例化渲染：只画暴露面 + O(1) 增量更新

这是整个工程性能的骨架，四层削减叠加：

1. **只给暴露在空气中的方块建实例**（检查 6 邻格），20,603 个体素只产生 8,877 个实例 → 省掉 **56.9%**。
2. **每座岛一个 `InstancedMesh`** → 视锥剔除的粒度从"1 个方块"变成"1 座岛"，剔除才真正起作用（一个巨大的全局 InstancedMesh 是不可剔除的）。
3. **增量更新而非全量重建**：挖掉一块只动 1 + 最多 6 个实例。
4. **容量预分配**：`cap = 初始块数 + 2500`，放置方块时永远不需要重建 buffer。

#### 手写矩阵，绕过 Three 的 API

```js
const m = isl.mesh.instanceMatrix.array, o = i * 16;
m[o] = 1; m[o+5] = 1; m[o+10] = 1; m[o+15] = 1;
m[o+12] = x + 0.5; m[o+13] = y + 0.5; m[o+14] = z + 0.5;
```

纯平移 + 单位缩放，直接写列主序矩阵的 4 个元素，省掉 `Matrix4.compose()` 的四元数→旋转矩阵换算。

#### O(1) 删除：swap-remove + `copyWithin`

```js
m.copyWithin(i * 16, last * 16, last * 16 + 16);   // 末尾实例搬到空洞
a.instTop.array.copyWithin(i * 3, last * 3, last * 3 + 3);
isl.keyToInst.set(lastKey, i);                     // 修正索引表
isl.instKeys.pop();
isl.mesh.count = last;                             // 缩短绘制数量
```

实例数组是**无序且紧凑**的：删除永远是"把最后一个搬到空洞 + `count--`"，从不做中间搬移。用 `instKeys[]`（下标→key）与 `keyToInst`（key→下标）维护双向映射。

代价：实例顺序不稳定，**任何依赖实例顺序的 per-instance 状态都会失效**。

#### 一张贴图 → 十三种方块

材质是**全局共享的一个 `MeshLambertMaterial`**，通过 `onBeforeCompile` 注入自定义实例属性：

```glsl
attribute vec3 instTop, instSide; attribute float instWind;
vBlockCol = mix(instSide, instTop, step(0.5, normal.y));   // 顶面一个色，侧面另一个色
// 片元：diffuseColor.rgb *= vBlockCol;                     // 灰度贴图 × 每实例颜色
```

- `step(0.5, normal.y)` 一行实现 Minecraft 式的"顶亮侧暗"配色，**零额外几何**。
- 每实例按 `hash3(x,y,z)` 做 ±5% 明度抖动，打破"所有草地一模一样"的塑料感。
- `instWind > 0.5`（树叶）追加正弦摆动，位移按 `(position.y + 0.5)` 加权 → **绕方块底面转而不是绕中心**，树冠整体摇晃。
- 方块贴图是 16×16，靠**边缘一圈压暗**烘出棱线 AO、靠左上斜向加亮假装主光，配 `NearestFilter`。

`flushIsland()` 只在 `dirty` 时上传 GPU，并且一定 `computeBoundingSphere()` —— 包围球不重算，新增实例会因落在旧包围球外而被错误剔除。

---

### 5. 粒子：三套系统三种成本模型

#### 浮尘 —— CPU 零开销

```glsl
p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
```

把一个 60³ 的盒子**以相机为中心做三维环形包裹**：粒子飘出盒子就从对面回来。于是 400 个粒子永远环绕玩家，CPU 一帧都不碰它们的坐标，每帧只更新一个 `uCam` uniform。

#### 特效池 —— 环形缓冲，永不分配

```js
emit(...) { const i = this.cursor; this.cursor = (this.cursor + 1) % this.cap; ... }
```

- 显式 SoA：`pos / vel / col / size / alpha / life / grav / drag` 各一个 `Float32Array`，缓存友好，零 GC 抖动。
- 池满即覆盖最老的粒子，**永远不 new、永远不 splice**。
- 阻尼用解析式 `k = exp(-drag*dt)` 而不是 `v *= (1 - drag*dt)` → 任意帧长都数值稳定。
- `grav` 允许为**负数** → 同一段代码同时服务"碎屑下落"与"光尘上浮"。
- 生命周期双端淡入淡出：`fade = min(1, (1-t)*8) * min(1, t*2.5)`，配合 `size = base*(0.4 + 0.6t)` 收缩。

挖掘、放置、落地、收集、点亮、光灵、升岛、托回……**全部共用这一个池**。

#### 微光碎片 —— CPU 只写中心点，GPU 负责绕圈

每个碎片 = 5 个绕行光点 + 1 个八面体核心，但**全部碎片共用 2 个 draw call**：

```glsl
float a = uTime * (1.2 + aSeed*1.3) + aSeed*40.0;
vec3 p = position + vec3(cos(a)*r, sin(uTime*2.0 + aSeed*17.0)*0.25, sin(a)*r);
```

CPU 每帧只把碎片**中心坐标**写进对应的 5 个顶点，旋转半径、角速度、相位全由 GPU 按 `aSeed` 差异化。825 个光点的动画只花 165 次坐标写入。

#### 点大小的物理单位化

```js
pointScale = (innerHeight * pixelRatio * 0.5) / Math.tan(degToRad(camera.fov * 0.5));
gl_PointSize = size * uScale / max(-mv.z, 0.2);
```

直径 $d$ 的球在深度 $z$ 处占屏幕高度的比例是 $d/(2z\tan\frac{fov}{2})$，乘像素高即得像素数。于是 `size` 就是**真实世界米数**（0.05 = 5 cm 的浮尘），且 FOV 变化时会跟着重算 `pointScale`。粒子因此有正确的透视收缩。

---

### 6. 玩家物理：固定步长、上台阶补偿与永远不会死的坠落

```js
dt = clamp((now - last) / 1000, 0, 0.05);              // 切后台回来不会炸
acc += dt;
while (acc >= 1/60) { fixedUpdate(1/60); acc -= 1/60; } // 单帧最多 3 步
const alpha = acc / (1/60);
rp.lerpVectors(player.prev, player.pos, alpha);         // 渲染用插值位置
```

物理永远 60 Hz（跳跃高度、滑翔下降率与显示帧率无关），渲染用 `prev → pos` 插值消掉一帧的抖动。所有影响玩法的逻辑在 `fixedUpdate`，所有只影响观感的在可变 `dt`。

**穿模安全性的数值证明**：`terminalVelocity 40 × (1/60) = 0.667 格/步 < 1`，AABB 分轴求解永远不会一步跨过整格。

#### 自动上台阶 + 视觉补偿

```js
const oy = p.y;
p.y = oy + CONFIG.player.stepHeight;        // 1.05 —— 恰好跨过 1 格
if (!collideAt(p.x, p.y, p.z)) {
  player.visualYOffset -= CONFIG.player.stepHeight;   // 物理立刻抬升，视觉留在原地
  return;
}
p.y = oy;
```

物理 y **立刻**抬升保证碰撞正确，`visualYOffset` 同时减去等量偏移，再由 `damp(→0, k=12)` 在约 80 ms 内归零；相机目标也吃这个偏移。结果是**走上台阶时角色平滑升起而不是瞬移**——绝大多数体素游戏在这里都会硬跳一下。

#### 跳跃与滑翔

- **土狼时间 0.12 s** + **输入缓冲 0.14 s**：离开边缘后仍可跳、落地前按跳会被缓存。
- 滑翔门控 `v.y < 0.5 || airTime > 0.35`，而 `jumpVelocity / gravity = 8.2/24 = 0.342 s` 正是抛物线到顶点的时间——**0.35 ≈ "过了最高点"**。防止玩家靠起跳瞬间按住空格无限爬升。
- 滑翔下降限速用指数回归而非硬夹取：`if (v.y < -1.7) v.y += (-1.7 - v.y) * min(1, 5*dt)`。
- 水平用 Quake 式限速逼近 `approach2D`，滑翔时最大速度增量与目标速度成正比 → 高速转向更快。
- 上升气流只在**已点亮**灯塔的光柱内生效，`v.y` 每帧 +30·dt、上限 +9 m/s。

#### 云朵托回

```js
let to = player.lastSafe.clone();
if (不能站人 || 卡住了) to.copy(spawnPoint);
while (collideAt(to)) to.y += 1;              // 玩家自己把方块堆在了落点上 → 顶出来
rescue = 二次贝塞尔(from, ctrl = 中点上方 + 10 m, to, 2.8 s);
```

控制点抬高 10 m → 玩家看到自己被云托着**划过一道拱桥**回到原处，全程洒云粉粒子 + 一串上行三音。结束时必须 `player.prev.copy(p)`，否则下一帧 `lerpVectors(prev, pos)` 会从云底一路插值回来，产生诡异的橡皮筋。

`lastSafe` 每 0.4 s 且**只在脚下确实有方块时**更新 → 空中位置不会被误记为安全点。

---

### 7. 音频：一台 WebAudio 合成器

**没有一个音频文件。** 信号链：

```
voice → [StereoPanner] → dryGain ─────────────→ master → Compressor → destination
                        → wetGain → Convolver(4.2s 程序化 IR) → 0.55 ↗
```

**程序化混响**：白噪声做 IR 会有刺耳的金属混响感，所以先低通再塑形——

```js
lp += (Math.random()*2 - 1 - lp) * 0.42;            // 单极点低通 ≈ 2.5 kHz 拐点
d[i] = lp * Math.pow(1 - i/len, 2.8);               // 幂律衰减包络
```

得到黑暗、绵长、无共振峰的空间尾。

**粉噪声**用 Paul Kellet 的 7 路一阶 IIR 并联实现，1/f 噪声比白噪听感自然得多，用来做风、水、鸟翼、落地灰。

**环境音是分层的**：

| 层 | 实现 | 动态 |
|---|---|---|
| 风 | 粉噪 → bandpass(320~580 Hz) | `0.5 + 0.5·sin(t·0.11)·sin(t·0.037)` 双正弦乘积造不可预测的阵风 |
| 滑翔哨 | 粉噪 → bandpass(2100 Hz, Q 2.5) | 随 `glide × speed` |
| 远处流水 | 粉噪 → lowpass 520 → highpass 160 | 恒定极低音 |
| 温暖底垫 | 3 个失谐 ±4 cent 正弦（C3 / G3 / C4） | 极慢起音 |
| 鸟鸣 | 2~4 个快速频率滑音，随机 pan | 每 4~12 s |
| 生成式旋律 | 五声音阶三角波 pad，0.9 s 起音 / 5.5 s 时长 | 每 2.6~5.8 s |

**为什么随便弹都不难听**：音阶是 `PENTA = [0, 2, 4, 7, 9]` 大调五声音阶，**任意两音同时响都不刺耳**（没有小二度、没有三全音）。和谐这件事被外包给了音阶的数学。

而且旋律八度的选择是 `random() < 0.25 + lit * 0.06 ? 72 : 60` —— **点亮的灯塔越多，高音越多，音乐越亮**。音频和进度系统是耦合的。

**收集连击有音高反馈**：`deg = streak % 5`、`oct = 72 + floor(streak/5) % 2 * 12` → 连续收集时沿五声音阶一路往上走，走完换高八度。

其他细节：

- `AudioContext` 在**首次 keydown/mousedown/touchstart** 时才创建（浏览器自动播放策略），`master.gain` 从 0.0001 淡入 1.2 s。
- `tick()` 每帧调用但内部限流到 10 Hz，参数全用 `setTargetAtTime` → 避免逐帧改 gain 的 zipper noise。
- `bell()` 的分音比是 `1 : 2 : 3.01`，那 1% 失谐产生的缓慢拍频就是"水晶质感"。
- 点亮灯塔的和弦：8 个根音循环 + `[0,4,7,9,12,14,16,19]` 加九加六配置，8 个音以 0.12 s 间隔**从左到右 pan 扫过**，再叠一层低音和 6 个随机高音 sparkle。仪式感基本全靠它。

---

### 8. 进度曲线：一个几何级数决定情绪节奏

```js
state.lightTarget = (1 - Math.pow(c, state.lit)) / (1 - Math.pow(c, n));   // c = 0.62, n = 8
```

| 点亮 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| 白昼进度 | 0% | **38.8%** | 62.9% | 77.9% | 87.1% | 92.9% | 96.4% | 98.6% | 100% |

**第一座灯塔就推进了近 40% 的天色。** 这是刻意的：开局最需要的是"我的行为真的改变了世界"这个确认，所以把最大的单次奖励给最早那次成功；后面回报递减，但那时动机已经内化。等差数列（每座 12.5%）会平淡得多。

这个 `f` 同时驱动 14 个量：天空三色、雾密度、云的明暗、半球光双色、太阳色与强度、曝光、Bloom 强度、太阳仰角（0.28 → 0.9 rad）。并且：

- `state.light = damp(→ target, 0.9)` → 约 1.1 s 时间常数，天色是**缓缓亮起来**的。
- `state.flash`（点亮瞬间置 1 再衰减）额外叠 `+0.8 阳光 / +0.35 曝光 / +0.4 Bloom` → 一次性爆闪。

配合"每座岛碎片数 = 灯塔配额 + 4"的规则，全局碎片上限 165、点亮全部只需 112 → **53 个（47%）富余，永远不可能把一局打成死局**。

---

## 实测数据

> 用 Node 复刻第 3、4 节的生成算法（同一 seed、同一 PRNG 调用顺序）在 `seed = 20261119` 下统计而得；运行时可在游戏内按 `F3` 看 FPS / draw calls / 三角面 / 活跃粒子 / 点亮进度。

**世界规模**

| 项 | 数值 |
|---|---|
| 体素总量 | **20,603** |
| 实际实例化（暴露方块） | **8,877**（43.1%，内部剔除 56.9%） |
| 方块三角面 | 106,524（全岛可见时） |
| 地表列数 | 3,256 |
| 草丛 / 花 | ~977 / ~293 |
| 树 | 32（15 座岛） |
| 微光碎片上限 | 165（点亮全部需 112） |

**按方块类型**

岩石 9,647 · 泥土 6,106 · 草地 2,443 · 细沙 752 · 叶类合计 1,370 · 树干 149 · 灯塔石 136

**按岛屿（节选）**

| 岛 | 半径 | 类型 | 总块数 | 实例数 | 树 | 灯塔配额 |
|---|---|---|---|---|---|---|
| 0 | 12 | 主岛·开局 | 3,228 | 1,310 | 4 | 10 |
| 1 | 10 | 主岛·开局 | 1,965 | 851 | 4 | 12 |
| 2 | 11 | 主岛·开局 | 2,498 | 1,045 | 4 | 12 |
| 3 | 10 | 主岛 | 1,840 | 839 | 4 | 14 |
| 7 | 11 | 主岛·最后 | 2,537 | 1,052 | 4 | 18 |
| 8 | 3.5 | 小岛 | 121 | 86 | 0 | — |

**渲染预算**

| 项 | 数值 |
|---|---|
| 粒子上限 | 浮尘 400 + 碎片光点 825 + 特效池 600 = **1,825 / 2,000** |
| 实例缓冲 | 58,103 槽 ≈ **5.10 MB**（其中约 65% 预留给尚未浮现的岛） |
| 云团 | 150 实例 × 320 面 = 48,000 面，1 个 draw call |
| Draw calls（估） | 开局 ~65（5 岛可见）→ 全亮 ~140，其中后处理固定占 ~13 |
| 阴影纹素 | 桌面 3.71 cm，手机 7.42 cm（76 m 视锥 / 2048²） |
| 视野 | 黎明 95% 雾化距离 ≈ 165 m → 全亮 ≈ 299 m |

**后处理链**：`RenderPass`（HalfFloat HDR RT + 4×MSAA）→ `UnrealBloomPass`（**分辨率猴补丁到 0.5×／手机 0.35×**）→ `OutputPass`（ACES Filmic + sRGB）。

- `antialias: false` 而把 MSAA 放在离屏 RT 上：开了后处理之后 canvas 自带 MSAA 完全无效。
- `HalfFloatType` 是为了 Bloom 的阈值提取——代码里大量 `multiplyScalar(2.2 / 2.6 / 3.2)` 把自发光颜色推到 1 以上，只有它们能过 `threshold 0.88`。
- `renderer.info.autoReset = false` + 手动 `reset()`，否则 F3 面板只能统计到最后一个 pass。

**移动端降级**（全部由一个 `IS_MOBILE` 开关驱动）：`pixelRatio 1`、MSAA 关闭、阴影图 1024、Bloom 0.35×、浮尘 260、触屏控件。

---

## 调参指南

所有关键参数集中在文件顶部的 `CONFIG`，改完刷新即可。

| 想改什么 | 改哪个 |
|---|---|
| 换一张世界 | `CONFIG.seed`（地形、树、灯塔位置、碎片分布**全变**） |
| 岛屿布局 | `CONFIG.world.islands`：`{x, z, y, r, islet, revealedBy}`，`revealedBy: -1` 开局可见，`n` 表示点亮第 n 座岛后浮现 |
| 难度 | `CONFIG.lighthouse.costs`（每座灯塔配额）与 `CONFIG.shards.extraPerIsland`（每岛额外碎片） |
| 手感 | `CONFIG.player.*`：`walkSpeed / runSpeed / jumpVelocity / gravity / glideFallSpeed / stepHeight / coyoteTime / jumpBuffer` |
| 相机 | `CONFIG.camera.*`：`distance / shoulder / turnDamping / followDamping / breathAmp` |
| 天气浓淡 | `CONFIG.light.fogDensity[]` 与 `heightFog.{falloff, strength}`（后者在分区 2 的 GLSL 里被烘成常量，改完要同步改） |
| 时段氛围 | `CONFIG.palette.dawn / day` 两套色 + `litCurve`（越大越"最后才亮"） |
| 发光强度 | `render.bloomScale`、`light.bloomThreshold / bloomStrength[]` |
| 建造上限 | `CONFIG.world.buildCapacity`（每座岛可额外放置的方块数） |
| 音乐密度 | `SoundEngine.musicNote` 的间隔与 `PENTA` 音阶数组 |

---

## 确定性

`CONFIG.seed = 20261119` 下，所有玩家看到的**地形、树、灯塔位置、碎片分布完全一致**。

这不是简单地"共用一个随机数生成器"——每个子系统开**独立的随机流**：

```js
worldRand            = mulberry32(seed)            // simplex 排列表
云团    / mulberry32(seed + 5)
灯塔位置 / mulberry32(seed + id * 131)
树       / mulberry32(seed + id * 733)
植被     / mulberry32(seed + id * 377)
碎片     / mulberry32(seed + id * 991)
```

好处：**给某座岛多放一棵树，不会让其他所有岛的地形和装饰全变**。这是程序化生成最重要的纪律，也是调参时能"逐项对比"的前提。

---

## 已知限制

- **刷新即丢失**：没有 localStorage 存档，玩家盖的东西不保留（世界本身由 seed 决定，重进完全一致）。
- **需要联网**：three.js 走 CDN。
- **放置方块没有连通性/高度约束**，理论上能往云上一直垒，绕过"必须靠上升气流"的设计意图（受 `buildCapacity` 限制）。
- **实例化是方块级而非面级**：两个相邻暴露方块之间的那对内部面仍然会被光栅化。改成 greedy meshing 能再省一档，但会摧毁"增量挖放"的简单性——这里选择了可玩性优先。
- 移除植被用的是把实例矩阵设成零尺度，顶点着色器仍会跑，槽位不回收。
- 未浮现岛屿的实例缓冲在开局就已分配（约占 5.1 MB 中的 65%），换来的是升岛瞬间不重建 buffer。
- 无 WebGL 不可用 / CDN 失败的兜底 UI，此时会停在「正在唤醒群岛」。

---

## 许可

Copyright (C) 2026 xianMuuu

本程序为自由软件：你可以在 Free Software Foundation 发布的 **GNU GPLv3**（或其后的任意版本）的条款下再分发或修改它。详见 [LICENSE](./LICENSE)。

依赖的 three.js 采用 MIT 许可证，由 three.js 作者版权所有；本项目通过 CDN 链接方式引用，不对其主张任何权利。
