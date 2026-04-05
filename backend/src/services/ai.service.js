exports.runProfileAnalysis = async (profileData) => {
  const { runAgentGraph } = await import("../agent/graph.mjs");
  return runAgentGraph("analyze", profileData);
};

exports.runCareerRecommendation = async (profileData) => {
  const { runAgentGraph } = await import("../agent/graph.mjs");
  return runAgentGraph("recommend", profileData);
};

exports.runPlanGeneration = async (pathData) => {
  const { runAgentGraph } = await import("../agent/graph.mjs");
  return runAgentGraph("plan", pathData);
};
