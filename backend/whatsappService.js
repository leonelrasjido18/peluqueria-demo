const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');

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
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            version,
            browser: ['YSY Panel', 'Chrome', '1.0.0'],
            syncFullHistory: false, // Evita colapso al cargar mensajes viejos
            generateHighQualityLinkPreview: true
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
                const shouldReconnect = (update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                console.log('❌ WhatsApp se ha cerrado o desconectado. ¿Reconectar?:', shouldReconnect);
                isWhatsAppReady = false;
                currentQrBase64 = null;
                
                if (shouldReconnect) {
                    // Try to reconnect if not logged out
                    setTimeout(() => startWhatsApp(true), 5000);
                } else {
                    // Logged out
                    console.log('🚨 Sesión cerrada desde el celular. Limpiando credenciales...');
                    try {
                        if (fs.existsSync('auth_info_baileys')) {
                            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
                        }
                    } catch(e) {}
                    // Restart for fresh QR
                    startWhatsApp(true);
                }
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
 * Resetear WhatsApp borrando las credenciales antiguas para generar un QR Limpio
 */
const resetWhatsApp = async () => {
    try {
        if (whatsappClient) {
            whatsappClient.ev.removeAllListeners();
            whatsappClient.ws.close();
        }
    } catch(e) {}
    
    isWhatsAppReady = false;
    currentQrBase64 = null;
    whatsappClient = null;
    
    try {
        if (fs.existsSync('auth_info_baileys')) {
            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
            console.log("🧹 Sesión antigua de WhatsApp borrada manualmente.");
        }
    } catch(e) {
        console.error("No se pudo limpiar auth_info_baileys", e);
    }
    
    await startWhatsApp(true);
};

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
    resetWhatsApp,
    isReady: () => isWhatsAppReady,
    getQrData: () => currentQrBase64
};
