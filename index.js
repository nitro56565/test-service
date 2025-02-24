const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { ModelManager } = require("@accordproject/concerto-core");
const { TemplateMarkInterpreter } = require("@accordproject/template-engine");
const { TemplateMarkTransformer } = require("@accordproject/markdown-template");
const { transform } = require("@accordproject/markdown-transform");

const app = express();
app.use(cors());
app.use(bodyParser.json());

/**
 * Logs requests and responses for debugging
 */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Incoming Request: ${req.method} ${req.url}`);
  console.log(`Body: ${JSON.stringify(req.body, null, 2)}`);
  next();
});

/**
 * Rebuilds the agreement HTML from the provided template, model, and data
 */
async function rebuild(template, model, dataString) {
  console.log("Starting rebuild process...");

  const modelManager = new ModelManager({ strict: true });

  try {
    console.log("Adding CTO model to ModelManager...");
    modelManager.addCTOModel(model, undefined, true);
    await modelManager.updateExternalModels();
    console.log("Model updated successfully.");

    const engine = new TemplateMarkInterpreter(modelManager, {});
    const templateMarkTransformer = new TemplateMarkTransformer();

    console.log("Transforming Markdown Template...");
    const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
      { content: template },
      modelManager,
      "contract",
      { verbose: false }
    );

    console.log("Parsing data...");
    const data = JSON.parse(dataString);

    console.log("Generating CiceroMark...");
    const ciceroMark = await engine.generate(templateMarkDom, data);

    console.log("Transforming CiceroMark to HTML...");
    const result = await transform(ciceroMark.toJSON(), "ciceromark_parsed", ["html"], {}, { verbose: false });

    console.log("Rebuild process completed successfully.");
    return result;
  } catch (error) {
    console.error("Error during rebuild:", error);
    throw error; // Rethrow to be handled in the route
  }
}

/**
 * Handles the rebuild request
 */
app.post("/rebuild", async (req, res) => {
  try {
    console.log("Received /rebuild request...");
    const { template, model, data } = req.body;

    if (!template || !model || !data) {
      console.warn("Missing required fields in request body.");
      return res.status(400).json({ error: "Template, model, and data are required." });
    }

    const result = await rebuild(template, model, data);

    console.log("Sending response...");
    res.json({ agreementHtml: result });
  } catch (error) {
    console.error("Failed to process /rebuild request:", error);
    res.status(500).json({ error: error.toString() });
  }
});

/**
 * Starts the server
 */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`));