const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');

let whatsappClient = null;
let isWhatsAppReady = false;
let currentQrBase64 = null;

async function startWhatsApp(forceReconnect = false) {
    if (isWhatsAppReady && !forceReconnect) return;

    try {
        // Carpeta donde se guardan las credenciales para no pedir QR una vez escaneado
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const { version } = await fetchLatestBaileysVersion();

        whatsappClient = makeWASocket({
            auth: state,
            printQRInTerminal: true, // Imprime en consola para logs tras bambalinas
            logger: pino({ level: 'silent' }), // Mantiene la consola de Render o local limpia sin exceso de logs
            version,
            browser: Browsers.macOS('Desktop')
        });

        // Guardar las claves si Baileys las actualiza automáticamente
        whatsappClient.ev.on('creds.update', saveCreds);

        // Controlar el estado de conexión
        whatsappClient.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;

            if (qr) {
                console.log('🔄 Generando código QR fresco para el panel web...');
                // Convertir la imagen cruda a una URL en Base64 para que React pueda mostrarla en un <img>
                currentQrBase64 = await qrcode.toDataURL(qr);
                isWhatsAppReady = false;
            }

            if (connection === 'open') {
                console.log('✅ Sistema de WhatsApp automatizado está 100% ONLINE.');
                isWhatsAppReady = true;
                currentQrBase64 = null;
            }

            if (connection === 'close') {
                console.log('❌ WhatsApp se ha cerrado o desconectado.', update.lastDisconnect?.error);
                isWhatsAppReady = false;
                currentQrBase64 = null;
                // Si la sesión fue borrada o cerrada desde el celular, podríamos vaciar auth_info_baileys
            }
        });
    } catch (error) {
        console.error("❌ Ocurrió un error al iniciar WhatsApp: ", error);
        isWhatsAppReady = false;
    }
}

// Iniciar al arrancar el servidor
startWhatsApp();

/**
 * Función exportada para enviar un mensaje de WhatsApp
 */
const sendWhatsAppMessage = async (to, message) => {
    if (!isWhatsAppReady || !whatsappClient) {
        console.log(`[WhatsApp OMITIDO - Sistema no listo] Mensaje a ${to}: ${message}`);
        return false;
    }

    try {
        // En Baileys el número debe llevar el sufijo @s.whatsapp.net y sin el signo +
        let cleanPhone = to.toString().replace(/\D/g, '');
        if (!cleanPhone.includes('@')) {
            cleanPhone = `${cleanPhone}@s.whatsapp.net`;
        }

        await whatsappClient.sendMessage(cleanPhone, { text: message });
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
