/* eslint-disable no-undef */
const faker = require('faker');
const { submit } = require('../game');
const db = require('../utils/db');

const team = faker.random.uuid();
const channel = faker.random.uuid();
const thread = faker.random.uuid();
const challenge = faker.random.uuid();
const user = faker.internet.userName();
const text = faker.lorem.word();
const submitEvent1 = {
  body: JSON.stringify({
    challenge,
  }),
};
const submitEvent2 = {
  body: JSON.stringify({
    event: {
      text: faker.lorem.word(),
    },
  }),
};

const submitEvent3 = {
  body: JSON.stringify({
    event: {
      team,
      channel,
      thread_ts: thread,
      text,
      user,
    },
  }),
};

describe('submit lambda function', () => {
  it('it handles slack verifaction', async () => {
    const callback = jest.fn((error, data) => ({ error, data }));
    await submit(submitEvent1, null, callback);
    expect(callback.mock.calls.length).toBe(1);
    const { data } = callback.mock.results[0].value;
    expect(data.statusCode).toBe(200);
    expect(data.body).toBe(challenge);
  });

  it('does nothing if the message is not a response in a thread', async () => {
    const callback = jest.fn((error, data) => ({ error, data }));
    await submit(submitEvent2, null, callback);
    expect(callback.mock.calls.length).toBe(1);
    const { data } = callback.mock.results[0].value;
    expect(data.statusCode).toBe(200);
  });

  it('calls db.addWords if the user sent a valid message', async () => {
    const callback = jest.fn((error, data) => ({ error, data }));
    const mockAddWords = jest.fn(() => Promise.resolve());
    db.addWords = mockAddWords;
    await submit(submitEvent3, null, callback);
    expect(callback.mock.calls.length).toBe(1);
    const { data } = callback.mock.results[0].value;
    expect(data.statusCode).toBe(200);
    const id = `${team}${channel}`;
    expect(mockAddWords).toHaveBeenCalledWith(id, thread, {
      user,
      word: text,
    });
  });
});
