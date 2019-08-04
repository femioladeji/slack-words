require('dotenv').config();
const axios = require('axios');

const vowels = ['a', 'e', 'i', 'o', 'u'];
// eslint-disable-next-line max-len
const consonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'w', 'x', 'y', 'z'];
const min = 10;
const max = 15;
const host = 'wordsapiv1.p.rapidapi.com';
const key = process.env.DICTIONARY_API_KEY;
const slackToken = process.env.SLACK_TOKEN;
const slackUrl = `https://slack.com/api/users.info?token=${slackToken}&user=`;
const letterValues = {
  a: 1,
  b: 3,
  c: 3,
  d: 2,
  e: 1,
  f: 4,
  g: 2,
  h: 4,
  i: 1,
  j: 8,
  k: 5,
  l: 1,
  m: 3,
  n: 1,
  o: 1,
  p: 3,
  q: 10,
  r: 1,
  s: 1,
  t: 1,
  u: 1,
  v: 4,
  w: 4,
  x: 8,
  y: 4,
  z: 10,
};

const randomNumber = maxNum => Math.floor(Math.random() * maxNum);

module.exports = {
  generateLetters() {
    const length = Math.floor(Math.random() * (max - min + 1) + min);
    let shuffled = '';
    for (let i = 0; i < length; i += 1) {
      if (i % 4) {
        shuffled += `${consonants[randomNumber(consonants.length)]} `;
      } else {
        shuffled += `${vowels[randomNumber(vowels.length)]} `;
      }
    }
    return shuffled.trim();
  },

  validateWords(entries, alphabets) {
    const foundWords = {};
    const validEntries = [];
    entries.forEach(({ word }, index) => {
      if (!foundWords[word] && this.isWordValid(word, alphabets)) {
        validEntries.push(entries[index]);
        foundWords[word] = true;
      }
    });
    return validEntries;
  },

  isWordValid(word, alphabets) {
    const letters = [...alphabets];
    if (word.length <= 1) {
      return false;
    }
    for (let i = 0; i < word.length; i += 1) {
      const index = letters.indexOf(word[i]);
      if (index < 0) {
        return false;
      }
      letters.splice(index, 1);
    }
    return true;
  },

  rateWord(word) {
    let value = 0;
    for (let i = 0; i < word.length; i += 1) {
      value += letterValues[word[i]];
    }
    return value;
  },

  groupByUser(scores) {
    const users = {};
    scores.forEach((each) => {
      if (!users[each.user]) {
        users[each.user] = 0;
      }
      users[each.user] += each.score;
    });
    return users;
  },

  computeResults(entries, alphabets) {
    return new Promise(async (resolve, reject) => {
      const validCandidates = this.validateWords(entries, alphabets);
      let dictionaryCheck = validCandidates.map(({ word }) => {
        const url = `https://wordsapiv1.p.rapidapi.com/words/${word}/definitions`;
        return axios.get(url, {
          headers: {
            'x-rapidapi-host': host,
            'x-rapidapi-key': key,
          },
          validateStatus: status => status >= 200,
        });
      });
      try {
        dictionaryCheck = await Promise.all(dictionaryCheck);
        const score = validCandidates.map((each, index) => {
          let wordValue = 0;
          if (dictionaryCheck[index].status === 200) {
            wordValue = this.rateWord(each.word);
          }
          return { user: each.user, score: wordValue };
        });
        const results = await this.getUsers(this.groupByUser(score));
        resolve(results.sort(this.sortScore));
      } catch (error) {
        reject(error);
      }
    });
  },

  getUsers(users) {
    return new Promise(async (resolve) => {
      const detailsRequest = Object.keys(users).map(each => axios.get(`${slackUrl}${each}`));
      let finalScore = await Promise.all(detailsRequest);
      finalScore = finalScore.map(({ data, status }) => {
        if (status === 200) {
          return {
            type: 'section',
            fields: [{
              type: 'plain_text',
              text: 'Name:',
            },
            {
              type: 'plain_text',
              text: data.user.real_name,
              emoji: true,
            },
            {
              type: 'plain_text',
              text: 'Username:',
            },
            {
              type: 'plain_text',
              text: data.user.name,
              emoji: true,
            },
            {
              type: 'plain_text',
              text: 'Score:',
            },
            {
              type: 'plain_text',
              text: `${users[data.user.id]}`,
            },
            {
              type: 'plain_text',
              text: 'Position:',
            },
            {
              type: 'plain_text',
              text: '1',
            }],
            accessory: {
              type: 'image',
              image_url: data.user.profile.image_72,
              alt_text: data.user.real_name,
            },
          };
        }
        return {};
      });
      resolve(finalScore);
    });
  },

  sortScore(a, b) {
    return parseInt(b.fields[5].text, 10) - parseInt(a.fields[5].text, 10);
  },
};
