'use strict';
const qs = require('qs');
const db = require('./utils/db');
const axios = require('axios');

module.exports.start = async (event, context, callback) => {
  console.log(context);
  // console.log(JSON.stringify(event, null, 2));

  callback(null, {
    statusCode: 200,
    body: JSON.stringify({
      text: 'Starting game...',
      response_type: 'ephemeral'
    }),
  });

  try {
    const gameItem = qs.parse(event.body);
    gameItem.id = `${gameItem.user_id}${Date.now()}`;
    gameItem.start = Date.now();
    gameItem.letters = "as kird nead";
    delete gameItem.text;
    delete gameItem.token;
    delete gameItem.command;

    const data = await db.insert("Game", gameItem);

    axios.post(gameItem.response_url, {
      text: `Game started, type as many english words using ${gameItem.letters}`,
      response_type: 'in_channel'
    });
  } catch (error) {
    axios.post(gameItem.response_url, {
      text: 'Game was not started',
      response_type: 'ephemeral'
    });
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
