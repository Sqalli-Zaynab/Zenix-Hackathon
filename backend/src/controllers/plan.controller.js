const aiService = require("../services/ai.service");

exports.generatePlan = async (req, res) => {
  try {
    const selectionData = req.body;
    const actionPlan = await aiService.runPlanGeneration(selectionData);
    return res.status(200).json(actionPlan);
  } catch (error) {
    console.error("Plan generation failed:", error);
    return res.status(500).json({ error: "Action plan generation failed" });
  }
};
