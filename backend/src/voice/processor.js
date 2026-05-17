const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const WHISPER_PATH = process.env.WHISPER_PATH || './whisper.cpp/main';
const WHISPER_MODEL = process.env.WHISPER_MODEL || './whisper.cpp/models/ggml-base.en.bin';

async function processVoice(audioBuffer, format = 'ogg') {
  const tempId = uuidv4();
  const tempDir = path.join(__dirname, '../../temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, `${tempId}.${format}`);
  const outputPath = path.join(tempDir, `${tempId}.txt`);

  try {
    fs.writeFileSync(inputPath, audioBuffer);

    await new Promise((resolve, reject) => {
      const cmd = `"${WHISPER_PATH}" -m "${WHISPER_MODEL}" -f "${inputPath}" -otxt -of "${tempDir}/${tempId}"`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('Whisper error:', stderr);
          reject(error);
        } else resolve(stdout);
      });
    });

    const text = fs.readFileSync(outputPath, 'utf-8').trim();

    return {
      text,
      success: true,
      duration: 0
    };

  } catch (error) {
    console.error('Voice processing error:', error);
    return {
      text: '',
      success: false,
      error: error.message
    };
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (_) {}
  }
}

module.exports = { processVoice };
