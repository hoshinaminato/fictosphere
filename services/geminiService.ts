import { Person, Relationship } from "../types";

// AI functionality has been disabled.
// This service now returns static messages instead of calling the Gemini API.

export const analyzeRelationship = async (
  personA: Person,
  personB: Person | null,
  allLinks: Relationship[],
  allNodes: Person[]
): Promise<string> => {
  return "AI 分析功能已禁用。";
};