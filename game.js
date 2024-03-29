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
    text: `Game has ended. ${numberOfWords ? 'Computing results...' : 'No submission found'}`,
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
  if (!app.requestVerification(headers['X-Slack-Request-Timestamp'], body, headers['X-Slack-Signature'])) {
    return callback(null, { statusCode: 401 });
  }
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
    const { Items: authItem } = await db.query(process.env.SLACK_AUTH_TABLE, gameItem.team_id);
    const { access_token: accessToken } = authItem[0];
    const text = `Game started, type as many English words in the thread within 60 seconds using \`${gameItem.letters}\``;
    const channelJoinResponse = await axios.post(`https://slack.com/api/conversations.join?token=${accessToken}&channel=${gameItem.channel_id}`);
    if (!channelJoinResponse.data.ok) {
      return respond(callback, 200, JSON.stringify({
        text: 'You can only play slackwords in a public channel. Please try playing it in a public channel',
        response_type: 'ephemeral',
      }));
    }
    const message = await axios.post(`https://slack.com/api/chat.postMessage?token=${accessToken}&channel=${gameItem.channel_id}&text=${text}`);
    gameItem.thread = message.data.ts;
    await db.insert(process.env.DYNAMO_TABLE_NAME, gameItem);
    await new aws.SQS().sendMessage({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(gameItem),
    }).promise();
    return respond(callback, 200);
  } catch (error) {
    console.log(error);
    return respond(callback, 500, JSON.stringify({
      text: 'An error occurred while starting the game. Please send a mail to femidotexe@gmail.com if this error persists',
      response_type: 'ephemeral',
    }));
  }
};

module.exports.end = async (eventMessage, context, callback) => {
  const event = JSON.parse(eventMessage.Records[0].body);
  const {
    id,
    team_id: teamId,
    letters,
    channel_id: channelId,
    thread,
    response_url: responseUrl,
  } = event;

  try {
    const { Items: authItem } = await db.query(process.env.SLACK_AUTH_TABLE, teamId);
    const { access_token: accessToken } = authItem[0];
    await db.delete(process.env.DYNAMO_TABLE_NAME, id);
    await axios.post(`https://slack.com/api/conversations.join?token=${accessToken}&channel=${channelId}`);
    const words = await app.retrieveMessages(`https://slack.com/api/conversations.replies?token=${accessToken}&channel=${channelId}&ts=${thread}`);
    if (!words) {
      return axios.post(responseUrl, JSON.stringify({
        text: 'An error occurred, can you please uninstall and re-install the game. If the error persists, please send a mail to femidotexe@gmail.com',
        response_type: 'in_channel',
      }));
    }
    sendEndMessage(responseUrl, accessToken, words.length);

    if (words.length) {
      const results = await app.computeResults(words, letters.toLowerCase().split(' '), accessToken);
      axios.post(responseUrl, JSON.stringify({
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
    await axios.post(responseUrl, JSON.stringify({
      text: 'An error occurred while ending the game. Please send a mail to femidotexe@gmail.com if this error persists',
      response_type: 'in_channel',
    }));
    callback(null, {
      statusCode: 500,
    });
  }
};
