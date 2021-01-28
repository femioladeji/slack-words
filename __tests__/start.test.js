/* eslint-disable no-undef */
const faker = require('faker');
const qs = require('qs');
const axios = require('axios');
const aws = require('aws-sdk');
const { start } = require('../game');
const db = require('../utils/db');
const app = require('../utils/app');
const helpers = require('./helpers');

const teamId = faker.random.uuid();
const channelId = faker.random.uuid();
const gameLetters = 'A B C D E';
const ts = faker.random.uuid();
const timeStamp = 12345;

const startEvent = (body) => {
  if (!body) {
    body = qs.stringify({
      team_id: teamId,
      channel_id: channelId,
    });
  }
  return {
    headers: {
      'X-Slack-Request-Timestamp': timeStamp,
      'X-Slack-Signature': helpers.generateHash(timeStamp, body),
    },
    body,
  }
}

const authItem = {
  id: teamId,
  access_token: faker.random.uuid(),
};

db.insert = jest.fn(() => Promise.resolve());
const mockAxiosPost = jest.fn().mockResolvedValue({
  status: 200,
  data: {
    ts,
  },
});
const callbackFunc = jest.fn((error, data) => ({ error, data }));

it('it returns game already in progress if there\'s an ongoing game', async () => {
  db.query = jest.fn(() => Promise.resolve({
    Count: 1,
    Items: [{
      active: true,
      letters: gameLetters,
    }],
  }));
  const querySpy = jest.spyOn(db, 'query');
  await start(startEvent(), null, callbackFunc);
  const id = `${teamId}${channelId}`;
  expect(querySpy).toHaveBeenCalledWith(process.env.DYNAMO_TABLE_NAME, id);
  expect(callbackFunc.mock.calls.length).toBe(1);
  const { error, data } = callbackFunc.mock.results[0].value;
  expect(error).toBe(null);
  expect(data.statusCode).toBe(200);
  expect(JSON.parse(data.body).text.includes('in progress')).toBe(true);
});

it('it starts a new game if there\'s no ongoing game', async () => {
  const mockSendMessage = jest.fn(() => ({
    promise: jest.fn(() => Promise.resolve()),
  }));
  const text = `Game started, type as many english words in the thread within 1 minute using \`${gameLetters}\``;
  axios.post = mockAxiosPost;
  aws.SQS = jest.fn().mockImplementation(() => ({ sendMessage: mockSendMessage }));
  db.query = jest.fn((table) => {
    if (table === process.env.SLACK_AUTH_TABLE) {
      return Promise.resolve({
        Count: 1,
        Items: [authItem],
      });
    }
    return Promise.resolve({ Count: 0 });
  });
  app.generateLetters = jest.fn(() => gameLetters);
  const querySpy = jest.spyOn(db, 'query');
  const insertSpy = jest.spyOn(db, 'insert');
  await start(startEvent(), null, callbackFunc);
  const id = `${teamId}${channelId}`;
  expect(querySpy).toHaveBeenNthCalledWith(1, process.env.DYNAMO_TABLE_NAME, id);
  expect(querySpy).toHaveBeenNthCalledWith(2, process.env.SLACK_AUTH_TABLE, teamId);
  expect(insertSpy).toHaveBeenCalled();
  const joinUrl = `https://slack.com/api/conversations.join?token=${authItem.access_token}&channel=${channelId}`;
  const url = `https://slack.com/api/chat.postMessage?token=${authItem.access_token}&channel=${channelId}&text=${text}`;
  expect(mockAxiosPost).toHaveBeenNthCalledWith(1, joinUrl);
  expect(mockAxiosPost).toHaveBeenNthCalledWith(2, url);
  expect(mockSendMessage).toHaveBeenCalled();
  expect(callbackFunc.mock.calls.length).toBe(1);
  const { error, data } = callbackFunc.mock.results[0].value;
  expect(error).toBe(null);
  expect(data.statusCode).toBe(200);
});

it('sets the game length if it is passed as part of the command', async () => {
  const body = qs.stringify({
    team_id: teamId,
    channel_id: channelId,
    text: "2"
  })
  const event = startEvent(body);
  const text = `Game started, type as many english words in the thread within 2 minutes using \`${gameLetters}\``;
  axios.post = mockAxiosPost;
  await start(event, null, callbackFunc);
  const url = `https://slack.com/api/chat.postMessage?token=${authItem.access_token}&channel=${channelId}&text=${text}`;
  expect(mockAxiosPost).toHaveBeenNthCalledWith(2, url);
})

it('sets invalid value to 1 minute', async () => {
  const body = qs.stringify({
    team_id: teamId,
    channel_id: channelId,
    text: "dsfadf"
  })
  const event = startEvent(body);
  const text = `Game started, type as many english words in the thread within 1 minute using \`${gameLetters}\``;
  axios.post = mockAxiosPost;
  await start(event, null, callbackFunc);
  const url = `https://slack.com/api/chat.postMessage?token=${authItem.access_token}&channel=${channelId}&text=${text}`;
  expect(mockAxiosPost).toHaveBeenNthCalledWith(2, url);
})

it('sets anything greater than 15 minutes to 15', async () => {
  const body = qs.stringify({
    team_id: teamId,
    channel_id: channelId,
    text: "20"
  })
  const event = startEvent(body);
  const text = `Game started, type as many english words in the thread within 15 minutes using \`${gameLetters}\``;
  axios.post = mockAxiosPost;
  await start(event, null, callbackFunc);
  const url = `https://slack.com/api/chat.postMessage?token=${authItem.access_token}&channel=${channelId}&text=${text}`;
  expect(mockAxiosPost).toHaveBeenNthCalledWith(2, url);
})
