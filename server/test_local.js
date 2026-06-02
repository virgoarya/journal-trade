const { default: axios } = require("axios");

async function test() {
  try {
    const response = await axios.post("http://localhost:5000/api/v1/macro-ai/chat", {
      messages: [{ role: "user", content: "Halo" }]
    }, { responseType: "stream" });
    
    response.data.on("data", chunk => {
      console.log("CHUNK:", JSON.stringify(chunk.toString()));
    });
    response.data.on("end", () => {
      console.log("END");
    });
  } catch (err) {
    if (err.response) {
      console.log("HTTP ERROR:", err.response.status);
      err.response.data.on('data', chunk => {
        console.log("ERROR CHUNK:", JSON.stringify(chunk.toString()));
      });
    } else {
      console.error(err);
    }
  }
}
test();
