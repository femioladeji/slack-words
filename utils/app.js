const axios = require('axios');
const crypto = require('crypto');

const vowels = ['a', 'e', 'i', 'o', 'u'];
// eslint-disable-next-line max-len
const consonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'w', 'x', 'y', 'z'];
const min = 15;
const max = 20;
const host = 'wordsapiv1.p.rapidapi.com';
const key = process.env.DICTIONARY_API_KEY;

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
    return shuffled.trim().toUpperCase();
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
    return word.length;
  },

  groupByUser(scores) {
    const users = {};
    scores.forEach(({ user, score, word }) => {
      if (!users[user]) {
        users[user] = {
          totalScore: 0,
          words: '',
        };
      }
      users[user].totalScore += score;
      users[user].words += `${users[user].words === '' ? '' : ', '}${word}: ${score}`;
    });
    return users;
  },

  computeResults(entries, alphabets, token) {
    return new Promise(async (resolve, reject) => {
      const foundWords = [];
      let dictionaryCheck = entries.map((eachReply) => {
        let { text } = eachReply;
        text = text.toLowerCase();
        if (eachReply.type !== 'message' || !text) {
          return Promise.resolve({
            status: 400,
          });
        }
        if (foundWords.includes(text)) {
          // someone has already entered the word
          return Promise.resolve({
            status: 400,
          });
        }
        if (!this.isWordValid(text, alphabets)) {
          return Promise.resolve({
            status: 400,
          });
        }
        foundWords.push(text);
        const url = `https://wordsapiv1.p.rapidapi.com/words/${text}/definitions`;
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
        const score = entries.map((each, index) => {
          const { status } = dictionaryCheck[index];
          let wordValue = 0;
          if (status === 200) {
            wordValue = this.rateWord(each.text);
          }
          return {
            user: each.user,
            score: wordValue,
            word: status === 200 ? each.text : `~${each.text}~`,
          };
        });
        const results = await this.getUsers(this.groupByUser(score), token);
        resolve(results.sort(this.sortScore));
      } catch (error) {
        reject(error);
      }
    });
  },

  getUsers(users, token) {
    return new Promise(async (resolve) => {
      const slackUrl = `https://slack.com/api/users.info?token=${token}&user=`;
      const detailsRequest = Object.keys(users).map(each => axios.get(`${slackUrl}${each}`));
      let finalScore = await Promise.all(detailsRequest);
      finalScore = finalScore.map(({ data: { user }, status }) => {
        if (status === 200) {
          return {
            type: 'section',
            fields: [{
              type: 'plain_text',
              text: 'Name:',
            },
            {
              type: 'plain_text',
              text: user.real_name,
              emoji: true,
            },
            {
              type: 'plain_text',
              text: 'Username:',
            },
            {
              type: 'plain_text',
              text: user.name,
              emoji: true,
            },
            {
              type: 'plain_text',
              text: 'Score:',
            },
            {
              type: 'plain_text',
              text: `${users[user.id].totalScore}`,
            },
            {
              type: 'plain_text',
              text: 'words:',
            },
            {
              type: 'mrkdwn',
              text: users[user.id].words,
            }],
            accessory: {
              type: 'image',
              image_url: user.profile.image_72,
              alt_text: user.real_name,
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

  requestVerification(timestamp, body, signature) {
    const stringToHash = `v0:${timestamp}:${body}`;
    const hashed = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET).update(stringToHash).digest('hex');
    return `v0=${hashed}` === signature;
  },

  async retrieveMessages(baseUrl) {
    let words = [];
    let nextCursor = '';
    let response;
    do {
      let url = baseUrl;
      if (nextCursor) {
        url = `${url}&cursor=${nextCursor}`;
      }
      response = await axios.get(url);
      if (!response.data.ok) {
        return false;
      }
      words = words.concat(response.data.messages);
      if (response.data.has_more) {
        nextCursor = response.data.response_metadata.next_cursor;
      }
    } while (response.data.has_more);
    return words.slice(1);
  },
};
