const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // لمجلد الواجهة

io.on('connection', (socket) => {
    console.log('مستخدم متصل بالواجهة...');

    socket.on('request-code', async (phoneNumber) => {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('session_auth');
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' })
            });

            if (!sock.authState.creds.registered) {
                // طلب كود الربط من واتساب
                await delay(2000);
                const code = await sock.requestPairingCode(phoneNumber);
                // إرسال الكود للواجهة فوراً
                socket.emit('receive-code', code);
            }

            sock.ev.on('creds.update', saveCreds);

            // عند نجاح الاتصال
            sock.ev.on('connection.update', async (update) => {
                const { connection } = update;
                if (connection === 'open') {
                    socket.emit('status', 'connected');
                    // إرسال رسالة ترحيبية وإعدادات للخاص
                    const myId = sock.user.id.split(':')[0] + "@s.whatsapp.net";
                    await sock.sendMessage(myId, { 
                        text: `✅ *تم التفعيل بنجاح!*\n\nإليك رابط لوحة التحكم الخاصة بك:\nhttp://your-site.com/dashboard?token=SECRET123` 
                    });
                }
            });

        } catch (err) {
            socket.emit('error', 'فشل في طلب الكود');
        }
    });
});

server.listen(3000, () => console.log('السيرفر يعمل على المنفذ 3000'));
