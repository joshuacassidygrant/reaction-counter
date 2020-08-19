const express = require('express');
const router = express.Router();
const {App} = require('@slack/bolt'); 
const e = require('express');
const { json } = require('express');

const bolt = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const MESSAGE_RESULTS_PER_PAGE = 500; // Slack hard limits history to 1000 messages per call

router.get('/:emoji', function(req, res, next) {
  //res.status(200).send("Received");
  getReactionsOfEmojiByPostAuthor(req.params.emoji)
  .then((val) => {
    res.status(200).send(val);
  })
  .catch((err) => {
    console.error(err);
  })
});

function getReactionsOfEmojiByPostAuthor(emoji) {
  return fetchHistory()
  .then((messages) => {
    authorToEmojiCount = {};

    for (let message of messages) {
      // check if message has any reactions
      if (!("reactions" in message)) continue;
  
      // find index of given emoji
      let emojiIndex = message.reactions.findIndex(reaction => reaction.name == emoji);
      if (emojiIndex == -1) continue;
  
      // attribute reactions to post author
      if (!(message.user in authorToEmojiCount)) {
        authorToEmojiCount[message.user] = 0;
      }
      authorToEmojiCount[message.user] += message.reactions[emojiIndex].count;
  
    }
    return authorToEmojiCount;
  })
  .then((authorToEmojiCount) => {
    // replaces ids with names
    return getListWithNames(authorToEmojiCount);
  })
  .then((scoreList) => {
    // sorts reactions descending
    return scoreList.sort((a, b) =>  b.score - a.score);
  })

}

async function getListWithNames(userIdToReactCount) {
  promiseList = [];

  // creates a promise array for all user requests
  for (let userId of Object.keys(userIdToReactCount)) {
    promiseList.push(bolt.client.users.info({
      token: process.env.SLACK_BOT_TOKEN,
      user: userId
    }));
  }

  // once all promises are resolved, constructs a list of {name, score} objects
  return Promise.all(promiseList)
  .then ((userList) => {
    scoreList = [];

    for (userRes of userList) {
      scoreList.push({name: userRes.user.profile.real_name, score: userIdToReactCount[userRes.user.id]});
    }
    
    // build score list
    return scoreList;
  })
  .catch ((error) => {
    console.error(error);
  })

}

// flattens all channel history into a single array of messages
async function fetchHistory(id) {
  return bolt.client.conversations.list({token: process.env.SLACK_BOT_TOKEN})
  .then(async (channelResults) => {
    let promiseList = [];

    for (let channel of channelResults.channels) {

      /* This function will grab "next_cursor" and put a request for that page of the 
       * results in the promise list until it reaches a page with less than maximum results.
       * It will also check all messages for replies and put those on the promise pile too.
       * The channel variable above is used in the below closure.
       */

      let sendPagingRequest = () => {
        return bolt.client.conversations.history({
          token: process.env.SLACK_BOT_TOKEN,
          channel: channel.id,
          limit: MESSAGE_RESULTS_PER_PAGE
        })
        .then((history) => {
          if (history.response_metadata.next_cursor) {
            // Returned page is full; we add a request to the promise list for the next one too
            console.log("push more");
            promiseList.push(bolt.client.conversations.history({
              token: process.env.SLACK_BOT_TOKEN,
              channel: channel.id,
              limit: MESSAGE_RESULTS_PER_PAGE,
              cursor: history.response_metadata.next_cursor
            }))
          }

          /*for (let message of history.messages) {
            if (message.reply_count > 0) {

              let sendRepliesRequest = () => {
                return bolt.client.conversations.replies({
                  token: process.env.SLACK_BOT_TOKEN,
                  channel: channel.id,
                  ts: message.ts,
                  limit: MESSAGE_RESULTS_PER_PAGE
                })
                .then((replies) => {
                  //TODO: Remove the original message from replies. We have already handled this.
                  return replies.messages;
                })
                .catch ((err) => {
                  console.error(err);
                })
              }

              promiseList.push(sendRepliesRequest);
            }
          }*/

          // Resolve this promise with the history
          return history.messages;
        })
        .catch((err) => {
          console.error(err);
        })
      }

      if (channel.is_member) {
        promiseList.push(sendPagingRequest());
      } else {
        console.log(`Not a member of channel {channel.id}`);
      }
    }

    return Promise.all(promiseList);
  })
  .then((channelsMessages) => {
    console.log(channelsMessages.length);
    messages = [];
    for (let channelMessages of channelsMessages) {
      console.log(channelMessages.length);
      messages.push(...channelMessages)
    }
    return messages;
  })
  .catch ((error) => {
    console.error(error);
  });
}

module.exports = router;