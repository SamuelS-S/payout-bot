// ============================================================
//  FiveM Payout Bot — reads Snipe Logs invoice embeds
//  and tracks weekly payouts per employee
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── CONFIG ────────────────────────────────────────────────
const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  INVOICE_CHANNEL_ID: process.env.INVOICE_CHANNEL_ID,
  PAYOUT_CHANNEL_ID: process.env.PAYOUT_CHANNEL_ID,
  CUT_PERCENT: 0.70,
  PAYOUT_DAY: 0,
  PAYOUT_HOUR: 20,
};
// ───────────────────────────────────────────────────────────

// In-memory store: { 'BEAR JOHNSON': { id: 'NGN07990', paid: 75000, invoiceCount: 3 } }
let weeklyData = {};

// ─── HELPERS ───────────────────────────────────────────────

function getField(embed, name) {
  const field = embed.fields?.find(f =>
    f.name.toLowerCase().includes(name.toLowerCase())
  );
  return field?.value?.trim() ?? null;
}

function parseAmount(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

function fmt(n) {
  return '$' + n.toLocaleString('en-US');
}

function addPaidInvoice(employeeName, employeeId, amount) {
  if (!weeklyData[employeeName]) {
    weeklyData[employeeName] = { id: employeeId, paid: 0, invoiceCount: 0 };
  }
  weeklyData[employeeName].paid += amount;
  weeklyData[employeeName].invoiceCount += 1;
  console.log(`[+] Logged paid invoice: ${employeeName} (${employeeId}) — ${fmt(amount)}`);
}

// ─── EMBED PARSER ──────────────────────────────────────────

function handleEmbed(embed) {
  const title = embed.title?.toLowerCase() ?? '';

  // Only care about "Invoice Paid" embeds
  if (!title.includes('invoice paid')) return;

  // "Invoiced By" field has the ID, "Invoiced By Name" has the full name
  // From the screenshot: two fields side by side — ID: NGN07990, Name: BEAR JOHNSON
  const invoicedById   = getField(embed, 'Invoiced By');
  const invoicedByName = getField(embed, 'Invoiced By Name');
  const amountStr      = getField(embed, 'Amount');

  if (!invoicedByName || !amountStr) {
    console.warn('[!] Could not parse Invoice Paid embed — missing fields:', embed);
    return;
  }

  const amount = parseAmount(amountStr);
  addPaidInvoice(invoicedByName, invoicedById ?? '?', amount);
}

// ─── PAYOUT SUMMARY ────────────────────────────────────────

async function postPayoutSummary(channel) {
  if (Object.keys(weeklyData).length === 0) {
    await channel.send('No paid invoices recorded this week.');
    return;
  }

  const cut = CONFIG.CUT_PERCENT;
  const cutPct = Math.round(cut * 100);
  const now = new Date();
  const weekStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let totalPool = 0;
  let totalInvoiced = 0;

  const fields = Object.entries(weeklyData)
    .sort((a, b) => b[1].paid - a[1].paid)
    .map(([name, data]) => {
      const payout = Math.round(data.paid * cut);
      totalPool += payout;
      totalInvoiced += data.paid;
      return {
        name: `${name} (${data.id})`,
        value: `Invoices: **${data.invoiceCount}** | Paid in: **${fmt(data.paid)}** | **Payout: ${fmt(payout)}**`,
        inline: false,
      };
    });

  const embed = new EmbedBuilder()
    .setTitle('Weekly Payout Summary')
    .setDescription(`Week ending **${weekStr}** · Employee cut: **${cutPct}%**`)
    .setColor(0x1D9E75)
    .addFields(fields)
    .setFooter({ text: `Total paid in: ${fmt(totalInvoiced)} | Total payout pool: ${fmt(totalPool)}` })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  console.log('[+] Payout summary posted.');

  // Reset for the new week
  weeklyData = {};
  console.log('[+] Weekly data reset.');
}

// ─── EVENTS ────────────────────────────────────────────────

client.once('ready', () => {
  console.log(`[+] Bot online as ${client.user.tag}`);
  startPayoutScheduler();
});

client.on('messageCreate', async (message) => {
  // Handle incoming webhook embeds from Snipe Logs
  if (message.channelId === CONFIG.INVOICE_CHANNEL_ID && message.embeds.length > 0) {
    for (const embed of message.embeds) {
      handleEmbed(embed);
    }
  }

  // Manual commands (prefix: !)
  if (!message.content.startsWith('!')) return;

  const command = message.content.split(' ')[0].toLowerCase();

  // !payout — post summary right now
  if (command === '!payout') {
    const payoutChannel = client.channels.cache.get(CONFIG.PAYOUT_CHANNEL_ID);
    if (!payoutChannel) return message.reply('Payout channel not found. Check PAYOUT_CHANNEL_ID in config.');
    await postPayoutSummary(payoutChannel);
    await message.react('✅');
  }

  // !status — show current week totals without posting/resetting
  if (command === '!status') {
    if (Object.keys(weeklyData).length === 0) {
      return message.reply('No paid invoices logged this week yet.');
    }
    const cut = CONFIG.CUT_PERCENT;
    const lines = Object.entries(weeklyData).map(([name, d]) => {
      const payout = Math.round(d.paid * cut);
      return `**${name}** — ${d.invoiceCount} invoice(s) · paid in ${fmt(d.paid)} · payout ${fmt(payout)}`;
    });
    await message.reply('**This week so far:**\n' + lines.join('\n'));
  }

  // !reset — manually reset the week
  if (command === '!reset') {
    weeklyData = {};
    await message.reply('Weekly data has been reset.');
  }

  // !setcut <number> — change cut % on the fly, e.g. !setcut 65
  if (command === '!setcut') {
    const val = parseInt(message.content.split(' ')[1]);
    if (isNaN(val) || val < 0 || val > 100) {
      return message.reply('Usage: `!setcut 70` (a number between 0 and 100)');
    }
    CONFIG.CUT_PERCENT = val / 100;
    await message.reply(`Cut updated to **${val}%**. Takes effect on next payout.`);
  }
});

// ─── SCHEDULER ─────────────────────────────────────────────

function startPayoutScheduler() {
  // Check every minute if it's payout time
  setInterval(async () => {
    const now = new Date();
    if (now.getDay() === CONFIG.PAYOUT_DAY && now.getHours() === CONFIG.PAYOUT_HOUR && now.getMinutes() === 0) {
      const payoutChannel = client.channels.cache.get(CONFIG.PAYOUT_CHANNEL_ID);
      if (payoutChannel) {
        await postPayoutSummary(payoutChannel);
      }
    }
  }, 60_000);
}

// ─── START ─────────────────────────────────────────────────

client.login(CONFIG.BOT_TOKEN);
