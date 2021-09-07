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
  access_token: accessToken,
};

describe('end lambda function', () => {
  it('it works as expected', async () => {
    const callback = jest.fn((error, data) => ({ error, data }));
    db.query = jest.fn().mockResolvedValue({ Items: [authItem] });
    db.delete = jest.fn().mockResolvedValue();
    app.computeResults = jest.fn().mockResolvedValue('block');
    app.retrieveMessages = jest.fn().mockResolvedValue(words);
    axios.post = jest.fn().mockResolvedValue();
    await end(event, null, callback);
    expect(db.query).toHaveBeenCalledWith(process.env.SLACK_AUTH_TABLE, teamId);
    expect(app.retrieveMessages).toHaveBeenCalledWith(`https://slack.com/api/conversations.replies?token=${authItem.access_token}&channel=${channelId}&ts=${thread}`);
    expect(app.computeResults).toHaveBeenCalledWith(words, letters.toLowerCase().split(' '), authItem.access_token);
    expect(axios.post).toHaveBeenCalledTimes(3)
    expect(axios.post).toHaveBeenNthCalledWith(1, `https://slack.com/api/conversations.join?token=${authItem.access_token}&channel=${channelId}`);
    expect(axios.post).toHaveBeenNthCalledWith(2, responseUrl, JSON.stringify({
      ...payload,
      response_type: 'in_channel',
    }), option);
    expect(axios.post).toHaveBeenNthCalledWith(3, responseUrl, JSON.stringify({
      response_type: 'in_channel',
      blocks: 'block',
    }), option);
    expect(callback.mock.calls.length).toBe(1);
  });
});
