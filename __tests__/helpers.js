const crypto = require('crypto');

module.exports = {
  generateHash(timestamp, body) {
    const stringToHash = `v0:${timestamp}:${body}`;
    const hashed = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET).update(stringToHash).digest('hex');
    return `v0=${hashed}`;
  },
};
