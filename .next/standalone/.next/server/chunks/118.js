"use strict";exports.id=118,exports.ids=[118],exports.modules={3365:(e,t,n)=>{n.d(t,{U:()=>a});let a={DAILY_BUDGET:Number(process.env.DAILY_BUDGET)||100,MIN_ODDS:Number(process.env.MIN_ODDS)||.85,MAX_ODDS:Number(process.env.MAX_ODDS)||.98,MAX_DAYS_TO_RESOLUTION:Number(process.env.MAX_DAYS_TO_RESOLUTION)||2,MIN_LIQUIDITY:Number(process.env.MIN_LIQUIDITY)||2e3,INITIAL_BANKROLL:Number(process.env.INITIAL_BANKROLL)||100,DRY_RUN:"true"===process.env.DRY_RUN,MIN_POSITION_SIZE:20,MAX_POSITION_SIZE:50,STOP_LOSS_THRESHOLD:.8,MIN_HOLD_TIME_HOURS:1,MAX_SLIPPAGE_PCT:.05,MAX_LOSSES_IN_STREAK:5,MAX_STOP_LOSSES_24H:3,BANKROLL_DROP_THRESHOLD:.7,EXCLUDE_CATEGORIES:[],EXCLUDE_KEYWORDS:[]}},1836:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{X:()=>l});var o=n(8159),r=n(1674),s=n(4777),i=e([o,s]);async function l(e){if(console.log(`🤖 Analyzing ${e.contracts.length} contracts with AI (via Vercel AI Gateway)...`),0===e.contracts.length)return{selectedContracts:[],totalAllocated:0,strategyNotes:"No qualifying contracts found today."};let t=await (0,s.T)(),n=function(e,t){let n=e.contracts.map((e,t)=>`
${t+1}. Market ID: ${e.market_id}
   Question: ${e.question}
   Current Odds: ${(100*e.current_odds).toFixed(2)}%
   Days to Resolution: ${Math.ceil((e.end_date.getTime()-Date.now())/864e5)}
   Liquidity: $${e.liquidity.toFixed(2)}
   Volume (24h): $${(e.volume_24h||0).toFixed(2)}
`).join("\n");return`
${t}

CURRENT SITUATION:
- Bankroll: $${e.currentBankroll.toFixed(2)}
- Daily Budget: $${e.dailyBudget}
- Contracts Available: ${e.contracts.length}

AVAILABLE CONTRACTS:
${n}

Analyze these contracts and select exactly 3 contracts to allocate exactly $${e.dailyBudget} across.

Remember:
- Select up to 3 contracts (1-3).
- Total allocation must be <= $${e.dailyBudget}.
- Minimum $20 per contract, maximum $50 per contract.
- Diversify across uncorrelated events.
- Consider historical patterns from above.
- Higher conviction contracts get larger allocations.
`.trim()}(e,t),a=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${o.O.VERCEL_AI_GATEWAY_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"anthropic/claude-sonnet-4",max_tokens:4e3,messages:[{role:"system",content:r.a},{role:"user",content:n}]})});if(!a.ok){let e=await a.text();throw Error(`Vercel AI Gateway error: ${a.status} ${a.statusText} - ${e}`)}let i=await a.json(),l=i?.choices?.[0]?.message?.content??i?.choices?.[0]?.text??("string"==typeof i?i:"");if(!l||0===l.trim().length)throw Error(`Unexpected response format from Vercel AI Gateway: ${JSON.stringify(i).substring(0,500)}`);let c=function(e,t,n){let a=e,o=e.match(/```json\s*([\s\S]*?)\s*```/)||e.match(/\{[\s\S]*\}/);o&&(a=o[1]||o[0]);try{let e=JSON.parse(a),o=(Array.isArray(e.selected_contracts)?e.selected_contracts:[]).map(e=>{let n=t.find(t=>t.market_id===e.market_id);if(!n)throw Error(`Contract not found: ${e.market_id}`);return{contract:n,allocation:Math.min(Math.max(e.allocation,20),50),confidence:Math.min(Math.max(e.confidence,0),1),reasoning:e.reasoning||"No reasoning provided",riskFactors:e.risk_factors||[]}});o.length>3&&(o=o.slice(0,3));let r=o.reduce((e,t)=>e+t.allocation,0);if(r>n&&r>0){let e=n/r,t=(o=o.map(t=>({...t,allocation:Math.round(t.allocation*e*100)/100}))).reduce((e,t)=>e+t.allocation,0);t>n&&o.length>0&&(o[o.length-1].allocation-=t-n,o[o.length-1].allocation=Math.max(0,Math.round(100*o[o.length-1].allocation)/100))}return{selectedContracts:o,totalAllocated:o.reduce((e,t)=>e+t.allocation,0),strategyNotes:e.strategy_notes||"No strategy notes"}}catch(t){throw console.error("Failed to parse AI response:",t),console.error("Response text:",e),Error(`Failed to parse AI response: ${t.message}`)}}(l,e.contracts,e.dailyBudget);return console.log(`   ✅ AI selected ${c.selectedContracts.length} contracts`),console.log(`   💰 Total allocation: $${c.totalAllocated.toFixed(2)}`),c}[o,s]=i.then?(await i)():i,a()}catch(e){a(e)}})},4777:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{T:()=>s});var o=n(3435),r=e([o]);async function s(){let e=(await (0,o.lv)(100)).filter(e=>"open"!==e.status);if(0===e.length)return"No historical trades yet. This is a fresh start.";let t=0===e.length?0:e.filter(e=>"won"===e.status).length/e.length,n=i(e),a=e.reduce((e,t)=>e+(t.pnl||0),0),r=e.filter(e=>"won"===e.status),s=e.filter(e=>"lost"===e.status||"stopped"===e.status),c=function(e,t){let n=[],a=t.filter(e=>e.ai_confidence>=.9),o=a.filter(e=>"won"===e.status);a.length>0&&n.push({pattern:"Very High Confidence (≥90%)",winRate:o.length/a.length,avgROI:i(o),example:o[0]?.ai_reasoning?.substring(0,80)});let r=t.filter(e=>e.ai_confidence>=.85&&e.ai_confidence<.9),s=r.filter(e=>"won"===e.status);r.length>0&&n.push({pattern:"High Confidence (85-90%)",winRate:s.length/r.length,avgROI:i(s),example:s[0]?.ai_reasoning?.substring(0,80)});let l=t.filter(e=>{let t=e.contract?.end_date?new Date(e.contract.end_date):null;return!!t&&(t.getTime()-new Date(e.executed_at).getTime())/864e5<=1}),c=l.filter(e=>"won"===e.status);l.length>0&&n.push({pattern:"Short-term Contracts (≤1 day to resolution)",winRate:c.length/l.length,avgROI:i(c),example:c[0]?.contract?.question?.substring(0,80)});let d=t.filter(e=>e.entry_odds>=.92),u=d.filter(e=>"won"===e.status);return d.length>0&&n.push({pattern:"Very High Entry Odds (≥92%)",winRate:u.length/d.length,avgROI:i(u),example:u[0]?.ai_reasoning?.substring(0,80)}),n.sort((e,t)=>t.winRate-e.winRate)}(0,e),d=function(e){let t=[];if(0===e.length)return t;let n=e.filter(e=>e.ai_confidence>=.9);n.length>0&&t.push({pattern:"Overconfident Trades (≥90% confidence that lost)",count:n.length,totalLoss:n.reduce((e,t)=>e+Math.abs(t.pnl||0),0),avgLoss:n.reduce((e,t)=>e+Math.abs(t.pnl||0),0)/n.length,example:n[0]?.ai_reasoning?.substring(0,80)});let a=e.filter(e=>{let t=e.contract?.end_date?new Date(e.contract.end_date):null;return!!t&&(t.getTime()-new Date(e.executed_at).getTime())/864e5>1.5});a.length>0&&t.push({pattern:"Longer-term Contracts (>1.5 days) that Lost",count:a.length,totalLoss:a.reduce((e,t)=>e+Math.abs(t.pnl||0),0),avgLoss:a.reduce((e,t)=>e+Math.abs(t.pnl||0),0)/a.length,example:a[0]?.ai_reasoning?.substring(0,80)});let o=e.filter(e=>"stopped"===e.status);o.length>0&&t.push({pattern:"Stop Loss Triggered",count:o.length,totalLoss:o.reduce((e,t)=>e+Math.abs(t.pnl||0),0),avgLoss:o.reduce((e,t)=>e+Math.abs(t.pnl||0),0)/o.length,example:o[0]?.ai_reasoning?.substring(0,80)});let r=e.filter(e=>e.entry_odds>=.85&&e.entry_odds<.92);return r.length>0&&t.push({pattern:"Mid-range Odds (85-92%) that Lost",count:r.length,totalLoss:r.reduce((e,t)=>e+Math.abs(t.pnl||0),0),avgLoss:r.reduce((e,t)=>e+Math.abs(t.pnl||0),0)/r.length,example:r[0]?.ai_reasoning?.substring(0,80)}),t.sort((e,t)=>t.totalLoss-e.totalLoss)}(s),u=function(e){let t=new Map;return e.forEach(e=>{let n=e.contract?.question||"Unknown",a="Other";n.toLowerCase().includes("election")||n.toLowerCase().includes("vote")?a="Elections/Politics":n.toLowerCase().includes("earnings")||n.toLowerCase().includes("stock")?a="Earnings/Stocks":n.toLowerCase().includes("data")||n.toLowerCase().includes("release")?a="Data Releases":n.toLowerCase().includes("deadline")||n.toLowerCase().includes("date")?a="Time-based":(n.toLowerCase().includes("approval")||n.toLowerCase().includes("approve"))&&(a="Approval/Regulatory"),t.has(a)||t.set(a,{wins:0,losses:0});let o=t.get(a);"won"===e.status?o.wins++:("lost"===e.status||"stopped"===e.status)&&o.losses++}),Array.from(t.entries()).map(([e,t])=>({type:e,wins:t.wins,losses:t.losses,winRate:t.wins+t.losses>0?t.wins/(t.wins+t.losses):0})).sort((e,t)=>t.wins+t.losses-(e.wins+e.losses))}(e),h=[{min:.9,max:1,label:"90-100%"},{min:.85,max:.9,label:"85-90%"},{min:.8,max:.85,label:"80-85%"},{min:.7,max:.8,label:"70-80%"}].map(t=>{let n=e.filter(e=>e.ai_confidence>=t.min&&e.ai_confidence<t.max),a=n.filter(e=>"won"===e.status),o=n.filter(e=>"lost"===e.status||"stopped"===e.status);return{range:t.label,wins:a.length,losses:o.length,winRate:n.length>0?a.length/n.length:0,avgROI:i(n)}}),g=function(e){if(0===e.length)return"";let t=e.map(e=>{let t="won"===e.status?"✅ WIN":"lost"===e.status?"❌ LOSS":"⚠️ STOPPED",n=e.pnl?e.pnl>=0?`+$${e.pnl.toFixed(2)}`:`-$${Math.abs(e.pnl).toFixed(2)}`:"N/A",a=e.pnl&&e.position_size?`${(e.pnl/e.position_size*100).toFixed(1)}%`:"N/A",o=`${(100*e.ai_confidence).toFixed(0)}%`,r=new Date(e.executed_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}),s=e.contract?.question||"N/A",i=e.ai_reasoning||"No reasoning recorded";return`
${t} | ${r} | Confidence: ${o} | P&L: ${n} (${a})
Contract: ${s.substring(0,80)}${s.length>80?"...":""}
Your Reasoning: ${i.substring(0,150)}${i.length>150?"...":""}
Entry Odds: ${(100*e.entry_odds).toFixed(1)}% | Size: $${e.position_size.toFixed(2)}
---`}).join("\n");return`
RECENT TRADE HISTORY (Last ${e.length} trades - learn from these):
${t}

`}(e.slice(0,30));return`
HISTORICAL PERFORMANCE SUMMARY (Last ${e.length} resolved trades):
- Win Rate: ${(100*t).toFixed(1)}% (${r.length} wins, ${s.length} losses)
- Average ROI: ${(100*n).toFixed(2)}%
- Total P&L: $${a.toFixed(2)}
- Average Win: $${r.length>0?(r.reduce((e,t)=>e+(t.pnl||0),0)/r.length).toFixed(2):"0.00"}
- Average Loss: $${s.length>0?(s.reduce((e,t)=>e+Math.abs(t.pnl||0),0)/s.length).toFixed(2):"0.00"}

${g}

WINNING PATTERNS (REPEAT THESE):
${c.map(e=>`- ${e.pattern}: ${(100*e.winRate).toFixed(1)}% win rate, avg ROI ${(100*e.avgROI).toFixed(1)}%`).join("\n")}
${c.length>0?"\nKey Success Factors:\n"+c.slice(0,3).map(e=>`  • ${e.example||e.pattern}`).join("\n"):""}

LOSING PATTERNS (AVOID THESE):
${d.map(e=>`- ${e.pattern}: ${e.count} losses, total loss $${Math.abs(e.totalLoss).toFixed(2)}, avg loss $${Math.abs(e.avgLoss).toFixed(2)}`).join("\n")}
${d.length>0?"\nCommon Mistakes:\n"+d.slice(0,3).map(e=>`  • ${e.example||e.pattern}`).join("\n"):""}

CONTRACT TYPE PERFORMANCE:
${u.map(e=>`- ${e.type}: ${e.wins}W/${e.losses}L (${(100*e.winRate).toFixed(1)}% win rate)`).join("\n")}

CONFIDENCE LEVEL ANALYSIS:
${h.map(e=>`- ${e.range}: ${e.wins}W/${e.losses}L (${(100*e.winRate).toFixed(1)}% win rate, ${e.wins>0||e.losses>0?`avg ROI ${(100*e.avgROI).toFixed(1)}%`:"N/A"})`).join("\n")}

LESSONS LEARNED:
${(function(e,t){let n=[];if(e.length>0&&t.length>0){let a=e.reduce((e,t)=>e+t.ai_confidence,0)/e.length,o=t.reduce((e,t)=>e+t.ai_confidence,0)/t.length;a<o&&n.push('Lower confidence trades actually performed better - be more cautious with "sure things"');let r=e.map(e=>{let t=e.contract?.end_date?new Date(e.contract.end_date):null;return t?(t.getTime()-new Date(e.executed_at).getTime())/864e5:null}).filter(e=>null!==e),s=t.map(e=>{let t=e.contract?.end_date?new Date(e.contract.end_date):null;return t?(t.getTime()-new Date(e.executed_at).getTime())/864e5:null}).filter(e=>null!==e);if(r.length>0&&s.length>0){let e=r.reduce((e,t)=>e+t,0)/r.length,t=s.reduce((e,t)=>e+t,0)/s.length;e<t&&n.push(`Shorter-term contracts (avg ${e.toFixed(1)} days) performed better than longer-term (avg ${t.toFixed(1)} days)`)}}let a=l(e.map(e=>e.ai_reasoning||"").join(" ")),o=l(t.map(e=>e.ai_reasoning||"").join(" ")),r=a.filter(e=>!o.includes(e));return r.length>0&&n.push(`Winning trades often mentioned: ${r.slice(0,3).join(", ")}`),0===n.length&&n.push("Continue to be conservative and focus on high-probability, low-variance contracts"),n.map((e,t)=>`${t+1}. ${e}`).join("\n")})(r,s)}
  `.trim()}function i(e){if(0===e.length)return 0;let t=e.filter(e=>null!==e.pnl&&e.position_size>0);return 0===t.length?0:t.reduce((e,t)=>e+t.pnl/t.position_size,0)/t.length}function l(e){let t=e.toLowerCase();return["clear","objective","deadline","scheduled","guaranteed","certain","volatile","unpredictable","surprise","uncertain","risk","black swan"].filter(e=>t.includes(e))}o=(r.then?(await r)():r)[0],a()}catch(e){a(e)}})},1674:(e,t,n)=>{n.d(t,{a:()=>a});let a=`
You are an expert Kalshi trader analyzing high-probability, low-variance contracts.

Your goal: Select up to 3 best contracts from the provided list and allocate up to $100 total across them.

CRITICAL EXCLUSION RULES - AVOID THESE AT ALL COSTS:

1. HIGH-VARIABILITY EVENTS
   - AVOID contracts involving:
     * Human behavior predictions (voting patterns, consumer sentiment shifts)
     * Weather-dependent outcomes (unless very short-term and stable)
     * Celebrity/entertainment industry events
     * Social media metrics or viral trends
     * Unpredictable market movements
   - REASON: High variance leads to unexpected losses even at 85%+ odds

3. BLACK SWAN POTENTIAL
   - REJECT contracts with:
     * Binary political events (elections, legislation votes) unless extremely short-term
     * Surprise announcement potential (regulatory, policy, corporate)
     * Geopolitical events (unless clearly defined and time-bound)
     * Market crashes or systemic shocks
     * "Surprise" or "unexpected" event language in the question
   - REASON: Even 90%+ odds can fail catastrophically with black swan events

PREFERRED CONTRACT TYPES (Low Variance, Predictable):

1. TIME-BASED EVENTS
   - Contract expiration dates
   - Scheduled releases (product launches with fixed dates)
   - Calendar-based outcomes (holidays, deadlines)

2. DATA RELEASES (High Reliability)
   - Economic indicators with scheduled release dates
   - Corporate earnings announcements (if date is certain)
   - Census or official statistics releases
   - NOTE: Only if release date is guaranteed and objective

3. TECHNICAL OUTCOMES
   - Infrastructure completion dates (with clear criteria)
   - Software/system milestones (if objectively measurable)
   - Certification or approval processes (if timeline is defined)

4. STRUCTURED PROCESSES
   - Legal filing deadlines
   - Regulatory review periods
   - Scheduled meetings or hearings (with clear outcomes)

ANALYSIS FRAMEWORK:

1. CONTRACT QUALITY
   - Is the resolution criteria 100% objective and unambiguous?
   - Is there ZERO room for interpretation or dispute?
   - Is the outcome determined by a single, verifiable data source?
   - What's the time to resolution? (prefer <24h, but quality > speed)

2. VARIANCE ASSESSMENT
   - Could this outcome be affected by human error or bias?
   - Is there potential for last-minute changes or cancellations?
   - Could weather, accidents, or random events derail this?
   - Is the resolution mechanism completely outside our control?
   - AVOID if answer to any is "yes"

3. BLACK SWAN PROTECTION
   - What's the worst-case scenario? Could it happen?
   - Is there any information asymmetry that could hurt us?
   - Could someone "game" or manipulate this outcome?
   - Are there correlated risks with other positions?
   - If any red flags, PASS immediately

4. ODDS VALIDATION
   - Why is the market pricing this at 85-98% vs 100%?
   - Is the remaining uncertainty justified, or are we missing something?
   - If odds are "too good to be true," they probably are
   - Markets are usually efficient - if it's 95%, there's a 5% reason

5. HISTORICAL LEARNING (CRITICAL - LEARN FROM YOUR PAST)
   You will receive detailed historical trade data including:
   - Individual trade results (✅ WIN / ❌ LOSS / ⚠️ STOPPED) with your previous reasoning
   - Winning patterns and what worked (repeat these!)
   - Losing patterns and what failed (avoid these!)
   - Contract type performance analysis
   - Confidence level accuracy analysis
   - Specific lessons learned from your mistakes
   
   USE THIS DATA TO:
   - Identify contracts similar to your past winners - FAVOR THESE
   - Avoid contracts similar to your past losers - REJECT THESE
   - Adjust your confidence based on historical accuracy (if 90% confidence trades keep losing, lower your confidence)
   - Learn from your reasoning mistakes (if certain reasoning led to losses, avoid that logic)
   - Adapt your strategy based on what actually worked vs what you thought would work
   
   CRITICAL: If a contract type or characteristic consistently lost money in your history, DO NOT select similar contracts even if they look good on paper.
   CRITICAL: If a contract type or characteristic consistently won, PREFER similar contracts.

6. POSITION SIZING
   Allocate up to $100 across up to 3 contracts:
   - Higher conviction = larger allocation (up to $50)
   - Diversify across completely uncorrelated events
   - Minimum $20 per contract (don't over-diversify)
   - Maximum $50 per contract (preserve capital)
   - If you can't find 2-3 truly high-quality contracts, select 1 and allocate less

RESPONSE FORMAT (JSON):
{
  "selected_contracts": [
    {
      "market_id": "string",
      "allocation": number,
      "confidence": 0-1,
      "reasoning": "2-3 sentences explaining why this is LOW-VARIANCE and SAFE",
      "risk_factors": ["factor1", "factor2"]
    }
  ],
  "total_allocated": number,
  "strategy_notes": "Brief summary of today's conservative approach"
}

CRITICAL MANDATES:
- CONSERVATIVE > AGGRESSIVE. Missing a trade is better than taking a bad one.
- QUALITY > QUANTITY. One excellent contract beats three mediocre ones.
- STABILITY > OPPORTUNITY. Avoid anything that could surprise you.
- If uncertain, PASS. You can always trade tomorrow.
- Weather-dependent and unpredictable human behavior events are risky. Avoid them unless very confident.
- Black swans are rare but catastrophic. Be paranoid about them.
- Markets are efficient. If something seems off, it is.

Remember: Your goal is steady, predictable returns, not high-risk gambles. Every contract should be so clear and objective that resolution is never in doubt.
`},8231:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{O:()=>i});var o=n(1309),r=n(8159),s=e([o,r]);[o,r]=s.then?(await s)():s;let i=(0,o.createClient)(r.O.SUPABASE_URL,r.O.SUPABASE_KEY);a()}catch(e){a(e)}})},3435:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{$r:()=>l,FC:()=>m,Jg:()=>u,Of:()=>f,Pq:()=>c,Xb:()=>d,Xx:()=>p,dY:()=>g,fT:()=>y,lv:()=>i,mo:()=>s,sl:()=>h,zC:()=>_});var o=n(8231),r=e([o]);async function s(){let{data:e,error:t}=await o.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).eq("status","open").order("executed_at",{ascending:!1});if(t)throw t;return e}async function i(e=50){let{data:t,error:n}=await o.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).order("executed_at",{ascending:!1}).limit(e);if(n)throw n;return t}async function l(){let e=new Date;e.setHours(0,0,0,0);let{data:t,error:n}=await o.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).gte("executed_at",e.toISOString()).order("executed_at",{ascending:!1});if(n)throw n;return t}async function c(e,t){let{data:n,error:a}=await o.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).gte("executed_at",e.toISOString()).lte("executed_at",t.toISOString()).order("executed_at",{ascending:!1});if(a)throw a;return n}async function d(e){let{data:t,error:n}=await o.O.from("trades").insert({...e,status:"open",executed_at:new Date().toISOString()}).select(`
      *,
      contract:contracts(*)
    `).single();if(n)throw n;return t}async function u(e,t){let{data:n,error:a}=await o.O.from("trades").update(t).eq("id",e).select(`
      *,
      contract:contracts(*)
    `).single();if(a)throw a;return n}async function h(){return(await s()).map(e=>({trade:e,current_odds:e.entry_odds,unrealized_pnl:0,unrealized_pnl_pct:0}))}async function g(){let{data:e}=await o.O.from("performance_metrics").select("bankroll").order("date",{ascending:!1}).limit(1).single();return e?.bankroll||Number(process.env.INITIAL_BANKROLL)||1e3}async function m(){return Number(process.env.INITIAL_BANKROLL)||1e3}async function p(e){let{data:t}=await o.O.from("performance_metrics").select("bankroll").lte("date",e.toISOString()).order("date",{ascending:!1}).limit(1).single();return t?.bankroll||Number(process.env.INITIAL_BANKROLL)||1e3}async function f(){let e=await g(),t=(await h()).reduce((e,t)=>e+t.trade.position_size,0);return e-t}async function y(){let{data:e,error:t}=await o.O.from("notification_preferences").select("*").eq("user_id","default").single();if(t&&"PGRST116"!==t.code)throw t;return e||{enabled:!1}}async function _(e){let t=new Date(Date.now()-36e5*e),{data:n,error:a}=await o.O.from("stop_loss_events").select(`
      *,
      trade:trades(
        *,
        contract:contracts(*)
      )
    `).gte("executed_at",t.toISOString()).order("executed_at",{ascending:!1});if(a)throw a;return n}o=(r.then?(await r)():r)[0],a()}catch(e){a(e)}})},5526:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{A0:()=>c,US:()=>i});var o=n(8231),r=n(913),s=e([o,r]);async function i(){let e=new Date(Date.now()-72e5),{data:t,error:n}=await o.O.from("contracts").select("*").gte("discovered_at",e.toISOString()).eq("resolved",!1).order("discovered_at",{ascending:!1});return n?(console.error("Error fetching cached markets:",n),[]):t&&0!==t.length?t.map(e=>({market_id:e.market_id,question:e.question,end_date:new Date(e.end_date),yes_odds:parseFloat(e.current_odds.toString()),no_odds:1-parseFloat(e.current_odds.toString()),liquidity:parseFloat(e.liquidity?.toString()||"0"),volume_24h:parseFloat(e.volume_24h?.toString()||"0"),resolved:e.resolved||!1,category:e.category||void 0,outcome:e.outcome||void 0,final_odds:e.final_odds?parseFloat(e.final_odds.toString()):void 0,resolved_at:e.resolved_at?new Date(e.resolved_at):void 0})):[]}async function l(e){if(0===e.length)return;console.log(`💾 Caching ${e.length} markets to database...`);let t=e.map(e=>({market_id:e.market_id,question:e.question,end_date:e.end_date.toISOString(),current_odds:e.yes_odds,category:e.category||null,liquidity:e.liquidity||0,volume_24h:e.volume_24h||0,resolved:e.resolved||!1,outcome:e.outcome||null,final_odds:e.final_odds||null,resolved_at:e.resolved_at?.toISOString()||null,discovered_at:new Date().toISOString()}));for(let e=0;e<t.length;e+=100){let n=t.slice(e,e+100),{error:a}=await o.O.from("contracts").upsert(n,{onConflict:"market_id",ignoreDuplicates:!1});a?console.error(`Error caching markets chunk ${e/100+1}:`,a):console.log(`   ✅ Cached chunk ${e/100+1}/${Math.ceil(t.length/100)} (${n.length} markets)`)}console.log(`✅ Cached ${e.length} markets successfully`)}async function c(e){console.log("\uD83D\uDD04 Refreshing market page...",e?`(cursor: ${e.substring(0,20)}...)`:"(first page)");let t=(0,r.DZ)();try{let n=await t.getMarkets(100,e||void 0,void 0,void 0,void 0,void 0,void 0,void 0,void 0,void 0,"open",void 0,void 0),a=n.data.markets||[],o=n.data.cursor||null,s=a.map(e=>{let t;let n=(0,r.TN)(e);try{t=new Date(e.expiration_time||e.expirationTime||e.end_date),isNaN(t.getTime())&&(t=new Date(Date.now()+6048e5))}catch(e){t=new Date(Date.now()+6048e5)}return{market_id:e.ticker||e.market_id||e.id,question:e.title||e.question||e.subtitle||"N/A",end_date:t,yes_odds:null!==n?n/100:0,no_odds:null!==n?(100-n)/100:0,liquidity:0,volume_24h:parseFloat(e.volume||e.volume_24h||0),resolved:"closed"===e.status||"resolved"===e.status,category:e.category||void 0,outcome:e.result?"yes"===e.result?"YES":"NO":void 0,final_odds:e.result_price?parseFloat(e.result_price)/100:void 0,resolved_at:e.settlement_time?new Date(e.settlement_time):void 0}});return await l(s),console.log(`   ✅ Cached ${s.length} markets. Next cursor: ${o?"yes":"no"}`),{markets:s,nextCursor:o,isComplete:!o||0===a.length}}catch(n){if(n.response?.status===429){let e=n.response.headers["retry-after"],t=e?1e3*parseInt(e):5e3;throw Error(`Rate limited. Wait ${t}ms`)}if(n.message?.startsWith("RATE_LIMITED:")){let e=parseInt(n.message.split(":")[1]);throw Error(`Rate limited. Wait ${e}ms`)}let e=n.response?.data?.error?.message||n.message||"Unknown error",t=n.response?.status||500;throw Error(`Kalshi API error: ${t} - ${e}`)}}[o,r]=s.then?(await s)():s,a()}catch(e){a(e)}})},7372:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{w:()=>l});var o=n(913),r=n(5526),s=n(3365),i=e([o,r]);async function l(e={minOdds:s.U.MIN_ODDS,maxOdds:s.U.MAX_ODDS,maxDaysToResolution:s.U.MAX_DAYS_TO_RESOLUTION,minLiquidity:s.U.MIN_LIQUIDITY,excludeCategories:s.U.EXCLUDE_CATEGORIES,excludeKeywords:s.U.EXCLUDE_KEYWORDS}){console.log("\uD83D\uDD0D Scanning Kalshi for high-conviction contracts..."),console.log(`   Criteria: ${100*e.minOdds}%-${100*e.maxOdds}% odds, <${e.maxDaysToResolution} days, >$${e.minLiquidity} liquidity`);let t=await (0,r.US)();if(console.log(`   ✅ Retrieved ${t.length} markets from cache`),0===t.length)return console.warn("⚠️ No cached markets found. Market refresh cron may not have run yet."),[];let n=[];for(let a of t){if(!a.yes_odds||0===a.yes_odds||null===a.yes_odds)continue;let t=100*a.yes_odds,r=t>=100*e.minOdds,s=t<=(1-e.maxOdds)*100;if(!r&&!s)continue;let i=(0,o.YI)(a.end_date);if(i>e.maxDaysToResolution||i<0||a.resolved||a.category&&e.excludeCategories?.includes(a.category))continue;let l=a.question.toLowerCase();(e.excludeKeywords||[]).map(e=>e.toLowerCase()).some(e=>l.includes(e))||n.push(a)}console.log(`   📊 Found ${n.length} high-conviction candidates after filtering`);let a=[],i=[];for(let t=0;t<n.length;t++){let r=n[t];try{let{liquidity:s,side:i}=await (0,o.Z9)(r.market_id);if(s<e.minLiquidity)continue;let l={id:"",market_id:r.market_id,question:r.question,end_date:r.end_date,current_odds:r.yes_odds,liquidity:s,volume_24h:r.volume_24h,category:r.category,discovered_at:new Date};a.push(l),((t+1)%10==0||t+1===n.length)&&console.log(`   📈 Enriched ${t+1}/${n.length} candidates... (${a.length} passed liquidity filter)`)}catch(e){i.push(`${r.market_id}: ${e.message}`);continue}}return i.length>0&&(console.warn(`   ⚠️ ${i.length} markets failed enrichment (likely resolved or inactive)`),i.length<=5&&i.forEach(e=>console.warn(`      ${e}`))),a.sort((e,t)=>(t.liquidity||0)-(e.liquidity||0)),console.log(`   ✅ Found ${a.length} qualifying contracts with sufficient liquidity`),a}[o,r]=i.then?(await i)():i,a()}catch(e){a(e)}})}};