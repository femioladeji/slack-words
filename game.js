// const axios = require('axios');
const qs = require('qs');
const db = require('./utils/db');

module.exports.start = async (event, context, callback) => {
  // console.log(context.callbackWaitsForEmptyEventLoop);
  // console.log(JSON.stringify(event, null, 2));

  // callback(null, {
  //   statusCode: 200,
  //   body: JSON.stringify({
  //     text: 'Starting game...',
  //     response_type: 'ephemeral',
  //   }),
  // });
  const gameItem = qs.parse(event.body);
  try {
    gameItem.id = `${gameItem.user_id}${Date.now()}`;
    gameItem.start = Date.now();
    gameItem.letters = 'as kird nead';
    delete gameItem.text;
    delete gameItem.token;
    delete gameItem.command;

    await db.insert('Game', gameItem);
    callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        text: `Game started, type as many english words using *${gameItem.letters}*`,
        response_type: 'in_channel',
      }),
    });
    // axios.post(gameItem.response_url, {
    //   text: `Game started, type as many english words using ${gameItem.letters}`,
    //   response_type: 'in_channel',
    // });
  } catch (error) {
    console.log(error);
    callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        text: 'Game was not started',
        response_type: 'ephemeral',
      }),
    });
    // axios.post(gameItem.response_url, {
    //   text: 'Game was not started',
    //   response_type: 'ephemeral',
    // });
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
