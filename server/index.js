/**
 * 暗夜迷踪 — 真人沉浸式恐怖剧本杀后端服务器
 * Express + WebSocket 主入口
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const gameRoutes = require('./gameRoutes');
const setupWebSocket = require('./wsHandler');

// ============================================================
// Express 服务器配置
// ============================================================

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 — 前端构建产物
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// API 路由
app.use('/api', gameRoutes);

// SPA 回退 — 所有非 API 请求返回 index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        // 如果 dist 目录不存在，返回提示信息
        res.status(200).json({
          message: '暗夜迷踪后端服务器运行中',
          hint: '请先构建前端项目 (npm run build)，然后将构建产物放入 dist 目录',
          apiBase: '/api'
        });
      }
    });
  }
});

// ============================================================
// HTTP + WebSocket 服务器
// ============================================================

const server = http.createServer(app);

// WebSocket 服务器与 HTTP 共享同一端口
const wss = new WebSocket.Server({ server });

// 设置 WebSocket 处理逻辑
setupWebSocket(wss);

// ============================================================
// 启动服务器
// ============================================================

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  🕯️  暗夜迷踪 — 恐怖剧本杀服务器');
  console.log('========================================');
  console.log(`  HTTP 服务器:  http://localhost:${PORT}`);
  console.log(`  WebSocket:    ws://localhost:${PORT}`);
  console.log(`  API 地址:     http://localhost:${PORT}/api`);
  console.log(`  静态文件:     ${distPath}`);
  console.log('========================================');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n[服务器] 收到 SIGTERM 信号，正在关闭...');
  wss.close(() => {
    server.close(() => {
      console.log('[服务器] 已关闭');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n[服务器] 收到 SIGINT 信号，正在关闭...');
  wss.close(() => {
    server.close(() => {
      console.log('[服务器] 已关闭');
      process.exit(0);
    });
  });
});
