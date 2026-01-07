"use strict";(()=>{var t={};t.id=695,t.ids=[695],t.modules={358:t=>{t.exports=require("kalshi-typescript")},145:t=>{t.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},1309:t=>{t.exports=import("@supabase/supabase-js")},9926:t=>{t.exports=import("zod")},8289:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.r(e),a.d(e,{config:()=>c,default:()=>l,routeModule:()=>u});var n=a(1802),r=a(7153),o=a(6249),s=a(2820),d=t([s]);s=(d.then?(await d)():d)[0];let l=(0,o.l)(s,"default"),c=(0,o.l)(s,"config"),u=new n.PagesAPIRouteModule({definition:{kind:r.x.PAGES_API,page:"/api/cron/morning-report",pathname:"/api/cron/morning-report",bundlePath:"",filename:""},userland:s});i()}catch(t){i(t)}})},8231:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{O:()=>s});var n=a(1309),r=a(8159),o=t([n,r]);[n,r]=o.then?(await o)():o;let s=(0,n.createClient)(r.O.SUPABASE_URL,r.O.SUPABASE_KEY);i()}catch(t){i(t)}})},3435:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{$r:()=>d,FC:()=>v,Jg:()=>u,Of:()=>g,Pq:()=>l,Xb:()=>c,Xx:()=>y,dY:()=>m,fT:()=>$,lv:()=>s,mo:()=>o,sl:()=>p,zC:()=>f});var n=a(8231),r=t([n]);async function o(){let{data:t,error:e}=await n.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).eq("status","open").order("executed_at",{ascending:!1});if(e)throw e;return t}async function s(t=50){let{data:e,error:a}=await n.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).order("executed_at",{ascending:!1}).limit(t);if(a)throw a;return e}async function d(){let t=new Date;t.setHours(0,0,0,0);let{data:e,error:a}=await n.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).gte("executed_at",t.toISOString()).order("executed_at",{ascending:!1});if(a)throw a;return e}async function l(t,e){let{data:a,error:i}=await n.O.from("trades").select(`
      *,
      contract:contracts(*)
    `).gte("executed_at",t.toISOString()).lte("executed_at",e.toISOString()).order("executed_at",{ascending:!1});if(i)throw i;return a}async function c(t){let{data:e,error:a}=await n.O.from("trades").insert({...t,status:"open",executed_at:new Date().toISOString()}).select(`
      *,
      contract:contracts(*)
    `).single();if(a)throw a;return e}async function u(t,e){let{data:a,error:i}=await n.O.from("trades").update(e).eq("id",t).select(`
      *,
      contract:contracts(*)
    `).single();if(i)throw i;return a}async function p(){return(await o()).map(t=>({trade:t,current_odds:t.entry_odds,unrealized_pnl:0,unrealized_pnl_pct:0}))}async function m(){let{data:t}=await n.O.from("performance_metrics").select("bankroll").order("date",{ascending:!1}).limit(1).single();return t?.bankroll||Number(process.env.INITIAL_BANKROLL)||1e3}async function v(){return Number(process.env.INITIAL_BANKROLL)||1e3}async function y(t){let{data:e}=await n.O.from("performance_metrics").select("bankroll").lte("date",t.toISOString()).order("date",{ascending:!1}).limit(1).single();return e?.bankroll||Number(process.env.INITIAL_BANKROLL)||1e3}async function g(){let t=await m(),e=(await p()).reduce((t,e)=>t+e.trade.position_size,0);return t-e}async function $(){let{data:t,error:e}=await n.O.from("notification_preferences").select("*").eq("user_id","default").single();if(e&&"PGRST116"!==e.code)throw e;return t||{enabled:!1}}async function f(t){let e=new Date(Date.now()-36e5*t),{data:a,error:i}=await n.O.from("stop_loss_events").select(`
      *,
      trade:trades(
        *,
        contract:contracts(*)
      )
    `).gte("executed_at",e.toISOString()).order("executed_at",{ascending:!1});if(i)throw i;return a}n=(r.then?(await r)():r)[0],i()}catch(t){i(t)}})},8946:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{C:()=>o,P:()=>s});var n=a(9572),r=t([n]);async function o(t,e,a){console.log("\uD83D\uDCE7 Email (log only):",e),console.log(`   Would send to: ${t}`);let i=a.replace(/<[^>]*>/g,"").substring(0,200);console.log(`   Preview: ${i}...`)}async function s(t,e){let a=e.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9",i=`${a} Daily Report: ${e.mtdPnL>=0?"+":""}$${e.mtdPnL.toFixed(2)} MTD`;(0,n.$m)(e),console.log("\uD83D\uDCE7 Daily Report Email (log only):"),console.log(`   Subject: ${i}`),console.log(`   Would send to: ${t}`),console.log(`   MTD P&L: $${e.mtdPnL.toFixed(2)}`),console.log(`   YTD P&L: $${e.ytdPnL.toFixed(2)}`),console.log(`   Total Liquidity: $${e.totalLiquidity.toFixed(2)}`)}n=(r.then?(await r)():r)[0],i()}catch(t){i(t)}})},9572:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{$m:()=>l,Ij:()=>s,yb:()=>d});var n=a(3435),r=a(913),o=t([n,r]);async function s(){let t=new Date;t.setHours(0,0,0,0);let e=new Date(t.getFullYear(),t.getMonth(),1),a=new Date(t.getFullYear(),0,1),i=await (0,n.$r)(),o=i.reduce((t,e)=>t+e.position_size,0),s=await (0,n.sl)(),d=[],l=0;for(let t of s)try{let e=await (0,r.YK)(t.trade.contract.market_id),a="YES"===t.trade.side?e.yes_odds:e.no_odds,i=t.trade.contracts_purchased*a,n=i-t.trade.position_size,o=n/t.trade.position_size*100;d.push({...t,current_odds:a,unrealized_pnl:n,unrealized_pnl_pct:o}),l+=i}catch(e){l+=t.trade.position_size}let c=await (0,n.Of)(),u=c+l,p=(await (0,n.Pq)(e,t)).filter(t=>"open"!==t.status),m=p.reduce((t,e)=>t+(e.pnl||0),0),v=p.filter(t=>"won"===t.status).length,y=p.length>0?v/p.length:0,g=await (0,n.Xx)(e),$=(await (0,n.Pq)(a,t)).filter(t=>"open"!==t.status),f=$.reduce((t,e)=>t+(e.pnl||0),0),h=$.filter(t=>"won"===t.status).length,x=$.length>0?h/$.length:0,_=await (0,n.FC)();return{reportDate:t,tradesExecuted:i,totalInvested:o,openPositions:d,openPositionsValue:l,cashBalance:c,totalLiquidity:u,mtdPnL:m,mtdReturnPct:g>0?m/g*100:0,mtdWinRate:y,mtdTrades:p.length,ytdPnL:f,ytdReturnPct:_>0?f/_*100:0,ytdWinRate:x,ytdTrades:$.length,currentBankroll:u,initialBankroll:_}}function d(t){let e=t.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9";return`
${e} Kalshi Daily Report - ${t.reportDate.toLocaleDateString()}

💰 LIQUIDITY
Cash: $${t.cashBalance.toFixed(2)}
Invested: $${t.openPositionsValue.toFixed(2)}
Total: $${t.totalLiquidity.toFixed(2)}

📊 TODAY'S ACTIVITY
Trades: ${t.tradesExecuted.length}
Invested: $${t.totalInvested.toFixed(2)}
${t.tradesExecuted.map(t=>`• ${u(t.contract.question,40)} - $${t.position_size.toFixed(0)} @ ${(100*t.entry_odds).toFixed(1)}%`).join("\n")}

📅 MTD PERFORMANCE
P&L: ${c(t.mtdPnL)}
Return: ${t.mtdReturnPct>=0?"+":""}${t.mtdReturnPct.toFixed(2)}%
Win Rate: ${(100*t.mtdWinRate).toFixed(1)}% (${t.mtdTrades} trades)

📆 YTD PERFORMANCE
P&L: ${c(t.ytdPnL)}
Return: ${t.ytdReturnPct>=0?"+":""}${t.ytdReturnPct.toFixed(2)}%
Win Rate: ${(100*t.ytdWinRate).toFixed(1)}% (${t.ytdTrades} trades)

🎯 OPEN POSITIONS: ${t.openPositions.length}
${t.openPositions.slice(0,3).map(t=>`• ${u(t.trade.contract.question,35)} - $${t.trade.position_size.toFixed(0)}`).join("\n")}${t.openPositions.length>3?`
...+${t.openPositions.length-3} more`:""}
  `.trim()}function l(t){let e=t.mtdPnL>=0?"\uD83D\uDCC8":"\uD83D\uDCC9",a=t.mtdPnL>=0?"#10b981":"#ef4444",i=t.ytdPnL>=0?"#10b981":"#ef4444";return`
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
      <h1>${e} Kalshi Daily Report</h1>
      <p>${t.reportDate.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
    </div>
    
    <div class="section">
      <h2>💰 Current Liquidity</h2>
      <div class="metric">
        <div class="metric-label">Cash Balance</div>
        <div class="metric-value">$${t.cashBalance.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Invested</div>
        <div class="metric-value">$${t.openPositionsValue.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Liquidity</div>
        <div class="metric-value">$${t.totalLiquidity.toFixed(2)}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📊 Today's Activity</h2>
      <p><strong>${t.tradesExecuted.length} trades executed</strong> • $${t.totalInvested.toFixed(2)} invested</p>
      ${t.tradesExecuted.map(t=>`
        <div class="trade-item">
          <strong>${t.contract.question}</strong><br/>
          $${t.position_size.toFixed(2)} @ ${(100*t.entry_odds).toFixed(1)}% odds
          <span style="color: #64748b;">• Confidence: ${(100*t.ai_confidence).toFixed(0)}%</span><br/>
          <small style="color: #64748b;">${t.ai_reasoning}</small>
        </div>
      `).join("")}
      ${0===t.tradesExecuted.length?'<p style="color: #64748b;">No trades executed today</p>':""}
    </div>
    
    <div class="section">
      <h2>📅 Month-to-Date Performance</h2>
      <div class="metric">
        <div class="metric-label">P&L</div>
        <div class="metric-value" style="color: ${a};">
          ${t.mtdPnL>=0?"+":""}$${t.mtdPnL.toFixed(2)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Return</div>
        <div class="metric-value" style="color: ${a};">
          ${t.mtdReturnPct>=0?"+":""}${t.mtdReturnPct.toFixed(2)}%
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${(100*t.mtdWinRate).toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${t.mtdTrades}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📆 Year-to-Date Performance</h2>
      <div class="metric">
        <div class="metric-label">P&L</div>
        <div class="metric-value" style="color: ${i};">
          ${t.ytdPnL>=0?"+":""}$${t.ytdPnL.toFixed(2)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Return</div>
        <div class="metric-value" style="color: ${i};">
          ${t.ytdReturnPct>=0?"+":""}${t.ytdReturnPct.toFixed(2)}%
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${(100*t.ytdWinRate).toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${t.ytdTrades}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>🎯 Open Positions (${t.openPositions.length})</h2>
      ${t.openPositions.map(t=>{let e=t.unrealized_pnl,a=t.unrealized_pnl_pct;return`
        <div class="trade-item">
          <strong>${t.trade.contract.question}</strong><br/>
          Entry: $${t.trade.position_size.toFixed(2)} @ ${(100*t.trade.entry_odds).toFixed(1)}%
          • Current: ${(100*t.current_odds).toFixed(1)}%<br/>
          Unrealized P&L: <span style="color: ${e>=0?"#10b981":"#ef4444"};">
            ${e>=0?"+":""}$${e.toFixed(2)} (${a>=0?"+":""}${a.toFixed(1)}%)
          </span><br/>
          <small style="color: #64748b;">Resolves: ${new Date(t.trade.contract.end_date).toLocaleDateString()}</small>
        </div>
        `}).join("")}
      ${0===t.openPositions.length?'<p style="color: #64748b;">No open positions</p>':""}
    </div>
    
    <div class="footer">
      <p>Automated Kalshi Trading System</p>
    </div>
  </div>
</body>
</html>
  `.trim()}function c(t){return`${t>=0?"+":""}$${t.toFixed(2)}`}function u(t,e){return t.length>e?t.substring(0,e-3)+"...":t}[n,r]=o.then?(await o)():o,i()}catch(t){i(t)}})},9802:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{sendSMS:()=>o,u:()=>s});var n=a(9572),r=t([n]);async function o(t,e){console.log("\uD83D\uDCF1 SMS (log only):",e),console.log(`   Would send to: ${t}`)}async function s(t,e){let a=(0,n.yb)(e);console.log("\uD83D\uDCF1 Daily Report SMS (log only):"),console.log(a),console.log(`   Would send to: ${t}`)}n=(r.then?(await r)():r)[0],i()}catch(t){i(t)}})},2820:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.r(e),a.d(e,{default:()=>c});var n=a(9572),r=a(3435),o=a(9802),s=a(8946),d=a(8231),l=t([n,r,o,s,d]);async function c(t,e){if(t.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return e.status(401).json({error:"Unauthorized"});try{console.log("\uD83D\uDCCA Generating daily report...");let t=await (0,n.Ij)();await d.O.from("daily_reports").insert({report_date:t.reportDate.toISOString().split("T")[0],trades_executed:t.tradesExecuted.length,total_invested:t.totalInvested,open_positions_value:t.openPositionsValue,cash_balance:t.cashBalance,total_liquidity:t.totalLiquidity,mtd_pnl:t.mtdPnL,ytd_pnl:t.ytdPnL,mtd_return_pct:t.mtdReturnPct,ytd_return_pct:t.ytdReturnPct,win_rate_mtd:t.mtdWinRate,win_rate_ytd:t.ytdWinRate,report_content:(0,n.yb)(t),sent_at:new Date().toISOString()});let a=await (0,r.fT)();return a.phone_number&&a.enabled&&(await (0,o.u)(a.phone_number,t),console.log("✅ SMS report sent")),a.email&&a.enabled&&(await (0,s.P)(a.email,t),console.log("✅ Email report sent")),e.status(200).json({success:!0,reportDate:t.reportDate,tradesExecuted:t.tradesExecuted.length,totalLiquidity:t.totalLiquidity})}catch(i){console.error("❌ Morning report failed:",i);let{logCronError:t}=await a.e(610).then(a.bind(a,7610));return await t("morning-report",i),console.error("⚠️ Daily report failed:",i.message),await (0,o.sendSMS)("admin",`⚠️ Daily report failed: ${i.message}`),e.status(500).json({error:i.message})}}[n,r,o,s,d]=l.then?(await l)():l,i()}catch(t){i(t)}})}};var e=require("../../../webpack-api-runtime.js");e.C(t);var a=t=>e(e.s=t),i=e.X(0,[947],()=>a(8289));module.exports=i})();