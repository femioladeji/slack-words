/* eslint-disable no-undef */
const faker = require('faker');
const qs = require('qs');
const aws = require('aws-sdk');
const { start } = require('../game');
const db = require('../utils/db');
const app = require('../utils/app');
const helpers = require('./helpers');

const teamId = faker.random.uuid();
const channelId = faker.random.uuid();
const gameLetters = 'A B C D E';
const body = qs.stringify({
  team_id: teamId,
  channel_id: channelId,
});
const timeStamp = 12345;

const startEvent = {
  headers: {
    'X-Slack-Request-Timestamp': timeStamp,
    'X-Slack-Signature': helpers.generateHash(timeStamp, body),
  },
  body,
};

it('it returns game already in progress if there\'s an ongoing game', async () => {
  db.query = jest.fn(() => Promise.resolve({
    Count: 1,
    Items: [{
      active: true,
      letters: gameLetters,
    }],
  }));
  const querySpy = jest.spyOn(db, 'query');
  const callbackFunc = jest.fn((error, data) => ({ error, data }));
  await start(startEvent, null, callbackFunc);
  const id = `${teamId}${channelId}`;
  expect(querySpy).toHaveBeenCalledWith(process.env.DYNAMO_TABLE_NAME, id);
  expect(callbackFunc.mock.calls.length).toBe(1);
  const { error, data } = callbackFunc.mock.results[0].value;
  expect(error).toBe(null);
  expect(data.statusCode).toBe(200);
  expect(JSON.parse(data.body).text.includes(gameLetters)).toBe(true);
  expect(JSON.parse(data.body).text.includes('in progress')).toBe(true);
});

it('it starts a new game if there\'s no ongoing game', async () => {
  const mockSendMessage = jest.fn(() => ({
    promise: jest.fn(() => Promise.resolve()),
  }));
  aws.SQS = jest.fn().mockImplementation(() => ({ sendMessage: mockSendMessage }));
  db.query = jest.fn(() => Promise.resolve({ Count: 0 }));
  db.insert = jest.fn(() => Promise.resolve());
  app.generateLetters = jest.fn(() => gameLetters);
  const querySpy = jest.spyOn(db, 'query');
  const insertSpy = jest.spyOn(db, 'insert');
  const callbackFunc = jest.fn((error, data) => ({ error, data }));
  await start(startEvent, null, callbackFunc);
  const id = `${teamId}${channelId}`;
  expect(querySpy).toHaveBeenCalledWith(process.env.DYNAMO_TABLE_NAME, id);
  expect(insertSpy).toHaveBeenCalled();
  expect(mockSendMessage).toHaveBeenCalled();
  expect(callbackFunc.mock.calls.length).toBe(1);
  const { error, data } = callbackFunc.mock.results[0].value;
  expect(error).toBe(null);
  expect(data.statusCode).toBe(200);
  expect(JSON.parse(data.body).text.includes(gameLetters)).toBe(true);
  expect(JSON.parse(data.body).text.includes('started')).toBe(true);
});
