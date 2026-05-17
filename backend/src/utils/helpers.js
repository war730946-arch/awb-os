function detectIntent(message) {
  const lower = message.toLowerCase();
  if (/\b(price|cost|rate|fee|charges|kitna|price|costing)\b/i.test(lower)) return 'pricing';
  if (/\b(book|appointment|schedule|reserve|slot|booking|time|available|free)\b/i.test(lower)) return 'booking';
  if(/\b(complain|complaint|issue|problem|not working|shikayat|problem)\b/i.test(lower)) return 'complaint';
  if (/\b(emergency|urgent|help|immediately|fauri|emergency)\b/i.test(lower)) return 'emergency';
  if (/\b(hi|hello|hey|salam|assalam|good morning|good evening)\b/i.test(lower)) return 'greeting';
  if (/\b(thank|thanks|shukria)\b/i.test(lower)) return 'thanks';
  return 'inquiry';
}

function detectLanguage(text) {
  const urduChars = text.match(/[\u0600-\u06FF]/g);
  if (urduChars && urduChars.length > text.length * 0.3) return 'urdu';
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  if (arabicChars && arabicChars.length > text.length * 0.3) return 'arabic';
  const hindiChars = text.match(/[\u0900-\u097F]/g);
  if (hindiChars && hindiChars.length > text.length * 0.3) return 'hindi';
  return 'english';
}

function formatTimestamp(date) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

module.exports = { detectIntent, detectLanguage, formatTimestamp };
