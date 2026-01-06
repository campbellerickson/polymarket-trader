import { env } from '../../config/env';
import { AnalysisRequest, AnalysisResponse, Contract } from '../../types';
import { TRADING_SYSTEM_PROMPT } from './prompts';
import { buildHistoricalContext } from './learning';

// Vercel AI Gateway (OpenAI-compatible API)
// Docs: https://vercel.com/docs/ai-gateway/openai-compat
const VERCEL_AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

export async function analyzeContracts(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  console.log(`🤖 Analyzing ${request.contracts.length} contracts with AI (via Vercel AI Gateway)...`);

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

  // Call Vercel AI Gateway
  const response = await fetch(VERCEL_AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.VERCEL_AI_GATEWAY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // AI Gateway supports model IDs like 'anthropic/claude-sonnet-4'
      model: 'anthropic/claude-sonnet-4',
      max_tokens: 4000,
      messages: [
        { role: 'system', content: TRADING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vercel AI Gateway error: ${response.status} ${response.statusText} - ${errorText}`);
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

  return parsed;
}

function buildAnalysisPrompt(request: AnalysisRequest, historicalContext: string): string {
  const contractsList = request.contracts.map((c, i) => `
${i + 1}. Market ID: ${c.market_id}
   Question: ${c.question}
   Current Odds: ${(c.current_odds * 100).toFixed(2)}%
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

AVAILABLE CONTRACTS:
${contractsList}

Analyze these contracts and select exactly 3 contracts to allocate exactly $${request.dailyBudget} across.

Remember:
- Select up to 3 contracts (1-3).
- Total allocation must be <= $${request.dailyBudget}.
- Minimum $20 per contract, maximum $50 per contract.
- Diversify across uncorrelated events.
- Consider historical patterns from above.
- Higher conviction contracts get larger allocations.
`.trim();
}

function parseAIResponse(text: string, contracts: Contract[], dailyBudget: number): AnalysisResponse {
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
        allocation: Math.min(Math.max(sc.allocation, 20), 50), // Clamp between 20-50
        confidence: Math.min(Math.max(sc.confidence, 0), 1), // Clamp between 0-1
        reasoning: sc.reasoning || 'No reasoning provided',
        riskFactors: sc.risk_factors || [],
      };
    });

    // Allow 0-3 selections (0 means "no trade today")
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

    return {
      selectedContracts,
      totalAllocated: selectedContracts.reduce((sum: number, sc: any) => sum + sc.allocation, 0),
      strategyNotes: parsed.strategy_notes || 'No strategy notes',
    };
  } catch (error: any) {
    console.error('Failed to parse AI response:', error);
    console.error('Response text:', text);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

