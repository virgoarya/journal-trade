const http = require("http");

const data = JSON.stringify({
  messages: [
    { role: "user", content: "jelaskan macro regime" },
    { role: "assistant", content: "pada pasar adalah: Saham: cender" },
    { role: "user", content: "jelaskan ulang secara lengkap" }
  ],
  currentRegime: "Stagflation",
  assets: [],
  liquidityStatus: "Draining"
});

const req = http.request(
  "http://localhost:5000/api/v1/macro-ai/chat",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
      // MOCK USER ID IF REQUIRE_AUTH IS USED
      "Cookie": "better-auth.session_token=mock" // or bypass auth
    }
  },
  (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      console.log(`BODY: ${chunk}`);
    });
    res.on("end", () => {
      console.log("No more data in response.");
    });
  }
);

req.on("error", (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
