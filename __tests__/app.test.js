/* eslint-disable no-undef */
const faker = require('faker');
const axios = require('axios');
const app = require('../utils/app');

describe('generateLetters', () => {
  it('calls math.random', () => {
    const randomSpy = jest.spyOn(Math, 'random');
    const floorSpy = jest.spyOn(Math, 'floor');
    app.generateLetters();
    expect(randomSpy).toHaveBeenCalled();
    expect(floorSpy).toHaveBeenCalled();
  });
});

const alphabets = 'A B C D E'.toLowerCase().split(' ');

describe('isWordValid', () => {
  it('returns false if word is empty', () => {
    const isValid = app.isWordValid('', alphabets);
    expect(isValid).toBe(false);
  });

  it('returns false if a letter in the word is not in the specified alphabets', () => {
    const isValid = app.isWordValid('invalid', alphabets);
    expect(isValid).toBe(false);
  });

  it('accounts for the number of each character', () => {
    const isValid = app.isWordValid('baad', alphabets);
    expect(isValid).toBe(false);
  });

  it('returns true for a valid word', () => {
    const isValid = app.isWordValid('bed', alphabets);
    expect(isValid).toBe(true);
  });
});

describe('rate word', () => {
  it('gives a word the right score', () => {
    const score = app.rateWord('bed');
    expect(score).toBe(3);
  });
});

describe('group users', () => {
  const scores = [{
    user: 'user1',
    word: 'bed',
    score: 3,
  }, {
    user: 'user1',
    word: 'beds',
    score: 4,
  }, {
    user: 'user2',
    word: 'bad',
    score: 3,
  }];
  const group = app.groupByUser(scores);
  expect(group).toStrictEqual({
    user1: {
      totalScore: 7,
      words: 'bed: 3, beds: 4',
    },
    user2: {
      totalScore: 3,
      words: 'bad: 3',
    },
  });
});

describe('computeResults', () => {
  const entries = [{
    text: 'mum',
    user: 'user2',
    type: 'message',
  }, {
    text: 'box',
    user: 'user1',
    type: 'message',
  }, {
    text: 'ox',
    user: 'user1',
    type: 'message',
  }, {
    text: 'dot',
    user: 'user1',
    type: 'message',
  }, {
    text: 'lame',
    user: 'user2',
    type: 'message',
  }, {
    text: 'mole',
    user: 'user2',
    type: 'message',
  }, {
    text: 'invalid',
    user: 'user1',
    type: 'message',
  }, {
    text: 'mole',
    user: 'user1',
    type: 'message',
  }, {
    text: 'lej',
    user: 'user1',
    type: 'message',
  }, {
    text: 'lje',
    user: 'user2',
    type: 'invalid',
  }];
  const alphabetLetters = 'O M N M U M M L E J D T O X B'.toLowerCase().split(' ');
  const token = faker.random.uuid();
  it('calculates the right result', async () => {
    const mockAxiosGet = jest.fn(url => Promise.resolve({
      status: url.includes('lej') ? 404 : 200,
      data: {
        result_code: url.includes('lej') ? "404" : "200"
      }
    }));
    axios.get = mockAxiosGet;
    const mockGetUsers = jest.fn(() => Promise.resolve([]));
    app.getUsers = mockGetUsers;
    await app.computeResults(entries, alphabetLetters, token);
    expect(mockAxiosGet).toHaveBeenCalledTimes(6);
    expect(mockGetUsers).toHaveBeenCalledWith({
      user1: {
        totalScore: 8,
        words: 'box: 3, ox: 2, dot: 3, ~invalid~: 0, ~mole~: 0, ~lej~: 0',
      },
      user2: {
        totalScore: 7,
        words: 'mum: 3, ~lame~: 0, mole: 4, ~lje~: 0',
      },
    }, token);
  });
});

describe('sortScore', () => {
  it('used to sort score by returning different between two scores', () => {
    const userA = {
      fields: ['', '', '', '', '', {
        text: '5',
      }],
    };
    const userB = {
      fields: ['', '', '', '', '', {
        text: '8',
      }],
    };
    const diff = app.sortScore(userA, userB);
    expect(diff).toEqual(3);
  });
});
