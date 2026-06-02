const { default: axios } = require("axios");
const fs = require("fs");

async function test() {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  require("dotenv").config({ path: ".env" });
  
  try {
    const response = await axios.post(
      url,
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Halo" }],
        stream: true,
      },
      {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        responseType: "stream",
      }
    );
    
    let output = "";
    response.data.on("data", (chunk) => {
      output += chunk.toString();
    });
    response.data.on("end", () => {
      fs.writeFileSync("output.json", output);
      console.log("DONE");
    });
  } catch (err) {
    fs.writeFileSync("error.log", err.message);
  }
}
test();
