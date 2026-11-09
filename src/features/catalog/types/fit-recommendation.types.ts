export interface FitFinderInput {
  heightCm: number;
  weightKg: number;
  fitPreference: 'slim' | 'regular' | 'relaxed';
  waistShape?: 'narrow' | 'standard' | 'full';
}

export interface FitRecommendationResult {
  recommendedSize: string;
  confidenceScore: number;
  fitNote: string;
}

