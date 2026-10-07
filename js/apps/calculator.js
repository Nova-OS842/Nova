window.CalculatorApp={id:"calculator",name:"Calculator",description:"Fast, safe everyday calculations",icon:"assets/icons/calculator.svg",width:390,height:570,mount(body){
  body.innerHTML=`<div class="calc"><div class="calc-display"><div class="calc-expression"></div><div class="calc-value">0</div></div><div class="calc-grid"></div></div>`;
  const grid=body.querySelector(".calc-grid"),expr=body.querySelector(".calc-expression"),value=body.querySelector(".calc-value");let input="";
  const keys=["AC","DEL","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","(",")",".","="];
  keys.forEach(k=>{const b=document.createElement("button");b.textContent=k;if(k==="=")b.className="equals";b.onclick=()=>press(k);grid.appendChild(b)});
  function tokenize(s){return s.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-").replace(/\s+/g,"").replace(/%/g,"/100")}
  function calc(s){
    s=tokenize(s);let i=0;
    function parseExpr(){let x=parseTerm();while(s[i]==="+"||s[i]==="-"){let op=s[i++],y=parseTerm();x=op==="+"?x+y:x-y}return x}
    function parseTerm(){let x=parseUnary();while(s[i]==="*"||s[i]==="/"){let op=s[i++],y=parseUnary();if(op==="/"&&y===0)throw Error("Cannot divide by zero");x=op==="*"?x*y:x/y}return x}
    function parseUnary(){if(s[i]==="+"){i++;return parseUnary()}if(s[i]==="-"){i++;return -parseUnary()}if(s[i]==="("){i++;let x=parseExpr();if(s[i++]!==")")throw Error("Missing )");return x}let m=s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);if(!m)throw Error("Invalid input");i+=m[0].length;return Number(m[0])}
    const n=parseExpr();if(i!==s.length||!Number.isFinite(n))throw Error("Invalid expression");return Math.round(n*1e12)/1e12
  }
  function press(k){if(k==="AC")input="";else if(k==="DEL")input=input.slice(0,-1);else if(k==="="){try{const result=calc(input);expr.textContent=input+" =";input=String(result)}catch(e){expr.textContent=e.message;input=""}}else input+=k;value.textContent=input||"0"}
  const key=e=>{if(WindowManager.get("calculator")?.minimized)return;if(/[\d.+\-*/%()]/.test(e.key))press(e.key==="*"?"×":e.key==="-"?"−":e.key);if(e.key==="Enter")press("=");if(e.key==="Backspace")press("DEL");if(e.key==="Escape")press("AC")};
  addEventListener("keydown",key);return()=>removeEventListener("keydown",key)
}};