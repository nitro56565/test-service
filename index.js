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
  return await transform(ciceroMark.toJSON(), "ciceromark_parsed", ["html"], {}, { verbose: false });
}

app.post("/rebuild", async (req, res) => {
  try {
    const { template, model, data } = req.body;
    const result = await rebuild(template, model, data);
    res.json({ agreementHtml: result });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));