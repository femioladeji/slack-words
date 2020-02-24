/* eslint-disable no-undef */
const faker = require('faker');
const axios = require('axios');
const { end } = require('../game');
const db = require('../utils/db');
const app = require('../utils/app');

const words = faker.lorem.sentence().split(' ');
const id = faker.random.uuid();
const responseUrl = faker.internet.url();
const letters = 'A B C D';
const teamId = faker.random.uuid();
const channelId = faker.random.uuid();
const accessToken = faker.random.uuid();
const thread = faker.random.uuid();
const payload = {
  text: 'Game has ended. Computing results...',
};
const option = {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
};

const event = {
  Records: [{
    body: JSON.stringify({
      id,
      team_id: teamId,
      channel_id: channelId,
      letters,
      thread,
      response_url: responseUrl,
    }),
  }],
};

const authItem = {
  id: teamId,
  access_token: faker.random.uuid(),
  authed_user: {
    access_token: accessToken,
  },
};

describe('end lambda function', () => {
  it('it works as expected', async () => {
    const callback = jest.fn((error, data) => ({ error, data }));
    const mockDelete = jest.fn(() => Promise.resolve());
    const mockQuery = jest.fn(() => Promise.resolve({
      Items: [authItem],
    }));
    const mockAxiosPost = jest.fn(() => Promise.resolve());
    const mockAxiosGet = jest.fn(() => Promise.resolve({ data: { messages: words } }));
    const mockResults = jest.fn(() => Promise.resolve(''));
    db.query = mockQuery;
    db.delete = mockDelete;
    app.computeResults = mockResults;
    axios.post = mockAxiosPost;
    axios.get = mockAxiosGet;
    await end(event, null, callback);
    expect(mockQuery).toHaveBeenCalledWith(process.env.SLACK_AUTH_TABLE, teamId);
    expect(mockAxiosGet).toHaveBeenCalledWith(`https://slack.com/api/conversations.replies?token=${authItem.authed_user.access_token}&channel=${channelId}&ts=${thread}`);
    expect(mockResults).toHaveBeenCalledWith(words.slice(1), letters.toLowerCase().split(' '), accessToken);
    expect(mockAxiosPost).toHaveBeenNthCalledWith(1, responseUrl, JSON.stringify({
      ...payload,
      response_type: 'in_channel',
    }), option);
    expect(mockAxiosPost).toHaveBeenNthCalledWith(2, responseUrl, JSON.stringify({
      response_type: 'in_channel',
      blocks: '',
    }), option);
    expect(callback.mock.calls.length).toBe(1);
  });
});
