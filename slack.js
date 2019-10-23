const axios = require('axios');
const qs = require('qs');
const db = require('./utils/db');
require('dotenv').config();

const slackUrl = 'https://slack.com/api/oauth.access';

module.exports.auth = async (event, context, callback) => {
  const { body } = event;
  const { code } = JSON.parse(body);
  const slackAuth = await axios.post(slackUrl, qs.stringify({
    code,
    client_id: process.env.SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET,
    single_channel: true,
  }));
  console.log(slackAuth);
  const authData = slackAuth.data;
  authData.id = authData.team_id;
  await db.insert(process.env.SLACK_AUTH_TABLE, slackAuth.data);
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      text: 'ok',
    }),
  };
  callback(null, response);
};
