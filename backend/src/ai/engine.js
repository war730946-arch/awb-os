const axios = require('axios');
const { buildConversationPrompt } = require('./promptBuilder');
const { detectIntent, detectLanguage } = require('../utils/helpers');
const db = require('../database');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const AI_MODEL = process.env.AI_MODEL || 'llama3.2';
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.7');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const HF_TOKEN = process.env.HF_TOKEN || '';
const HF_MODEL = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';

async function generateResponse(business, userMessage, history = []) {
  const aiSettings = business.ai_settings || {};
  const intent = detectIntent(userMessage);
  const lang = detectLanguage(userMessage);

  const { system, conversation } = buildConversationPrompt(
    business, aiSettings, '', history
  );

  const langInstruction = getLanguageInstruction(lang, aiSettings.language);
  const intentInstruction = getIntentInstruction(intent);

  const messages = [
    { role: 'system', content: `${system}\n\n${langInstruction}\n${intentInstruction}` }
  ];
  for (const msg of (history || []).slice(-10)) {
    messages.push({ role: 'user', content: msg.message || msg.content || '' });
    messages.push({ role: 'assistant', content: msg.response || msg.reply || '' });
  }
  messages.push({ role: 'user', content: userMessage });

  // 1. Try Hugging Face (user's choice)
  if (HF_TOKEN) {
    try {
      return await callHuggingFace(messages, intent, lang);
    } catch (err) {
      console.error('HuggingFace Error:', err.message);
    }
  }

  // 2. Try Groq
  if (GROQ_API_KEY) {
    try {
      return await callGroq(messages, intent, lang);
    } catch (err) {
      console.error('Groq Error:', err.message);
    }
  }

  // 3. Try OpenAI
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(messages, intent, lang);
    } catch (err) {
      console.error('OpenAI Error:', err.message);
    }
  }

  // 4. Try Google Gemini
  if (GEMINI_API_KEY) {
    try {
      return await callGemini(messages, intent, lang);
    } catch (err) {
      console.error('Gemini Error:', err.message);
    }
  }

  // 5. Try local Ollama
  try {
    return await callOllama(system, userMessage, conversation, langInstruction, intentInstruction, intent, lang);
  } catch (err) {
    console.error('Ollama Error:', err.message);
  }

  // 6. Fallback templates
  return generateFallbackResponse(business, userMessage);
}

async function callGroq(messages, intent, lang) {
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: GROQ_MODEL,
      messages,
      temperature: AI_TEMPERATURE,
      max_tokens: 300
    },
    {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  let reply = response.data.choices?.[0]?.message?.content?.trim() || '';
  reply = cleanResponse(reply);
  return { reply, intent, lang };
}

async function callOpenAI(messages, intent, lang) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: OPENAI_MODEL,
      messages,
      temperature: AI_TEMPERATURE,
      max_tokens: 300
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

async function callGemini(messages, intent, lang) {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatHistory = messages.filter(m => m.role !== 'system').slice(0, -1);
  const lastMsg = messages.filter(m => m.role !== 'system').slice(-1)[0];

  const contents = [];
  for (const msg of chatHistory) {
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
  }
  contents.push({ role: 'user', parts: [{ text: lastMsg?.content || '' }] });

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents,
      systemInstruction: { parts: [{ text: systemMsg }] },
      generationConfig: { temperature: AI_TEMPERATURE, maxOutputTokens: 300 }
    }
  );
  let reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  reply = cleanResponse(reply);
  return { reply, intent, lang };
}

async function callHuggingFace(messages, intent, lang) {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMessages = messages.filter(m => m.role !== 'system');
  const conversationText = chatMessages.map(m =>
    `${m.role === 'assistant' ? 'Assistant' : 'Human'}: ${m.content}`
  ).join('\n');

  const prompt = `${systemMsg}

${conversationText}
Assistant:`;

  const response = await axios.post(
    `https://api-inference.huggingface.co/models/${HF_MODEL}`,
    {
      inputs: prompt,
      parameters: {
        max_new_tokens: 300,
        temperature: AI_TEMPERATURE,
        return_full_text: false
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );

  let reply = '';
  if (Array.isArray(response.data)) {
    reply = response.data[0]?.generated_text?.trim() || '';
  } else if (response.data?.generated_text) {
    reply = response.data.generated_text.trim();
  }
  reply = cleanResponse(reply);
  return { reply, intent, lang };
}

async function callOllama(system, userMessage, conversation, langInstruction, intentInstruction, intent, lang) {
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
    options: { num_predict: 256, stop: ['Customer:', '\n\n\n'] }
  });
  let reply = response.data.response?.trim() || '';
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

module.exports = { generateResponse };
