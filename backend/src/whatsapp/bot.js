const manager = require('./manager');

module.exports = {
  startBot: (businessId, phoneNumber) => manager.startBot(businessId, phoneNumber),
  stopBot: (businessId) => manager.stopBot(businessId),
  sendMessage: (businessId, remoteJid, text) => manager.sendMessage(businessId, remoteJid, text),
  getBotStatus: (businessId) => manager.getBotStatus(businessId),
  requestPairing: (businessId, phoneNumber) => manager.requestPairing(businessId, phoneNumber),
  getManager: () => manager
};
