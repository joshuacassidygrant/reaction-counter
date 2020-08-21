const dotEnv = require('dotenv').config();
const jsonWriter = require('./services/jsonWriter');
const getReactionsOfEmojiByPostAuthor = require('./services/reactionCounter');

let emoji = process.env.npm_config_emoji;

if (emoji == undefined) {
    emoji = "clap";
}

console.log(`Counting ${emoji} for all channels the auth'd bot is invited to`);

getReactionsOfEmojiByPostAuthor(emoji)
.then((val) => {
    jsonWriter.writeFile("count-" + emoji, val); 
    console.log("Success. The file is in the folder.");
})
.catch((err) => {
    console.error(err);
})