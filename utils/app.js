const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'w', 'x', 'y', 'z'];
// const vowels = ['a', 'e', 'i', 'o', 'u'];
// eslint-disable-next-line max-len
// const consonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'w', 'x', 'y', 'z'];
const min = 10;
const max = 15;

const randomNumber = maxNum => Math.floor(Math.random() * maxNum);

module.exports = {
  generateLetters() {
    const length = Math.floor(Math.random() * (max - min + 1) + min);
    let shuffled = '';
    for (let i = 0; i < length; i += 1) {
      shuffled += letters[randomNumber(letters.length)];
    }
    return shuffled;
  },
};
