require("dotenv").config();
const express = require("express");
const { WebSocketServer } = require("ws");
const cors = require("cors");

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  ws.on("message", async (message) => {
    try {
      const { template, model, dataString } = JSON.parse(message);
      const result = await rebuild(template, model, dataString);
      ws.send(JSON.stringify({ status: "success", result }));
    } catch (error) {
      ws.send(JSON.stringify({ status: "error", message: error.message }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// Simulate the rebuild function inside the WebSocket server
const { ModelManager } = require("@accordproject/concerto-core");
const { TemplateMarkInterpreter } = require("@accordproject/template-engine");
const { TemplateMarkTransformer } = require("@accordproject/markdown-template");
const { transform } = require("@accordproject/markdown-transform");

async function rebuild(template, model, dataString) {
  const modelManager = new ModelManager({ strict: true });
  modelManager.addCTOModel(model, undefined, true);
  await modelManager.updateExternalModels();
  const engine = new TemplateMarkInterpreter(modelManager, {});
  const templateMarkTransformer = new TemplateMarkTransformer();
  const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
    { content: template },
    modelManager,
    "contract",
    { verbose: false }
  );
  const data = JSON.parse(dataString);
  const ciceroMark = await engine.generate(templateMarkDom, data);
  return await transform(
    ciceroMark.toJSON(),
    "ciceromark_parsed",
    ["html"],
    {},
    { verbose: false }
  );
}