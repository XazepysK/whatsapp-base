const {
    fs,
    path,
    lb,
    question,
    pino
} = require('./libraries/constants.js');
const goon = require('./commands.js');

async function weaStart() {
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        Browsers,
        fetchLatestBaileysVersion,
        fetchLatestWAWebVersion,
        makeInMemoryStore,
        jidDecode,
        jidEncode,
        downloadContentFromMessage
    } = await lb();
    // const { version } = await fetchLatestWAWebVersion();
    const { state, saveCreds } = await useMultiFileAuthState('sessions');
    const client = makeWASocket({
        browser: Browsers.ubuntu('Safari'),
        // version,
        printQRInTerminal: false,
        auth: state,
        aiLabel: false,
        markOnlineOnConnect: false,
        shouldSyncHistoryMessage: msg => !!msg.syncType,
        logger: pino({ level: 'silent' }),
        emitOwnEvents: true,
        ignoreOfflineMessages: true,
    });
    if (!state.creds.registered) {
        const pn = await question('Enter ur number without "+" or space\n');
        const code = await client.requestPairingCode(pn.replace(/\D/g, ''), 'STATICEX');
        const fcode = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`Ur code is: ${fcode}`);
    }
    const store = makeInMemoryStore({ logger: pino({ level: 'silent' }).child({ stream: 'store' }) });
    store.bind(client.ev);
    let node;
    let attrs;
    client.ws.on('CB:messages', nigga => {
        node = nigga.content;
        attrs = nigga.attrs;
    });
    client.decodeJid = async (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
        }
        return jid;
    };
    client.downloadMediaMessage = async (message) => {
        const mime = (message.msg || message).mimetype || '';
        const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    }
    client.ev.on('messages.upsert', async cetupdet => {
        try {
            const update = cetupdet.messages[0];
            if (!update?.message) return;

            update.message = Object.keys(update.message)[0] === 'ephemeralMessage'
                ? update.message.ephemeralMessage.message
                : update.message;

            const m = {
                ...update,
                node,
                attrs
            };
            await goon(client, m, cetupdet, store);
        } catch (err) {
            console.error(err);
        }
    })
    client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                weaStart();
            }
        } else if (connection === 'open') {
            console.log('Connected in ' + client.user.name + ' (' + client.user.id.split(':')[0] + ')');
        }
    });
    client.ev.on('creds.update', saveCreds);
}
weaStart();