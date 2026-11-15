// SAF-01 cast (all male). Rocketbox bodies (MIT) for Mahmoud and Mr. Fathy; Eng. Karim is the scanned full-body man in the
// suit (his hidden Rocketbox skeleton runs the clips, the splat figure follows it). Scripts are set by the scenario (§ SAF).
const NPC_CLIPS = ['m_idle_nervous_03', 'm_idle_look_around_01', 'm_idle_cough_01', 'm_walk_fast_01'];
const WORKERS = [
  { id: 'mahmoud', av: 'Construction_Male_02', pre: 'm101', hide: ['helmet'],          // a classmate: no hard hat
    pos: [-1.25, 3.7], script: [idle('m_idle_nervous_03', Infinity, [.8, -3.5])], after: null, extra: NPC_CLIPS },
  { id: 'fathy', av: 'Construction_Male_01', pre: 'm111', pos: [3.3, -1.75], script: [idle('m_idle_nervous_03', Infinity, [1.6, -4.2])], after: null, extra: NPC_CLIPS },
  { id: 'karim', av: 'Construction_Male_01', pre: 'm111', pos: [-7.7, 1.5], man: true, script: [idle('m_idle_look_around_01', Infinity, [-5, 1.5])], after: null, extra: NPC_CLIPS },
];
