import { Component, OnInit, computed, inject } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ProfileFlowService } from '../profile-flow.service';
import { CareerChoice, OpportunityItem } from '../profile-flow.types';
import {
  CARD_TONES_BY_LABEL,
  EMPTY_RADAR_SCORES,
  RADAR_AXIS_LABELS,
  RADAR_LEVELS,
  RADAR_SCORES_BY_CAREER,
  RadarAxis,
  ToneConfig,
  buildTraitTags,
  getCareerIconPath,
  getProfileTitle,
  getReadinessLabel,
  getSkillLevelLabel,
  polarPoint,
  serializePolygon,
} from './result-page.helpers';
import { ResultPdfExportService } from '../shared/services/result-pdf-export.service';

@Component({
  selector: 'app-result-page',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, RouterLink],
  templateUrl: './result-page.component.html',
  styleUrls: ['./result-page.component.css'],
})
export class ResultPageComponent implements OnInit {
  readonly flow = inject(ProfileFlowService);
  private readonly exportService = inject(ResultPdfExportService);

  readonly analyzedProfile = this.flow.analyzedProfile;
  readonly diagnosis = this.flow.diagnosis;
  readonly recommendations = this.flow.recommendations;
  readonly selectedCareerId = this.flow.selectedCareerId;
  readonly plan = this.flow.plan;
  readonly isGeneratingPlan = this.flow.isGeneratingPlan;
  readonly planError = this.flow.planError;

  readonly topChoices = computed(() =>
    this.recommendations()?.topChoices.slice(0, 3) ?? [],
  );

  readonly hasResults = computed(
    () => !!this.analyzedProfile() && this.topChoices().length > 0,
  );

  readonly selectedChoice = computed(() => {
    const choices = this.topChoices();

    if (!choices.length) {
      return null;
    }

    return (
      choices.find((choice) => choice.id === this.selectedCareerId()) ?? choices[0]
    );
  });

  readonly profileTitle = computed(() => {
    const selectedChoice = this.selectedChoice();
    return getProfileTitle(selectedChoice?.id);
  });

  readonly profileSummary = computed(() => {
    const profile = this.analyzedProfile();
    const diagnosis = this.diagnosis();

    if (profile?.personalGoal.trim()) {
      return `"${profile.personalGoal.trim()}"`;
    }

    return diagnosis?.summary ?? 'Your profile is ready for the next step.';
  });

  readonly traitTags = computed(() => {
    return buildTraitTags(
      this.analyzedProfile(),
      this.recommendations()?.profileSummary,
    );
  });

  readonly skillLevelLabel = computed(() => {
    return getSkillLevelLabel(this.analyzedProfile());
  });

  readonly readinessLabel = computed(() => {
    return getReadinessLabel(this.analyzedProfile());
  });

  readonly radarAxes = computed<RadarAxis[]>(() =>
    RADAR_AXIS_LABELS.map((label, index) => {
      const angle = -90 + (360 / RADAR_AXIS_LABELS.length) * index;
      const linePoint = polarPoint(angle, 58);
      const labelPoint = polarPoint(angle, 78);

      return {
        label,
        lineX: linePoint.x,
        lineY: linePoint.y,
        labelX: labelPoint.x,
        labelY: labelPoint.y,
      };
    }),
  );

  readonly radarGridPolygons = computed(() =>
    RADAR_LEVELS.map((level) =>
      serializePolygon(
        Array.from({ length: RADAR_AXIS_LABELS.length }, () => level),
        58,
      ),
    ),
  );

  readonly radarShape = computed(() => {
    const selectedChoice = this.selectedChoice();
    const values = selectedChoice
      ? RADAR_SCORES_BY_CAREER[selectedChoice.id] ?? EMPTY_RADAR_SCORES
      : EMPTY_RADAR_SCORES;

    return serializePolygon(values, 58);
  });

  readonly planSections = computed(() => {
    const roadmap = this.plan()?.roadmap;

    if (!roadmap) {
      return [];
    }

    return [
      {
        label: 'Days 1-30',
        title: 'Build your foundation',
        items: roadmap.first30Days,
      },
      {
        label: 'Days 31-60',
        title: 'Build your momentum',
        items: roadmap.next60Days,
      },
      {
        label: 'Days 61-90',
        title: 'Turn it into traction',
        items: roadmap.next90Days,
      },
    ];
  });

  ngOnInit(): void {
    const selectedChoice = this.selectedChoice();
    const plan = this.plan();

    if (selectedChoice && plan?.selectedPath.id !== selectedChoice.id) {
      void this.flow.generatePlan(selectedChoice.id);
    }
  }

  async selectCareer(choiceId: string): Promise<void> {
    const currentPlan = this.plan();

    if (
      this.selectedCareerId() === choiceId &&
      currentPlan?.selectedPath.id === choiceId
    ) {
      return;
    }

    await this.flow.generatePlan(choiceId);
  }

  getToneClasses(choice: CareerChoice): ToneConfig {
    return CARD_TONES_BY_LABEL[choice.label];
  }

  getCareerIcon(choiceId: string): string {
    return getCareerIconPath(choiceId);
  }

  trackByChoice(_: number, choice: CareerChoice): string {
    return choice.id;
  }

  trackByOpportunity(_: number, opportunity: OpportunityItem): number {
    return opportunity.id;
  }

  exportPlan(): void {
    const selectedChoice = this.selectedChoice();
    const plan = this.plan();
    const analyzedProfile = this.analyzedProfile();
    const recommendations = this.recommendations();

    if (!selectedChoice || !plan || !analyzedProfile || !recommendations) {
      return;
    }

    void this.exportService.exportResultReport({
      analyzedProfile,
      diagnosis: this.diagnosis(),
      recommendations,
      selectedChoice,
      plan,
      profileTitle: this.profileTitle(),
      profileSummary: this.profileSummary(),
      traitTags: this.traitTags(),
      skillLevelLabel: this.skillLevelLabel(),
      readinessLabel: this.readinessLabel(),
    });
  }
}
