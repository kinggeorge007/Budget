"use strict";
// SalaryPlan: full-screen calculator layout (look only; the maths is unchanged).

const cfStyle = document.createElement("style");
cfStyle.textContent = `
.pBody.calcFull{display:flex;flex-direction:column;height:calc(100% - 65px);padding:8px 14px calc(16px + env(safe-area-inset-bottom, 0px))}
.calcFull .calcDisp{flex:1;min-height:110px;background:transparent;box-shadow:none;padding:8px 6px;margin:0;justify-content:flex-end}
.calcFull .calcExpr{font-size:1.4rem}
.calcFull .calcRes{font-size:clamp(2.8rem,14vw,4.4rem);line-height:1.1}
.calcFull .calcGrid{flex:0 0 58%;grid-template-rows:repeat(5,1fr);gap:12px;margin:8px 0 12px}
.calcFull .calcGrid button{min-height:0;height:100%;border-radius:32px;font-size:clamp(1.5rem,7vw,2.2rem)}
.calcFull .calcGrid .op{background:var(--accent2);color:#fff}
.calcFull .calcGrid .eq{background:var(--accent2);color:#fff}
.calcFull .nBar{flex:none;margin:0}
.calcFull .nBar button{min-height:52px}
`;
document.head.appendChild(cfStyle);

// Remove the full-screen layout whenever any other page opens.
const baseOpenPage = openPage;
openPage = function (title, build) {
  pBody.classList.remove("calcFull");
  baseOpenPage(title, build);
};

// Shrink the result text as the number gets longer.
const baseCalculatorPage = calculatorPage;
calculatorPage = function (body) {
  baseCalculatorPage(body);
  body.classList.add("calcFull");
  const res = body.querySelector(".calcRes");
  if (!res) return;
  const fit = () => {
    const n = res.textContent.length;
    res.style.fontSize = n <= 8 ? "" : n <= 11 ? "2.6rem" : n <= 14 ? "2rem" : "1.5rem";
  };
  new MutationObserver(fit).observe(res, { childList: true, characterData: true, subtree: true });
  fit();
};
