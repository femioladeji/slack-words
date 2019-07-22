'use strict';
const db = require('../utils/db');

module.exports.start = async (event, context, callback) => {
  // console.log(event);
  try {
    const data = await db.insert("Game", event);
    return callback(null, {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Game started',
          data,
        },
        null,
        2
      ),
    });
  } catch (error) {
    return callback(null, {
      statusCode: 500,
      error: JSON.stringify(error, null, 2)
    });
  }


  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
