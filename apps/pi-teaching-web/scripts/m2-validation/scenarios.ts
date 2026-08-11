export const M2_VALIDATION_SCENARIO_IDS = [
  'question-formation',
  'brainstorming',
  'note-proposal',
  'plan-problem-card',
  'focus-cycle',
  'calendar',
  'direct-review',
  'batch-review',
  'lesson-review',
] as const;

export type M2ValidationScenarioId = typeof M2_VALIDATION_SCENARIO_IDS[number];

export type M2ValidationScenario = {
  id: M2ValidationScenarioId;
  title: string;
  entry: 'free-learning' | 'plan' | 'lesson' | 'desktop';
  setup: string;
  studentMessages: readonly string[];
  gates: readonly string[];
};

export const M2_VALIDATION_SCENARIOS: readonly M2ValidationScenario[] = [
  {
    id: 'question-formation',
    title: '从模糊困惑形成问题',
    entry: 'free-learning',
    setup: '不选择资产，开启一段新的自由学习。',
    studentMessages: ['我好像懂平衡移动，但加惰性气体时总会乱，我也说不清自己到底卡在哪里。'],
    gates: [
      '老师先帮助学生区分问题，不把普通对话强行变成固定方法流程',
      '学生形成一个更清楚的解释后，老师才按自然节奏询问是否整理为 Note',
    ],
  },
  {
    id: 'brainstorming',
    title: '四路头脑风暴与可选论文',
    entry: 'free-learning',
    setup: '选择一份学生真实接触过的资产，并确保库中另有一份尚未接触的相关资产。',
    studentMessages: [
      '我想把这个现象往外想一想，看看它还和什么东西有关。先不用查论文。',
      '这些联系挺有意思，可以再查一下有没有相关论文，但只挑真有帮助的。',
    ],
    gates: [
      '公开区分本轮活动证据、库存资产、模型常识和可选论文四种来源',
      '论文检索只能在学生明确同意后发生，拒绝或失败后对话仍可继续',
    ],
  },
  {
    id: 'note-proposal',
    title: 'Note 提案、纠正与自然确认',
    entry: 'free-learning',
    setup: '先让对话形成一个学生参与得出的关键结论。',
    studentMessages: [
      '把我们刚才真正说清楚的部分整理成一份笔记草稿给我看看。',
      '第二段别说成已经掌握，改成我现在还需要检查的边界。',
      '这样就可以，帮我保存下来。',
    ],
    gates: [
      '提案本身不写文件，纠正后公开展示最新草稿',
      '自然语言确认可以保存最新草稿，并出现学生可见的保存结果',
    ],
  },
  {
    id: 'plan-problem-card',
    title: '备课自编题卡提案',
    entry: 'plan',
    setup: '使用一个已批准、正在备课且确实采用教师自编题的 Plan。',
    studentMessages: ['这道自编题可以做成题卡，但先把学生看到的题面给我确认。'],
    gates: [
      '题卡提案只显示题干与学生笔记，不泄露标准答案或教师依据',
      '学生确认后才保存，并保持题卡属于当前 Plan 的既有备课边界',
    ],
  },
  {
    id: 'focus-cycle',
    title: '专注周期',
    entry: 'desktop',
    setup: '在一段可继续的 Free、Plan 或 Lesson 对话中操作 15 分钟计时。',
    studentMessages: [],
    gates: [
      '开始计时不触发教师回复；手动或自然到时结束后才把真实用时交给老师',
      '结束反馈询问实际进展，不声称学生一直专注或已经学会',
      '结束对话会同步结束所属计时，多窗口仍只有一个活动周期',
    ],
  },
  {
    id: 'calendar',
    title: '正式课程与复习约定',
    entry: 'desktop',
    setup: '分别建立一个 Plan 约定和一个带资产的复习约定。',
    studentMessages: [],
    gates: [
      '打开约定只进入它绑定的 Plan 或 Free Learning，不创建旁支课程',
      '跨学习集打开时先切换到精确学习集；明确约定不会因提前复习被自动删除',
    ],
  },
  {
    id: 'direct-review',
    title: '资产页直接复习',
    entry: 'desktop',
    setup: '准备一份带 recall block 的 Note，以及一张曾经看过答案的题卡。',
    studentMessages: [],
    gates: [
      'Note 必须先逐项回忆再自评；题卡重新隐藏答案并绑定本轮新作答',
      'revision 变化、同日重复与未揭示答案都不能写入新的有效结果',
    ],
  },
  {
    id: 'batch-review',
    title: '批量 Free Learning 复习',
    entry: 'free-learning',
    setup: '从同一学习集选择至少三份到期资产，以 review intent 开启 Free Learning。',
    studentMessages: ['今天先复习前两份，第三份先留着，不用为了清空列表硬做完。'],
    gates: [
      '老师先保留每份资产的首次提取表现，再正常讲解',
      '只记录真正触及的两份资产，未触及项仍保持原到期状态',
      '到期不被描述成遗忘，自评结果不被描述成掌握证明',
    ],
  },
  {
    id: 'lesson-review',
    title: '正式 Lesson 吸收到期资产',
    entry: 'lesson',
    setup: '备课时只读查询到期摘要，并把一份与本课目标相关的资产放入 Lesson Uses。',
    studentMessages: ['先让我自己回忆这份旧内容，不要直接把答案带出来。'],
    gates: [
      'Prepare 查询有界且只读，读取候选不会写复习结果',
      'Tutor 只能记录当前 Lesson Uses 中的资产，并且必须发生在冷提取之后',
      '复习事件不自动改对象记忆、课程状态、资产正文或能力判断',
    ],
  },
];

export function m2ValidationScenario(id: string): M2ValidationScenario {
  const scenario = M2_VALIDATION_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`M2_VALIDATION_SCENARIO_UNKNOWN: ${id}`);
  return scenario;
}
