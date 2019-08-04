const axios = require('axios');
const aws = require('aws-sdk');
const qs = require('qs');
const db = require('./utils/db');
const app = require('./utils/app');

const lambda = new aws.Lambda({
  region: 'us-east-1',
});

const respond = (callback, statusCode, body) => callback(null, {
  statusCode,
  body,
});

module.exports.start = async (event, context, callback) => {
  const gameItem = qs.parse(event.body);
  try {
    gameItem.id = `${gameItem.team_id}${gameItem.channel_id}`;
    gameItem.start = Date.now();
    gameItem.letters = app.generateLetters();
    gameItem.active = true;
    gameItem.words = [];
    delete gameItem.text;
    delete gameItem.token;
    delete gameItem.command;
    const { Count, Items } = await db.query(gameItem.id, gameItem.channel_id);
    if (Count > 0 && Items[0].active) {
      return respond(callback, 200, JSON.stringify({
        text: `There's a game in progress with \`${Items[0].letters}\``,
        response_type: 'in_channel',
      }));
    }
    await db.insert('Game', gameItem);
    const request = lambda.invoke({
      FunctionName: 'end_game',
      InvocationType: 'Event',
      Payload: JSON.stringify(gameItem),
    });
    request.send();
    return respond(callback, 200, JSON.stringify({
      text: `Game started, type as many english words using \`${gameItem.letters}\``,
      response_type: 'in_channel',
    }));
  } catch (error) {
    return respond(callback, 200, JSON.stringify({
      text: 'Game was not started',
      response_type: 'ephemeral',
    }));
  }
};

module.exports.end = (event, context, callback) => {
  const DELAY = 30;
  setTimeout(async () => {
    try {
      const item = await db.endGame(event.id, event.channel_id);
      axios.post(event.response_url, JSON.stringify({
        text: 'Game has ended computing results...',
        response_type: 'in_channel',
      }));
      const results = await app.computeResults(item.Attributes.words, item.Attributes.letters.split(' '));
      axios.post(event.response_url, JSON.stringify({
        response_type: 'in_channel',
        blocks: results,
      }));
      callback(null, {
        statusCode: 200,
      });
    } catch (error) {
      await axios.post(event.response_url, JSON.stringify({
        text: 'An error ocurred while ending the game',
        response_type: 'in_channel',
      }));
      callback(null, {
        statusCode: 500,
      });
    }
    // axios.post()
  }, DELAY * 1000);
};

module.exports.submit = async (event, context, callback) => {
  const { event: message } = JSON.parse(event.body);
  if (!message.thread_ts || message.text.trim().split(' ').length > 1) {
    return callback(null, { statusCode: 200 });
  }
  try {
    const id = `${message.team}${message.channel}`;
    await db.addWords(id, message.channel, {
      user: message.user,
      word: message.text,
    });
    return callback(null, { statusCode: 200 });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      console.log('game has ended');
    }
    return callback(null, { statusCode: 200 });
  }
};
