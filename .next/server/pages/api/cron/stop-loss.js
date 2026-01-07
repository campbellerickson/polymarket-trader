"use strict";(()=>{var e={};e.id=465,e.ids=[465],e.modules={358:e=>{e.exports=require("kalshi-typescript")},145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},1309:e=>{e.exports=import("@supabase/supabase-js")},9926:e=>{e.exports=import("zod")},1799:(e,t,o)=>{o.a(e,async(e,s)=>{try{o.r(t),o.d(t,{config:()=>c,default:()=>l,routeModule:()=>u});var i=o(1802),a=o(7153),r=o(6249),n=o(6212),d=e([n]);n=(d.then?(await d)():d)[0];let l=(0,r.l)(n,"default"),c=(0,r.l)(n,"config"),u=new i.PagesAPIRouteModule({definition:{kind:a.x.PAGES_API,page:"/api/cron/stop-loss",pathname:"/api/cron/stop-loss",bundlePath:"",filename:""},userland:n});s()}catch(e){s(e)}})},3365:(e,t,o)=>{o.d(t,{U:()=>s});let s={DAILY_BUDGET:Number(process.env.DAILY_BUDGET)||100,MIN_ODDS:Number(process.env.MIN_ODDS)||.85,MAX_ODDS:Number(process.env.MAX_ODDS)||.98,MAX_DAYS_TO_RESOLUTION:Number(process.env.MAX_DAYS_TO_RESOLUTION)||2,MIN_LIQUIDITY:Number(process.env.MIN_LIQUIDITY)||2e3,INITIAL_BANKROLL:Number(process.env.INITIAL_BANKROLL)||100,DRY_RUN:"true"===process.env.DRY_RUN,MIN_POSITION_SIZE:20,MAX_POSITION_SIZE:50,STOP_LOSS_THRESHOLD:.8,MIN_HOLD_TIME_HOURS:1,MAX_SLIPPAGE_PCT:.05,MAX_LOSSES_IN_STREAK:5,MAX_STOP_LOSSES_24H:3,BANKROLL_DROP_THRESHOLD:.7,EXCLUDE_CATEGORIES:[],EXCLUDE_KEYWORDS:[]}},8231:(e,t,o)=>{o.a(e,async(e,s)=>{try{o.d(t,{O:()=>n});var i=o(1309),a=o(8159),r=e([i,a]);[i,a]=r.then?(await r)():r;let n=(0,i.createClient)(a.O.SUPABASE_URL,a.O.SUPABASE_KEY);s()}catch(e){s(e)}})},3435:(e,t,o)=>{o.a(e,async(e,s)=>{try{o.d(t,{$r:()=>d,FC:()=>m,Jg:()=>u,Of:()=>v,Pq:()=>l,Xb:()=>c,Xx:()=>_,dY:()=>g,fT:()=>h,lv:()=>n,mo:()=>r,sl:()=>p,zC:()=>$});var i=o(8231),a=e([i]);async function r(){let{data:e,error:t}=await i.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).eq("status","open").order("executed_at",{ascending:!1});if(t)throw t;return e}async function n(e=50){let{data:t,error:o}=await i.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).order("executed_at",{ascending:!1}).limit(e);if(o)throw o;return t}async function d(){let e=new Date;e.setHours(0,0,0,0);let{data:t,error:o}=await i.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).gte("executed_at",e.toISOString()).order("executed_at",{ascending:!1});if(o)throw o;return t}async function l(e,t){let{data:o,error:s}=await i.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).gte("executed_at",e.toISOString()).lte("executed_at",t.toISOString()).order("executed_at",{ascending:!1});if(s)throw s;return o}async function c(e){let{data:t,error:o}=await i.O.from("trades").insert({...e,status:"open",executed_at:new Date().toISOString()}).select(`
      *,
      contract:contracts(*)
    `).single();if(o)throw o;return t}async function u(e,t){let{data:o,error:s}=await i.O.from("trades").update(t).eq("id",e).select(`
      *,
      contract:contracts(*)
    `).single();if(s)throw s;return o}async function p(){return(await r()).map(e=>({trade:e,current_odds:e.entry_odds,unrealized_pnl:0,unrealized_pnl_pct:0}))}async function g(){let{data:e}=await i.O.from("performance_metrics").select("bankroll").order("date",{ascending:!1}).limit(1).single();return e?.bankroll||Number(process.env.INITIAL_BANKROLL)||1e3}async function m(){return Number(process.env.INITIAL_BANKROLL)||1e3}async function _(e){let{data:t}=await i.O.from("performance_metrics").select("bankroll").lte("date",e.toISOString()).order("date",{ascending:!1}).limit(1).single();return t?.bankroll||Number(process.env.INITIAL_BANKROLL)||1e3}async function v(){let e=await g(),t=(await p()).reduce((e,t)=>e+t.trade.position_size,0);return e-t}async function h(){let{data:e,error:t}=await i.O.from("notification_preferences").select("*").eq("user_id","default").single();if(t&&"PGRST116"!==t.code)throw t;return e||{enabled:!1}}async function $(e){let t=new Date(Date.now()-36e5*e),{data:o,error:s}=await i.O.from("stop_loss_events").select(`
      *,
      trade:trades(
        *,
        contract:contracts(*)
      )
    `).gte("executed_at",t.toISOString()).order("executed_at",{ascending:!1});if(s)throw s;return o}i=(a.then?(await a)():a)[0],s()}catch(e){s(e)}})},9572:(e,t,o)=>{o.a(e,async(e,s)=>{try{o.d(t,{$m:()=>l,Ij:()=>n,yb:()=>d});var i=o(3435),a=o(913),r=e([i,a]);async function n(){let e=new Date;e.setHours(0,0,0,0);let t=new Date(e.getFullYear(),e.getMonth(),1),o=new Date(e.getFullYear(),0,1),s=await (0,i.$r)(),r=s.reduce((e,t)=>e+t.position_size,0),n=await (0,i.sl)(),d=[],l=0;for(let e of n)try{let t=await (0,a.YK)(e.trade.contract.market_id),o="YES"===e.trade.side?t.yes_odds:t.no_odds,s=e.trade.contracts_purchased*o,i=s-e.trade.position_size,r=i/e.trade.position_size*100;d.push({...e,current_odds:o,unrealized_pnl:i,unrealized_pnl_pct:r}),l+=s}catch(t){l+=e.trade.position_size}let c=await (0,i.Of)(),u=c+l,p=(await (0,i.Pq)(t,e)).filter(e=>"open"!==e.status),g=p.reduce((e,t)=>e+(t.pnl||0),0),m=p.filter(e=>"won"===e.status).length,_=p.length>0?m/p.length:0,v=await (0,i.Xx)(t),h=(await (0,i.Pq)(o,e)).filter(e=>"open"!==e.status),$=h.reduce((e,t)=>e+(t.pnl||0),0),f=h.filter(e=>"won"===e.status).length,y=h.length>0?f/h.length:0,x=await (0,i.FC)();return{reportDate:e,tradesExecuted:s,totalInvested:r,openPositions:d,openPositionsValue:l,cashBalance:c,totalLiquidity:u,mtdPnL:g,mtdReturnPct:v>0?g/v*100:0,mtdWinRate:_,mtdTrades:p.length,ytdPnL:$,ytdReturnPct:x>0?$/x*100:0,ytdWinRate:y,ytdTrades:h.length,currentBankroll:u,initialBankroll:x}}function d(e){let t=e.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9";return`
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
  `.trim()}function l(e){let t=e.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9",o=e.mtdPnL>=0?"#10b981":"#ef4444",s=e.ytdPnL>=0?"#10b981":"#ef4444";return`
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
        <div class="metric-value" style="color: ${s};">
          ${e.ytdPnL>=0?"+":""}$${e.ytdPnL.toFixed(2)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Return</div>
        <div class="metric-value" style="color: ${s};">
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
  `.trim()}function c(e){return`${e>=0?"+":""}$${e.toFixed(2)}`}function u(e,t){return e.length>t?e.substring(0,t-3)+"...":e}[i,a]=r.then?(await r)():r,s()}catch(e){s(e)}})},9802:(e,t,o)=>{o.a(e,async(e,s)=>{try{o.d(t,{sendSMS:()=>r,u:()=>n});var i=o(9572),a=e([i]);async function r(e,t){console.log("\uD83D\uDCF1 SMS (log only):",t),console.log(`   Would send to: ${e}`)}async function n(e,t){let o=(0,i.yb)(t);console.log("\uD83D\uDCF1 Daily Report SMS (log only):"),console.log(o),console.log(`   Would send to: ${e}`)}i=(a.then?(await a)():a)[0],s()}catch(e){s(e)}})},4799:(e,t,o)=>{o.a(e,async(e,s)=>{try{o.d(t,{A:()=>_,d:()=>c});var i=o(3435),a=o(913),r=o(8231),n=o(9802),d=o(3365),l=e([i,a,r,n]);async function c(){console.log("\uD83D\uDEE1️ Checking stop loss conditions...");let e=await p();if(!e.enabled)return console.log("⏸️ Stop loss monitoring disabled"),{triggered:0,candidates:[],events:[]};let t=await (0,i.mo)();console.log(`📊 Monitoring ${t.length} open positions`);let o=[],s=[];for(let i of t)try{let t=await (0,a.YK)(i.contract.market_id),r="YES"===i.side?t.yes_odds:t.no_odds,n=i.contracts_purchased*r-i.position_size,d=n/i.position_size*100,l=(Date.now()-new Date(i.executed_at).getTime())/36e5,c=r<e.triggerThreshold&&l>=e.minHoldTimeHours,p={trade:i,currentOdds:r,entryOdds:i.entry_odds,unrealizedLoss:n,unrealizedLossPct:d,holdTimeHours:l,shouldTrigger:c,reason:c?`Odds dropped from ${(100*i.entry_odds).toFixed(1)}% to ${(100*r).toFixed(1)}%`:"Not triggered"};if(o.push(p),c){console.log(`🚨 STOP LOSS TRIGGERED: ${i.contract.question.substring(0,50)}...`),console.log(`   Entry: ${(100*i.entry_odds).toFixed(1)}% → Current: ${(100*r).toFixed(1)}%`),console.log(`   Unrealized Loss: $${n.toFixed(2)} (${d.toFixed(1)}%)`);let t=await u(i,r,p.reason,e);t.success&&t.event&&s.push(t.event)}}catch(e){console.error(`   ⚠️ Error checking trade ${i.id}:`,e.message)}if(console.log(`
📊 Stop Loss Summary:`),console.log(`   Total positions: ${t.length}`),console.log(`   Below threshold: ${o.filter(t=>t.currentOdds<e.triggerThreshold).length}`),console.log(`   Triggered: ${s.length}`),s.length>0){let e=s.reduce((e,t)=>e+t.realized_loss,0);console.log(`   Total realized loss: $${e.toFixed(2)}`),await m(s)}return{triggered:s.length,candidates:o,events:s}}async function u(e,t,o,s){try{let r=await (0,a.up)(e.contract.market_id),n="YES"===e.side?r.bestYesBid:r.bestNoBid,d=Math.abs(n-t)/t;if(d>s.maxSlippagePct)return console.log(`⚠️ Slippage too high (${(100*d).toFixed(2)}%), skipping`),{success:!1,error:`Slippage ${(100*d).toFixed(2)}% exceeds max ${(100*s.maxSlippagePct).toFixed(2)}%`};await (0,a.s1)({market:e.contract.market_id,side:"YES"===e.side?"SELL_YES":"SELL_NO",amount:e.contracts_purchased,price:n});let l=e.contracts_purchased*n-e.position_size;await (0,i.Jg)(e.id,{status:"stopped",exit_odds:n,pnl:l,resolved_at:new Date});let c=await g({trade_id:e.id,trigger_odds:s.triggerThreshold,exit_odds:n,position_size:e.position_size,realized_loss:l,reason:o});return console.log(`✅ Stop loss executed:`),console.log(`   Sold ${e.contracts_purchased} contracts @ ${(100*n).toFixed(1)}%`),console.log(`   Realized loss: $${l.toFixed(2)}`),{success:!0,event:c}}catch(e){return console.error(`❌ Failed to execute stop loss:`,e.message),{success:!1,error:e.message}}}async function p(){let{data:e,error:t}=await r.O.from("stop_loss_config").select("*").single();return t||!e?{triggerThreshold:d.U.STOP_LOSS_THRESHOLD,enabled:!0,minHoldTimeHours:d.U.MIN_HOLD_TIME_HOURS,maxSlippagePct:d.U.MAX_SLIPPAGE_PCT}:{triggerThreshold:parseFloat(e.trigger_threshold),enabled:e.enabled,minHoldTimeHours:e.min_hold_time_hours,maxSlippagePct:parseFloat(e.max_slippage_pct)}}async function g(e){let{data:t,error:o}=await r.O.from("stop_loss_events").insert({...e,executed_at:new Date().toISOString()}).select().single();if(o)throw o;return t}async function m(e){let t=e.reduce((e,t)=>e+t.realized_loss,0),o=`
🚨 STOP LOSS TRIGGERED

${e.length} position${e.length>1?"s":""} sold:

${e.map(e=>{let t=e.realized_loss/e.position_size*100;return`• ${e.reason.substring(0,50)}
  Loss: $${Math.abs(e.realized_loss).toFixed(2)} (${t.toFixed(1)}%)`}).join("\n\n")}

Total realized loss: $${Math.abs(t).toFixed(2)}
  `.trim();console.log("\uD83D\uDEA8 STOP LOSS ALERT:",o),await (0,n.sendSMS)("admin",o)}async function _(e){if((await (0,i.zC)(24)).length>=3){console.log("\uD83D\uDD34 CIRCUIT BREAKER: 3+ stop losses in 24 hours"),await r.O.from("stop_loss_config").update({enabled:!1}).eq("id",1);let e=`🔴 CIRCUIT BREAKER ACTIVATED

3+ stop losses triggered in 24 hours.
Trading has been automatically halted.`;console.error("\uD83D\uDD34 CIRCUIT BREAKER:",e),await (0,n.sendSMS)("admin",e)}}[i,a,r,n]=l.then?(await l)():l,s()}catch(e){s(e)}})},6212:(e,t,o)=>{o.a(e,async(e,s)=>{try{o.r(t),o.d(t,{default:()=>r});var i=o(4799),a=e([i]);async function r(e,t){if(e.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return t.status(401).json({error:"Unauthorized"});try{console.log("\uD83D\uDEE1️ Running stop loss monitor...");let e=await (0,i.d)();return e.triggered>0&&await (0,i.A)(e.events),t.status(200).json({success:!0,triggered:e.triggered,total_positions:e.candidates.length,below_threshold:e.candidates.filter(e=>e.currentOdds<.8).length})}catch(i){console.error("❌ Stop loss monitor failed:",i);let{logCronError:e}=await o.e(610).then(o.bind(o,7610));await e("stop-loss",i);let{sendSMS:s}=await Promise.resolve().then(o.bind(o,9802));return console.error("\uD83D\uDEA8 CRITICAL: Stop loss monitor failed:",i.message),await s("admin",`🚨 CRITICAL: Stop loss monitor failed: ${i.message}`),t.status(500).json({error:i.message})}}i=(a.then?(await a)():a)[0],s()}catch(e){s(e)}})}};var t=require("../../../webpack-api-runtime.js");t.C(e);var o=e=>t(t.s=e),s=t.X(0,[947],()=>o(1799));module.exports=s})();