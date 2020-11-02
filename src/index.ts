import * as dotenv from 'dotenv'; 
import needle from 'needle';

dotenv.config(); 
const queueQuestion: any = [];
const queueSummary: any = [];
const queueReport: any = [];

// The code below sets the bearer token from your environment variables
// To set environment variables on Mac OS X, run the export command below from the terminal: 
// export BEARER_TOKEN='YOUR-TOKEN'
const token = process.env.TWITTER_BEARER_TOKEN;  

const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules'
const streamURL = 'https://api.twitter.com/2/tweets/search/stream?expansions=attachments.poll_ids,attachments.media_keys,author_id,entities.mentions.username,geo.place_id,in_reply_to_user_id,referenced_tweets.id,referenced_tweets.id.author_id';
const recentSearchURL = 'https://api.twitter.com/2/tweets/search/recent'; 

// Edit rules as desired here below
const rules = [
    { 'value': `${process.env.TWITTER_ACCOUNT_TO_LISTEN}`, 'tag': 'monitor-mention' }, 
  ];

async function getAllRules() {

    const response = await needle('get', rulesURL, { headers: {
        "authorization": `Bearer ${token}`
    }})

    if (response.statusCode !== 200) {
        throw new Error(response.body);
        return null;
    }

    return (response.body);
}

async function deleteAllRules(rules: any) {

    if (!Array.isArray(rules.data)) {
        return null;
      }

    const ids = rules.data.map((rule: any) => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
    }}) 

    if (response.statusCode !== 200) {
        throw new Error(response.body);
        return null;
    }
    
    return (response.body);

}

async function setRules() {

    const data = {
        "add": rules
      }

    const response = await needle('post', rulesURL, data, {headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
    }}) 

    if (response.statusCode !== 201) {
        throw new Error(response.body);
        return null;
    }
    
    return (response.body);

}

function streamConnect(token: any) {
    //Listen to the stream
    const options = {
        timeout: 20000
      }
    
    const stream = needle.get(streamURL, {
        headers: { 
            Authorization: `Bearer ${token}`
        }
    }, options)
    
    stream.on('data', (data: any) => {
    try {
        const json = JSON.parse(data);
        queueQuestion.push(json)
    } catch (e) {
        // Keep alive signal received. Do nothing.
    }
    }).on('err', (err: any) => {
        // if (err.code === 'ETIMEDOUT') {
        //     stream.emit('timeout');
        // }
        console.log(err)
    }); 

    return stream;
    
}

async function recentSearch(username: string) {

    // Edit query parameters below
    const params = {
        'query': `from:${username}`, 
        'tweet.fields': 'author_id' 
    } 

    const res = await needle('get', recentSearchURL, params, { headers: {
        "authorization": `Bearer ${token}`
    }})

    if(res.body) {
        return res.body;
    } else {
        throw new Error ('Unsuccessful request')
    }
}

async function retrieveQuestion() {
    let currentRules;
  
    try {
      // Gets the complete list of rules currently applied to the stream
      currentRules = await getAllRules();
      
      // Delete all rules. Comment the line below if you want to keep your existing rules.
      await deleteAllRules(currentRules);
  
      // Add rules to the stream. Comment the line below if you don't want to add new rules.
      await setRules();
      
    } catch (e) {
      console.error(e);
      process.exit(-1);
    }
  
    // Listen to the stream.
    // This reconnection logic will attempt to reconnect when a disconnection is detected.
    // To avoid rate limites, this logic implements exponential backoff, so the wait time
    // will increase if the client cannot reconnect to the stream.
  
    const filteredStream = streamConnect(token)
    let timeout = 0;
    filteredStream.on('timeout', () => {
      // Reconnect on error
      console.warn('A connection error occurred. Reconnecting…');
      setTimeout(() => {
        timeout++;
        streamConnect(token);
      }, 2 ** timeout);
      streamConnect(token);
    })
}

async function generateSummary(question: any) {
    if (question.data.in_reply_to_user_id) {
        return recentSearch(question.data.in_reply_to_user_id); 
    } else return null; 
}

async function sendAnswer() {
    return; 
}

async function app() {
    try {
        retrieveQuestion(); 

    setInterval(async () => {
        const question = await queueQuestion.shift()
        if (question) {
            console.log(JSON.stringify(question)); 
            const summary = await generateSummary(question); 
            console.log(JSON.stringify(summary)); 
            if (summary) queueSummary.push(summary); 
        }
    }, 1000)

    setInterval( async() => {
        sendAnswer(); 
    }, 1000)

    console.log('Service has been started!')
    } catch (e) {
        console.log(JSON.stringify(e)); 
        setTimeout(app, 3000)
    }
}

(async () => {
    app(); 
  })();