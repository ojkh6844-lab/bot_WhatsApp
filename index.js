const axios = require('axios')
const config = require('./config')
const {
  default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    isJidBroadcast,
    getContentType,
    proto,
    generateWAMessageContent,
    generateWAMessage,
    AnyMessageContent,
    prepareWAMessageMedia,
    areJidsSameUser,
    downloadContentFromMessage,
    MessageRetryMap,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    generateMessageID, makeInMemoryStore,
    jidDecode,
    fetchLatestBaileysVersion,
    Browsers
  } = require(config.BAILEYS)
  
  const l = console.log
  const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions')
  const { AntiDelDB, initializeAntiDeleteSettings, setAnti, getAnti, getAllAntiDeleteSettings, saveContact, loadMessage, getName, getChatSummary, saveGroupMetadata, getGroupMetadata, saveMessageCount, getInactiveGroupMembers, getGroupMembersMessageCount, saveMessage } = require('./data')
  const fs = require('fs')
  const ff = require('fluent-ffmpeg')
  const P = require('pino')
  const GroupEvents = require('./lib/groupevents');
  const { PresenceControl, BotActivityFilter } = require('./data/presence');
  const qrcode = require('qrcode-terminal')
  const StickersTypes = require('wa-sticker-formatter')
  const path = require('path')

// ==========================================
// دالة حفظ رموز المصادقة للمستخدمين
// ==========================================
function saveUserAuth(phone, key) {
    const authPath = path.join(__dirname, 'users_auth.json');
    let data = {};
    if (fs.existsSync(authPath)) {
        data = JSON.parse(fs.readFileSync(authPath));
    }
    data[phone] = key;
    fs.writeFileSync(authPath, JSON.stringify(data, null, 2));
}

const util = require('util')
const { sms, downloadMediaMessage, AntiDelete } = require('./lib')
const FileType = require('file-type');
const { File } = require('megajs')
const { fromBuffer } = require('file-type')
const bodyparser = require('body-parser')
const os = require('os')
const Crypto = require('crypto')
const prefix = config.PREFIX
const ownerNumber = ['923493114170']

const tempDir = path.join(os.tmpdir(), 'cache-temp')
if (!fs.existsSync(tempDir)) { fs.mkdirSync(tempDir) }

const clearTempDir = () => {
    fs.readdir(tempDir, (err, files) => {
        if (err) throw err;
        for (const file of files) {
            fs.unlink(path.join(tempDir, file), err => { if (err) throw err; });
        }
    });
}
setInterval(clearTempDir, 5 * 60 * 1000);

const express = require("express");
const app = express();
const port = process.env.PORT || 9090;

// إضافة body-parser لقراءة البيانات من الواجهة
app.use(bodyparser.json());

// ==========================================
// مسارات الـ API للتحكم الحقيقي
// ==========================================

// 1. مسار التحقق من الرمز عند الدخول
app.post('/api/verify', (req, res) => {
    const { phone, code } = req.body;
    const authPath = path.join(__dirname, 'users_auth.json');
    if (!fs.existsSync(authPath)) return res.json({ success: false });
    const data = JSON.parse(fs.readFileSync(authPath));
    if (data[phone] && data[phone] === code) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// 2. مسار استقبال تحديثات الأزرار (AUTO_SEEN, ANTI_CALL, إلخ)
app.post('/api/settings', (req, res) => {
    const { feature, status, emoji } = req.body;
    
    // تحديث القيم في ملف الإعدادات config (يعمل في الجلسة الحالية)
    if (feature === 'AUTO_SEEN') config.AUTO_READ_STATUS = status;
    if (feature === 'AUTO_REACT') config.AUTO_REACT = status;
    if (feature === 'ANTI_CALL') config.ANTI_CALL = status;
    if (feature === 'ALWAYS_ONLINE') config.ALWAYS_ONLINE = status;
    if (emoji) config.CUSTOM_EMOJI = emoji;

    console.log(`[⚙️] تم تحديث ${feature || 'الإيموجي'} إلى: ${status || emoji}`);
    res.json({ success: true });
});

// تقديم ملفات الواجهة
app.use(express.static(path.join(__dirname, 'lib')));
app.get('/', (req, res) => { res.redirect('/immutech.html'); });

// ==========================================

const sessionDir = path.join(__dirname, 'sessions');
const credsPath = path.join(sessionDir, 'creds.json');
if (!fs.existsSync(sessionDir)) { fs.mkdirSync(sessionDir, { recursive: true }); }

async function loadSession() {
    try {
        if (!config.SESSION_ID) return null;
        const megaFileId = config.SESSION_ID.startsWith('IMMU~') ? config.SESSION_ID.replace("IMMU~", "") : config.SESSION_ID;
        const filer = File.fromURL(`https://mega.nz/file/${megaFileId}`);
        const data = await new Promise((resolve, reject) => {
            filer.download((err, data) => { if (err) reject(err); else resolve(data); });
        });
        fs.writeFileSync(credsPath, data);
        return JSON.parse(data.toString());
    } catch (error) { return null; }
}

async function connectToWA() {
    const creds = await loadSession();
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'sessions'), { creds: creds || undefined });
    const { version } = await fetchLatestBaileysVersion();
    
    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: !creds,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version,
        getMessage: async () => ({})
    });

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(connectToWA, 5000);
            }
        } else if (connection === 'open') {
            console.log('[✅] Ramy PRO Connected');
            const userJid = jidNormalizedUser(conn.user.id);
            const userPhone = userJid.split('@')[0];
            const accessKey = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            saveUserAuth(userPhone, accessKey);

            const welcomeMsg = `🚀 *مرحباً بك في نظام Ramy PRO الذكي!*\n\nتم ربط حسابك بنجاح.\n🔐 *بيانات الدخول للوحة التحكم:*\n📍 *الرابط:* http://localhost:${port}\n🔑 *رمز الدخول الخاص بك:* \`${accessKey}\`\n\n*المطور: رامي الحطامي* 👨‍💻`;

            await conn.sendMessage(userJid, { 
                image: { url: `https://i.postimg.cc/xTTgKc2W/IMG-20250801-WA0019.jpg` },
                caption: welcomeMsg 
            });

            const pluginPath = path.join(__dirname, 'plugins');
            if (fs.existsSync(pluginPath)) {
                fs.readdirSync(pluginPath).forEach((plugin) => {
                    if (path.extname(plugin).toLowerCase() === ".js") { require(path.join(pluginPath, plugin)); }
                });
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);
}

app.listen(port, () => console.log(`[🚀] Server is running on port: ${port}`));
connectToWA();
    const creds = await loadSession();
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'sessions'), { creds: creds || undefined });
    const { version } = await fetchLatestBaileysVersion();
    
    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: !creds,
        browser: Browsers.macOS("Firefox"),
        syncFullHistory: true,
        auth: state,
        version,
        getMessage: async () => ({})
    });

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(connectToWA, 5000);
            }
        } else if (connection === 'open') {
            console.log('[✅] Ramy PRO Connected');
            const userJid = jidNormalizedUser(conn.user.id);
            const userPhone = userJid.split('@')[0];
            const accessKey = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            saveUserAuth(userPhone, accessKey);

            const welcomeMsg = `🚀 *مرحباً بك في نظام Ramy PRO الذكي!*\n\nتم ربط حسابك بنجاح.\n🔐 *بيانات الدخول للوحة التحكم:*\n📍 *الرابط:* http://localhost:${port}\n🔑 *رمز الدخول الخاص بك:* \`${accessKey}\`\n\n*المطور: رامي الحطامي* 👨‍💻`;

            await conn.sendMessage(userJid, { 
                image: { url: `https://i.postimg.cc/xTTgKc2W/IMG-20250801-WA0019.jpg` },
                caption: welcomeMsg 
            });

            const pluginPath = path.join(__dirname, 'plugins');
            if (fs.existsSync(pluginPath)) {
                fs.readdirSync(pluginPath).forEach((plugin) => {
                    if (path.extname(plugin).toLowerCase() === ".js") { require(path.join(pluginPath, plugin)); }
                });
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);
}

app.listen(port, () => console.log(`[🚀] Server is running on port: ${port}`));
connectToWA();
