import { env } from '../../config/env';
import { AnalysisRequest, AnalysisResponse, Contract } from '../../types';
import { TRADING_SYSTEM_PROMPT } from './prompts';
import { buildHistoricalContext } from './learning';
import { saveAIDecision } from '../database/queries';

// OpenAI API
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function analyzeContracts(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  console.log(`🤖 Analyzing ${request.contracts.length} contracts with AI (GPT-5.2 - superior reasoning & context)...`);

  if (request.contracts.length === 0) {
    return {
      selectedContracts: [],
      totalAllocated: 0,
      strategyNotes: `No qualifying contracts found today.`,
    };
  }

  // Build historical context
  const historicalContext = await buildHistoricalContext();

  // Build prompt
  const prompt = buildAnalysisPrompt(request, historicalContext);

  // Call OpenAI API directly
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.2', // GPT-5.2 - most advanced model with superior reasoning and context
      max_completion_tokens: 8000, // GPT-5.2 uses max_completion_tokens
      temperature: 0.7, // Balanced creativity
      messages: [
        { role: 'system', content: TRADING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: any = await response.json();

  // Parse OpenAI-compatible response: { choices: [{ message: { content: "..." } }] }
  const text: string =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    (typeof data === 'string' ? data : '');
  
  if (!text || text.trim().length === 0) {
    throw new Error(`Unexpected response format from Vercel AI Gateway: ${JSON.stringify(data).substring(0, 500)}`);
  }

  const parsed = parseAIResponse(text, request.contracts, request.dailyBudget);

  console.log(`   ✅ AI selected ${parsed.selectedContracts.length} contracts`);
  console.log(`   💰 Total allocation: $${parsed.totalAllocated.toFixed(2)}`);

  // Log ALL AI decisions (selected + rejected) to database
  await logAIDecisions(request.contracts, parsed, text);

  return parsed;
}

function buildAnalysisPrompt(request: AnalysisRequest, historicalContext: string): string {
  const contractsList = request.contracts.map((c, i) => `
${i + 1}. Market ID: ${c.market_id}
   Question: ${c.question}
   Yes Odds: ${(c.yes_odds * 100).toFixed(2)}%, No Odds: ${((c.no_odds || (1 - c.yes_odds)) * 100).toFixed(2)}%
   Days to Resolution: ${Math.ceil((c.end_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
   Liquidity: $${c.liquidity.toFixed(2)}
   Volume (24h): $${(c.volume_24h || 0).toFixed(2)}
`).join('\n');

  return `
${historicalContext}

CURRENT SITUATION:
- Bankroll: $${request.currentBankroll.toFixed(2)}
- Daily Budget: $${request.dailyBudget}
- Contracts Available: ${request.contracts.length}

AVAILABLE CONTRACTS (Pre-filtered to 85-95% odds, good liquidity, <2 days to resolution):
${contractsList}

RESEARCH each contract deeply and SELECT THE BEST 1-3 opportunities to trade.

YOUR TASK:
1. RESEARCH each contract thoroughly (understand the actual event, teams, polls, factors)
2. ANALYZE the odds (is market pricing fair or is there edge based on research?)
3. CONSIDER exit timing (when does it resolve? Can we exit early with profit?)
4. IDENTIFY specific risks (what could go wrong? How likely?)
5. COMPARE all contracts and RANK them (which are BEST?)
6. SELECT the top 1-3 contracts with best risk/reward

IMPORTANT: For EVERY contract (both selected AND rejected), provide detailed reasoning.

Return JSON in this format:
{
  "selected_contracts": [
    {
      "market_id": "...",
      "allocation": 35,
      "confidence": 0.92,
      "reasoning": "RESEARCH-BASED: [What you researched] [What edge you found] [Exit timing] [Why this is BETTER than other options]",
      "risk_factors": ["Specific risk 1", "Specific risk 2"]
    }
  ],
  "rejected_contracts": [
    {
      "market_id": "...",
      "reasoning": "Why you didn't select this - be specific about research findings or why other contracts were better"
    }
  ],
  "strategy_notes": "Summary of research findings and rationale for your selections"
}

Guidelines:
- SELECT 1-3 of the BEST contracts presented (your job is to pick winners, not pass on everything)
- RESEARCH each contract - understand the actual event, not just the numbers
- Daily budget: $${request.dailyBudget} - use what makes sense, prefer smaller distributed positions
- Position sizing: $20-50 per contract (KEEP SIZES SMALL - prefer $25-35)
  * Best opportunity: $30-50 (rarely use $50, prefer $30-40)
  * Good opportunity: $25-35
  * Acceptable opportunity: $20-25
  * Default: $25-30 per contract
- COMPARE contracts - which have best combination of edge, timing, lower risk?
- EXIT TIMING - consider opportunities to exit early if odds move 2-3% in our favor
- Some risk is OK and expected - focus on finding the BEST risk/reward available
- BE SPECIFIC in reasoning - what research did you do? What edge did you find?
- Use historical learning - favor contract types that worked, avoid types that failed
`.trim();
}

function parseAIResponse(text: string, contracts: Contract[], dailyBudget: number): AnalysisResponse & { rejectedContracts?: any[], rawResponse?: any } {
  // Try to extract JSON from the response
  let jsonText = text;

  // Look for JSON block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[1] || jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonText);

    // Map market_ids to contracts
    const selectedRaw: any[] = Array.isArray(parsed.selected_contracts) ? parsed.selected_contracts : [];
    let selectedContracts = selectedRaw.map((sc: any) => {
      const contract = contracts.find(c => c.market_id === sc.market_id);
      if (!contract) {
        throw new Error(`Contract not found: ${sc.market_id}`);
      }

      return {
        contract,
        allocation: Math.min(Math.max(sc.allocation, 20), 50), // Clamp between 20-50 (new active trading range)
        confidence: Math.min(Math.max(sc.confidence, 0), 1), // Clamp between 0-1
        reasoning: sc.reasoning || 'No reasoning provided',
        riskFactors: sc.risk_factors || [],
      };
    });

    // Allow 1-3 selections (active trading approach - AI should pick best opportunities)
    // Cap at 3 to maintain focus and risk management
    if (selectedContracts.length > 3) {
      selectedContracts = selectedContracts.slice(0, 3);
    }

    // Normalize allocations to sum to exactly dailyBudget
    const totalAllocated = selectedContracts.reduce((sum: number, sc: any) => sum + sc.allocation, 0);
    // If AI over-allocates, scale down to fit dailyBudget. Otherwise allow under-allocation.
    if (totalAllocated > dailyBudget && totalAllocated > 0) {
      const scale = dailyBudget / totalAllocated;
      selectedContracts = selectedContracts.map((sc: any) => ({
        ...sc,
        allocation: Math.round(sc.allocation * scale * 100) / 100,
      }));
      // Adjust last contract to ensure <= dailyBudget (avoid tiny rounding overflow)
      const adjustedTotal = selectedContracts.reduce((sum: number, sc: any) => sum + sc.allocation, 0);
      if (adjustedTotal > dailyBudget && selectedContracts.length > 0) {
        selectedContracts[selectedContracts.length - 1].allocation -= (adjustedTotal - dailyBudget);
        selectedContracts[selectedContracts.length - 1].allocation = Math.max(
          0,
          Math.round(selectedContracts[selectedContracts.length - 1].allocation * 100) / 100
        );
      }
    }

    // Extract rejected contracts with reasoning
    const rejectedRaw: any[] = Array.isArray(parsed.rejected_contracts) ? parsed.rejected_contracts : [];
    const rejectedContracts = rejectedRaw.map((rc: any) => {
      const contract = contracts.find(c => c.market_id === rc.market_id);
      return {
        contract,
        reasoning: rc.reasoning || 'No rejection reasoning provided',
      };
    });

    return {
      selectedContracts,
      totalAllocated: selectedContracts.reduce((sum: number, sc: any) => sum + sc.allocation, 0),
      strategyNotes: parsed.strategy_notes || 'No strategy notes',
      rejectedContracts,
      rawResponse: parsed,
    };
  } catch (error: any) {
    console.error('Failed to parse AI response:', error);
    console.error('Response text:', text);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

/**
 * Log ALL AI decisions (both selected and rejected contracts) to database
 */
async function logAIDecisions(
  allContracts: Contract[],
  analysis: AnalysisResponse & { rejectedContracts?: any[], rawResponse?: any },
  rawAIResponse: string
): Promise<void> {
  try {
    // Log selected contracts
    for (const selection of analysis.selectedContracts) {
      await saveAIDecision({
        trade_id: undefined, // Will be filled in when trade is executed
        contract_snapshot: selection.contract,
        features_analyzed: {
          yes_odds: selection.contract.yes_odds,
          no_odds: selection.contract.no_odds,
          liquidity: selection.contract.liquidity,
          volume_24h: selection.contract.volume_24h,
          days_to_resolution: Math.ceil((selection.contract.end_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        },
        decision_factors: {
          selected: true,
          reasoning: selection.reasoning,
          ai_full_response: rawAIResponse.substring(0, 2000), // Store first 2000 chars
        },
        confidence_score: selection.confidence,
        allocated_amount: selection.allocation,
        risk_factors: selection.riskFactors,
        reasoning: selection.reasoning,
      });
    }

    // Log rejected contracts
    const rejectedContracts = analysis.rejectedContracts || [];
    for (const rejection of rejectedContracts) {
      if (!rejection.contract) continue; // Skip if contract not found

      await saveAIDecision({
        trade_id: undefined, // No trade for rejected
        contract_snapshot: rejection.contract,
        features_analyzed: {
          yes_odds: rejection.contract.yes_odds,
          no_odds: rejection.contract.no_odds,
          liquidity: rejection.contract.liquidity,
          volume_24h: rejection.contract.volume_24h,
          days_to_resolution: Math.ceil((rejection.contract.end_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        },
        decision_factors: {
          selected: false,
          reasoning: rejection.reasoning,
          ai_full_response: rawAIResponse.substring(0, 2000),
        },
        confidence_score: 0,
        allocated_amount: 0,
        risk_factors: [],
        reasoning: `REJECTED: ${rejection.reasoning}`,
      });
    }

    console.log(`   📝 Logged ${analysis.selectedContracts.length} selected + ${rejectedContracts.length} rejected decisions`);
  } catch (error) {
    console.error('Error logging AI decisions:', error);
    // Don't throw - logging shouldn't break the trading flow
  }
}

