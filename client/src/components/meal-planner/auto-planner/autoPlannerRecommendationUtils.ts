import { type AutoPlannerResult } from './autoPlannerTypes';

export const deriveWeeklyOptimizationSuggestions = (result: AutoPlannerResult) => {
  const suggestions = [...result.suggestions];
  const deltaProtein = result.afterScores.proteinCoverageScore - result.beforeScores.proteinCoverageScore;
  const deltaPrep = result.afterScores.prepLoadScore - result.beforeScores.prepLoadScore;
  const deltaVariety = result.afterScores.varietyScore - result.beforeScores.varietyScore;
  if (deltaProtein > 3) suggestions.push({ id: 'protein', tone: 'positive', message: `Protein balance improved by ${deltaProtein} points across the week.` });
  if (deltaPrep > 3) suggestions.push({ id: 'prep', tone: 'positive', message: `Prep load distribution improved by ${deltaPrep} points.` });
  if (deltaVariety > 3) suggestions.push({ id: 'variety', tone: 'positive', message: `Meal variety increased by ${deltaVariety} points.` });
  if (result.semanticIntelligence?.comfortAnchorStrength && result.semanticIntelligence.comfortAnchorStrength > 0.6) suggestions.push({ id: 'semantic-comfort', tone: 'positive', message: 'Comfort-oriented meals improved late-week adherence.' });
  if (result.semanticIntelligence?.semanticVarietyScore && result.semanticIntelligence.semanticVarietyScore < 40) suggestions.push({ id: 'semantic-fatigue', tone: 'warning', message: 'Semantic variety is low; rotate fresh/light with cozy/hearty meals.' });
  return suggestions;
};
