import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/database/client';
import OpenAI from 'openai';

/**
 * Analyzer Agent - On-demand trading performance analysis
 *
 * This endpoint analyzes your full Kalshi trading history and provides:
 * - Total returns and ROI
 * - Annualized return projections
 * - Win rate and average win/loss
 * - Best and worst performing market categories
 * - GPT-powered insights and recommendations
 *
 * Trigger manually via:
 * curl -X GET "https://your-app.vercel.app/api/cron/analyzer" -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('📊 ANALYZER AGENT - Starting performance analysis...\n');

  try {
    // ===== PULL FULL TRADING HISTORY =====
    const { data: allTrades, error } = await supabase
      .from('trades')
      .select('*, contract:contracts(*)')
      .order('executed_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch trades: ${error.message}`);

    if (!allTrades || allTrades.length === 0) {
      console.log('⚠️ No trades found in database');
      return res.status(200).json({ message: 'No trades to analyze' });
    }

    // Filter resolved trades (won, lost, stopped, cancelled)
    const resolvedTrades = allTrades.filter(t => ['won', 'lost', 'stopped', 'cancelled', 'take_profit'].includes(t.status));
    const openTrades = allTrades.filter(t => t.status === 'open');

    console.log(`📈 Total Trades: ${allTrades.length}`);
    console.log(`   ✅ Resolved: ${resolvedTrades.length}`);
    console.log(`   ⏳ Open: ${openTrades.length}\n`);

    if (resolvedTrades.length === 0) {
      console.log('⚠️ No resolved trades to analyze yet');
      return res.status(200).json({ message: 'No resolved trades to analyze' });
    }

    // ===== CALCULATE CORE METRICS =====
    const totalInvested = resolvedTrades.reduce((sum, t) => sum + t.position_size, 0);
    const totalPnL = resolvedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = resolvedTrades.filter(t => t.status === 'won' || t.status === 'take_profit');
    const losses = resolvedTrades.filter(t => ['lost', 'stopped'].includes(t.status));
    const cancelled = resolvedTrades.filter(t => t.status === 'cancelled');

    const winRate = wins.length / (wins.length + losses.length);
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;
    const roi = (totalPnL / totalInvested) * 100;

    // Calculate time range for annualized return
    const firstTrade = new Date(resolvedTrades[0].executed_at);
    const lastTrade = new Date(resolvedTrades[resolvedTrades.length - 1].resolved_at || resolvedTrades[resolvedTrades.length - 1].executed_at);
    const daysTrading = Math.max(1, (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24));
    const annualizedReturn = (totalPnL / totalInvested) * (365 / daysTrading) * 100;

    console.log('💰 PERFORMANCE SUMMARY');
    console.log('━'.repeat(50));
    console.log(`Total Invested:     $${totalInvested.toFixed(2)}`);
    console.log(`Total P&L:          $${totalPnL.toFixed(2)} ${totalPnL >= 0 ? '📈' : '📉'}`);
    console.log(`ROI:                ${roi.toFixed(2)}%`);
    console.log(`Annualized Return:  ${annualizedReturn.toFixed(2)}% (${daysTrading.toFixed(0)} days)`);
    console.log(`\nWin Rate:           ${(winRate * 100).toFixed(1)}% (${wins.length}W / ${losses.length}L / ${cancelled.length}C)`);
    console.log(`Average Win:        $${avgWin.toFixed(2)}`);
    console.log(`Average Loss:       $${avgLoss.toFixed(2)}`);
    console.log(`Profit Factor:      ${avgLoss !== 0 ? (Math.abs(avgWin * wins.length) / Math.abs(avgLoss * losses.length)).toFixed(2) : 'N/A'}\n`);

    // ===== ANALYZE BY MARKET CATEGORY =====
    const byCategory: Record<string, { trades: any[], pnl: number, wins: number, total: number }> = {};

    for (const trade of resolvedTrades) {
      if (trade.status === 'cancelled') continue; // Skip cancelled trades for category analysis

      const category = trade.contract?.category || 'Unknown';
      if (!byCategory[category]) {
        byCategory[category] = { trades: [], pnl: 0, wins: 0, total: 0 };
      }

      byCategory[category].trades.push(trade);
      byCategory[category].pnl += trade.pnl || 0;
      byCategory[category].total += 1;
      if (trade.status === 'won') byCategory[category].wins += 1;
    }

    // Sort by P&L
    const categoriesByPnL = Object.entries(byCategory)
      .map(([category, data]) => ({
        category,
        pnl: data.pnl,
        trades: data.total,
        winRate: data.wins / data.total,
        avgPnL: data.pnl / data.total,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    console.log('🎯 PERFORMANCE BY CATEGORY');
    console.log('━'.repeat(50));

    if (categoriesByPnL.length > 0) {
      console.log('Top 3 Best Performing:');
      categoriesByPnL.slice(0, 3).forEach((cat, i) => {
        console.log(`  ${i + 1}. ${cat.category}`);
        console.log(`     P&L: $${cat.pnl.toFixed(2)} | Win Rate: ${(cat.winRate * 100).toFixed(1)}% | Trades: ${cat.trades}`);
      });

      console.log('\nBottom 3 Worst Performing:');
      categoriesByPnL.slice(-3).reverse().forEach((cat, i) => {
        console.log(`  ${i + 1}. ${cat.category}`);
        console.log(`     P&L: $${cat.pnl.toFixed(2)} | Win Rate: ${(cat.winRate * 100).toFixed(1)}% | Trades: ${cat.trades}`);
      });
    }

    console.log('');

    // ===== GPT-POWERED INSIGHTS =====
    console.log('🤖 GENERATING AI INSIGHTS...\n');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const analysisData = {
      summary: {
        totalTrades: resolvedTrades.length,
        totalInvested: totalInvested.toFixed(2),
        totalPnL: totalPnL.toFixed(2),
        roi: roi.toFixed(2),
        annualizedReturn: annualizedReturn.toFixed(2),
        daysTrading: daysTrading.toFixed(0),
        winRate: (winRate * 100).toFixed(1),
        wins: wins.length,
        losses: losses.length,
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
      },
      byCategory: categoriesByPnL.slice(0, 10), // Top 10 categories
      recentTrades: resolvedTrades.slice(-10).map(t => ({
        date: t.executed_at,
        category: t.contract?.category,
        question: t.contract?.question?.substring(0, 60),
        result: t.status,
        pnl: t.pnl,
      })),
    };

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a quantitative trading analyst specializing in prediction markets. Analyze the trading data and provide actionable insights, patterns, and recommendations. Be concise but insightful.',
          },
          {
            role: 'user',
            content: `Analyze this Kalshi trading performance data and provide insights:\n\n${JSON.stringify(analysisData, null, 2)}\n\nProvide:\n1. Overall performance assessment\n2. Key strengths and weaknesses\n3. Category-specific insights\n4. Actionable recommendations for improvement\n5. Risk assessment`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const insights = completion.choices[0].message.content;

      console.log('💡 AI INSIGHTS & RECOMMENDATIONS');
      console.log('━'.repeat(50));
      console.log(insights);
      console.log('');

    } catch (gptError: any) {
      console.log('⚠️ GPT analysis failed:', gptError.message);
      console.log('(Continuing without AI insights)\n');
    }

    // ===== OPEN POSITIONS SNAPSHOT =====
    if (openTrades.length > 0) {
      console.log('📊 OPEN POSITIONS');
      console.log('━'.repeat(50));

      const openValue = openTrades.reduce((sum, t) => sum + t.position_size, 0);
      console.log(`Total Open Positions: ${openTrades.length}`);
      console.log(`Capital at Risk: $${openValue.toFixed(2)}\n`);

      openTrades.forEach(trade => {
        console.log(`• ${trade.contract?.question?.substring(0, 50)}...`);
        console.log(`  Category: ${trade.contract?.category} | Side: ${trade.side} | Size: $${trade.position_size.toFixed(2)}`);
      });
      console.log('');
    }

    console.log('✅ Analysis complete!\n');

    return res.status(200).json({
      success: true,
      summary: {
        totalTrades: allTrades.length,
        resolvedTrades: resolvedTrades.length,
        openTrades: openTrades.length,
        totalPnL,
        roi,
        annualizedReturn,
        winRate,
      },
      categories: categoriesByPnL,
    });

  } catch (error: any) {
    console.error('❌ Analyzer failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
