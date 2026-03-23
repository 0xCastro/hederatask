require('dotenv').config();
const express = require('express');
const {
  Client, PrivateKey, AccountId,
  TopicCreateTransaction, TopicMessageSubmitTransaction
} = require('@hashgraph/sdk');
const { AccountBalanceQuery } = require('@hashgraph/sdk');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ── HEDERA CLIENT ──
const client = Client.forTestnet();
client.setOperator(
  AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
);

// ── PRICING CONFIG ──
// Anthropic costs (USD per 1M tokens)
const CLAUDE_INPUT_COST_PER_1M  = 3.00;   // claude-sonnet-4-5 input
const CLAUDE_OUTPUT_COST_PER_1M = 15.00;  // claude-sonnet-4-5 output
const HBAR_USD_PRICE            = 0.25;   // approximate HBAR price in USD
const MARGIN_MULTIPLIER         = 3.0;    // 3x markup to cover Hedera fees + profit

// Task complexity multipliers
const COMPLEXITY = {
  summarize: 1.0,   // normal
  translate: 1.2,   // slightly more output
  analyze:   1.0,   // normal
  code:      1.5,   // more complex reasoning = more tokens
};

// Limits
const MAX_CHARS       = 4000;   // ~1000 tokens input max
const MIN_HBAR        = 0.05;   // minimum floor price
const MAX_HBAR        = 5.0;    // maximum ceiling price
const RATE_LIMIT_MS   = 10000;  // 10 seconds between requests per IP
const lastRequest     = {};     // simple in-memory rate limiter

// ── DYNAMIC PRICE CALCULATOR ──
function calculatePrice(content, taskType) {
  const chars        = content.length;
  const inputTokens  = Math.ceil(chars / 4);          // ~4 chars per token
  const outputTokens = Math.ceil(inputTokens * 0.6);  // output ~60% of input

  const inputCost  = (inputTokens  / 1_000_000) * CLAUDE_INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_1M;
  const totalUSD   = (inputCost + outputCost) * MARGIN_MULTIPLIER;

  const complexity = COMPLEXITY[taskType] || 1.0;
  const hbarPrice  = (totalUSD / HBAR_USD_PRICE) * complexity;

  // Clamp between min and max
  const finalHbar = Math.max(MIN_HBAR, Math.min(MAX_HBAR, hbarPrice));

  return {
    hbar:         parseFloat(finalHbar.toFixed(4)),
    usdCost:      parseFloat(totalUSD.toFixed(6)),
    inputTokens,
    outputTokens,
    chars,
    complexity,
  };
}

// ── PRICING ENDPOINT (frontend calls this to show price before running) ──
app.post('/api/price', (req, res) => {
  const { content, taskType } = req.body;
  if (!content || !taskType) return res.status(400).json({ error: 'Missing fields' });
  if (content.length > MAX_CHARS) {
    return res.status(400).json({
      error: `Content too long. Max ${MAX_CHARS} characters (yours: ${content.length})`
    });
  }
  const price = calculatePrice(content, taskType);
  res.json({ success: true, price });
});

// ── TASK ENDPOINT ──
app.post('/api/task', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { taskType, content } = req.body;

  // Rate limiting
  const now = Date.now();
  if (lastRequest[ip] && (now - lastRequest[ip]) < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (now - lastRequest[ip])) / 1000);
    return res.status(429).json({ error: `Slow down! Wait ${wait}s before next request.` });
  }
  lastRequest[ip] = now;

  // Validation
  if (!content || !taskType) return res.status(400).json({ error: 'Missing content or taskType' });
  if (content.length > MAX_CHARS) {
    return res.status(400).json({
      error: `Content too long. Max ${MAX_CHARS} characters.`
    });
  }

  // Calculate price
  const price = calculatePrice(content, taskType);

  try {
    // 1. Call Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: Math.min(1024, Math.ceil(price.outputTokens * 1.2)),
        messages: [{
          role: 'user',
          content: buildPrompt(taskType, content)
        }]
      })
    });

    const aiData = await response.json();
    if (!aiData.content || !aiData.content[0]) {
      throw new Error('Empty response from Claude: ' + JSON.stringify(aiData));
    }
    const aiResult = aiData.content[0].text;

    // Get actual tokens used from response
    const actualInputTokens  = aiData.usage?.input_tokens  || price.inputTokens;
    const actualOutputTokens = aiData.usage?.output_tokens || price.outputTokens;

    // Recalculate actual cost from real usage
    const actualUSD = (
      (actualInputTokens  / 1_000_000) * CLAUDE_INPUT_COST_PER_1M +
      (actualOutputTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_1M
    );

    // 2. Record on Hedera HCS
    const topicTx = await new TopicCreateTransaction()
      .setTopicMemo(`HederaTask:${taskType}`)
      .execute(client);
    const topicReceipt = await topicTx.getReceipt(client);
    const topicId = topicReceipt.topicId;

    await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify({
        taskType,
        timestamp:     new Date().toISOString(),
        chars:         content.length,
        inputTokens:   actualInputTokens,
        outputTokens:  actualOutputTokens,
        hbarCharged:   price.hbar,
        actualUSD:     actualUSD.toFixed(6),
        marginUSD:     ((price.hbar * HBAR_USD_PRICE) - actualUSD).toFixed(6),
        resultPreview: aiResult.substring(0, 80)
      }))
      .execute(client);

    res.json({
      success:      true,
      result:       aiResult,
      topicId:      topicId.toString(),
      message:      `Task completed & recorded on Hedera! Topic: ${topicId}`,
      pricing: {
        hbarCharged:   price.hbar,
        estimatedUSD:  price.usdCost,
        actualUSD:     actualUSD.toFixed(6),
        inputTokens:   actualInputTokens,
        outputTokens:  actualOutputTokens,
        margin:        ((price.hbar * HBAR_USD_PRICE) - actualUSD).toFixed(4),
      }
    });

  } catch (error) {
    console.error('Task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PROMPTS PER TASK TYPE ──
function buildPrompt(taskType, content) {
  const prompts = {
    summarize: `You are an expert summarizer. Summarize the following content in 3-5 clear bullet points. Be concise and capture the key ideas only.\n\nContent:\n${content}`,
    translate: `You are a professional translator. Translate the following text to English accurately and naturally. Preserve the tone and meaning.\n\nText:\n${content}`,
    analyze:   `You are a sentiment analysis expert. Analyze the emotional tone of the following text. Return: overall sentiment (positive/negative/neutral), confidence %, key emotional signals found, and a 1-sentence summary.\n\nText:\n${content}`,
    code:      `You are a senior software engineer. Explain what the following code does in plain English. Cover: purpose, how it works step by step, and any potential issues.\n\nCode:\n${content}`,
  };
  return prompts[taskType] || `Complete this task (${taskType}):\n\n${content}`;
}

// ── BALANCE ENDPOINT ──
app.get('/api/balance', async (req, res) => {
  try {
    const balance = await new AccountBalanceQuery()
      .setAccountId(process.env.HEDERA_ACCOUNT_ID)
      .execute(client);
    res.json({ balance: balance.hbars.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── START ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HederaTask running on http://localhost:${PORT}`);
  console.log(`💰 Pricing: ${MIN_HBAR}–${MAX_HBAR} HBAR | Margin: ${MARGIN_MULTIPLIER}x | Max: ${MAX_CHARS} chars`);
});
