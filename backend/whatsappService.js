const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Initialize WhatsApp client with LocalAuth to persist session
const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Importante para entornos con bajos recursos como el plan gratuito de Render
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null, // Vía para indicar la ruta de Chromium en Render
        headless: true
    }
});

let isWhatsAppReady = false;

whatsappClient.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('\n--- ESCANEA EL SIGUIENTE CÓDIGO QR EN TU WHATSAPP ---');
    qrcode.generate(qr, { small: true });
    console.log('----------------------------------------------------\n');
});

whatsappClient.on('ready', () => {
    console.log('✅ Sistema de WhatsApp automatizado (WhatsApp-web.js beta) está LISTO.');
    isWhatsAppReady = true;
});

whatsappClient.on('auth_failure', msg => {
    console.error('❌ Error de Autenticación de WhatsApp:', msg);
});

whatsappClient.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Desconectado. Razón:', reason);
    isWhatsAppReady = false;
});

whatsappClient.initialize();

/**
 * Función para enviar un mensaje de WhatsApp a un número
 * @param {string} to - Número de teléfono en formato internacional sin el + (Ej: 5491112345678)
 * @param {string} message - El mensaje a enviar
 */
const sendWhatsAppMessage = async (to, message) => {
    if (!isWhatsAppReady) {
        console.log(`[WhatsApp OMITIDO - Sistema no listo] Mensaje a ${to}: ${message}`);
        return false;
    }

    try {
        // Formatear el número para whatsapp-web.js format (añadir @c.us)
        const chatId = `${to}@c.us`;
        await whatsappClient.sendMessage(chatId, message);
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
    isReady: () => isWhatsAppReady
};
