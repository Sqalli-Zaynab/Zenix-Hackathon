import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  AnalyzeProfilePayload,
  CareerChoice,
  CareerRecommendations,
  CareerRecommendResponse,
  Diagnosis,
  EMPTY_PROFILE_DRAFT,
  EMPTY_PROFILE_FLOW_STATE,
  NormalizedProfile,
  OpportunityItem,
  PlanGeneratePayload,
  PlanGenerateResponse,
  PlanResult,
  ProfileAnalyzeResponse,
  ProfileDraft,
  ProfileFlowState,
  WorkValue,
} from './profile-flow.types';

type ArrayDraftField = {
  [K in keyof ProfileDraft]: ProfileDraft[K] extends string[] ? K : never;
}[keyof ProfileDraft];

const STORAGE_KEY = 'afaq.profile-flow.draft';
const RESULT_STORAGE_KEY = 'afaq.profile-flow.result';

type PersistedResultState = Omit<ProfileFlowState, 'draft'>;

const EMPTY_PERSISTED_RESULT_STATE: PersistedResultState = {
  analyzedProfile: null,
  diagnosis: null,
  recommendations: null,
  selectedCareerId: null,
  plan: null,
};

@Injectable({ providedIn: 'root' })
export class ProfileFlowService {
  private readonly apiBaseUrl = '/api';

  private readonly state = signal<ProfileFlowState>({
    ...EMPTY_PROFILE_FLOW_STATE,
    draft: this.loadDraft(),
    ...this.loadResultState(),
  });

  readonly draft = computed(() => this.state().draft);
  readonly analyzedProfile = computed(() => this.state().analyzedProfile);
  readonly diagnosis = computed(() => this.state().diagnosis);
  readonly recommendations = computed(() => this.state().recommendations);
  readonly selectedCareerId = computed(() => this.state().selectedCareerId);
  readonly plan = computed(() => this.state().plan);

  readonly isSubmitting = signal(false);
  readonly isGeneratingPlan = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly planError = signal<string | null>(null);
  readonly analysisTrace = signal<string[]>([]);
  readonly recommendationTrace = signal<string[]>([]);

  constructor(private readonly http: HttpClient) {}

  clearSubmitFeedback(): void {
    this.submitError.set(null);
  }

  clearPlanFeedback(): void {
    this.planError.set(null);
  }

  updateDraftField<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ): void {
    this.patchDraft({ [key]: value } as Pick<ProfileDraft, K>);
  }

  updateListField(key: ArrayDraftField, rawValue: string): void {
    this.patchDraft({
      [key]: this.parseStringList(rawValue),
    } as Pick<ProfileDraft, ArrayDraftField>);
  }

  toggleArrayValue<K extends ArrayDraftField>(
    key: K,
    value: ProfileDraft[K][number],
    checked: boolean,
  ): void {
    const current = this.draft()[key] as string[];
    const next = checked
      ? Array.from(new Set([...current, value as string]))
      : current.filter((item) => item !== value);

    this.patchDraft({
      [key]: next,
    } as Pick<ProfileDraft, K>);
  }

  getListFieldText(key: ArrayDraftField): string {
    return (this.draft()[key] as string[]).join(', ');
  }

  saveDraft(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.draft()));
  }

  resetFlow(): void {
    this.state.set({
      ...EMPTY_PROFILE_FLOW_STATE,
      draft: { ...EMPTY_PROFILE_DRAFT },
    });
    this.isSubmitting.set(false);
    this.isGeneratingPlan.set(false);
    this.submitError.set(null);
    this.planError.set(null);
    this.analysisTrace.set([]);
    this.recommendationTrace.set([]);
    this.clearDraftStorage();
    this.clearResultStorage();
  }

  setSelectedCareerId(careerId: string | null): void {
    this.state.update((state) => ({
      ...state,
      selectedCareerId: careerId,
    }));
    this.saveResultState();
  }

  getAnalyzePayload(): AnalyzeProfilePayload {
    const draft = this.draft();

    return {
      passions: draft.passions,
      interests: draft.interests,
      causes: draft.causes,
      strengths: draft.strengths,
      academicLevel: draft.academicLevel ?? 'undergraduate',
      fieldOfStudy: draft.fieldOfStudy.trim(),
      skillLevel: draft.skillLevel ?? 'beginner',
      personalGoal: draft.personalGoal.trim(),
      careerClarity: draft.careerClarity ?? 'i_dont_know',
      mainChallenge: draft.mainChallenge ?? 'i_dont_know_what_fits_me',
      values: draft.values,
      opportunityTypes: draft.opportunityTypes,
      preferredLocation: draft.preferredLocation ?? 'remote',
    };
  }

  getRecommendPayload(): AnalyzeProfilePayload {
    const normalizedProfile = this.analyzedProfile();

    if (!normalizedProfile) {
      return this.getAnalyzePayload();
    }

    return this.pickAnalyzePayload(normalizedProfile);
  }

  getPlanPayload(): PlanGeneratePayload | null {
    const normalizedProfile = this.analyzedProfile();
    const selectedCareerId = this.selectedCareerId();

    if (!normalizedProfile || !selectedCareerId) {
      return null;
    }

    return {
      ...this.pickAnalyzePayload(normalizedProfile),
      selectedCareerId,
    };
  }

  async analyzeAndRecommend(): Promise<void> {
    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.planError.set(null);

    try {
      const analyzeResponse = await firstValueFrom(
        this.http.post<ProfileAnalyzeResponse>(
          `${this.apiBaseUrl}/profile/analyze`,
          this.getAnalyzePayload(),
        ),
      );

      this.analysisTrace.set(analyzeResponse.agentTrace ?? []);

      this.state.update((state) => ({
        ...state,
        analyzedProfile: analyzeResponse.profile,
        diagnosis: analyzeResponse.diagnosis,
        plan: null,
      }));
      this.saveResultState();

      const recommendResponse = await firstValueFrom(
        this.http.post<CareerRecommendResponse>(
          `${this.apiBaseUrl}/career/recommend`,
          this.pickAnalyzePayload(analyzeResponse.profile),
        ),
      );

      this.recommendationTrace.set(recommendResponse.agentTrace ?? []);

      this.state.update((state) => ({
        ...state,
        recommendations: {
          profileSummary: recommendResponse.profileSummary,
          topChoices: recommendResponse.topChoices,
        },
        selectedCareerId:
          state.selectedCareerId ?? recommendResponse.topChoices[0]?.id ?? null,
      }));
      this.saveResultState();

      this.saveDraft();
    } catch (error) {
      console.error('Profile flow submission failed:', error);
      this.submitError.set(this.getSubmissionErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async generatePlan(careerId: string): Promise<void> {
    const normalizedProfile = this.analyzedProfile();

    if (!normalizedProfile || !careerId) {
      return;
    }

    this.isGeneratingPlan.set(true);
    this.planError.set(null);

    this.state.update((state) => ({
      ...state,
      selectedCareerId: careerId,
      plan: state.plan?.selectedPath.id === careerId ? state.plan : null,
    }));
    this.saveResultState();

    try {
      const payload: PlanGeneratePayload = {
        ...this.pickAnalyzePayload(normalizedProfile),
        selectedCareerId: careerId,
      };

      const response = await firstValueFrom(
        this.http.post<PlanGenerateResponse>(
          `${this.apiBaseUrl}/plan/generate`,
          payload,
        ),
      );

      this.state.update((state) => ({
        ...state,
        analyzedProfile: response.profile,
        selectedCareerId: careerId,
        plan: {
          selectedPath: response.selectedPath,
          roadmap: response.roadmap,
          recommendedOpportunities: response.recommendedOpportunities,
          explanation: response.explanation,
        },
      }));
      this.saveResultState();
    } catch (error) {
      console.error('Plan generation failed:', error);
      this.planError.set(this.getPlanErrorMessage(error));
    } finally {
      this.isGeneratingPlan.set(false);
    }
  }

  private patchDraft(patch: Partial<ProfileDraft>): void {
    let didChange = false;

    this.state.update((state) => {
      const keys = Object.keys(patch) as Array<keyof ProfileDraft>;

      didChange = keys.some((key) =>
        !this.areDraftValuesEqual(state.draft[key], patch[key] as ProfileDraft[typeof key]),
      );

      if (!didChange) {
        return state;
      }

      return {
        ...state,
        draft: {
          ...state.draft,
          ...patch,
        },
        analyzedProfile: null,
        diagnosis: null,
        recommendations: null,
        selectedCareerId: null,
        plan: null,
      };
    });

    if (didChange) {
      this.analysisTrace.set([]);
      this.recommendationTrace.set([]);
      this.submitError.set(null);
      this.planError.set(null);
      this.clearResultStorage();
    }
  }

  private loadDraft(): ProfileDraft {
    if (typeof localStorage === 'undefined') {
      return { ...EMPTY_PROFILE_DRAFT };
    }

    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ??
        localStorage.getItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.draft');

      if (!raw) {
        return { ...EMPTY_PROFILE_DRAFT };
      }

      const parsed = JSON.parse(raw) as Partial<ProfileDraft>;

      return {
        ...EMPTY_PROFILE_DRAFT,
        ...parsed,
        passions: this.ensureStringArray(parsed.passions),
        interests: this.ensureStringArray(parsed.interests),
        causes: this.ensureStringArray(parsed.causes),
        strengths: this.ensureStringArray(parsed.strengths),
        values: this.ensureStringArray(parsed.values) as WorkValue[],
        opportunityTypes: this.ensureStringArray(parsed.opportunityTypes) as ProfileDraft['opportunityTypes'],
      };
    } catch {
      return { ...EMPTY_PROFILE_DRAFT };
    }
  }

  private loadResultState(): PersistedResultState {
    if (typeof localStorage === 'undefined') {
      return { ...EMPTY_PERSISTED_RESULT_STATE };
    }

    try {
      const raw =
        localStorage.getItem(RESULT_STORAGE_KEY) ??
        localStorage.getItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.result');

      if (!raw) {
        return { ...EMPTY_PERSISTED_RESULT_STATE };
      }

      const parsed = JSON.parse(raw) as Partial<PersistedResultState>;

      return {
        analyzedProfile: this.sanitizeNormalizedProfile(parsed.analyzedProfile),
        diagnosis: this.sanitizeDiagnosis(parsed.diagnosis),
        recommendations: this.sanitizeRecommendations(parsed.recommendations),
        selectedCareerId:
          typeof parsed.selectedCareerId === 'string'
            ? parsed.selectedCareerId
            : null,
        plan: this.sanitizePlan(parsed.plan),
      };
    } catch {
      return { ...EMPTY_PERSISTED_RESULT_STATE };
    }
  }

  private pickAnalyzePayload(profile: AnalyzeProfilePayload): AnalyzeProfilePayload {
    return {
      passions: [...profile.passions],
      interests: [...profile.interests],
      causes: [...profile.causes],
      strengths: [...profile.strengths],
      academicLevel: profile.academicLevel,
      fieldOfStudy: profile.fieldOfStudy,
      skillLevel: profile.skillLevel,
      personalGoal: profile.personalGoal,
      careerClarity: profile.careerClarity,
      mainChallenge: profile.mainChallenge,
      values: [...profile.values],
      opportunityTypes: [...profile.opportunityTypes],
      preferredLocation: profile.preferredLocation,
    };
  }

  private parseStringList(rawValue: string): string[] {
    return rawValue
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private ensureStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }

  private sanitizeNormalizedProfile(value: unknown): NormalizedProfile | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    return {
      passions: this.ensureStringArray(data.passions),
      interests: this.ensureStringArray(data.interests),
      causes: this.ensureStringArray(data.causes),
      strengths: this.ensureStringArray(data.strengths),
      academicLevel:
        typeof data.academicLevel === 'string'
          ? data.academicLevel
          : 'undergraduate',
      fieldOfStudy:
        typeof data.fieldOfStudy === 'string' ? data.fieldOfStudy : '',
      skillLevel:
        typeof data.skillLevel === 'string' ? data.skillLevel : 'beginner',
      personalGoal:
        typeof data.personalGoal === 'string' ? data.personalGoal : '',
      careerClarity:
        typeof data.careerClarity === 'string'
          ? data.careerClarity
          : 'i_dont_know',
      mainChallenge:
        typeof data.mainChallenge === 'string'
          ? data.mainChallenge
          : 'i_dont_know_what_fits_me',
      values: this.ensureStringArray(data.values) as WorkValue[],
      opportunityTypes: this.ensureStringArray(
        data.opportunityTypes,
      ) as AnalyzeProfilePayload['opportunityTypes'],
      preferredLocation:
        typeof data.preferredLocation === 'string'
          ? data.preferredLocation
          : 'remote',
      themes: this.ensureStringArray(data.themes),
      readiness:
        typeof data.readiness === 'number' && Number.isFinite(data.readiness)
          ? data.readiness
          : 0,
    } as NormalizedProfile;
  }

  private sanitizeDiagnosis(value: unknown): Diagnosis | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    return {
      recommendationMode:
        typeof data.recommendationMode === 'string'
          ? data.recommendationMode
          : 'explore',
      mainNeed: typeof data.mainNeed === 'string' ? data.mainNeed : '',
      summary: typeof data.summary === 'string' ? data.summary : '',
      suggestedNextStep:
        typeof data.suggestedNextStep === 'string'
          ? data.suggestedNextStep
          : '',
    } as Diagnosis;
  }

  private sanitizeRecommendations(value: unknown): CareerRecommendations | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (!this.isRecord(data.profileSummary)) {
      return null;
    }

    const summary: any = data.profileSummary;

    const topChoices = Array.isArray(data.topChoices)
      ? data.topChoices
          .map((choice: unknown) => this.sanitizeCareerChoice(choice))
          .filter(
            (choice: CareerChoice | null): choice is CareerChoice =>
              choice !== null,
          )
      : [];

    if (!topChoices.length) {
      return null;
    }

    return {
      profileSummary: {
        themes: this.ensureStringArray(summary.themes),
        readiness:
          typeof summary.readiness === 'number' &&
          Number.isFinite(summary.readiness)
            ? summary.readiness
            : 0,
        careerClarity:
          typeof summary.careerClarity === 'string'
            ? summary.careerClarity
            : '',
      },
      topChoices,
    };
  }

  private sanitizeCareerChoice(value: unknown): CareerChoice | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (typeof data.id !== 'string' || typeof data.title !== 'string') {
      return null;
    }

    return {
      label:
        typeof data.label === 'string' ? data.label : 'alternative',
      id: data.id,
      title: data.title,
      score:
        typeof data.score === 'number' && Number.isFinite(data.score)
          ? data.score
          : 0,
      entryDifficulty:
        typeof data.entryDifficulty === 'string'
          ? data.entryDifficulty
          : 'medium',
      shortDescription:
        typeof data.shortDescription === 'string' ? data.shortDescription : '',
      reasons: this.ensureStringArray(data.reasons),
      recommendedOpportunities: this.ensureStringArray(
        data.recommendedOpportunities,
      ),
    } as CareerChoice;
  }

  private sanitizePlan(value: unknown): PlanResult | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (!this.isRecord(data.selectedPath) || !this.isRecord(data.roadmap)) {
      return null;
    }

    if (typeof data.selectedPath.id !== 'string' || typeof data.selectedPath.title !== 'string') {
      return null;
    }

    return {
      selectedPath: {
        id: data.selectedPath.id,
        title: data.selectedPath.title,
        shortDescription:
          typeof data.selectedPath.shortDescription === 'string'
            ? data.selectedPath.shortDescription
            : '',
      },
      roadmap: {
        first30Days: this.ensureStringArray(data.roadmap.first30Days),
        next60Days: this.ensureStringArray(data.roadmap.next60Days),
        next90Days: this.ensureStringArray(data.roadmap.next90Days),
      },
      recommendedOpportunities: Array.isArray(data.recommendedOpportunities)
        ? data.recommendedOpportunities
            .map((item: unknown) => this.sanitizeOpportunity(item))
            .filter(
              (item: OpportunityItem | null): item is OpportunityItem =>
                item !== null,
            )
        : [],
      explanation:
        typeof data.explanation === 'string' ? data.explanation : '',
    };
  }

  private sanitizeOpportunity(value: unknown): OpportunityItem | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (typeof data.id !== 'number') {
      return null;
    }

    return {
      id: data.id,
      title: typeof data.title === 'string' ? data.title : '',
      type: typeof data.type === 'string' ? data.type : '',
      location: typeof data.location === 'string' ? data.location : '',
      tags: this.ensureStringArray(data.tags),
      description:
        typeof data.description === 'string' ? data.description : '',
    };
  }

  private saveResultState(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const resultState = this.getPersistedResultState();

    if (
      !resultState.analyzedProfile &&
      !resultState.diagnosis &&
      !resultState.recommendations &&
      !resultState.selectedCareerId &&
      !resultState.plan
    ) {
      this.clearResultStorage();
      return;
    }

    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(resultState));
  }

  private getPersistedResultState(): PersistedResultState {
    const state = this.state();

    return {
      analyzedProfile: state.analyzedProfile,
      diagnosis: state.diagnosis,
      recommendations: state.recommendations,
      selectedCareerId: state.selectedCareerId,
      plan: state.plan,
    };
  }

  private clearDraftStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.draft');
  }

  private clearResultStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(RESULT_STORAGE_KEY);
    localStorage.removeItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.result');
  }

  private areDraftValuesEqual<T>(current: T, next: T): boolean {
    if (Array.isArray(current) && Array.isArray(next)) {
      return (
        current.length === next.length &&
        current.every((value, index) => value === next[index])
      );
    }

    return current === next;
  }

  private getSubmissionErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage =
        typeof error.error?.error === 'string' ? error.error.error : null;

      if (backendMessage) {
        if (backendMessage === 'Profile analysis failed') {
          return 'We couldn’t understand your profile just yet. Please try again.';
        }

        if (backendMessage === 'Career recommendation failed') {
          return 'We analyzed your profile, but your recommendations are not ready yet. Please try again.';
        }
      }
    }

    return 'We couldn’t complete this step right now. Please try again.';
  }

  private getPlanErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.error === 'string') {
        return 'We couldn’t build this action plan right now. Please try again.';
      }
    }

    return 'We couldn’t build this action plan right now. Please try again.';
  }
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
