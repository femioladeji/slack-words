/* eslint-disable no-undef */
const faker = require('faker');
const axios = require('axios');
const { end } = require('../game');
const db = require('../utils/db');
const app = require('../utils/app');

const words = faker.random.words().split(' ');
const id = faker.random.uuid();
const responseUrl = faker.internet.url();
const incomingHook = faker.internet.url();
const letters = 'A B C D';
const teamId = faker.random.uuid();
const accessToken = faker.random.uuid();
const thread = faker.random.uuid();
const payload = {
  text: '@here! Game has ended. Computing results...',
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
      response_url: responseUrl,
    }),
  }],
};

describe('end lambda function', () => {
  it('it works as expected', async () => {
    const callback = jest.fn((error, data) => ({ error, data }));
    const mockDelete = jest.fn(() => Promise.resolve());
    const mockEndGame = jest.fn(() => Promise.resolve({
      Attributes: {
        team_id: teamId,
        thread,
        letters,
        words,
      },
    }));
    const mockQuery = jest.fn(() => Promise.resolve({
      Items: [{
        access_token: accessToken,
        incoming_webhook: {
          url: incomingHook,
        },
      }],
    }));
    const mockAxiosPost = jest.fn(() => Promise.resolve());
    const mockResults = jest.fn(() => Promise.resolve(''));
    db.endGame = mockEndGame;
    db.query = mockQuery;
    db.delete = mockDelete;
    app.computeResults = mockResults;
    axios.post = mockAxiosPost;
    await end(event, null, callback);
    expect(mockEndGame).toHaveBeenCalledWith(id);
    expect(mockResults).toHaveBeenCalledWith(words, letters.toLowerCase().split(' '), accessToken);
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
