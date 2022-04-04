/*
 * Obama r/place bot
 * Written by Saghetti (Walter Min) for discord.gg/obama
 * 2022-04-02
 * 
 * Do not use my code without given permission. If you would like to contact me, please message
 * Saghetti#9735 on Discord. I don't accept friend requests, but my DMs are open.
 * 
 * This code is a mess. I wrote this code first and foremost to work, and not to be the best
 * code ever. Deadlines are deadlines, and this must be done before r/place is over.
 */

import cluster from "cluster";
import { ApolloClient, from, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { createHttpLink } from '@apollo/client';
import fs from "fs";
import fetch from "node-fetch";
import secret from './secret.json';

import { requestAccessToken, TokenData } from './tokenLogic';
import { ControlLogic } from './controlLogic';
import { ClientLogic } from './clientLogic';

if (cluster.isPrimary) {
  cluster.fork();

  cluster.on('exit', async (worker, code, signal) => {
    if (code === 69) return;
    console.log(`Worker ${worker.id} died with code ${code} and signal ${signal}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log("Restarting worker");
    cluster.fork();
  });
}

if (cluster.isWorker) {

(async () => {
  let tokenData: TokenData = null;

  function getCurrentToken() {
    return tokenData?.access_token ?? null;
  }

  async function recheckToken() {
    console.log("checking auth token...");
  
    if (fs.existsSync("token_cache.json")) {
      const tokenCache = JSON.parse(fs.readFileSync("token_cache.json", "utf8"));
      const now = new Date();
      if (tokenCache.expires_at > (now.getTime() / 1000)) {
        tokenData = tokenCache;
        console.log("using cached token");
      } else {
        console.log("cached token expired, getting new one");
        tokenData = await requestAccessToken(secret);
      }
    } else {
      console.log("no token cache found");
      tokenData = await requestAccessToken(secret);
    }
    
    fs.writeFileSync("token_cache.json", JSON.stringify(tokenData));
  
    if (tokenData === null) {
      console.log("failed to get token");
      return;
    }

    if (tokenData.access_token === null || tokenData.access_token === undefined) {
      console.log("\n\nCouldn't authenticate! Make sure your secret.json is correct.\n\n");
      process.exit(69);
    }
    
    const exprSeconds = Math.floor(tokenData.expires_at - Math.floor(new Date().getTime()) / 1000);
    setTimeout(recheckToken, (exprSeconds * 1000) - 5000);
  
    console.log(`token expires in ${exprSeconds} seconds`);
  }
  
  await recheckToken();
  
  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        authorization: `Bearer ${getCurrentToken()}`,
      }
    }
  });
  
  const errorLink = onError(({ graphQLErrors, operation, forward }) => {
    // check for ratelimit errors

    if (graphQLErrors) {
      console.log(graphQLErrors);
    }
  
    forward(operation)
  })
  
  const httpLink = createHttpLink({
    uri: "https://gql-realtime-2.reddit.com/query",
    fetch: fetch as any,
  });
  
  const client = new ApolloClient({
    link: from([authLink, errorLink, httpLink]),
    cache: new InMemoryCache(),
    name: "mona-lisa",
    version: "0.0.1",
    queryDeduplication: false,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
      },
    },
  });
  
  if (process.argv[2] == "control") {
    console.log("starting control logic");
    const controlLogic = new ControlLogic(client);
    await controlLogic.run();
  } else {
    console.log("starting client logic");
    const clientLogic = new ClientLogic(client);
    await clientLogic.run();
  }
})();

}
