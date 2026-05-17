# AWB-OS v1.0.0
## AI WhatsApp Business Operating System

---

## 🇮🇳 चलाने का आसान तरीका / Easy Start Guide

### 🚀 **सबसे आसान तरीका - बस एक क्लिक:**

1. `awb-os` फोल्डर खोलें
2. **`start.bat`** पर डबल-क्लिक करें
3. सब कुछ अपने आप start हो जाएगा

---

### 🖥️ खुद से चलाना (Manual):

#### Step 1: Backend चलाएं (Terminal 1)
```bash
cd awb-os/backend
npm start
```
- यह http://localhost:3001 पर चलेगा

#### Step 2: Frontend चलाएं (Terminal 2)
```bash
cd awb-os/frontend
npx next start -p 3000
```
- यह http://localhost:3000 पर चलेगा

---

### 🌐 कहाँ खोलें? (Where to open?)

| Page | URL | क्या है |
|------|-----|---------|
| **Login** | http://localhost:3000 | लॉगिन पेज |
| **Dashboard** | http://localhost:3000/dashboard | मुख्य पेज |
| **API Health** | http://localhost:3001/api/health | बैकएंड चेक |

### 👤 Demo Login (टेस्ट करने के लिए):
```
Email: user5021@test.com
Pass:  test123
```

---

### 📱 क्या-क्या कर सकते हैं? (Features)

1. **नया Business बनाएं** - Dashboard में "New Business" पर क्लिक करें
2. **AI Personality सेट करें** - Settings पेज पर जाएं
3. **WhatsApp कनेक्ट करें** - Business Detail में WhatsApp नंबर डालें
4. **Chat History देखें** - Chat पेज पर सारे मैसेज दिखते हैं
5. **Subscription मैनेज करें** - Subscription पेज पर प्लान देखें

---

### 🤖 AI के लिए (For AI Responses)

Ollama install करें:
```bash
winget install Ollama.Ollama
ollama pull llama3.2
```
फिर backend restart करें।

---

### ⚙️ Requirements

- **Node.js** (v18+) - https://nodejs.org
- **Git** (Baileys के लिए)
- **Ollama** (AI के लिए - optional)

### ❓ Help

Agar koi problem ho toh:
- Backend console check karein
- Frontend console check karein (F12 > Console)
- Dono ports (3000, 3001) free hain ya nahi check karein
