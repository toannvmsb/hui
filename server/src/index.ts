import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PORT } from './lib/constants.js';
import { authRouter } from './routes/auth.js';
import { walletRouter } from './routes/wallet.js';
import { groupsRouter } from './routes/groups.js';
import { slotsRouter } from './routes/slots.js';
import { meRouter } from './routes/me.js';
import { organizerRouter } from './routes/organizer.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'hui-thong-minh', time: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/me', meRouter);
app.use('/api/organizer', organizerRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy endpoint' }));

// Phục vụ giao diện React đã build (deploy 1 service: API + web cùng origin).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback: mọi route không phải /api trả về index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
  console.log('🌐 Phục vụ giao diện web từ', webDist);
}

app.listen(PORT, () => {
  console.log(`\n🟢 Hụi Thông Minh đang chạy tại http://localhost:${PORT}\n`);
});
