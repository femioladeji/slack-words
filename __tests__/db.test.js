/* eslint-disable no-undef */
const faker = require('faker');
const aws = require('aws-sdk');
const db = require('../utils/db');

const tableName = faker.lorem.word();
const word = faker.lorem.word();
const dataItem = {
  user: faker.internet.userName(),
  word,
};
const id = faker.random.uuid();
const thread = faker.random.uuid();

describe('insert', () => {
  it('resolves to the data sent', async () => {
    const mockPut = jest.fn((data, cb) => cb(null));
    aws.DynamoDB.DocumentClient = jest.fn().mockImplementation(() => ({
      put: mockPut,
    }));
    const response = await db.insert(tableName, dataItem);
    expect(response).toStrictEqual(dataItem);
    expect(mockPut).toHaveBeenCalled();
    expect(mockPut.mock.calls[0][0]).toStrictEqual({
      TableName: tableName,
      Item: dataItem,
    });
  });
});

describe('endGame', () => {
  it('updates the game active field to false', async () => {
    const mockUpdate = jest.fn((data, cb) => cb(null, dataItem));
    aws.DynamoDB.DocumentClient = jest.fn().mockImplementation(() => ({
      update: mockUpdate,
    }));
    const response = await db.endGame(id);
    expect(response).toStrictEqual(dataItem);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      TableName: process.env.DYNAMO_TABLE_NAME,
      Key: { id },
      UpdateExpression: 'set active = :status',
      ReturnValues: 'ALL_NEW',
      ExpressionAttributeValues: {
        ':status': false,
      },
    });
  });
});

describe('addWords', () => {
  it('adds new words to an existing game', async () => {
    const mockUpdate = jest.fn((data, cb) => cb(null, dataItem));
    aws.DynamoDB.DocumentClient = jest.fn().mockImplementation(() => ({
      update: mockUpdate,
    }));
    const response = await db.addWords(id, thread, word);
    expect(response).toStrictEqual(dataItem);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      TableName: process.env.DYNAMO_TABLE_NAME,
      Key: { id },
      ConditionExpression: 'active = :status',
      UpdateExpression: 'set words = list_append(words, :word), thread = :thread',
      ExpressionAttributeValues: {
        ':word': [word],
        ':status': true,
        ':thread': thread,
      },
    });
  });
});

describe('query table', () => {
  it('calls the query function', async () => {
    const mockQuery = jest.fn((data, cb) => cb(null, dataItem));
    aws.DynamoDB.DocumentClient = jest.fn().mockImplementation(() => ({
      query: mockQuery,
    }));
    const response = await db.query(tableName, id);
    expect(response).toStrictEqual(dataItem);
    expect(mockQuery).toHaveBeenCalled();
    expect(mockQuery.mock.calls[0][0]).toStrictEqual({
      TableName: tableName,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': id,
      },
    });
  });
});

describe('delete table', () => {
  it('calls the delete function', async () => {
    const mockDelete = jest.fn((data, cb) => cb(null, dataItem));
    aws.DynamoDB.DocumentClient = jest.fn().mockImplementation(() => ({
      delete: mockDelete,
    }));
    await db.delete(tableName, id);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDelete.mock.calls[0][0]).toStrictEqual({
      TableName: tableName,
      Key: { id },
    });
  });
});
