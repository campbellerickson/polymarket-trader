"use strict";(()=>{var e={};e.id=22,e.ids=[22],e.modules={358:e=>{e.exports=require("kalshi-typescript")},145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},1309:e=>{e.exports=import("@supabase/supabase-js")},9926:e=>{e.exports=import("zod")},1406:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.r(t),o.d(t,{config:()=>c,default:()=>l,routeModule:()=>u});var s=o(1802),i=o(7153),n=o(6249),r=o(2271),d=e([r]);r=(d.then?(await d)():d)[0];let l=(0,n.l)(r,"default"),c=(0,n.l)(r,"config"),u=new s.PagesAPIRouteModule({definition:{kind:i.x.PAGES_API,page:"/api/cron/daily-scan",pathname:"/api/cron/daily-scan",bundlePath:"",filename:""},userland:r});a()}catch(e){a(e)}})},8318:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.d(t,{z:()=>l});var s=o(913),i=o(3435),n=o(7565),r=o(3365),d=e([s,i]);async function l(e){console.log(`💰 Executing ${e.selectedContracts.length} trades...`);let t=[];for(let o of e.selectedContracts)try{console.log(`   Executing: ${o.contract.question.substring(0,50)}...`),console.log(`   Allocation: $${o.allocation}, Confidence: ${(100*o.confidence).toFixed(1)}%`);let e=await (0,s.up)(o.contract.market_id),a=(0,n.l)(o.allocation,o.contract.current_odds),d=await (0,s.s1)({market:o.contract.market_id,side:"YES",amount:a,price:e.bestYesAsk||o.contract.current_odds});r.U.DRY_RUN?console.log("   \uD83E\uDDEA DRY RUN: Trade simulated"):console.log(`   ✅ Order placed: ${d.id}`);let l=await (0,i.Xb)({contract_id:o.contract.id||"",entry_odds:o.contract.current_odds,position_size:o.allocation,side:"YES",contracts_purchased:a,ai_confidence:o.confidence,ai_reasoning:o.reasoning,risk_factors:o.riskFactors&&o.riskFactors.length>0?o.riskFactors:void 0});t.push({success:!0,trade:l})}catch(e){console.error(`   ❌ Failed to execute trade:`,e.message),t.push({success:!1,error:e.message,contract:o.contract})}return console.log(`   ✅ Executed ${t.filter(e=>e.success).length}/${t.length} trades`),t}[s,i]=d.then?(await d)():d,a()}catch(e){a(e)}})},3412:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.d(t,{J:()=>r});var s=o(913),i=o(3435),n=e([s,i]);async function r(){console.log("\uD83D\uDD0D Checking for resolved trades...");let e=await (0,i.mo)();for(let t of(console.log(`   Found ${e.length} open trades`),e))try{let e=await (0,s.YK)(t.contract.market_id);if(e.resolved&&e.outcome){let o=e.outcome===t.side,a="won"===t.status?1*t.contracts_purchased-t.position_size:-t.position_size;await (0,i.Jg)(t.id,{status:o?"won":"lost",exit_odds:e.final_odds||e.yes_odds,pnl:a,resolved_at:e.resolved_at||new Date}),console.log(`${o?"✅ WON":"❌ LOST"}: ${t.contract.question.substring(0,50)}... | P&L: $${a.toFixed(2)}`)}}catch(e){console.error(`   ⚠️ Error checking trade ${t.id}:`,e.message)}}[s,i]=n.then?(await n)():n,a()}catch(e){a(e)}})},8946:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.d(t,{C:()=>n,P:()=>r});var s=o(9572),i=e([s]);async function n(e,t,o){console.log("\uD83D\uDCE7 Email (log only):",t),console.log(`   Would send to: ${e}`);let a=o.replace(/<[^>]*>/g,"").substring(0,200);console.log(`   Preview: ${a}...`)}async function r(e,t){let o=t.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9",a=`${o} Daily Report: ${t.mtdPnL>=0?"+":""}$${t.mtdPnL.toFixed(2)} MTD`;(0,s.$m)(t),console.log("\uD83D\uDCE7 Daily Report Email (log only):"),console.log(`   Subject: ${a}`),console.log(`   Would send to: ${e}`),console.log(`   MTD P&L: $${t.mtdPnL.toFixed(2)}`),console.log(`   YTD P&L: $${t.ytdPnL.toFixed(2)}`),console.log(`   Total Liquidity: $${t.totalLiquidity.toFixed(2)}`)}s=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},9572:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.d(t,{$m:()=>l,Ij:()=>r,yb:()=>d});var s=o(3435),i=o(913),n=e([s,i]);async function r(){let e=new Date;e.setHours(0,0,0,0);let t=new Date(e.getFullYear(),e.getMonth(),1),o=new Date(e.getFullYear(),0,1),a=await (0,s.$r)(),n=a.reduce((e,t)=>e+t.position_size,0),r=await (0,s.sl)(),d=[],l=0;for(let e of r)try{let t=await (0,i.YK)(e.trade.contract.market_id),o="YES"===e.trade.side?t.yes_odds:t.no_odds,a=e.trade.contracts_purchased*o,s=a-e.trade.position_size,n=s/e.trade.position_size*100;d.push({...e,current_odds:o,unrealized_pnl:s,unrealized_pnl_pct:n}),l+=a}catch(t){l+=e.trade.position_size}let c=await (0,s.Of)(),u=c+l,g=(await (0,s.Pq)(t,e)).filter(e=>"open"!==e.status),p=g.reduce((e,t)=>e+(t.pnl||0),0),$=g.filter(e=>"won"===e.status).length,m=g.length>0?$/g.length:0,h=await (0,s.Xx)(t),v=(await (0,s.Pq)(o,e)).filter(e=>"open"!==e.status),y=v.reduce((e,t)=>e+(t.pnl||0),0),_=v.filter(e=>"won"===e.status).length,D=v.length>0?_/v.length:0,x=await (0,s.FC)();return{reportDate:e,tradesExecuted:a,totalInvested:n,openPositions:d,openPositionsValue:l,cashBalance:c,totalLiquidity:u,mtdPnL:p,mtdReturnPct:h>0?p/h*100:0,mtdWinRate:m,mtdTrades:g.length,ytdPnL:y,ytdReturnPct:x>0?y/x*100:0,ytdWinRate:D,ytdTrades:v.length,currentBankroll:u,initialBankroll:x}}function d(e){let t=e.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9";return`
${t} Kalshi Daily Report - ${e.reportDate.toLocaleDateString()}

💰 LIQUIDITY
Cash: $${e.cashBalance.toFixed(2)}
Invested: $${e.openPositionsValue.toFixed(2)}
Total: $${e.totalLiquidity.toFixed(2)}

📊 TODAY'S ACTIVITY
Trades: ${e.tradesExecuted.length}
Invested: $${e.totalInvested.toFixed(2)}
${e.tradesExecuted.map(e=>`• ${u(e.contract.question,40)} - $${e.position_size.toFixed(0)} @ ${(100*e.entry_odds).toFixed(1)}%`).join("\n")}

📅 MTD PERFORMANCE
P&L: ${c(e.mtdPnL)}
Return: ${e.mtdReturnPct>=0?"+":""}${e.mtdReturnPct.toFixed(2)}%
Win Rate: ${(100*e.mtdWinRate).toFixed(1)}% (${e.mtdTrades} trades)

📆 YTD PERFORMANCE
P&L: ${c(e.ytdPnL)}
Return: ${e.ytdReturnPct>=0?"+":""}${e.ytdReturnPct.toFixed(2)}%
Win Rate: ${(100*e.ytdWinRate).toFixed(1)}% (${e.ytdTrades} trades)

🎯 OPEN POSITIONS: ${e.openPositions.length}
${e.openPositions.slice(0,3).map(e=>`• ${u(e.trade.contract.question,35)} - $${e.trade.position_size.toFixed(0)}`).join("\n")}${e.openPositions.length>3?`
...+${e.openPositions.length-3} more`:""}
  `.trim()}function l(e){let t=e.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9",o=e.mtdPnL>=0?"#10b981":"#ef4444",a=e.ytdPnL>=0?"#10b981":"#ef4444";return`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .section { background: #f8fafc; padding: 20px; margin: 10px 0; border-radius: 8px; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .trade-item { padding: 10px; margin: 5px 0; background: white; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${t} Kalshi Daily Report</h1>
      <p>${e.reportDate.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
    </div>
    
    <div class="section">
      <h2>💰 Current Liquidity</h2>
      <div class="metric">
        <div class="metric-label">Cash Balance</div>
        <div class="metric-value">$${e.cashBalance.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Invested</div>
        <div class="metric-value">$${e.openPositionsValue.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Liquidity</div>
        <div class="metric-value">$${e.totalLiquidity.toFixed(2)}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📊 Today's Activity</h2>
      <p><strong>${e.tradesExecuted.length} trades executed</strong> • $${e.totalInvested.toFixed(2)} invested</p>
      ${e.tradesExecuted.map(e=>`
        <div class="trade-item">
          <strong>${e.contract.question}</strong><br/>
          $${e.position_size.toFixed(2)} @ ${(100*e.entry_odds).toFixed(1)}% odds
          <span style="color: #64748b;">• Confidence: ${(100*e.ai_confidence).toFixed(0)}%</span><br/>
          <small style="color: #64748b;">${e.ai_reasoning}</small>
        </div>
      `).join("")}
      ${0===e.tradesExecuted.length?'<p style="color: #64748b;">No trades executed today</p>':""}
    </div>
    
    <div class="section">
      <h2>📅 Month-to-Date Performance</h2>
      <div class="metric">
        <div class="metric-label">P&L</div>
        <div class="metric-value" style="color: ${o};">
          ${e.mtdPnL>=0?"+":""}$${e.mtdPnL.toFixed(2)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Return</div>
        <div class="metric-value" style="color: ${o};">
          ${e.mtdReturnPct>=0?"+":""}${e.mtdReturnPct.toFixed(2)}%
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${(100*e.mtdWinRate).toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${e.mtdTrades}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📆 Year-to-Date Performance</h2>
      <div class="metric">
        <div class="metric-label">P&L</div>
        <div class="metric-value" style="color: ${a};">
          ${e.ytdPnL>=0?"+":""}$${e.ytdPnL.toFixed(2)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Return</div>
        <div class="metric-value" style="color: ${a};">
          ${e.ytdReturnPct>=0?"+":""}${e.ytdReturnPct.toFixed(2)}%
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${(100*e.ytdWinRate).toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${e.ytdTrades}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>🎯 Open Positions (${e.openPositions.length})</h2>
      ${e.openPositions.map(e=>{let t=e.unrealized_pnl,o=e.unrealized_pnl_pct;return`
        <div class="trade-item">
          <strong>${e.trade.contract.question}</strong><br/>
          Entry: $${e.trade.position_size.toFixed(2)} @ ${(100*e.trade.entry_odds).toFixed(1)}%
          • Current: ${(100*e.current_odds).toFixed(1)}%<br/>
          Unrealized P&L: <span style="color: ${t>=0?"#10b981":"#ef4444"};">
            ${t>=0?"+":""}$${t.toFixed(2)} (${o>=0?"+":""}${o.toFixed(1)}%)
          </span><br/>
          <small style="color: #64748b;">Resolves: ${new Date(e.trade.contract.end_date).toLocaleDateString()}</small>
        </div>
        `}).join("")}
      ${0===e.openPositions.length?'<p style="color: #64748b;">No open positions</p>':""}
    </div>
    
    <div class="footer">
      <p>Automated Kalshi Trading System</p>
    </div>
  </div>
</body>
</html>
  `.trim()}function c(e){return`${e>=0?"+":""}$${e.toFixed(2)}`}function u(e,t){return e.length>t?e.substring(0,t-3)+"...":e}[s,i]=n.then?(await n)():n,a()}catch(e){a(e)}})},9802:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.d(t,{sendSMS:()=>n,u:()=>r});var s=o(9572),i=e([s]);async function n(e,t){console.log("\uD83D\uDCF1 SMS (log only):",t),console.log(`   Would send to: ${e}`)}async function r(e,t){let o=(0,s.yb)(t);console.log("\uD83D\uDCF1 Daily Report SMS (log only):"),console.log(o),console.log(`   Would send to: ${e}`)}s=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},4799:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.d(t,{A:()=>m,d:()=>c});var s=o(3435),i=o(913),n=o(8231),r=o(9802),d=o(3365),l=e([s,i,n,r]);async function c(){console.log("\uD83D\uDEE1️ Checking stop loss conditions...");let e=await g();if(!e.enabled)return console.log("⏸️ Stop loss monitoring disabled"),{triggered:0,candidates:[],events:[]};let t=await (0,s.mo)();console.log(`📊 Monitoring ${t.length} open positions`);let o=[],a=[];for(let s of t)try{let t=await (0,i.YK)(s.contract.market_id),n="YES"===s.side?t.yes_odds:t.no_odds,r=s.contracts_purchased*n-s.position_size,d=r/s.position_size*100,l=(Date.now()-new Date(s.executed_at).getTime())/36e5,c=n<e.triggerThreshold&&l>=e.minHoldTimeHours,g={trade:s,currentOdds:n,entryOdds:s.entry_odds,unrealizedLoss:r,unrealizedLossPct:d,holdTimeHours:l,shouldTrigger:c,reason:c?`Odds dropped from ${(100*s.entry_odds).toFixed(1)}% to ${(100*n).toFixed(1)}%`:"Not triggered"};if(o.push(g),c){console.log(`🚨 STOP LOSS TRIGGERED: ${s.contract.question.substring(0,50)}...`),console.log(`   Entry: ${(100*s.entry_odds).toFixed(1)}% → Current: ${(100*n).toFixed(1)}%`),console.log(`   Unrealized Loss: $${r.toFixed(2)} (${d.toFixed(1)}%)`);let t=await u(s,n,g.reason,e);t.success&&t.event&&a.push(t.event)}}catch(e){console.error(`   ⚠️ Error checking trade ${s.id}:`,e.message)}if(console.log(`
📊 Stop Loss Summary:`),console.log(`   Total positions: ${t.length}`),console.log(`   Below threshold: ${o.filter(t=>t.currentOdds<e.triggerThreshold).length}`),console.log(`   Triggered: ${a.length}`),a.length>0){let e=a.reduce((e,t)=>e+t.realized_loss,0);console.log(`   Total realized loss: $${e.toFixed(2)}`),await $(a)}return{triggered:a.length,candidates:o,events:a}}async function u(e,t,o,a){try{let n=await (0,i.up)(e.contract.market_id),r="YES"===e.side?n.bestYesBid:n.bestNoBid,d=Math.abs(r-t)/t;if(d>a.maxSlippagePct)return console.log(`⚠️ Slippage too high (${(100*d).toFixed(2)}%), skipping`),{success:!1,error:`Slippage ${(100*d).toFixed(2)}% exceeds max ${(100*a.maxSlippagePct).toFixed(2)}%`};await (0,i.s1)({market:e.contract.market_id,side:"YES"===e.side?"SELL_YES":"SELL_NO",amount:e.contracts_purchased,price:r});let l=e.contracts_purchased*r-e.position_size;await (0,s.Jg)(e.id,{status:"stopped",exit_odds:r,pnl:l,resolved_at:new Date});let c=await p({trade_id:e.id,trigger_odds:a.triggerThreshold,exit_odds:r,position_size:e.position_size,realized_loss:l,reason:o});return console.log(`✅ Stop loss executed:`),console.log(`   Sold ${e.contracts_purchased} contracts @ ${(100*r).toFixed(1)}%`),console.log(`   Realized loss: $${l.toFixed(2)}`),{success:!0,event:c}}catch(e){return console.error(`❌ Failed to execute stop loss:`,e.message),{success:!1,error:e.message}}}async function g(){let{data:e,error:t}=await n.O.from("stop_loss_config").select("*").single();return t||!e?{triggerThreshold:d.U.STOP_LOSS_THRESHOLD,enabled:!0,minHoldTimeHours:d.U.MIN_HOLD_TIME_HOURS,maxSlippagePct:d.U.MAX_SLIPPAGE_PCT}:{triggerThreshold:parseFloat(e.trigger_threshold),enabled:e.enabled,minHoldTimeHours:e.min_hold_time_hours,maxSlippagePct:parseFloat(e.max_slippage_pct)}}async function p(e){let{data:t,error:o}=await n.O.from("stop_loss_events").insert({...e,executed_at:new Date().toISOString()}).select().single();if(o)throw o;return t}async function $(e){let t=e.reduce((e,t)=>e+t.realized_loss,0),o=`
🚨 STOP LOSS TRIGGERED

${e.length} position${e.length>1?"s":""} sold:

${e.map(e=>{let t=e.realized_loss/e.position_size*100;return`• ${e.reason.substring(0,50)}
  Loss: $${Math.abs(e.realized_loss).toFixed(2)} (${t.toFixed(1)}%)`}).join("\n\n")}

Total realized loss: $${Math.abs(t).toFixed(2)}
  `.trim();console.log("\uD83D\uDEA8 STOP LOSS ALERT:",o),await (0,r.sendSMS)("admin",o)}async function m(e){if((await (0,s.zC)(24)).length>=3){console.log("\uD83D\uDD34 CIRCUIT BREAKER: 3+ stop losses in 24 hours"),await n.O.from("stop_loss_config").update({enabled:!1}).eq("id",1);let e=`🔴 CIRCUIT BREAKER ACTIVATED

3+ stop losses triggered in 24 hours.
Trading has been automatically halted.`;console.error("\uD83D\uDD34 CIRCUIT BREAKER:",e),await (0,r.sendSMS)("admin",e)}}[s,i,n,r]=l.then?(await l)():l,a()}catch(e){a(e)}})},7565:(e,t,o)=>{function a(e,t){if(t<=0||t>=1)throw Error(`Invalid odds: ${t}`);return Math.floor(e/t*1e4)/1e4}o.d(t,{l:()=>a})},390:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.d(t,{k:()=>d,s:()=>r});var s=o(9802),i=o(8946),n=e([s,i]);async function r(e){let t=`🚨 KALSHI TRADER ERROR

${e.message}

Stack:
${e.stack?.substring(0,500)}

Time: ${new Date().toISOString()}`;console.error("\uD83D\uDEA8 ERROR ALERT:",t),await (0,i.C)("admin@kalshi-trader.com","\uD83D\uDEA8 Kalshi Trader Error",`<pre>${t}</pre>`)}async function d(e){let t=`📊 Daily Trading Summary

Contracts Analyzed: ${e.contracts_analyzed}
Trades Executed: ${e.trades_executed}
Total Allocated: $${e.total_allocated.toFixed(2)}
Current Bankroll: $${e.current_bankroll.toFixed(2)}`;console.log("\uD83D\uDCCA DAILY SUMMARY:",t),await (0,s.sendSMS)("admin",t)}[s,i]=n.then?(await n)():n,a()}catch(e){a(e)}})},2271:(e,t,o)=>{o.a(e,async(e,a)=>{try{o.r(t),o.d(t,{default:()=>p});var s=o(7372),i=o(1836),n=o(8318),r=o(3412),d=o(4799),l=o(3435),c=o(390),u=o(3365),g=e([s,i,n,r,d,l,c]);async function p(e,t){if(e.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return t.status(401).json({error:"Unauthorized"});let a=[];try{if(console.log("\uD83D\uDD0D Starting daily scan..."),a=await (0,s.w)({minOdds:u.U.MIN_ODDS,maxOdds:u.U.MAX_ODDS,maxDaysToResolution:u.U.MAX_DAYS_TO_RESOLUTION,minLiquidity:u.U.MIN_LIQUIDITY,excludeCategories:u.U.EXCLUDE_CATEGORIES}),console.log(`📊 Found ${a.length} qualifying contracts`),0===a.length){console.log(`⚠️ No qualifying contracts found. Skipping today.`);let{logError:e}=await o.e(610).then(o.bind(o,7610));return await e("warning","No qualifying contracts found. Skipping today.",void 0,{qualifying_contracts:0},"cron"),t.status(200).json({success:!0,skipped:!0,reason:"no_contracts",contracts_analyzed:0})}let e=await (0,l.lv)(50),g=await (0,i.X)({contracts:a,historicalPerformance:e,currentBankroll:await (0,l.dY)(),dailyBudget:u.U.DAILY_BUDGET});console.log(`🤖 AI selected ${g.selectedContracts.length} contracts`),console.log(`💰 Total allocation: $${g.totalAllocated}`);let p=await (0,n.z)(g);return console.log("\uD83D\uDEE1️ Checking stop losses..."),await (0,d.d)(),await (0,r.J)(),await (0,c.k)({contracts_analyzed:a.length,trades_executed:p.filter(e=>e.success).length,total_allocated:g.totalAllocated,current_bankroll:await (0,l.dY)()}),t.status(200).json({success:!0,contracts_analyzed:a.length,trades_executed:p.length,results:p})}catch(s){console.error("❌ Cron job failed:",s);let{logCronError:e}=await o.e(610).then(o.bind(o,7610));return await e("daily-scan",s,{contracts_analyzed:a?.length}),await (0,c.s)(s),t.status(500).json({error:s.message})}}[s,i,n,r,d,l,c]=g.then?(await g)():g,a()}catch(e){a(e)}})}};var t=require("../../../webpack-api-runtime.js");t.C(e);var o=e=>t(t.s=e),a=t.X(0,[947,118],()=>o(1406));module.exports=a})();