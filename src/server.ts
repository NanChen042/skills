import dotenv from 'dotenv';
import app from './app';
import { testConnection } from './config/db';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
    console.log('🚀 Starting Skill Backend Server...');

    // 1. 尝试连接数据库
    await testConnection();

    // 2. 启动服务
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`📡 Server is running on http://localhost:${PORT}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
        console.log(`🤖 AI Skill: Qwen/Qwen3.5-4B via SiliconFlow`);
    });
}

// 错误捕捉
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
