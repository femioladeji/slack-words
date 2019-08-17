const axios = require('axios');
const aws = require('aws-sdk');
const qs = require('qs');
const db = require('./utils/db');
const app = require('./utils/app');
require('dotenv').config();

const sqs = new aws.SQS({
  region: 'us-east-1',
});

const respond = (callback, statusCode, body) => callback(null, {
  statusCode,
  body,
});

const sendEndMessage = (url, thread) => {
  let payload = {
    text: 'Game has ended computing results...',
  };
  if (thread) {
    payload.thread_ts = thread;
  } else {
    payload = JSON.stringify({ ...payload, response_type: 'in_channel' });
  }
  axios.post(url, payload);
};

module.exports.start = async (event, context, callback) => {
  const gameItem = qs.parse(event.body);
  try {
    gameItem.id = `${gameItem.team_id}${gameItem.channel_id}`;
    gameItem.start = Date.now();
    gameItem.letters = app.generateLetters();
    gameItem.active = true;
    gameItem.words = [];
    gameItem.thread = ' ';
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
    sqs.sendMessage({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(gameItem),
    }, (err, data) => {
      console.log(err, data);
    });
    return respond(callback, 200, JSON.stringify({
      text: `Game started, type as many english words within 60 seconds using \`${gameItem.letters}\``,
      response_type: 'in_channel',
    }));
  } catch (error) {
    return respond(callback, 200, JSON.stringify({
      text: 'Game was not started',
      response_type: 'ephemeral',
    }));
  }
};

module.exports.end = async (eventMessage, context, callback) => {
  const event = JSON.parse(eventMessage.Records[0].body);
  try {
    const item = await db.endGame(event.id, event.channel_id);
    const { letters, words, thread } = item.Attributes;
    sendEndMessage(event.response_url);
    if (thread && thread.trim()) {
      sendEndMessage('https://hooks.slack.com/services/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', thread);
    }

    const results = await app.computeResults(words, letters.toLowerCase().split(' '));
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
};

module.exports.submit = async (event, context, callback) => {
  const { event: message } = JSON.parse(event.body);
  if (!message.thread_ts || message.text.trim().split(' ').length > 1) {
    return callback(null, { statusCode: 200 });
  }
  try {
    const id = `${message.team}${message.channel}`;
    await db.addWords(id, message.channel, message.thread_ts, {
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
