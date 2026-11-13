const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function calculate(expression) {
  if (typeof expression !== "string" || expression.length === 0 || expression.length > 200) {
    throw new Error("Enter an expression up to 200 characters long.");
  }

  let position = 0;

  function skipWhitespace() {
    while (/\s/.test(expression[position] || "")) position += 1;
  }

  function parseNumber() {
    skipWhitespace();
    const start = position;
    let decimalSeen = false;

    while (position < expression.length) {
      const character = expression[position];
      if (character >= "0" && character <= "9") {
        position += 1;
      } else if (character === "." && !decimalSeen) {
        decimalSeen = true;
        position += 1;
      } else {
        break;
      }
    }

    if (start === position || expression.slice(start, position) === ".") {
      throw new Error("Expected a number.");
    }
    return Number(expression.slice(start, position));
  }

  function parseFactor() {
    skipWhitespace();
    if (expression[position] === "+") {
      position += 1;
      return parseFactor();
    }
    if (expression[position] === "-") {
      position += 1;
      return -parseFactor();
    }
    if (expression[position] === "(") {
      position += 1;
      const value = parseExpression();
      skipWhitespace();
      if (expression[position] !== ")") throw new Error("Missing closing parenthesis.");
      position += 1;
      return value;
    }
    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();
    while (true) {
      skipWhitespace();
      const operator = expression[position];
      if (operator !== "*" && operator !== "/") break;
      position += 1;
      const right = parseFactor();
      if (operator === "/" && right === 0) throw new Error("Cannot divide by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (true) {
      skipWhitespace();
      const operator = expression[position];
      if (operator !== "+" && operator !== "-") break;
      position += 1;
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseExpression();
  skipWhitespace();
  if (position !== expression.length) throw new Error("The expression contains an invalid character.");
  if (!Number.isFinite(result)) throw new Error("The result is too large to calculate.");
  return Number(result.toPrecision(12));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && url.pathname === "/api/calculate") {
    let body = "";
    let bodyTooLarge = false;
    request.on("data", (chunk) => {
      if (bodyTooLarge) return;
      if (body.length + chunk.length > 4096) bodyTooLarge = true;
      else body += chunk;
    });
    request.on("end", () => {
      if (bodyTooLarge) {
        sendJson(response, 413, { error: "Request body is too large." });
        return;
      }
      try {
        const { expression } = JSON.parse(body);
        sendJson(response, 200, { result: calculate(expression) });
      } catch (error) {
        sendJson(response, 400, { error: error.message || "Invalid request." });
      }
    });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD, POST" });
    response.end();
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Calculator is running at http://localhost:${PORT}`);
  });
}

module.exports = { calculate, server };