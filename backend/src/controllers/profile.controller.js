const aiService = require("../services/ai.service");

exports.analyzeProfile = async (req, res) => {
  try {
    const rawUserData = req.body;
    const response = await aiService.runProfileAnalysis(rawUserData);
    return res.status(200).json(response);
  } catch (error) {
    console.error("Profile analysis failed:", error);
    return res.status(500).json({ error: "Profile analysis failed" });
  }
};
