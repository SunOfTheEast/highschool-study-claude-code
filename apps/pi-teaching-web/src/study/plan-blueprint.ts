import type { ActivationSnapshotDraft } from './activation-snapshot';
import {
  renderPreparedActivationSnapshot,
  validateActivationSnapshotDraft,
} from './activation-snapshot';

export type PlanBlueprint = {
  title: string;
  publicPurpose: string;
  goal: string;
  capabilityStandard: string;
  test: string;
  planningBasis: string;
  activation: ActivationSnapshotDraft;
};

export type PlanRenderContext = {
  planId: string;
  planPath: string;
  parentId: string;
  parentPath: string;
};

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function invalidBlueprint(): never {
  throw new Error('PLAN_BLUEPRINT_INVALID');
}

function nonempty(value: string): string {
  const result = value.trim();
  if (!result) invalidBlueprint();
  return result;
}

export function validatePlanBlueprint(
  blueprint: PlanBlueprint,
): PlanBlueprint {
  return {
    title: nonempty(blueprint.title),
    publicPurpose: nonempty(blueprint.publicPurpose),
    goal: nonempty(blueprint.goal),
    capabilityStandard: nonempty(blueprint.capabilityStandard),
    test: nonempty(blueprint.test),
    planningBasis: nonempty(blueprint.planningBasis),
    activation: validateActivationSnapshotDraft(blueprint.activation),
  };
}

function validateContext(context: PlanRenderContext): PlanRenderContext {
  if (
    !idPattern.test(context.planId)
    || context.planPath !== `plans/${context.planId}.md`
    || context.parentId !== 'roadmap'
    || context.parentPath !== 'ROADMAP.md'
  ) {
    throw new Error('PLAN_RENDER_CONTEXT_INVALID');
  }
  return { ...context };
}

export function renderPreparedPlan(
  contextInput: PlanRenderContext,
  blueprintInput: PlanBlueprint,
): string {
  const context = validateContext(contextInput);
  const blueprint = validatePlanBlueprint(blueprintInput);
  const activation = renderPreparedActivationSnapshot(
    `roadmap:${context.parentId}`,
    blueprint.activation,
  );
  return `---
id: ${context.planId}
kind: plan
status: prepared
parent_id: ${context.parentId}
parent_path: ${context.parentPath}
coach_session: null
---
# ${blueprint.title}

> ${blueprint.publicPurpose}

## Goal

${blueprint.goal}

## Observable Capability Standard

${blueprint.capabilityStandard}

## Test

${blueprint.test}

## Planning Basis

${blueprint.planningBasis}

${activation}
## Lesson Tree

（尚未编排 Lesson。）

## Current Position

Plan 已备妥，等待学生启动。

## Plan Summary

（尚未完成）

## Handoff

（尚未封存）
`;
}
