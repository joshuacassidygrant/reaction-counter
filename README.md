# reaction-counter

This script counts the reactions to posts in a Slack group and attributes them to the original author of the reacted post, aggregating a score for all chat-users-who-get-reacted-to.

#SETUP
-In https://api.slack.com/apps/ create an app.
-Give it oAuth scope for the following: channels:history, channels:join, channels:read, commands, groups:history, groups:read, im:history, im:read, incoming-webhook, mpim:history, mpim:read, reactions:read, users: read
-Set up an oAuth token and a signing secret (from Basic Information) and include that in a .env file for SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET in the root of the project (see example file).
-Set up a bot user from App Home.
-The bot should now show up in your Slack group. Invite it to all channels you with to count by @ing it.

#OPERATION
It's probably best to run this from the command line. Navigate to the root folder. 
run npm --emoji=clap run count-reactions
(Replace clap with whatever emoji name you wish to count; hover over an emoji in slack to see its string id).
You can also run it as a web request using the /reactions/:emoji route after running npm start.
After the script runs successfully, you will find count-emoji.json file in the root of the project. That should have the data you need!
Note that this can take quite long to run as it needs to run a separate request for each threaded message, and the API rate limits at ~50 calls per minute for these.
