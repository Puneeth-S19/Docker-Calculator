const expressionDisplay = document.querySelector("#expression");
const resultDisplay = document.querySelector("#result");
const keypad = document.querySelector(".keypad");

let expression = "";
let justEvaluated = false;
let requestNumber = 0;

function render() {
  expressionDisplay.textContent = expression.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
}

function appendValue(value) {
  if (justEvaluated && /[0-9.(]/.test(value)) expression = "";
  justEvaluated = false;

  if (/[+\-*/]/.test(value)) {
    if (!expression) {
      if (value !== "-") return;
      expression = "-";
    } else if (/[+\-*/]$/.test(expression)) {
      expression = expression.slice(0, -1) + value;
    } else {
      expression += value;
    }
  } else if (value === ".") {
    const currentNumber = expression.split(/[+\-*/()]/).pop();
    if (currentNumber.includes(".")) return;
    expression += currentNumber ? "." : "0.";
  } else {
    expression += value;
  }
  render();
}

function clear() {
  expression = "";
  resultDisplay.textContent = "0";
  justEvaluated = false;
  render();
}

function backspace() {
  expression = expression.slice(0, -1);
  justEvaluated = false;
  render();
}

function addParenthesis() {
  const opens = (expression.match(/\(/g) || []).length;
  const closes = (expression.match(/\)/g) || []).length;
  if (opens > closes && /[0-9.)]$/.test(expression)) {
    expression += ")";
  } else {
    if (justEvaluated) expression = "";
    if (/[0-9.)]$/.test(expression)) expression += "*";
    expression += "(";
  }
  justEvaluated = false;
  render();
}

function changeSign() {
  if (!expression) {
    expression = "-";
  } else if (/[+\-*/]$/.test(expression)) {
    expression += "-";
  } else {
    const match = expression.match(/(\d*\.?\d+|\.)$/);
    if (!match) return;
    const start = match.index;
    const prefix = expression.slice(0, start);
    const number = match[0];
    if (prefix.endsWith("-") && (prefix.length === 1 || /[+\-*/(]$/.test(prefix.slice(0, -1)))) {
      expression = prefix.slice(0, -1) + number;
    } else {
      expression = prefix + "-" + number;
    }
  }
  justEvaluated = false;
  render();
}

async function calculate() {
  if (!expression.trim()) return;
  const currentRequest = ++requestNumber;
  resultDisplay.textContent = "…";
  resultDisplay.setAttribute("aria-label", "Calculating");
  try {
    const response = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression }),
    });
    const data = await response.json();
    if (currentRequest !== requestNumber) return;
    if (!response.ok) throw new Error(data.error || "Unable to calculate.");
    resultDisplay.textContent = String(data.result);
    resultDisplay.removeAttribute("aria-label");
    expression = String(data.result);
    justEvaluated = true;
    render();
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    resultDisplay.textContent = error.message;
    resultDisplay.setAttribute("aria-label", `Error: ${error.message}`);
  }
}

function handleKey(key) {
  if (/^[0-9.]$/.test(key) || /^[+\-*/()]$/.test(key)) {
    appendValue(key);
  } else if (key === "Enter" || key === "=") {
    calculate();
  } else if (key === "Backspace") {
    backspace();
  } else if (key === "Escape" || key.toLowerCase() === "c") {
    clear();
  }
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "clear") clear();
  else if (button.dataset.action === "backspace") backspace();
  else if (button.dataset.action === "sign") changeSign();
  else if (button.dataset.action === "parenthesis") addParenthesis();
  else if (button.dataset.action === "equals") calculate();
  else appendValue(button.dataset.value);
});

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[0-9.]$/.test(event.key) || /^[+\-*/()]$/.test(event.key) ||
      ["Enter", "=", "Backspace", "Escape"].includes(event.key) || event.key.toLowerCase() === "c") {
    event.preventDefault();
    handleKey(event.key);
  }
});