const axios = require('axios');
const { buildConversationPrompt } = require('./promptBuilder');
const { detectIntent, detectLanguage } = require('../utils/helpers');
const db = require('../database');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const AI_MODEL = process.env.AI_MODEL || 'llama3.2';
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.7');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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
    console.error('Ollama Error:', error.message);

    if (OPENAI_API_KEY) {
      try {
        return await callOpenAI(business, userMessage, history);
      } catch (openAiError) {
        console.error('OpenAI Fallback Error:', openAiError.message);
      }
    }

    return generateFallbackResponse(business, userMessage);
  }
}

async function generateResponseDirect(business, userMessage) {
  const history = db.getCustomerMessages
    ? db.getCustomerMessages(business.id, userMessage.from || '', 10)
    : [];

  return generateResponse(business, userMessage.message || userMessage, history || []);
}

async function callOpenAI(business, userMessage, history) {
  const aiSettings = business.ai_settings || {};
  const intent = detectIntent(userMessage);
  const lang = detectLanguage(userMessage);
  const { system, conversation } = buildConversationPrompt(business, aiSettings, '', history);
  const langInstruction = getLanguageInstruction(lang, aiSettings.language);
  const intentInstruction = getIntentInstruction(intent);

  const messages = [
    { role: 'system', content: `${system}\n\n${langInstruction}\n${intentInstruction}` }
  ];

  for (const msg of history.slice(-10)) {
    messages.push({ role: 'user', content: msg.message });
    messages.push({ role: 'assistant', content: msg.response });
  }

  messages.push({ role: 'user', content: userMessage });

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: OPENAI_MODEL,
      messages,
      temperature: AI_TEMPERATURE,
      max_tokens: 256
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  let reply = response.data.choices?.[0]?.message?.content?.trim() || '';
  reply = cleanResponse(reply);

  return { reply, intent, lang };
}

function generateFallbackResponse(business, userMessage) {
  const intent = detectIntent(userMessage);
  const lang = detectLanguage(userMessage);
  const businessName = business.name || 'our business';
  const services = Array.isArray(business.services) ? business.services : [];

  const greetings = [
    `Hello! Welcome to ${businessName}. How can I help you today?`,
    `Hi there! Thanks for reaching out to ${businessName}. What can I assist you with?`,
    `Hey! Great to hear from you. This is ${businessName}, how may I help?`
  ];

  const thanks = [
    `You're welcome! If you need anything else, feel free to ask.`,
    `Happy to help! Let me know if there's anything else you need.`,
    `My pleasure! I'm here if you have more questions.`
  ];

  const pricing = [
    `Sure! I'd be happy to share our pricing details. ` + (services.length > 0
      ? `We offer: ${services.map(s => `${s.name} ($${s.price})`).join(', ')}. `
      : `Let me check our latest rates for you. `) +
    `Would you like to proceed with any of these?`,
    `Great question about pricing! ` + (services.length > 0
      ? `Here's what we have: ${services.map(s => `${s.name} - $${s.price}`).join(', ')}. `
      : `I can look up the pricing for you. `) +
    `Would you like more details on any service?`
  ];

  const booking = [
    `I'd love to help you book! Could you share your name, preferred date, and time so I can check availability?`,
    `Sure, let me help with that! Please tell me your name and the date/time you'd prefer.`
  ];

  const complaint = [
    `I'm sorry to hear about this. Let me make it right. Could you share more details so I can look into it and find a solution?`,
    `I apologize for the inconvenience. Please tell me what happened so I can resolve this for you.`
  ];

  const emergency = [
    `This sounds urgent. Please call us directly at your earliest convenience so we can assist you immediately.`,
    `For urgent matters, I recommend reaching us by phone right away. We're here to help.`
  ];

  const inquiryTemplates = [
    `Thank you for your message. Regarding "${userMessage}", I'd be happy to help. ` +
    (services.length > 0
      ? `We offer ${services.map(s => s.name).join(', ')}. `
      : `Let me provide you with the information you need. `) +
    `Could you tell me a bit more about what you're looking for?`,
    `Thanks for reaching out to ${businessName}! ` +
    `I understand you're asking about "${userMessage.substring(0, 50)}". ` +
    `Let me help you with that. What specific details are you looking for?`
  ];

  let templates;
  switch (intent) {
    case 'greeting': templates = greetings; break;
    case 'thanks':   templates = thanks; break;
    case 'pricing':  templates = pricing; break;
    case 'booking':  templates = booking; break;
    case 'complaint': templates = complaint; break;
    case 'emergency': templates = emergency; break;
    default:         templates = inquiryTemplates; break;
  }

  const reply = templates[Math.floor(Math.random() * templates.length)];

  return { reply, intent, lang };
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

module.exports = { generateResponse, generateResponseDirect };
