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

const sendEndMessage = (url, token, numberOfWords) => {
  let payload = {
    text: `@here! Game has ended. ${numberOfWords ? 'Computing results...' : 'No submission found'}`,
  };
  payload = JSON.stringify({ ...payload, response_type: 'in_channel' });
  axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

module.exports.start = async (event, _context, callback) => {
  const { body, headers } = event;
  console.log(JSON.stringify(event, null, 2));
  console.log('is same? ', app.requestVerification(headers['X-Slack-Request-Timestamp'], body, headers['X-Slack-Signature']));
  // if (!app.requestVerification(headers['X-Slack-Request-Timestamp'], body, headers['X-Slack-Signature'])) {
  //   return callback(null);
  // }
  const gameItem = qs.parse(body);
  const { channel_name: channelName } = gameItem;
  if (channelName === 'directmessage' || channelName === 'privategroup') {
    return respond(callback, 200, JSON.stringify({
      text: 'You can only play slackwords in a public channel. Please add the app to a public channel',
      response_type: 'ephemeral',
    }));
  }
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
      text: `Game started, type as many english words in the thread within 60 seconds using \`${gameItem.letters}\``,
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
    const { Attributes: gameDetails } = await db.endGame(event.id);
    const { letters, words } = gameDetails;
    const { Items: authItem } = await db.query(process.env.SLACK_AUTH_TABLE, event.team_id);
    const { access_token: accessToken } = authItem[0];
    sendEndMessage(event.response_url, accessToken, words.length);

    await db.delete(process.env.DYNAMO_TABLE_NAME, event.id);
    if (words.length) {
      const results = await app.computeResults(words, letters.toLowerCase().split(' '), accessToken);
      axios.post(event.response_url, JSON.stringify({
        response_type: 'in_channel',
        blocks: results,
      }), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }
    callback(null, {
      statusCode: 200,
    });
  } catch (error) {
    console.log(error);
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
  console.log(JSON.stringify(event, null, 2));
  const { event: message, challenge } = JSON.parse(event.body);
  if (challenge) {
    // this is for slack verification
    return respond(callback, 200, challenge);
  }
  if (message.type === 'app_rate_limited') {
    return callback(null, { statusCode: 200 });
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
      return callback(null, { statusCode: 200, body: 'Game has ended' });
    }
    return callback(null, { statusCode: 200, body: 'An error occurred while ending the game' });
  }
};
