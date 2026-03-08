const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');

let whatsappClient = null;
let isWhatsAppReady = false;
let currentQrBase64 = null;
let onReviewReceived = null; // Callback para guardar reseñas recibidas por WhatsApp
const pendingReviews = {}; // { 'number@s.whatsapp.net': { name, timestamp } }

// Limpiar pendingReviews viejos cada hora (expiran en 48hs)
setInterval(() => {
    const now = Date.now();
    Object.keys(pendingReviews).forEach(k => {
        if (now - pendingReviews[k].timestamp > 48 * 60 * 60 * 1000) delete pendingReviews[k];
    });
}, 60 * 60 * 1000);

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

        // Números de teléfono que están esperando dejar una reseña
        // Formato: { 'number@s.whatsapp.net': { name: 'Juan', timestamp: Date.now() } }

        // Listener de mensajes entrantes para capturar reseñas
        whatsappClient.ev.on('messages.upsert', async (m) => {
            if (!m.messages || m.messages.length === 0) return;
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
            if (!text) return;

            const senderJid = msg.key.remoteJid;
            const senderNumber = senderJid.replace('@s.whatsapp.net', '');
            let senderName = msg.pushName || senderNumber;

            // Opción 1: El cliente responde un número del 1 al 5 (con o sin comentario)
            // Esto funciona SIEMPRE - cualquier mensaje que empiece con 1-5
            const match = text.match(/^([1-5])\s*(.*)?$/s);
            if (match && pendingReviews[senderJid]) {
                const rating = parseInt(match[1]);
                const comment = (match[2] || '').trim();
                
                if (onReviewReceived) {
                    const reviewName = pendingReviews[senderJid].name || senderName;
                    onReviewReceived(reviewName, rating, comment);
                    delete pendingReviews[senderJid];
                    await whatsappClient.sendMessage(senderJid, { 
                        text: `✅ *¡Gracias ${reviewName}!*\n\nTu calificación de ${'⭐'.repeat(rating)} fue guardada.\n${comment ? `\n_"${comment}"_\n` : ''}\n¡Te esperamos pronto! ✂️` 
                    });
                    console.log(`⭐ Reseña recibida de ${reviewName}: ${rating} estrellas`);
                }
                return;
            }

            // Opción 2: Formato directo con "RESEÑA" (para quienes envían sin haber sido consultados)
            const upperText = text.toUpperCase();
            if (upperText.startsWith('RESEÑA') || upperText.startsWith('RESENA')) {
                const parts = text.split(/\s+/);
                const rating = parseInt(parts[1]);
                if (rating >= 1 && rating <= 5) {
                    const comment = parts.slice(2).join(' ') || '';
                    if (onReviewReceived) {
                        onReviewReceived(senderName, rating, comment);
                        await whatsappClient.sendMessage(senderJid, { 
                            text: `✅ *¡Gracias ${senderName}!*\n\nTu calificación de ${'⭐'.repeat(rating)} fue guardada.\n${comment ? `\n_"${comment}"_\n` : ''}\n¡Te esperamos pronto! ✂️` 
                        });
                        console.log(`⭐ Reseña directa de ${senderName}: ${rating} estrellas`);
                    }
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

/**
 * Solicitar reseña al cliente después de completar un turno
 * Envía un mensaje amigable y registra el número como 'pendiente de reseña'
 */
const requestReview = async (to, clientName) => {
    let cleanPhone = to.toString().replace(/\D/g, '');
    if (!cleanPhone.includes('@')) {
        cleanPhone = `${cleanPhone}@s.whatsapp.net`;
    }
    
    // Registrar como pendiente de reseña
    pendingReviews[cleanPhone] = { name: clientName, timestamp: Date.now() };
    
    const message = `⭐ *¡Hola ${clientName}!*\n\n¿Cómo fue tu experiencia en *YSY BARBER*?\n\nCalificanos respondiendo con un número:\n\n1️⃣ Malo\n2️⃣ Regular\n3️⃣ Bueno\n4️⃣ Muy bueno\n5️⃣ Excelente\n\n_También podés agregar un comentario después del número._\n_Ej: 5 Me encantó el corte!_`;
    
    return sendWhatsAppMessage(to, message);
};

module.exports = {
    whatsappClient,
    sendWhatsAppMessage,
    requestReview,
    startWhatsApp,
    resetWhatsApp,
    unlinkWhatsApp,
    isReady: () => isWhatsAppReady,
    getQrData: () => currentQrBase64,
    setOnReviewReceived: (cb) => { onReviewReceived = cb; }
};
