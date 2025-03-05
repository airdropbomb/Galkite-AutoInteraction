import fetch from 'node-fetch';
import cfonts from "cfonts";
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';

async function main(numberOfInteractions) {
  cfonts.say('ADB Node', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'black',
    letterSpacing: 1,
    lineHeight: 1,
    space: true,
    maxLength: '0',
  });

  console.log(chalk.green("=== Telegram Channel : ADB Node ( @airdropbombnode ) ===\n"));

  const interactions = loadInteractionsFromFile('interactions.txt');
  const wallets = loadWalletsFromFile('wallet.txt');

  if (wallets.length === 0) {
    console.log(chalk.red('No wallets found in wallet.txt! Please add wallet addresses.'));
    return;
  }

  for (const walletAddress of wallets) {
    console.log(chalk.magenta(`\n=== Processing wallet: ${walletAddress} ===`));
    
    for (let i = 0; i < parseInt(numberOfInteractions); i++) {
      console.log(chalk.blue(`\nProcessing interaction ${i + 1} of ${numberOfInteractions}`));
      const { agent_id, request_text, response_text } = interactions[i % interactions.length];
      await retryOperation(() => reportUsage(walletAddress, agent_id, request_text, response_text));
      
      console.log(chalk.yellow("\u23F3 Waiting 30 seconds before next interaction..."));
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  console.log(chalk.magenta("\u23F3 All wallets completed. Waiting 24 hours before restarting..."));
  await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
  await main(numberOfInteractions);
}

function loadWalletsFromFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    console.log(chalk.red(`Error reading ${filePath}: ${error.message}`));
    return [];
  }
}

function loadInteractionsFromFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n').filter(line => line).map(line => {
      const [agent_id, request_text, response_text] = line.split('|');
      return { agent_id, request_text, response_text };
    });
  } catch (error) {
    console.log(chalk.red(`Error reading ${filePath}: ${error.message}`));
    return [];
  }
}

async function retryOperation(operation, delay = 5000) {
  const spinner = ora('Processing...').start();
  let firstAttempt = true;
  while (true) {
    try {
      if (firstAttempt) {
        console.log(chalk.cyan(`\uD83D\uDD04 Trying interaction...`));
        firstAttempt = false;
      }
      await operation();
      spinner.succeed('Operation successful!');
      return;
    } catch (error) {
      spinner.text = `Retrying... (${error.message})`;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function reportUsage(walletAddress, agent_id, request_text, response_text) {
  const postUrl = 'https://quests-usage-dev.prod.zettablock.com/api/report_usage';
  const postPayload = {
    wallet_address: walletAddress,
    agent_id,
    request_text,
    response_text,
    request_metadata: null
  };

  const headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json'
  };

  console.log(chalk.cyan(`\uD83D\uDD04 Trying interaction with wallet: ${walletAddress}`));

  const response = await fetch(postUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(postPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`POST request failed: ${response.status}\nServer Response: ${errorText}`);
  }

  const data = await response.json();
  const interactionId = data.interaction_id;

  if (!interactionId) throw new Error('interaction_id not found in the POST response!');

  console.log(chalk.green(`\u2705 Success! Got interaction ID: ${interactionId}`));

  await retryOperation(() => submitInteraction(interactionId, walletAddress));
}

async function submitInteraction(interactionId, walletAddress) {
  const getUrl = `https://neo.prod.zettablock.com/v1/inference?id=${interactionId}`;

  const headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json'
  };

  console.log(chalk.cyan(`\uD83D\uDD04 Trying to submit interaction (${interactionId})...`));

  const response = await fetch(getUrl, { method: 'GET', headers });
  if (!response.ok) throw new Error(`GET request failed: ${response.status}`);

  await new Promise(resolve => setTimeout(resolve, 2000));
  const response2 = await fetch(getUrl, { method: 'GET', headers });
  if (!response2.ok) throw new Error(`Second request failed: ${response2.status}`);

  const data = await response2.json();
  const txHash = data.tx_hash || chalk.gray("No transaction hash available");

  console.log(chalk.green(`\u2705 Successfully submitted!`));
  console.log(chalk.magenta(`______________________________________________________________________________`));

  await fetchUserStats(walletAddress);
}

async function fetchUserStats(walletAddress) {
  const statsUrl = `https://quests-usage-dev.prod.zettablock.com/api/user/${walletAddress}/stats`;

  const statsHeaders = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-US,en;q=0.8',
    'origin': 'https://agents.testnet.gokite.ai',
    'referer': 'https://agents.testnet.gokite.ai/',
    'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'
  };

  const response = await fetch(statsUrl, { method: 'GET', headers: statsHeaders });

  if (!response.ok) {
    throw new Error(`Failed to fetch user stats: ${response.status}`);
  }

  const stats = await response.json();
  const totalInteractions = stats.total_interactions || chalk.gray('N/A');
  const lastActive = stats.last_active || chalk.gray('N/A');

  console.log(chalk.yellow('\ud83d\udcca User Interaction Stats:'));
  console.log(chalk.blue(`Total Interactions: ${totalInteractions}`));
  console.log(chalk.blue(`Last Active: ${lastActive}`));
}

process.on('SIGINT', () => {
  console.log(chalk.red('\nProcess terminated by user.'));
  process.exit(0);
});

(async () => {
  const numberOfInteractions = process.argv[2] || 1;
  await main(numberOfInteractions);
})();
