import { env } from '../../config/env';
import { AnalysisRequest, AnalysisResponse, Contract } from '../../types';
import { TRADING_SYSTEM_PROMPT } from './prompts';
import { buildHistoricalContext } from './learning';

const VERCEL_AI_GATEWAY_URL = 'https://api.vercel.ai/v1/messages';

export async function analyzeContracts(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  console.log(`🤖 Analyzing ${request.contracts.length} contracts with AI (via Vercel AI Gateway)...`);

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
      model: 'anthropic/claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: TRADING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vercel AI Gateway error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data: any = await response.json();
  
  // Parse response - Vercel AI Gateway returns Anthropic-compatible format
  // Response can be in different formats depending on gateway configuration
  let text: string;
  
  if (data.content && Array.isArray(data.content) && data.content[0]) {
    // Anthropic format: { content: [{ type: 'text', text: '...' }] }
    const content: any = data.content[0];
    text = content.text || content.content || '';
  } else if (data.text) {
    // Direct text format
    text = data.text;
  } else if (typeof data === 'string') {
    // String response
    text = data;
  } else {
    // Try to extract from nested structure
    text = JSON.stringify(data);
    console.warn('Unexpected response format, attempting to parse:', JSON.stringify(data).substring(0, 200));
  }
  
  if (!text || text.trim().length === 0) {
    throw new Error(`Unexpected response format from Vercel AI Gateway: ${JSON.stringify(data).substring(0, 500)}`);
  }

  const parsed = parseAIResponse(text, request.contracts);
  
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
- You must select exactly 3 contracts.
- Total allocation must equal $${request.dailyBudget}.
- Minimum $30 per contract, maximum $40 per contract.
- Diversify across uncorrelated events.
- Consider historical patterns from above.
- Higher conviction contracts get larger allocations.
`.trim();
}

function parseAIResponse(text: string, contracts: Contract[]): AnalysisResponse {
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
    let selectedContracts = parsed.selected_contracts.map((sc: any) => {
      const contract = contracts.find(c => c.market_id === sc.market_id);
      if (!contract) {
        throw new Error(`Contract not found: ${sc.market_id}`);
      }
      
      return {
        contract,
        allocation: Math.min(Math.max(sc.allocation, 30), 40), // Clamp between 30-40
        confidence: Math.min(Math.max(sc.confidence, 0), 1), // Clamp between 0-1
        reasoning: sc.reasoning || 'No reasoning provided',
        riskFactors: sc.risk_factors || [],
      };
    });

    // Ensure exactly 3 contracts
    if (selectedContracts.length !== 3) {
      throw new Error(`AI must select exactly 3 contracts, got ${selectedContracts.length}`);
    }
    
    // Normalize allocations to sum to exactly dailyBudget
    const totalAllocated = selectedContracts.reduce((sum: number, sc: any) => sum + sc.allocation, 0);
    if (Math.abs(totalAllocated - request.dailyBudget) > 0.01) {
      const scale = request.dailyBudget / totalAllocated;
      selectedContracts = selectedContracts.map((sc: any) => ({
        ...sc,
        allocation: Math.round(sc.allocation * scale * 100) / 100,
      }));
      // Adjust last contract to ensure exact total
      const adjustedTotal = selectedContracts.reduce((sum: number, sc: any) => sum + sc.allocation, 0);
      selectedContracts[selectedContracts.length - 1].allocation += (request.dailyBudget - adjustedTotal);
      selectedContracts[selectedContracts.length - 1].allocation = Math.round(selectedContracts[selectedContracts.length - 1].allocation * 100) / 100;
    }

    return {
      selectedContracts,
      totalAllocated: request.dailyBudget,
      strategyNotes: parsed.strategy_notes || 'No strategy notes',
    };
  } catch (error: any) {
    console.error('Failed to parse AI response:', error);
    console.error('Response text:', text);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

