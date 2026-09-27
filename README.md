# Claude Animation Lite

用代码画手绘风格的 2D 小动画：角色、表情、镜头、转场全部由 JS 描述，每一帧都是时间的纯函数。可以直接交给 Claude Code，让它从分镜一路做到出片。

这是 [Claude Animation Base](https://github.com/bin38/ClaudeAnimationBase)（p5.js + p5.brush + 无头 Chrome）的轻量重制版：底层换成了 Canvas2D，在 Node 里直接渲染，**不需要 Chrome、WebGL 和 GPU**，任何机器（笔记本、云端容器、CI）都能跑。角色系统、情绪系统和动画规则都沿用原版，并新增了一个角色：小芽（Sprout）。

![Clawd 和小芽](docs/meet.webp)

## 快速开始

```bash
npm install                     # 只有一个依赖 @napi-rs/canvas，外加自带的 ffmpeg
npm run video                   # 渲染示例短片 → out/video.mp4（12 秒 1080p，4 核约 20 秒）
```

浏览器里直接打开 `studio.html` 就能拖时间轴看，不需要安装任何东西。

用 Claude Code 做一个新视频：

> 读一下 ANIMATION_GUIDE.md，然后做一个 15 秒的视频：Clawd 和小芽一起放风筝。

它会先写分镜，再逐个镜头制作，渲染 contact sheet 自己检查，最后输出 `out/video.mp4`。仓库里的 `.claude/skills/clawd-animate` 把这套流程固定成了 skill。

## 角色

| | Clawd | 小芽 Sprout |
|---|---|---|
| 造型 | 陶土色方块，四条短腿，竖条眼 | 薄荷色圆蛋，头顶两片叶子，面条手臂，圆眼睛 |
| 调用 | `clawd(x, y, u, options)` | `sprout(x, y, u, options)` |
| 特色 | 暴怒时头顶像饭盒盖一样掀开 | 叶子会表演：难过时下垂，兴奋时竖起，害怕时发抖，跳跃时跟随甩动 |
| 模型表 | [情绪](docs/emotions.jpg) · [视角与帽子](docs/views.jpg) | [视角、叶子与帽子](docs/sprout.jpg) · [情绪](docs/sprout_emotions.jpg) |

两个角色使用同一套选项，`feel()`、`emotions()`、`turn()`、`jump()`、`stroll()`、`move()` 都能直接驱动，31 种情绪、所有表情符号和帽子都能通用：

```js
clawd(700, 880, 24, emotions(t, [[0, 'sad'], [2.1, 'surprised'], [2.6, 'excited']]));
sprout(1150, 884, 22, { ...feel('happy', t), ...jump(t, 1.2, 1.6, 3), view: 'q', flip: true });
```

想再加角色，照着 `src/sprout.js` 的写法即可：接收同一套选项，复用共享的五官系统，身体配色交给 `bodyCols()`。

## 音效和配乐也用代码生成

场景里声明 `window.SOUND`（一串带时间的音符、鼓点、音效事件），`render.mjs --clip` 会用 `audio/synth.mjs` 合成立体声 WAV 并自动混进 MP4。全部由振荡器和噪声合成，不用下载素材，每次渲染结果完全相同。可用的乐器有电钢琴、贝斯、铺底、钟琴、拨弦和方波主音，音效库包括键盘声、回车、报错蜂鸣、风声、上升音、杯子落桌、蒸汽、叮、拍击、噗、成功和弦、鸟叫、鼾声、虫子爬、钟表滴答和黑胶噪声，另外还有“磁带停转”效果。

示例短片《加班》（`src/scenes/overtime.js`，16.8 秒）：深夜 Clawd 敲代码，编译报错，通宵找 bug，最后一巴掌拍死 bug，天亮时趴在桌上睡着。配乐是每分钟 90 拍的 lo-fi，报错时磁带停转，只剩钟表滴答。

```bash
npm run overtime                # → out/overtime.mp4 和 out/overtime.wav
```

## 常用命令

```bash
# 检查画面（打开图片看）
node render.mjs --sheet=0.5,1.5,2.5 --cols=3 --w=640 --out=out/check/sheet.jpg     # 几个时间点
node render.mjs --strip=6.8:7.4 --cols=8 --w=240 --out=out/check/strip.jpg          # 一段动作的每一帧
node render.mjs --strip=6.8:7.4 --crop-at=1150,760,500,420 --out=out/check/rise.jpg # 跟随世界坐标裁切
node render.mjs --loop=sprout --sheet=1 --cols=1 --w=1920 --out=out/sprout.jpg      # 模型表

# 出片
node render.mjs --clip --out=out/video.mp4
node render.mjs --clip --audio=assets/song.mp3 --out=out/video.mp4
node render.mjs --scene=src/scenes/demo.js --duration=11 --clip --out=out/demo.mp4  # 渲染另一个场景

# 每个视频单独一个项目
node new.mjs ../my-video --duration=15
```

## 结构

| 路径 | 作用 |
|---|---|
| [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md) | 规则、流程和完整 API（写给模型看，先读它） |
| `src/core.js` | 绘制、时间与动作辅助函数、镜头、光效、纸张 |
| `src/clawd.js` | Clawd，以及所有角色共享的五官、情绪和表情符号系统 |
| `src/sprout.js` | 小芽 |
| `src/timeline.js` | 镜头列表、循环、笔刷划变转场 |
| `src/sheets.js` | 模型表（`studio.html?loop=sprout` 等） |
| `src/scenes/` | 场景：`meet.js`（小芽登场，12 秒）、`overtime.js`（加班，16.8 秒，带配乐）、`demo.js`（坠落的星星，11 秒） |
| `audio/synth.mjs` | 用代码合成音乐和音效：把场景的 `window.SOUND` 渲染成 WAV |
| `runtime/p5lite.js` | 用 Canvas2D 实现引擎用到的 p5 + p5.brush 子集，浏览器和 Node 通用 |
| `render.mjs` | Node 渲染器：多线程并行，支持 contact sheet、strip、裁切、静帧、PNG 序列、MP4 |
| `new.mjs` | 从这套工具新建视频项目 |

## 和原版的区别

- **画面是近似**：p5.brush 混色像真颜料（黄叠蓝会变绿），这里用普通透明度叠加，大面积水彩会稍亮、稍平。线条、角色、动作、线条抖动（boil）和转场与原版一致，见 [对比图](docs/lite_compare.jpg)（上排原版，下排 Lite）。需要真水彩效果时，打开 `studio.html?brush` 加载真正的 p5.brush（需要 GPU）。
- **速度**：同一台 4 核无 GPU 机器上，原版每帧约 44 秒，这里约 0.1 秒。
- **对 `src/clawd.js` 的改动都是增量的**：圆眼睛选项、`bodyCols()`、情绪切换时的配色过渡信息。原版场景可以不改直接运行。

## 许可

MIT。原版代码版权归 John Heibel，Permanent Marker 字体为 Apache-2.0（见 `runtime/fonts/LICENSE.txt`）。
