import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  AnalyzeProfilePayload,
  CareerRecommendResponse,
  EMPTY_PROFILE_DRAFT,
  EMPTY_PROFILE_FLOW_STATE,
  PlanGeneratePayload,
  ProfileAnalyzeResponse,
  ProfileDraft,
  ProfileFlowState,
  WorkValue,
} from './profile-flow.types';

type ArrayDraftField = {
  [K in keyof ProfileDraft]: ProfileDraft[K] extends string[] ? K : never;
}[keyof ProfileDraft];

const STORAGE_KEY = 'pathai.profile-flow.draft';

@Injectable({ providedIn: 'root' })
export class ProfileFlowService {
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  private readonly state = signal<ProfileFlowState>({
    ...EMPTY_PROFILE_FLOW_STATE,
    draft: this.loadDraft(),
  });

  readonly draft = computed(() => this.state().draft);
  readonly analyzedProfile = computed(() => this.state().analyzedProfile);
  readonly diagnosis = computed(() => this.state().diagnosis);
  readonly recommendations = computed(() => this.state().recommendations);
  readonly selectedCareerId = computed(() => this.state().selectedCareerId);
  readonly plan = computed(() => this.state().plan);

  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly analysisTrace = signal<string[]>([]);
  readonly recommendationTrace = signal<string[]>([]);

  constructor(private readonly http: HttpClient) {}

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

  setSelectedCareerId(careerId: string | null): void {
    this.state.update((state) => ({
      ...state,
      selectedCareerId: careerId,
    }));
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

      this.saveDraft();
    } catch (error) {
      console.error('Profile flow submission failed:', error);
      this.submitError.set(
        'The profile could not be analyzed right now. Please try again.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private patchDraft(patch: Partial<ProfileDraft>): void {
    this.state.update((state) => ({
      ...state,
      draft: {
        ...state.draft,
        ...patch,
      },
    }));
  }

  private loadDraft(): ProfileDraft {
    if (typeof localStorage === 'undefined') {
      return { ...EMPTY_PROFILE_DRAFT };
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

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
}
