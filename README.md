# 俄罗斯方块小游戏（TetrisM）

## 玩法
经典俄罗斯方块：左右移动、旋转、快速下落、消行得分、等级加速、暂停、最高分记录。

## 目录结构
```
TetrisM/
├── game.js              # 入口：创建画布 + 主循环
├── game.json            # 小游戏配置（竖屏）
├── project.config.json  # 微信开发者工具配置
├── js/
│   ├── tetris.js        # 主逻辑（TetrisGame 调度 + Game 纯逻辑）
│   ├── block.js         # 方块类（7 种形状）
│   ├── matrix.js        # 棋盘类（碰撞/消行/渲染）
│   ├── comon.js         # 公共工具（Button/ButtonManager/矢量箭头兜底）
│   ├── assets.js        # 图标资源加载（loadIcon）
│   └── audio.js         # 精简音频管理器
└── res/
    ├── music/           # 音效（teris.mp3 / move.mp3）
    └── icon/            # 控制按钮图标（direction-left/right/down.svg）
```

## 界面说明
- 页面为中性浅色渐变背景，控制按钮为浅色面板 + 灰色图标，与 `res/icon` 的图标风格统一。
- 按钮图标：左移/右移/下移用 `direction-*.svg`，旋转用 `forward.svg`，暂停/继续用 `timeout.svg` / `play-circle.svg`（在 `tetris.js` 的 `ICON_SOURCES` 中集中配置）。
- 若运行环境无法解码 SVG（部分平台 canvas 不支持），左右下按钮会退化为同方向的矢量箭头，旋转按钮退化为「旋转」文字，按钮不会空白也不会画错图标。
- 按钮文字颜色、分数区文字均按浅色背景重新配过对比度。
