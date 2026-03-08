const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');

let whatsappClient = null;
let isWhatsAppReady = false;
let currentQrBase64 = null;
let onReviewReceived = null; // Callback para guardar reseñas recibidas por WhatsApp

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

        // Listener de mensajes entrantes para capturar reseñas
        whatsappClient.ev.on('messages.upsert', async (m) => {
            if (!m.messages || m.messages.length === 0) return;
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const upperText = text.toUpperCase().trim();

            // Formato: RESEÑA 5 Excelente corte, muy recomendable
            // o: RESEÑA 4 
            if (upperText.startsWith('RESEÑA') || upperText.startsWith('RESENA') || upperText.startsWith('REVIEW')) {
                const parts = text.trim().split(/\s+/);
                // parts[0] = RESEÑA, parts[1] = rating, parts[2...] = comment
                const rating = parseInt(parts[1]);
                if (!rating || rating < 1 || rating > 5) {
                    const senderJid = msg.key.remoteJid;
                    await whatsappClient.sendMessage(senderJid, { 
                        text: '⭐ *YSY BARBER - Reseña*\n\nPara dejar tu reseña enviá:\n\n*RESEÑA [1-5] [tu comentario]*\n\nEjemplo:\n_RESEÑA 5 Excelente servicio, muy recomendable!_' 
                    });
                    return;
                }
                const comment = parts.slice(2).join(' ') || '';
                
                // Obtener nombre del contacto
                const senderJid = msg.key.remoteJid;
                const senderNumber = senderJid.replace('@s.whatsapp.net', '');
                let senderName = msg.pushName || senderNumber;

                // Guardar reseña usando el callback
                if (onReviewReceived) {
                    onReviewReceived(senderName, rating, comment);
                    await whatsappClient.sendMessage(senderJid, { 
                        text: `✅ *¡Gracias ${senderName}!*\n\nTu reseña de ${'⭐'.repeat(rating)} fue guardada exitosamente.\n\n_"${comment || 'Sin comentario'}"_\n\n¡Te esperamos pronto! ✂️` 
                    });
                    console.log(`⭐ Nueva reseña vía WhatsApp de ${senderName}: ${rating} estrellas`);
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
 * Desvincular WhatsApp limpiando sesión y deteniendo cliente
 */
const unlinkWhatsApp = async () => {
    try {
        if (whatsappClient) {
            whatsappClient.ev.removeAllListeners();
            // Cerrar conexión WS de baileys
            whatsappClient.end(undefined);
        }
    } catch(e) {}
    
    isWhatsAppReady = false;
    currentQrBase64 = null;
    whatsappClient = null;
    
    try {
        // En WhatsApp web multi-device la sesión está en esta carpeta
        if (fs.existsSync('auth_info_baileys')) {
            fs.rmSync('auth_info_baileys', { recursive: true, force: true });
            console.log("🧹 WhatsApp Desvinculado - Sesión borrada.");
        }
    } catch(e) {
        console.error("No se pudo desvincular auth_info_baileys", e);
    }
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
    unlinkWhatsApp,
    isReady: () => isWhatsAppReady,
    getQrData: () => currentQrBase64,
    setOnReviewReceived: (cb) => { onReviewReceived = cb; }
};
