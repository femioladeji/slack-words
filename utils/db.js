const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config({
  path: process.env.NODE_ENV === 'test' ? path.resolve(process.cwd(), '.env.testing') : path.resolve(process.cwd(), '.env'),
});

AWS.config.update({ region: 'us-east-1' });

module.exports = {
  insert(tableName, data) {
    return new Promise((resolve, reject) => {
      new AWS.DynamoDB.DocumentClient().put({
        TableName: tableName,
        Item: data,
      }, (error) => {
        if (error) {
          return reject(error);
        }
        return resolve(data);
      });
    });
  },

  endGame(id) {
    return new Promise((resolve, reject) => {
      new AWS.DynamoDB.DocumentClient().delete({
        TableName: process.env.DYNAMO_TABLE_NAME,
        Key: { id },
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },

  // eslint-disable-next-line camelcase
  addWords(id, thread, word) {
    return new Promise((resolve, reject) => {
      new AWS.DynamoDB.DocumentClient().update({
        TableName: process.env.DYNAMO_TABLE_NAME,
        Key: { id },
        ConditionExpression: 'active = :status',
        UpdateExpression: 'set words = list_append(words, :word), thread = :thread',
        ExpressionAttributeValues: {
          ':word': [word],
          ':status': true,
          ':thread': thread,
        },
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },

  query(tableName, id) {
    return new Promise((resolve, reject) => {
      new AWS.DynamoDB.DocumentClient().query({
        TableName: tableName,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
          ':id': id,
        },
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },
};
