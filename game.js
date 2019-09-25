const axios = require('axios');
const aws = require('aws-sdk');
const qs = require('qs');
const path = require('path');
const db = require('./utils/db');
const app = require('./utils/app');

const { NODE_ENV } = process.env;
require('dotenv').config({
  path: NODE_ENV === 'test' || NODE_ENV === 'staging'
    ? path.resolve(process.cwd(), `.env.${NODE_ENV}`) : path.resolve(process.cwd(), '.env'),
});

const respond = (callback, statusCode, body) => callback(null, {
  statusCode,
  body,
});

const sendEndMessage = (url, token, thread) => {
  let payload = {
    text: 'Game has ended computing results...',
  };
  if (thread) {
    payload.thread_ts = thread;
  } else {
    payload = JSON.stringify({ ...payload, response_type: 'in_channel' });
  }
  axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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
    const { Count, Items } = await db.query(process.env.DYNAMO_TABLE_NAME, gameItem.id);
    if (Count > 0 && Items[0].active) {
      return respond(callback, 200, JSON.stringify({
        text: `There's a game in progress with \`${Items[0].letters}\``,
        response_type: 'in_channel',
      }));
    }
    await db.insert(process.env.DYNAMO_TABLE_NAME, gameItem);
    await new aws.SQS().sendMessage({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(gameItem),
    }).promise();
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
    const item = await db.endGame(event.id);
    const {
      letters, words, thread, team_id: teamId,
    } = item.Attributes;
    const team = await db.query(process.env.SLACK_AUTH_TABLE, teamId);
    const { access_token: accessToken, incoming_webhook: incomingHook } = team.Items[0];
    sendEndMessage(event.response_url, accessToken);
    if (thread && thread.trim()) {
      sendEndMessage(incomingHook.url, accessToken, thread);
    }

    const results = await app.computeResults(words, letters.toLowerCase().split(' '), accessToken);
    axios.post(event.response_url, JSON.stringify({
      response_type: 'in_channel',
      blocks: results,
    }), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
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
  const { event: message, challenge } = JSON.parse(event.body);
  if (challenge) {
    // this is for slack verification
    return respond(callback, 200, challenge);
  }
  if (!message.thread_ts || message.text.trim().split(' ').length > 1) {
    return callback(null, { statusCode: 200 });
  }
  try {
    const id = `${message.team}${message.channel}`;
    await db.addWords(id, message.thread_ts, {
      user: message.user,
      word: message.text,
    });
    return callback(null, { statusCode: 200 });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      console.log('game has ended');
    }
    return callback(null, { statusCode: 200, body: 'Game has ended' });
  }
};
