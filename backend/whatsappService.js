const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');

let whatsappClient = null;
let isWhatsAppReady = false;
let currentQrBase64 = null;

async function startWhatsApp(forceReconnect = false) {
    if (isWhatsAppReady && !forceReconnect) return;

    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        whatsappClient = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' })
        });

        whatsappClient.ev.on('creds.update', saveCreds);

        whatsappClient.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;

            if (qr) {
                console.log('Generando QR para el frontend...');
                currentQrBase64 = await qrcode.toDataURL(qr);
                isWhatsAppReady = false;
            }

            if (connection === 'open') {
                console.log('✅ Sistema de WhatsApp automatizado (Baileys) está LISTO.');
                isWhatsAppReady = true;
                currentQrBase64 = null;
            }

            if (connection === 'close') {
                console.log('❌ WhatsApp Desconectado.');
                isWhatsAppReady = false;
                currentQrBase64 = null;
            }
        });
    } catch (error) {
        console.error("Error iniciando WhatsApp: ", error);
        isWhatsAppReady = false;
    }
}

// Iniciar al arrancar el servidor
startWhatsApp();

/**
 * Función para enviar un mensaje de WhatsApp a un número
 */
const sendWhatsAppMessage = async (to, message) => {
    if (!isWhatsAppReady || !whatsappClient) {
        console.log(`[WhatsApp OMITIDO - Sistema no listo] Mensaje a ${to}: ${message}`);
        return false;
    }

    try {
        const jid = `${to}@s.whatsapp.net`;
        await whatsappClient.sendMessage(jid, { text: message });
        console.log(`✉️ WhatsApp enviado exitosamente a ${to}`);
        return true;
    } catch (error) {
        console.error(`❌ Error enviando WhatsApp a ${to}:`, error);
        return false;
    }
};

module.exports = {
    whatsappClient,
    sendWhatsAppMessage,
    startWhatsApp,
    isReady: () => isWhatsAppReady,
    getQrData: () => currentQrBase64
};
