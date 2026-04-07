import express from 'express';
import cors from 'cors';
import { ChatController } from './controllers/chatController';

const app = express();

// 中间件配置
app.use(cors());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 核心对话接口
app.post('/api/chat', ChatController.handleChat);

export default app;
