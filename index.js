import fetch from 'node-fetch';
import cfonts from "cfonts";
import chalk from 'chalk';
import readline from 'readline';
import ora from 'ora';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  cfonts.say('NT Exhaust', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'black',
    letterSpacing: 1,
    lineHeight: 1,
    space: true,
    maxLength: '0',
  });

  console.log(chalk.green("=== Telegram Channel : NT Exhaust ( @NTExhaust ) ===\n"));

  const numberOfInteractions = await askQuestion(chalk.yellow("Enter the number of interactions: "));

  for (let i = 1; i <= parseInt(numberOfInteractions); i++) {
    console.log(chalk.blue(`\nProcessing interaction ${i} of ${numberOfInteractions}`));
    await retryOperation(reportUsage); // Keep retrying until success
  }

  rl.close();

  console.log(chalk.magenta("⏳ All interactions completed. Waiting 24 hours before restarting..."));
  await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000)); // 24 hours delay
  main(); // Restart the process after 24 hours
}

const walletAddress = "WALLETADDRESS";
const postUrl = 'https://quests-usage-dev.prod.zettablock.com/api/report_usage';

async function retryOperation(operation, delay = 5000) {
  const spinner = ora('Processing...').start();
  let firstAttempt = true;
  while (true) {
    try {
      if (firstAttempt) {
        console.log(chalk.cyan(`🔄 Trying interaction with wallet: ${walletAddress}`));
        firstAttempt = false;
      }
      await operation();
      spinner.succeed('Operation successful!');
      return;
    } catch {
      spinner.text = 'Retrying...';
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function reportUsage() {
  const postPayload = {
    wallet_address: walletAddress,
    agent_id: "deployment_p5J9lz1Zxe7CYEoo0TZpRVay",
    request_text: "What is Kite AI?",
    response_text: "Kite AI is a purpose-built Layer 1 blockchain designed for the AI economy, utilizing a novel consensus mechanism called Proof of AI (PoAI). It enables transparent and fair collaboration in AI development through EVM-compatible subnets for data, models, and intelligent agents. Kite AI focuses on democratizing AI access, seamless blockchain integration, and fostering an ecosystem for developers and researchers.",
    request_metadata: null
  };

  const headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json'
  };

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

  console.log(chalk.green(`✅ Success! Got interaction ID: ${interactionId}`));

  await retryOperation(() => submitInteraction(interactionId)); // Keep retrying until success
}

async function submitInteraction(interactionId) {
  const getUrl = `https://neo-dev.prod.zettablock.com/v1/inference?id=${interactionId}`;

  const headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json'
  };

  console.log(chalk.cyan(`🔄 Trying to submit interaction (${interactionId})...`));

  const response = await fetch(getUrl, { method: 'GET', headers });
  if (!response.ok) throw new Error(`GET request failed: ${response.status}`);

  await new Promise(resolve => setTimeout(resolve, 2000));
  const response2 = await fetch(getUrl, { method: 'GET', headers });
  if (!response2.ok) throw new Error(`Second request failed: ${response2.status}`);

  const data = await response2.json();
  const txHash = data.tx_hash || chalk.gray("No transaction hash available");

  console.log(chalk.green(`✅ Successfully submitted!`));
  console.log(chalk.magenta(`______________________________________________________________________________`));

  await fetchUserStats();
}

async function fetchUserStats() {
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

  console.log(chalk.yellow('📊 User Interaction Stats:'));
  console.log(chalk.blue(`Total Interactions: ${totalInteractions}`));
  console.log(chalk.blue(`Last Active: ${lastActive}`));
}

main();
