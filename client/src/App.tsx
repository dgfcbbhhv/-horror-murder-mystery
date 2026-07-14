import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import SearchPage from './pages/SearchPage';
import DiscussPage from './pages/DiscussPage';
import VotePage from './pages/VotePage';
import ResultPage from './pages/ResultPage';
import AdminPage from './pages/AdminPage';

/**
 * 暗夜迷踪 - 真人沉浸式恐怖剧本杀 Demo
 * 路由配置
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 首页 - 入口选择 */}
        <Route path="/" element={<HomePage />} />

        {/* 开局大厅 - 创建/加入游戏、角色分配 */}
        <Route path="/lobby" element={<LobbyPage />} />

        {/* 实景搜证 - 房间探索、线索收集 */}
        <Route path="/search/:gameId" element={<SearchPage />} />

        {/* 推理博弈 - 公聊私聊、笔记 */}
        <Route path="/discuss/:gameId" element={<DiscussPage />} />

        {/* 终局投票 - 限时投票 */}
        <Route path="/vote/:gameId" element={<VotePage />} />

        {/* 结局展示 - 真相/恐怖结局 */}
        <Route path="/result/:gameId" element={<ResultPage />} />

        {/* 主持人后台 - 控场面板 */}
        <Route path="/admin/:gameId" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
