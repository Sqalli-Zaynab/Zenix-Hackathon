import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  inject,
  OnDestroy,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';

import { ProfileFlowService } from '../profile-flow.service';
import {
  AcademicLevel,
  CareerClarity,
  MainChallenge,
  OpportunityType,
  PreferredLocation,
  SkillLevel,
  WorkValue,
} from '../profile-flow.types';

type AnalysisSectionId = 'pics' | 'context' | 'direction' | 'opportunities';
type ValidatableField =
  | 'passions'
  | 'interests'
  | 'causes'
  | 'strengths'
  | 'academicLevel'
  | 'skillLevel'
  | 'personalGoal'
  | 'careerClarity'
  | 'mainChallenge'
  | 'values'
  | 'opportunityTypes'
  | 'preferredLocation';

type ValidationErrors = Partial<Record<ValidatableField, string>>;

interface AnalysisStep {
  id: AnalysisSectionId;
  number: string;
  title: string;
}

@Component({
  selector: 'app-input-page',
  standalone: true,
  imports: [NgFor, NgClass, NgIf],
  templateUrl: './input-page.component.html',
  styleUrls: ['./input-page.component.css'],
})
export class InputPageComponent implements AfterViewInit, OnDestroy {
  readonly flow = inject(ProfileFlowService);
  private readonly router = inject(Router);

  readonly steps: AnalysisStep[] = [
    { id: 'pics', number: '1', title: 'About you' },
    { id: 'context', number: '2', title: 'Context' },
    { id: 'direction', number: '3', title: 'Direction' },
    { id: 'opportunities', number: '4', title: 'Opportunities' },
  ];

  readonly draft = this.flow.draft;
  readonly recommendations = this.flow.recommendations;
  readonly diagnosis = this.flow.diagnosis;
  readonly submitError = this.flow.submitError;
  readonly isSubmitting = this.flow.isSubmitting;
  readonly selectedCareerId = this.flow.selectedCareerId;
  readonly validationErrors = signal<ValidationErrors>({});
  readonly saveMessage = signal<string | null>(null);
  readonly validationMessage = computed(() =>
    Object.keys(this.validationErrors()).length
      ? 'Please complete the highlighted fields before continuing.'
      : null,
  );
  readonly topChoiceTitle = computed(
    () => this.recommendations()?.topChoices[0]?.title ?? null,
  );

  readonly valueOptions: ReadonlyArray<{ label: string; value: WorkValue }> = [
    { label: 'Impact', value: 'impact' },
    { label: 'Growth', value: 'growth' },
    { label: 'Stability', value: 'stability' },
    { label: 'Creativity', value: 'creativity' },
    { label: 'Freedom', value: 'freedom' },
    { label: 'Challenge', value: 'challenge' },
    { label: 'Innovation', value: 'innovation' },
  ];

  activeSectionId: AnalysisSectionId = 'pics';

  @ViewChildren('analysisSection')
  private readonly sections!: QueryList<ElementRef<HTMLElement>>;

  private observer?: IntersectionObserver;
  private readonly stickyOffset = 112;
  private saveMessageTimeout?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.setupScrollSpy();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();

    if (this.saveMessageTimeout) {
      clearTimeout(this.saveMessageTimeout);
    }
  }

  scrollToSection(sectionId: AnalysisSectionId): void {
    this.activeSectionId = sectionId;

    const section = this.sections.find(
      ({ nativeElement }) => nativeElement.id === sectionId,
    )?.nativeElement;

    if (!section || typeof window === 'undefined') {
      return;
    }

    const top =
      section.getBoundingClientRect().top + window.scrollY - this.stickyOffset;

    window.scrollTo({
      top,
      behavior: 'smooth',
    });
  }

  isStepActive(sectionId: AnalysisSectionId): boolean {
    return this.activeSectionId === sectionId;
  }

  isStepCompleted(sectionId: AnalysisSectionId): boolean {
    return this.getStepIndex(sectionId) < this.getStepIndex(this.activeSectionId);
  }

  getProgressRatio(): number {
    const lastIndex = this.steps.length - 1;

    if (lastIndex <= 0) {
      return 0;
    }

    return this.getStepIndex(this.activeSectionId) / lastIndex;
  }

  getListFieldValue(
    field: 'passions' | 'interests' | 'causes' | 'strengths',
  ): string {
    return this.flow.getListFieldText(field);
  }

  onListFieldInput(
    field: 'passions' | 'interests' | 'causes' | 'strengths',
    value: string,
  ): void {
    this.clearInlineFeedback(field);
    this.flow.updateListField(field, value);
  }

  onAcademicLevelChange(value: AcademicLevel): void {
    this.clearInlineFeedback('academicLevel');
    this.flow.updateDraftField('academicLevel', value);
  }

  onSkillLevelChange(value: SkillLevel): void {
    this.clearInlineFeedback('skillLevel');
    this.flow.updateDraftField('skillLevel', value);
  }

  onCareerClarityChange(value: CareerClarity): void {
    this.clearInlineFeedback('careerClarity');
    this.flow.updateDraftField('careerClarity', value);
  }

  onMainChallengeChange(value: MainChallenge): void {
    this.clearInlineFeedback('mainChallenge');
    this.flow.updateDraftField('mainChallenge', value);
  }

  onPreferredLocationChange(value: PreferredLocation): void {
    this.clearInlineFeedback('preferredLocation');
    this.flow.updateDraftField('preferredLocation', value);
  }

  onOpportunityTypeToggle(value: OpportunityType, checked: boolean): void {
    this.clearInlineFeedback('opportunityTypes');
    this.flow.toggleArrayValue('opportunityTypes', value, checked);
  }

  onValueToggle(value: WorkValue, checked: boolean): void {
    this.clearInlineFeedback('values');
    this.flow.toggleArrayValue('values', value, checked);
  }

  onFieldOfStudyInput(value: string): void {
    this.clearTransientMessages();
    this.flow.updateDraftField('fieldOfStudy', value);
  }

  onPersonalGoalInput(value: string): void {
    this.clearInlineFeedback('personalGoal');
    this.flow.updateDraftField('personalGoal', value);
  }

  async submitProfile(): Promise<void> {
    this.saveMessage.set(null);
    this.flow.clearSubmitFeedback();

    if (!this.validateDraft()) {
      return;
    }

    await this.flow.analyzeAndRecommend();

    if (!this.submitError() && this.recommendations()?.topChoices.length) {
      await this.router.navigate(['/results']);
    }
  }

  saveDraft(): void {
    this.clearTransientMessages();
    this.flow.saveDraft();
    this.saveMessage.set('Draft saved.');

    if (this.saveMessageTimeout) {
      clearTimeout(this.saveMessageTimeout);
    }

    this.saveMessageTimeout = setTimeout(() => {
      this.saveMessage.set(null);
    }, 2500);
  }

  hasValidationError(field: ValidatableField): boolean {
    return !!this.validationErrors()[field];
  }

  getValidationError(field: ValidatableField): string | null {
    return this.validationErrors()[field] ?? null;
  }

  private setupScrollSpy(): void {
    if (
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio ||
              Math.abs(a.boundingClientRect.top) -
                Math.abs(b.boundingClientRect.top),
          );

        const currentEntry = visibleEntries[0];

        if (currentEntry?.target instanceof HTMLElement) {
          this.activeSectionId = currentEntry.target.id as AnalysisSectionId;
        }
      },
      {
        root: null,
        rootMargin: `-${this.stickyOffset + 28}px 0px -48% 0px`,
        threshold: [0.18, 0.32, 0.52, 0.72],
      },
    );

    this.sections.forEach((section) => {
      this.observer?.observe(section.nativeElement);
    });
  }

  private getStepIndex(sectionId: AnalysisSectionId): number {
    return this.steps.findIndex((step) => step.id === sectionId);
  }

  private validateDraft(): boolean {
    const draft = this.draft();
    const errors: ValidationErrors = {};

    if (!draft.passions.length) {
      errors.passions = 'Add at least one item.';
    }

    if (!draft.interests.length) {
      errors.interests = 'Add at least one item.';
    }

    if (!draft.causes.length) {
      errors.causes = 'Add at least one item.';
    }

    if (!draft.strengths.length) {
      errors.strengths = 'Add at least one item.';
    }

    if (!draft.academicLevel) {
      errors.academicLevel = 'Select one option.';
    }

    if (!draft.skillLevel) {
      errors.skillLevel = 'Select one option.';
    }

    if (!draft.personalGoal.trim()) {
      errors.personalGoal = 'Please complete this field.';
    }

    if (!draft.careerClarity) {
      errors.careerClarity = 'Select one option.';
    }

    if (!draft.mainChallenge) {
      errors.mainChallenge = 'Select one option.';
    }

    if (!draft.values.length) {
      errors.values = 'Select at least one option.';
    }

    if (!draft.opportunityTypes.length) {
      errors.opportunityTypes = 'Select at least one option.';
    }

    if (!draft.preferredLocation) {
      errors.preferredLocation = 'Select one option.';
    }

    this.validationErrors.set(errors);

    const firstInvalidField = Object.keys(errors)[0] as ValidatableField | undefined;

    if (firstInvalidField) {
      this.focusField(firstInvalidField);
      return false;
    }

    return true;
  }

  private clearInlineFeedback(field?: ValidatableField): void {
    if (field && this.validationErrors()[field]) {
      const { [field]: _removed, ...rest } = this.validationErrors();
      this.validationErrors.set(rest);
    }

    this.clearTransientMessages();
  }

  private clearTransientMessages(): void {
    this.flow.clearSubmitFeedback();
    this.saveMessage.set(null);
  }

  private focusField(field: ValidatableField): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const fieldElement = document.querySelector<HTMLElement>(
      `[data-field="${field}"]`,
    );

    if (!fieldElement) {
      return;
    }

    const top =
      fieldElement.getBoundingClientRect().top + window.scrollY - this.stickyOffset - 20;

    window.scrollTo({
      top,
      behavior: 'smooth',
    });

    window.setTimeout(() => {
      const focusTarget = fieldElement.querySelector<HTMLElement>(
        'textarea, input, button',
      );
      focusTarget?.focus();
    }, 220);
  }
}
