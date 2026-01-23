import { getRecentTrades, getRecentLosses } from '../database/queries';
import { Trade } from '../../types';

export async function buildHistoricalContext(): Promise<string> {
  const recentTrades = await getRecentTrades(100); // Get more trades for better learning
  const resolvedTrades = recentTrades.filter(t => t.status !== 'open');
  
  if (resolvedTrades.length === 0) {
    return 'No historical trades yet. This is a fresh start.';
  }

  // Overall statistics
  const winRate = calculateWinRate(resolvedTrades);
  const avgROI = calculateAvgROI(resolvedTrades);
  const totalPnL = calculateTotalPnL(resolvedTrades);
  
  // Detailed analysis
  const winningTrades = resolvedTrades.filter(t => t.status === 'won' || t.status === 'take_profit');
  const losingTrades = resolvedTrades.filter(t => t.status === 'lost' || t.status === 'stopped');
  
  // Analyze patterns
  const winningPatterns = analyzeWinningTrades(winningTrades, resolvedTrades);
  const losingPatterns = analyzeLosingTrades(losingTrades);
  const contractTypePerformance = analyzeContractTypes(resolvedTrades);
  const confidencePerformance = analyzeConfidenceLevels(resolvedTrades);
  
  // Build detailed trade history with reasoning
  const recentTradeHistory = buildTradeHistorySection(resolvedTrades.slice(0, 30)); // Last 30 trades
  
  return `
HISTORICAL PERFORMANCE SUMMARY (Last ${resolvedTrades.length} resolved trades):
- Win Rate: ${(winRate * 100).toFixed(1)}% (${winningTrades.length} wins, ${losingTrades.length} losses)
- Average ROI: ${(avgROI * 100).toFixed(2)}%
- Total P&L: $${totalPnL.toFixed(2)}
- Average Win: $${winningTrades.length > 0 ? (winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length).toFixed(2) : '0.00'}
- Average Loss: $${losingTrades.length > 0 ? (losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / losingTrades.length).toFixed(2) : '0.00'}

${recentTradeHistory}

WINNING PATTERNS (REPEAT THESE):
${winningPatterns.map(p => `- ${p.pattern}: ${(p.winRate * 100).toFixed(1)}% win rate, avg ROI ${(p.avgROI * 100).toFixed(1)}%`).join('\n')}
${winningPatterns.length > 0 ? '\nKey Success Factors:\n' + winningPatterns.slice(0, 3).map(p => `  • ${p.example || p.pattern}`).join('\n') : ''}

LOSING PATTERNS (AVOID THESE):
${losingPatterns.map(p => `- ${p.pattern}: ${p.count} losses, total loss $${Math.abs(p.totalLoss).toFixed(2)}, avg loss $${Math.abs(p.avgLoss).toFixed(2)}`).join('\n')}
${losingPatterns.length > 0 ? '\nCommon Mistakes:\n' + losingPatterns.slice(0, 3).map(p => `  • ${p.example || p.pattern}`).join('\n') : ''}

CONTRACT TYPE PERFORMANCE:
${contractTypePerformance.map(ct => `- ${ct.type}: ${ct.wins}W/${ct.losses}L (${(ct.winRate * 100).toFixed(1)}% win rate)`).join('\n')}

CONFIDENCE LEVEL ANALYSIS:
${confidencePerformance.map(cp => `- ${cp.range}: ${cp.wins}W/${cp.losses}L (${(cp.winRate * 100).toFixed(1)}% win rate, ${cp.wins > 0 || cp.losses > 0 ? `avg ROI ${(cp.avgROI * 100).toFixed(1)}%` : 'N/A'})`).join('\n')}

LESSONS LEARNED:
${generateLessonsLearned(winningTrades, losingTrades)}
  `.trim();
}

function buildTradeHistorySection(trades: Trade[]): string {
  if (trades.length === 0) return '';

  const historyItems = trades.map(trade => {
    const status = trade.status === 'won' ? '✅ WIN' : trade.status === 'lost' ? '❌ LOSS' : '⚠️ STOPPED';
    const pnl = trade.pnl ? (trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`) : 'N/A';
    const roi = trade.pnl && trade.position_size ? `${((trade.pnl / trade.position_size) * 100).toFixed(1)}%` : 'N/A';
    const confidence = `${(trade.ai_confidence * 100).toFixed(0)}%`;
    const date = new Date(trade.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const question = trade.contract?.question || 'N/A';
    const reasoning = trade.ai_reasoning || 'No reasoning recorded';
    
    return `
${status} | ${date} | Confidence: ${confidence} | P&L: ${pnl} (${roi})
Contract: ${question.substring(0, 80)}${question.length > 80 ? '...' : ''}
Your Reasoning: ${reasoning.substring(0, 150)}${reasoning.length > 150 ? '...' : ''}
Entry Odds: ${(trade.entry_odds * 100).toFixed(1)}% | Size: $${trade.position_size.toFixed(2)}
---`;
  }).join('\n');

  return `\nRECENT TRADE HISTORY (Last ${trades.length} trades - learn from these):
${historyItems}

`;
}

function calculateWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter(t => t.status === 'won' || t.status === 'take_profit').length;
  return wins / trades.length;
}

function calculateAvgROI(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const validTrades = trades.filter(t => t.pnl !== null && t.position_size > 0);
  if (validTrades.length === 0) return 0;
  
  const totalROI = validTrades.reduce((sum, t) => {
    return sum + (t.pnl! / t.position_size);
  }, 0);
  return totalROI / validTrades.length;
}

function calculateTotalPnL(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
}

function analyzeWinningTrades(winners: Trade[], allTrades: Trade[]): Array<{ 
  pattern: string; 
  winRate: number; 
  avgROI: number;
  example?: string;
}> {
  const patterns: Array<{ pattern: string; winRate: number; avgROI: number; example?: string }> = [];
  
  // By confidence level
  const highConf = allTrades.filter(t => t.ai_confidence >= 0.90);
  const highConfWins = highConf.filter(t => t.status === 'won');
  if (highConf.length > 0) {
    patterns.push({
      pattern: 'Very High Confidence (≥90%)',
      winRate: highConfWins.length / highConf.length,
      avgROI: calculateAvgROI(highConfWins),
      example: highConfWins[0]?.ai_reasoning?.substring(0, 80),
    });
  }

  const midHighConf = allTrades.filter(t => t.ai_confidence >= 0.85 && t.ai_confidence < 0.90);
  const midHighConfWins = midHighConf.filter(t => t.status === 'won');
  if (midHighConf.length > 0) {
    patterns.push({
      pattern: 'High Confidence (85-90%)',
      winRate: midHighConfWins.length / midHighConf.length,
      avgROI: calculateAvgROI(midHighConfWins),
      example: midHighConfWins[0]?.ai_reasoning?.substring(0, 80),
    });
  }

  // By contract characteristics
  const shortTerm = allTrades.filter(t => {
    const endDate = t.contract?.end_date ? new Date(t.contract.end_date) : null;
    if (!endDate) return false;
    const daysToRes = (endDate.getTime() - new Date(t.executed_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysToRes <= 1;
  });
  const shortTermWins = shortTerm.filter(t => t.status === 'won');
  if (shortTerm.length > 0) {
    patterns.push({
      pattern: 'Short-term Contracts (≤1 day to resolution)',
      winRate: shortTermWins.length / shortTerm.length,
      avgROI: calculateAvgROI(shortTermWins),
      example: shortTermWins[0]?.contract?.question?.substring(0, 80),
    });
  }

  // By entry odds
  const highOdds = allTrades.filter(t => t.entry_odds >= 0.92);
  const highOddsWins = highOdds.filter(t => t.status === 'won');
  if (highOdds.length > 0) {
    patterns.push({
      pattern: 'Very High Entry Odds (≥92%)',
      winRate: highOddsWins.length / highOdds.length,
      avgROI: calculateAvgROI(highOddsWins),
      example: highOddsWins[0]?.ai_reasoning?.substring(0, 80),
    });
  }

  return patterns.sort((a, b) => b.winRate - a.winRate);
}

function analyzeLosingTrades(losers: Trade[]): Array<{ 
  pattern: string; 
  count: number;
  totalLoss: number;
  avgLoss: number;
  example?: string;
}> {
  const patterns: Array<{ pattern: string; count: number; totalLoss: number; avgLoss: number; example?: string }> = [];
  
  if (losers.length === 0) return patterns;

  // By confidence level (overconfidence)
  const overconfident = losers.filter(t => t.ai_confidence >= 0.90);
  if (overconfident.length > 0) {
    patterns.push({
      pattern: 'Overconfident Trades (≥90% confidence that lost)',
      count: overconfident.length,
      totalLoss: overconfident.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0),
      avgLoss: overconfident.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / overconfident.length,
      example: overconfident[0]?.ai_reasoning?.substring(0, 80),
    });
  }

  // Long-term contracts that lost
  const longTerm = losers.filter(t => {
    const endDate = t.contract?.end_date ? new Date(t.contract.end_date) : null;
    if (!endDate) return false;
    const daysToRes = (endDate.getTime() - new Date(t.executed_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysToRes > 1.5;
  });
  if (longTerm.length > 0) {
    patterns.push({
      pattern: 'Longer-term Contracts (>1.5 days) that Lost',
      count: longTerm.length,
      totalLoss: longTerm.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0),
      avgLoss: longTerm.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / longTerm.length,
      example: longTerm[0]?.ai_reasoning?.substring(0, 80),
    });
  }

  // Stop losses
  const stopped = losers.filter(t => t.status === 'stopped');
  if (stopped.length > 0) {
    patterns.push({
      pattern: 'Stop Loss Triggered',
      count: stopped.length,
      totalLoss: stopped.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0),
      avgLoss: stopped.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / stopped.length,
      example: stopped[0]?.ai_reasoning?.substring(0, 80),
    });
  }

  // Mid-range odds that lost
  const midOdds = losers.filter(t => t.entry_odds >= 0.85 && t.entry_odds < 0.92);
  if (midOdds.length > 0) {
    patterns.push({
      pattern: 'Mid-range Odds (85-92%) that Lost',
      count: midOdds.length,
      totalLoss: midOdds.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0),
      avgLoss: midOdds.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / midOdds.length,
      example: midOdds[0]?.ai_reasoning?.substring(0, 80),
    });
  }

  return patterns.sort((a, b) => b.totalLoss - a.totalLoss);
}

function analyzeContractTypes(trades: Trade[]): Array<{ 
  type: string; 
  wins: number; 
  losses: number; 
  winRate: number;
}> {
  const typeMap = new Map<string, { wins: number; losses: number }>();
  
  trades.forEach(trade => {
    const question = trade.contract?.question || 'Unknown';
    
    // Extract contract type from question keywords
    let type = 'Other';
    if (question.toLowerCase().includes('election') || question.toLowerCase().includes('vote')) {
      type = 'Elections/Politics';
    } else if (question.toLowerCase().includes('earnings') || question.toLowerCase().includes('stock')) {
      type = 'Earnings/Stocks';
    } else if (question.toLowerCase().includes('data') || question.toLowerCase().includes('release')) {
      type = 'Data Releases';
    } else if (question.toLowerCase().includes('deadline') || question.toLowerCase().includes('date')) {
      type = 'Time-based';
    } else if (question.toLowerCase().includes('approval') || question.toLowerCase().includes('approve')) {
      type = 'Approval/Regulatory';
    }
    
    if (!typeMap.has(type)) {
      typeMap.set(type, { wins: 0, losses: 0 });
    }
    
    const stats = typeMap.get(type)!;
    if (trade.status === 'won') {
      stats.wins++;
    } else if (trade.status === 'lost' || trade.status === 'stopped') {
      stats.losses++;
    }
  });
  
  return Array.from(typeMap.entries()).map(([type, stats]) => ({
    type,
    wins: stats.wins,
    losses: stats.losses,
    winRate: (stats.wins + stats.losses) > 0 ? stats.wins / (stats.wins + stats.losses) : 0,
  })).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
}

function analyzeConfidenceLevels(trades: Trade[]): Array<{ 
  range: string; 
  wins: number; 
  losses: number; 
  winRate: number;
  avgROI: number;
}> {
  const ranges = [
    { min: 0.90, max: 1.0, label: '90-100%' },
    { min: 0.85, max: 0.90, label: '85-90%' },
    { min: 0.80, max: 0.85, label: '80-85%' },
    { min: 0.70, max: 0.80, label: '70-80%' },
  ];
  
  return ranges.map(range => {
    const inRange = trades.filter(t => t.ai_confidence >= range.min && t.ai_confidence < range.max);
    const wins = inRange.filter(t => t.status === 'won');
    const losses = inRange.filter(t => t.status === 'lost' || t.status === 'stopped');
    
    return {
      range: range.label,
      wins: wins.length,
      losses: losses.length,
      winRate: inRange.length > 0 ? wins.length / inRange.length : 0,
      avgROI: calculateAvgROI(inRange),
    };
  });
}

function generateLessonsLearned(winners: Trade[], losers: Trade[]): string {
  const lessons: string[] = [];
  
  if (winners.length > 0 && losers.length > 0) {
    // Compare winning vs losing reasoning patterns
    const avgWinnerConfidence = winners.reduce((sum, t) => sum + t.ai_confidence, 0) / winners.length;
    const avgLoserConfidence = losers.reduce((sum, t) => sum + t.ai_confidence, 0) / losers.length;
    
    if (avgWinnerConfidence < avgLoserConfidence) {
      lessons.push('Lower confidence trades actually performed better - be more cautious with "sure things"');
    }
    
    // Time to resolution
    const winnerAvgDays = winners.map(t => {
      const endDate = t.contract?.end_date ? new Date(t.contract.end_date) : null;
      if (!endDate) return null;
      return (endDate.getTime() - new Date(t.executed_at).getTime()) / (1000 * 60 * 60 * 24);
    }).filter(d => d !== null) as number[];
    
    const loserAvgDays = losers.map(t => {
      const endDate = t.contract?.end_date ? new Date(t.contract.end_date) : null;
      if (!endDate) return null;
      return (endDate.getTime() - new Date(t.executed_at).getTime()) / (1000 * 60 * 60 * 24);
    }).filter(d => d !== null) as number[];
    
    if (winnerAvgDays.length > 0 && loserAvgDays.length > 0) {
      const winnerAvg = winnerAvgDays.reduce((a, b) => a + b, 0) / winnerAvgDays.length;
      const loserAvg = loserAvgDays.reduce((a, b) => a + b, 0) / loserAvgDays.length;
      if (winnerAvg < loserAvg) {
        lessons.push(`Shorter-term contracts (avg ${winnerAvg.toFixed(1)} days) performed better than longer-term (avg ${loserAvg.toFixed(1)} days)`);
      }
    }
  }
  
  // Analyze reasoning keywords
  const winningKeywords = extractKeywords(winners.map(t => t.ai_reasoning || '').join(' '));
  const losingKeywords = extractKeywords(losers.map(t => t.ai_reasoning || '').join(' '));
  
  const uniqueWinningKeywords = winningKeywords.filter(k => !losingKeywords.includes(k));
  if (uniqueWinningKeywords.length > 0) {
    lessons.push(`Winning trades often mentioned: ${uniqueWinningKeywords.slice(0, 3).join(', ')}`);
  }
  
  if (lessons.length === 0) {
    lessons.push('Continue to be conservative and focus on high-probability, low-variance contracts');
  }
  
  return lessons.map((l, i) => `${i + 1}. ${l}`).join('\n');
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - look for important trading terms
  const keywords = [
    'clear', 'objective', 'deadline', 'scheduled', 'guaranteed', 'certain',
    'volatile', 'unpredictable', 'surprise', 'uncertain', 'risk', 'black swan',
  ];
  
  const lowerText = text.toLowerCase();
  return keywords.filter(k => lowerText.includes(k));
}
