import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  inject,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';

import { HeaderComponent } from '../components/header/header.component';
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

interface AnalysisStep {
  id: AnalysisSectionId;
  number: string;
  title: string;
}

@Component({
  selector: 'app-input-page',
  standalone: true,
  imports: [HeaderComponent, NgFor, NgClass, NgIf],
  templateUrl: './input-page.component.html',
  styleUrls: ['./input-page.component.css'],
})
export class InputPageComponent implements AfterViewInit, OnDestroy {
  readonly flow = inject(ProfileFlowService);

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

  ngAfterViewInit(): void {
    this.setupScrollSpy();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
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
    this.flow.updateListField(field, value);
  }

  onAcademicLevelChange(value: AcademicLevel): void {
    this.flow.updateDraftField('academicLevel', value);
  }

  onSkillLevelChange(value: SkillLevel): void {
    this.flow.updateDraftField('skillLevel', value);
  }

  onCareerClarityChange(value: CareerClarity): void {
    this.flow.updateDraftField('careerClarity', value);
  }

  onMainChallengeChange(value: MainChallenge): void {
    this.flow.updateDraftField('mainChallenge', value);
  }

  onPreferredLocationChange(value: PreferredLocation): void {
    this.flow.updateDraftField('preferredLocation', value);
  }

  onOpportunityTypeToggle(value: OpportunityType, checked: boolean): void {
    this.flow.toggleArrayValue('opportunityTypes', value, checked);
  }

  onValueToggle(value: WorkValue, checked: boolean): void {
    this.flow.toggleArrayValue('values', value, checked);
  }

  async submitProfile(): Promise<void> {
    await this.flow.analyzeAndRecommend();
  }

  saveDraft(): void {
    this.flow.saveDraft();
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
}
