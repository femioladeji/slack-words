const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' });
const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

module.exports = {
  insert(tableName, data) {
    return new Promise((resolve, reject) => {
      documentClient.put({
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

  // eslint-disable-next-line camelcase
  endGame(id) {
    return new Promise((resolve, reject) => {
      documentClient.update({
        TableName: process.env.DYNAMO_TABLE_NAME,
        Key: { id },
        UpdateExpression: 'set active = :status',
        ReturnValues: 'ALL_NEW',
        ExpressionAttributeValues: {
          ':status': false,
        },
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
      documentClient.update({
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
      documentClient.query({
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
