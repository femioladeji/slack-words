const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' });
const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

module.exports = {
  insert(table, data) {
    return new Promise((resolve, reject) => {
      documentClient.put({
        TableName: table,
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
  endGame(id, channel_id) {
    return new Promise((resolve, reject) => {
      documentClient.update({
        TableName: 'Game',
        Key: { id, channel_id },
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
  addWords(id, channel_id, word) {
    return new Promise((resolve, reject) => {
      documentClient.update({
        TableName: 'Game',
        Key: { id, channel_id },
        ConditionExpression: 'active = :status',
        UpdateExpression: 'set words = list_append(words, :word)',
        ExpressionAttributeValues: {
          ':word': [word],
          ':status': true,
        },
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },

  query(id) {
    return new Promise((resolve, reject) => {
      documentClient.query({
        TableName: 'Game',
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
