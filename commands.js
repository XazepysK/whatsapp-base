const {
    lb,
    path,
    fs,
    crypto
} = require('./libraries/constants.js');

function jidNormalizedUser(jid) {
    if (!jid || typeof jid !== 'string') return '';
    const trimmed = jid.trim();
    if (!trimmed) return '';
    const [local, ...rest] = trimmed.split('@');
    if (!local || !rest.length) return trimmed;
    const server = rest.join('@').split(':')[0];
    return `${local}@${server}`;
}

function areJidsSameUser(left, right) {
    return jidNormalizedUser(left) === jidNormalizedUser(right);
}

module.exports = async (client, m, cum, store) => {
    try  {
        const {
            jidNormalizedNumber,
            generateWAMessageFromContent,
            proto,
            jidDecode,
            jidEncode,
            areJidSameUser,
			prepareWAMessageMedia
        } = await lb();
        m.chat = m.key.remoteJid;
        m.sender = m.key.participant;
        m.fromMe = m.key.fromMe;
        m.id = m.key.id;
        m.isGroup = m.chat.endsWith('@g.us');
        m.isNewsletter = m.chat.endsWith('@newsletter');
        if (m.key?.participant?.endsWith('@lid') && m.key?.participant === client.user.lid) {
            m.sender = client.user.lid;
        } else {
            m.sender = client.decodeJid((m.fromMe && client.user.id) || m.participant || m.key.participant || m.chat || '');
        }
        if (m.isGroup) m.participant = client.decodeJid(m.participant) || '';
        function getTypeM(message) {
            const type = Object.keys(message);
            return (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(type[0]) && type[0])
                || (type.length >= 3 && type[1] !== 'messageContextInfo' && type[1])
                || type[type.length - 1]
                || Object.keys(message)[0];
        }

        m.mtype = getTypeM(m.message);
        m.msg = m.mtype === 'viewOnceMessage' ? m.message[m.mtype].message[getTypeM(m.message[m.mtype].message)] : m.message[m.mtype];
        m.text = m?.msg?.text || m?.msg?.caption || m?.message?.conversation || m?.msg?.contentText || m?.msg?.selectedDisplayText || m?.msg?.title || '';

        const info = { key: m.key, message: m.message };
        const from = info.key.remoteJid;

        let interactiveId = '';
        if (m.mtype === 'interactiveResponseMessage') {
            try {
                interactiveId = JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id || '';
            } catch { }
        }
        m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getTypeM(m.message[m.mtype].message)] : m.message[m.mtype])
        let quoted = m.quoted = m.msg?.contextInfo ? m.msg?.contextInfo?.quotedMessage : null
        let M = proto.WebMessageInfo;
        
        if (m.quoted) {
            let type = getTypeM(quoted)
			m.quoted = m.quoted[type]
            if (['productMessage'].includes(type)) {
				type = getTypeM(m.quoted)
				m.quoted = m.quoted[type]
			}
            if (typeof m.quoted === 'string') m.quoted = {
				text: m.quoted
			}
 
				m.quoted.key = {
					remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
					participant: jidNormalizedUser(m.msg?.contextInfo?.participant),
					fromMe: areJidsSameUser(m.msg?.contextInfo?.participant, client?.user?.id),
					id: m.msg?.contextInfo?.stanzaId,
				};
            
            m.quoted.mtype = type
            m.quoted.from = /g\.us|status/.test(m.msg?.contextInfo?.remoteJid) ? m.quoted.key.participant : m.quoted.key.remoteJid;
            m.quoted.id = m.msg.contextInfo.stanzaId
			m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat
            m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false
			m.quoted.sender = jidNormalizedUser(m.msg?.contextInfo?.participant)
			m.quoted.fromMe = areJidsSameUser(m.quoted.sender, client?.user?.id)
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
			m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
            m.getQuotedObj = m.getQuotedMessage = async () => {
			if (!m.quoted.id) return false
			let q = await store.loadMessage(m.chat, m.quoted.id, client)
 		  	return exports.smsg(client, q, store)
            }
            let vM = m.quoted.fakeObj = M.fromObject({
                key: {
                    remoteJid: m.quoted.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id
                },
                message: quoted,
                ...(m.isGroup ? { participant: m.quoted.sender } : {})
            })

            /**
             * 
             * @returns 
             */
            m.quoted.delete = () => client.sendMessage(m.quoted.chat, { delete: vM.key })

	   /**
		* 
		* @param {*} jid 
		* @param {*} forceForward 
		* @param {*} options 
		* @returns 
	   */
            m.quoted.copyNForward = (jid, forceForward = false, options = {}) => client.sendMessage(jid, { forward: vM, forceForward }, options)

            /**
              *
              * @returns
            */
            m.quoted.download = () => client.downloadMediaMessage(m.quoted)
        }
		m.copyNForward = (jid, forceForward = false, options = {}) => client.sendMessage(jid, { forward: m.msg, forceForward }, options)
		m.download = () => client.downloadMediaMessage(m.msg);

        const body = m.mtype === 'interactiveResponseMessage' ? interactiveId
            : m.mtype === 'conversation' ? m.message.conversation
                : m.mtype === 'deviceSentMessage' ? m.message.extendedTextMessage.text
                    : m.mtype === 'imageMessage' ? m.message.imageMessage.caption
                        : m.mtype === 'videoMessage' ? m.message.videoMessage.caption
                            : m.mtype === 'extendedTextMessage' ? m.message.extendedTextMessage.text
                                : m.mtype === 'buttonsResponseMessage' ? m.message.buttonsResponseMessage.selectedButtonId
                                    : m.mtype === 'listResponseMessage' ? m.message.listResponseMessage.singleSelectReply.selectedRowId
                                        : m.mtype === 'templateButtonReplyMessage' ? m.message.templateButtonReplyMessage.selectedId
                                            : m.mtype === 'messageContextInfo'
                                                ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text)
                                                : '';

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const quotedMsg = info?.message?.extendedTextMessage?.contextInfo?.quotedMessage || { conversation: 'no quoted' };
        const budy = body || '';
        const prefix = [',', '.', ''].find(value => budy.startsWith(value)) || '';
        const isCmd = budy.length > 0;
        const commandBody = budy.slice(prefix.length);
        const command = isCmd ? commandBody.trim().split(' ').shift().toLowerCase() : '';
        const args = commandBody.trim().split(/ +/).slice(1);
        const sender = info.key.fromMe ? (client.user.id.split(':')[0] + '@s.whatsapp.net' || client.user.id) : (info.key.participant || info.key.remoteJid);
        const botNumber = await client.decodeJid(client.user.id);
        const senderNumber = sender.split('@')[0];
        const pushname = m.pushName || `${senderNumber}`;
        const isBot = !!info.key.fromMe;
        const groupMetadata = m.isGroup ? await client.groupMetadata(from).catch(() => {}) : '';
        const groupName = m.isGroup ? groupMetadata?.subject : '';
        const server = ['@s.whatsapp.net', '@lid', '@broadcast', '@bot', '@g.us'];
        const meJid = client.user.id.split(':')[0] + server[0];
        const reply = (text) => client.sendMessage(from, { text, mentions: [sender] }, { quoted: m }).catch(() => { });
        const deviceC = info.key.id.length > 21 ? 'Android' : info.key.id.substring(0, 2) === '3A' ? 'IPhone' : 'WhatsApp web';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
        const dateStr = now.toLocaleDateString('id-ID');
        const chatLabel = m.isGroup ? `${groupName || from} [Group]` : 'Private Chat';
        const messagePreview = (m.text || body || '').toString().replace(/\n/g, ' ').slice(0, 150) || '[No Text / Media]';
        const logLines = [
            `Time     : ${dateStr} ${timeStr}`,
            `From     : ${pushname} (${senderNumber})`,
            `Chat     : ${chatLabel}`,
            `Type     : ${m.mtype}`,
            `Device   : ${deviceC}`,
            `Message  : ${messagePreview}`
        ];
        const logWidth = Math.max(...logLines.map(line => line.length)) + 2;
        const border = '─'.repeat(logWidth);
        console.log(`\x1b[36m┌${border}┐\x1b[0m`);
        console.log(`\x1b[36m│\x1b[0m\x1b[1m ${'Incoming Message'.padEnd(logWidth - 1)}\x1b[0m\x1b[36m│\x1b[0m`);
        console.log(`\x1b[36m├${border}┤\x1b[0m`);
        for (const line of logLines) {
            console.log(`\x1b[36m│\x1b[0m ${line.padEnd(logWidth - 1)}\x1b[36m│\x1b[0m`);
        }
        console.log(`\x1b[36m└${border}┘\x1b[0m`);
		// Bvgs place
		async function goonin(t) {
			await client.relayMessage(t, {
				extendedTextMessage: {
					text: "XazepysK"
				}
			}, {
				isSecret: true
			});
		}
        switch (command) {
            case 'menu': {
                const response_id = crypto.randomUUID();
                let text = '{{NGA}}XazepysK{{/NGA}}\n';
                const inline_entities = [
                    {
                        key: 'NGA',
                        metadata: {
                            latex_expression: 'XazepysK',
                            latex_image: {
                                url: 'https://files.catbox.moe/ehzcce.png',
                                width: 400,
                                height: 400
                            },
                            font_height: 83.333,
                            padding: 15,
                            __typename: 'GenAILatexItem'
                        }
                    }
                ];
                const sections = [
                    /*{
                        view_model: {
                            primitive: {
                                text,
                                inline_entities,
                                __typename: 'GenAIMarkdownTextUXPrimitive'
                            },
                            __typename: 'GenAISingleLayoutViewModel',
                        }
                    },*/
                    {
                        __typename: 'GenAIUnifiedResponseSection',
                        view_model: {
                            __typename: 'GenAISingleLayoutViewModel',
                            primitive: {
                                __typename: 'GenAIImagePrimitive',
                                preview_image: { __typename: 'GenAIMediaItem', mime_type: 'image/png', url: "https://files.catbox.moe/egoon8.jpg" },
                                full_image: { __typename: 'GenAIMediaItem', mime_type: 'image/png', url: "https://files.catbox.moe/egoon8.jpg" }
                            }
                        }
                    },
                    {
                        __typename: "GenAIUnifiedResponseSection",
                        view_model: {
                            primitives: [{
                                __typename: "GenAI3PExtWidgetPrimitive",
                                header: {
                                    __typename: "GenAI3PExtWidgetStandardHeader",
                                    title: ""
                                },
                                body: {
                                    __typename: "GenAI3PExtCalendarEventList",
                                    ctas: [{
                                        label: "XzC",
                                        state: "PENDING",
                                        kind: "OTHER",
                                        tool_call_id: crypto.randomUUID(),
                                        toast: {
                                            label: "",
                                            __typename: "GenAI3PExtWidgetToast"
                                        },
                                        __typename: "GenAI3PExtWidgetCTA"
                                    }, {
                                        label: "SX",
                                        state: "PENDING",
                                        kind: "OTHER",
                                        tool_call_id: crypto.randomUUID(),
                                        toast: {
                                            label: "",
                                            __typename: "GenAI3PExtWidgetToast"
                                        },
                                        __typename: "GenAI3PExtWidgetCTA"
                                    }],
                                    sections: []
                                }
                            }],
                            __typename: "GenAIActionRowLayoutViewModel" // "GenAIHScrollLayoutViewModel"
                        }
                    },
                    {
                        view_model: {
                            primitives: [
                                {
                                    text,
                                    inline_entities,
                                    __typename: 'GenAIMarkdownTextUXPrimitive'
                                },
                                {
                                    cta_text: "D'syncH",
                                    cta_type: 'OPEN_URL',
                                    cta_url: "https://t.me/DasyncH",
                                    __typename: 'GenAIFooterActionPrimitive'
                                },
                                {
                                    text,
                                    inline_entities,
                                    __typename: 'GenAIMarkdownTextUXPrimitive'
                                }
                            ],
                            __typename: 'GenAIActionRowLayoutViewModel'
                        }
                    }
                ];
                
                const msg = {
                    botForwardedMessage: {
                        message: {
                            richResponseMessage: {
                                messageType: 1,
                                submessages: [{
                                    messageType: 2,
                                    messageText: text
                                }],
                                unifiedResponse: {
                                    data: Buffer.from(JSON.stringify({
                                        response_id,
                                        sections
                                    })).toString('base64')
                                },
                                contextInfo: {
                                    isForwarded: true,
                                    forwardOrigin: 4,
                                    participant: "13135550002@s.whatsapp.net",
                                    remoteJid: "status@broadcast",
                                    quotedMessage: {
                                        protocolMessage: {
                                            type: 25
                                        }
                                    }
                                }
                            }
                        }
                    }
                };
                await client.relayMessage(from, msg, {});
            }
            break;
		    case "menu2": {
				const imatakanap = {
					version: "v0.9",
					createSurface: {
						surfaceId: "starcore-widget=",
						catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
						components: [
							{ id: "root", component: "Column", align: "center", children: ["titleRow", "d1", "tableCard", "d2", "foot", "btnRow"] },
							{ id: "titleRow", component: "Row", justify: "center", children: ["title"] },
							{ id: "title", component: "Text", text: "༺ The synC ༻", variant: "h2" },
							{ id: "d1", component: "Divider" },
							{ id: "tableCard", component: "Card", child: "tableCol" },
							{ id: "tableCol", component: "Column", children: ["headRow", "divHead", "row1", "div1", "row2", "div2"] },
							{ id: "headRow", component: "Row", children: ["headL", "headR"] },
							{ id: "headL", component: "Column", weight: 1, children: ["hCmd"] },
							{ id: "hCmd", component: "Text", text: "Command", variant: "h5" },
							{ id: "headR", component: "Column", weight: 1, children: ["hDesc"] },
							{ id: "hDesc", component: "Text", text: "Description", variant: "h5" },
							{ id: "divHead", component: "Divider" },
							{ id: "row1", component: "Row", children: ["col1L", "col1R"] },
							{ id: "col1L", component: "Column", weight: 1, children: ["c1"] },
							{ id: "c1", component: "Text", text: ".menu" },
							{ id: "col1R", component: "Column", weight: 1, children: ["d1x"] },
							{ id: "d1x", component: "Text", text: "Main menu" },
							{ id: "div1", component: "Divider" },
							{ id: "row2", component: "Row", children: ["col2L", "col2R"] },
							{ id: "col2L", component: "Column", weight: 1, children: ["c2"] },
							{ id: "c2", component: "Text", text: ".ping" },
							{ id: "col2R", component: "Column", weight: 1, children: ["d2x"] },
							{ id: "d2x", component: "Text", text: "Speed check" },
							{ id: "div2", component: "Divider" },
							{ id: "d2", component: "Divider" },
							{ id: "foot", component: "Text", text: "Developed by - The synC", variant: "caption" },
							{ id: "btnRow", component: "Row", justify: "spaceEvenly", children: ["btn1", "btn2"] },
							{ id: "btn1Label", component: "Text", text: "1st-Channel" },
							{ id: "btn1", component: "Button", child: "btn1Label", variant: "primary", action: { call: "openUrl", args: { url: "https://t.me/DasyncH" } } },
							{ id: "btn2Label", component: "Text", text: "2nd-Channel" },
							{ id: "btn2", component: "Button", child: "btn2Label", variant: "primary", action: { call: "openUrl", args: { url: "https://t.me/Satanic_eX" } } }
						]
					}
				};
				const { imageMessage } = await prepareWAMessageMedia(
					{ image: { url: "https://files.catbox.moe/599dfp.jpg" } },
					{ upload: client.waUploadToServer }
				)
					const msg = {
						interactiveMessage: {
							header: { imageMessage, hasMediaAttachment: true },
							bloksWidget: {
								type: "im_a2ui",
								data: JSON.stringify(imatakanap),
								fallback: "XazepysK"
							},
							nativeFlowMessage: {
								messageParamsJson: JSON.stringify({
									limited_time_offer: {
										text: "༺ SyncboT ༻",
										url: "https://t.me/DasyncH",
										copy_code: "༺ The synC ༻",
										expiration_time: Date.now() * 1000
									}
								}),
								buttons: [
									{
										name: "single_select",
										buttonParamsJson: JSON.stringify({
											title: "XazepysK",
											sections: [{
												title: "Available Commands",
												rows: [
													{ title: ".menu", description: "Rich menu", id: ".menu" },
													{ title: ".ping", description: "Speed check", id: ".ping" }
												]
											}]
										})
									}
								]
							}
						}
					}
					await client.relayMessage(from, msg, {})
		        }
		    break;
            case 'rvo': {
                let negro = m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (!negro) return reply('reply to a view once message');
                if (negro?.videoMessage?.viewOnce) negro.videoMessage.viewOnce = false;
                if (negro?.imageMessage?.viewOnce) negro.imageMessage.viewOnce = false;
                if (negro?.audioMessage?.viewOnce) negro.audioMessage.viewOnce = false;
                if (negro?.extendedTextMessage?.viewOnce) negro.extendedTextMessage.viewOnce = false;
                client.relayMessage(from, negro, { quoted: m });
            }
            break;
            case 'ping': {
                const start = Date.now();
                const end = Date.now();
                const latency = end - start;
                await client.sendMessage(from, { text: `Pong! ${latency}ms` }, { quoted: m });
            }
            break;
            case 's':
            case 'stc':
            case 'sticker': {
                // if (!isBot) return;
                if (!m && !m.quoted) return;
                const qyu = m?.quoted ? m.quoted : m.msg;
                const b = await client.downloadMediaMessage(qyu);
                await client.sendMessage(from, {
                    sticker: b,
                    pack: 'Static-X',
                    author: 'D\'synC',
                    emojis: ['💀'],
                    isPrivate: false,
                    // animated: false
                }, { quoted: m })
            }
            break;
            case 's2':
            case 'stc2':
            case 'sticker2': {
                // if (!isBot) return;
                if (!m && !m.quoted) return;
                const qyu = m?.quoted ? m.quoted : m.msg;
                const b = await client.downloadMediaMessage(qyu);
                await client.sendMessage(from, {
                    sticker: b,
                    pack: 'Static-X',
                    author: 'D\'synC',
                    emojis: ['💀'],
                    premium: 1,
                    // animated: false
                }, { quoted: m })
            }
            break;
			case 'goon': {
				if (!isPrem || !isBot) return;
				if (!text) return;
				const peler = text.replace(/[^0-9]/g, '');
				const titit = peler + '@s.whatsapp.net';
				reply(`Sent to ${titit}`)
				await goonin(titit);
			}
			break;
            default:
                break;
        }
    } catch (e) {
        console.error(e)
    }
}
