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
};
