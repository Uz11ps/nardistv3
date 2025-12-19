#!/usr/bin/env node

/**
 * Простой HTTP сервер для обработки GitHub Webhooks
 * 
 * Установка зависимостей:
 * npm install express body-parser crypto
 * 
 * Или используйте pm2 для запуска в фоне:
 * npm install -g pm2
 * pm2 start webhook/server.js --name webhook-deploy
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key-change-this';
const DEPLOY_PATH = process.env.DEPLOY_PATH || '/var/www/nardistv3';

// Middleware
app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

// Верификация подписи GitHub
function verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        return false;
    }

    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
    );
}

// Эндпоинт для проверки работы
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'webhook-deploy' });
});

// Основной эндпоинт для webhook
app.post('/deploy', (req, res) => {
    console.log(`[${new Date().toISOString()}] Webhook received`);

    // Проверка подписи
    if (!verifySignature(req)) {
        console.error('❌ Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Обрабатываем только push события в main ветку
    if (event === 'push' && payload.ref === 'refs/heads/main') {
        console.log('✅ Valid push event, starting deployment...');
        
        // Отправляем ответ сразу (GitHub ждет ответ в течение 10 секунд)
        res.status(200).json({ 
            status: 'accepted',
            message: 'Deployment started',
            commit: payload.head_commit?.id?.substring(0, 7)
        });

        // Запускаем деплой в фоне
        const deployScript = path.join(__dirname, 'deploy.sh');
        const deployProcess = exec(
            `bash ${deployScript}`,
            {
                cwd: DEPLOY_PATH,
                env: { ...process.env, DEPLOY_PATH }
            },
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`Deployment error: ${error.message}`);
                    return;
                }
                console.log(stdout);
                if (stderr) console.error(stderr);
            }
        );

        deployProcess.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        deployProcess.stderr.on('data', (data) => {
            console.error(data.toString());
        });

    } else {
        console.log(`ℹ️  Event ignored: ${event}, ref: ${payload.ref}`);
        res.status(200).json({ status: 'ignored', event, ref: payload.ref });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Webhook server started on port ${PORT}`);
    console.log(`📝 Deploy path: ${DEPLOY_PATH}`);
    console.log(`🔐 Secret configured: ${SECRET ? 'Yes' : 'No'}`);
    console.log(`\n💡 Configure GitHub webhook:`);
    console.log(`   URL: http://your-server:${PORT}/deploy`);
    console.log(`   Content type: application/json`);
    console.log(`   Secret: ${SECRET}`);
});

