const axios = require('axios');
const { buildConversationPrompt } = require('./promptBuilder');
const { detectIntent, detectLanguage } = require('../utils/helpers');
const db = require('../database');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const AI_MODEL = process.env.AI_MODEL || 'llama3.2';
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.7');

async function generateResponse(business, userMessage, history = []) {
  try {
    const aiSettings = business.ai_settings || {};
    const intent = detectIntent(userMessage);
    const lang = detectLanguage(userMessage);
    const customerName = '';

    const { system, conversation } = buildConversationPrompt(
      business, aiSettings, customerName, history
    );

    const langInstruction = getLanguageInstruction(lang, aiSettings.language);
    const intentInstruction = getIntentInstruction(intent);

    const fullPrompt = `${system}

${langInstruction}
${intentInstruction}

${conversation}
Customer: ${userMessage}
You:`;

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: AI_MODEL,
      prompt: fullPrompt,
      system: system,
      temperature: AI_TEMPERATURE,
      stream: false,
      options: {
        num_predict: 256,
        stop: ['Customer:', '\n\n\n']
      }
    });

    let reply = response.data.response?.trim() || '';

    reply = cleanResponse(reply);

    return { reply, intent, lang };

  } catch (error) {
    console.error('AI Engine Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      return {
        reply: getFallbackResponse(business),
        intent: 'inquiry',
        lang: 'english'
      };
    }
    return {
      reply: 'I apologize, but I am facing a technical issue. Please try again in a moment.',
      intent: 'inquiry',
      lang: 'english'
    };
  }
}

async function generateResponseDirect(business, userMessage) {
  const history = db.getCustomerMessages
    ? db.getCustomerMessages(business.id, userMessage.from || '', 10)
    : [];

  return generateResponse(business, userMessage.message || userMessage, history || []);
}

function getLanguageInstruction(detectedLang, settingLang) {
  if (settingLang && settingLang !== 'auto') {
    return `IMPORTANT: Respond in ${settingLang} language only.`;
  }
  if (detectedLang === 'urdu') return 'IMPORTANT: Respond in Urdu (Roman Urdu is fine). Use words like "ji", "aap", "hain".';
  if (detectedLang === 'hindi') return 'IMPORTANT: Respond in Hindi. Use natural Hindi conversation.';
  if (detectedLang === 'arabic') return 'IMPORTANT: Respond in Arabic.';
  return 'Respond in English. You can mix in conversational Urdu/Hindi if the customer does.';
}

function getIntentInstruction(intent) {
  switch (intent) {
    case 'pricing': return '- Customer is asking about prices. Give clear pricing. Ask if they want to proceed.';
    case 'booking': return '- Customer wants to book. Ask for name, phone, preferred date/time. Confirm booking.';
    case 'complaint': return '- Customer has a complaint. Apologize sincerely. Offer solution. Be understanding.';
    case 'emergency': return '- Customer has an emergency. Be serious. Provide urgent contact info immediately. If no emergency contact, advise calling directly.';
    case 'greeting': return '- Customer is greeting. Greet back warmly. Ask how you can help them today.';
    case 'thanks': return '- Customer is thanking. Be humble. Offer further assistance.';
    default: return '- Customer has a general inquiry. Be helpful. Provide information and convert.';
  }
}

function cleanResponse(text) {
  return text
    .replace(/^(You:|Assistant:|AI:|Bot:)\s*/gmi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getFallbackResponse(business) {
  return `Hi! Welcome to ${business.name}. I'm currently processing your request. Could you please briefly share what you're looking for? I'll be happy to assist you.`;
}

module.exports = { generateResponse, generateResponseDirect };
