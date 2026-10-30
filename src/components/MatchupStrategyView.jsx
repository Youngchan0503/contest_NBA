import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChartNoAxesCombined,
  CircleAlert,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Users,
  Zap,
  RotateCcw
} from 'lucide-react';
import { PLAYERS } from '../data/mockPlayers';
import { NBA_TEAMS_2026 } from '../data/teamStandings2026';
import { buildMatchupPlan, getLeagueBenchmarks, summarizeTeam, summarizeCustomLineup } from '../data/matchupStrategy';

const CURRENT_SEASON = 2026;

// 기본 중립 대기 위치 (공격 / 수비)
const DEFAULT_OFFENSE_COORDINATES = {
  PG: [300, 125],
  SG: [110, 195],
  SF: [490, 195],
  PF: [165, 305],
  C: [435, 305]
};

const DEFAULT_DEFENSE_COORDINATES = {
  PG: [300, 150],
  SG: [140, 215],
  SF: [460, 215],
  PF: [205, 290],
  C: [395, 305]
};

const ROUTE_CONFIG = {
  // 공격 전술 동선
  dribble: { color: '#f43f5e', strokeWidth: 2.7, label: '드리블 돌파' },
  pass: { color: '#0ea5e9', strokeWidth: 2.5, label: '패스' },
  screen: { color: '#f59e0b', strokeWidth: 2.7, label: '스크린' },
  cut: { color: '#10b981', strokeWidth: 2.5, label: '오프볼 컷인' },
  // 수비 전술 동선
  closeout: { color: '#0284c7', strokeWidth: 2.5, label: '외곽 클로즈아웃' },
  rotation: { color: '#8b5cf6', strokeWidth: 2.7, label: '헬프 수비 로테이션' },
  trap: { color: '#ec4899', strokeWidth: 2.7, label: '더블팀 트랩' },
  drop: { color: '#059669', strokeWidth: 2.5, label: '골밑 드롭' }
};

function compactCourtRole(role, maxLength = 8) {
  const cleanRole = String(role || '').replace(/\s+/g, ' ').trim();
  const mainRole = cleanRole.split(/[(&,/·]/, 1)[0].trim();
  const words = mainRole.split(/\s+/).filter(Boolean);
  let compact = '';

  for (const word of words) {
    const next = compact ? `${compact} ${word}` : word;
    if (next.length > maxLength) break;
    compact = next;
  }

  if (compact) return compact;
  return `${(words[0] || cleanRole).slice(0, Math.max(1, maxLength - 1))}…`;
}

function TeamPicker({ team, teams, onChange, side, excludedTeamId, customTeamOption }) {
  return (
    <label className="matchup-team-picker">
      <span className="matchup-picker-label">{side === 'A' ? 'HOME · 분석 팀' : 'AWAY · 상대 팀'}</span>
      <span className="matchup-picker-select-wrap">
        <img src={team.logoUrl} alt="" className="matchup-picker-logo" />
        <select value={team.id} onChange={(event) => onChange(event.target.value)} aria-label={`${side} 팀 선택`}>
          {customTeamOption && side === 'A' && (
            <option value="CUSTOM">
              ⭐ [내 맞춤 라인업] {customTeamOption.nameKo}
            </option>
          )}
          {teams.map((option) => (
            <option key={option.id} value={option.id} disabled={option.id === excludedTeamId}>
              {option.id} · {option.nameKo}
            </option>
          ))}
        </select>
      </span>
      <span className="matchup-team-record">
        {team.isCustom
          ? '⭐ 머신러닝 맞춤 5인 라인업'
          : `${team.wins}승 ${team.losses}패 · ${team.conference === 'West' ? '서부' : '동부'}`}
      </span>
    </label>
  );
}

function CourtStrategyDiagram({ team, summary, style, aiTactics, tacticMode, aiStatus, onRequestAi }) {
  const isDefense = tacticMode === 'defense';
  const tacticData = isDefense
    ? (aiTactics?.defense || (aiTactics?.schemeName ? aiTactics : null))
    : (aiTactics?.offense || (aiTactics?.playName ? aiTactics : null));

  const hasAiTactics = Boolean(tacticData && (tacticData.playName || tacticData.schemeName));
  const fallbackCoords = isDefense ? DEFAULT_DEFENSE_COORDINATES : DEFAULT_OFFENSE_COORDINATES;

  // 선수 토큰 간격 강제 보정 알고리즘
  const coordinates = useMemo(() => {
    const raw = {};
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

    for (const pos of positions) {
      const aiPos = hasAiTactics ? tacticData?.playerPlacements?.[pos] : null;
      if (aiPos && Number.isFinite(aiPos.x) && Number.isFinite(aiPos.y)) {
        raw[pos] = [
          Math.max(80, Math.min(520, aiPos.x)),
          Math.max(110, Math.min(360, aiPos.y))
        ];
      } else {
        raw[pos] = [...fallbackCoords[pos]];
      }
    }

    const MIN_DIST = 68;
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const p1 = positions[i];
          const p2 = positions[j];
          const dx = raw[p2][0] - raw[p1][0];
          const dy = raw[p2][1] - raw[p1][1];
          const dist = Math.hypot(dx, dy);
          if (dist < MIN_DIST && dist > 0) {
            const overlap = (MIN_DIST - dist) / 2;
            const nx = (dx / dist) * overlap;
            const ny = (dy / dist) * overlap;
            raw[p1][0] = Math.max(80, Math.min(520, raw[p1][0] - nx));
            raw[p1][1] = Math.max(110, Math.min(360, raw[p1][1] - ny));
            raw[p2][0] = Math.max(80, Math.min(520, raw[p2][0] + nx));
            raw[p2][1] = Math.max(110, Math.min(360, raw[p2][1] + ny));
          }
        }
      }
    }

    return raw;
  }, [hasAiTactics, tacticData, fallbackCoords]);

  const tacticTitle = isDefense
    ? (hasAiTactics ? tacticData?.schemeName : `${style.label} 맞춤 수비 대기`)
    : (hasAiTactics ? tacticData?.playName : `${style.label} 공격 배치`);

  return (
    <div className={`strategy-court-wrap ${!hasAiTactics ? 'is-court-standby' : 'is-court-active'}`}>
      <div className="strategy-court-heading">
        <div>
          <span className="strategy-court-eyebrow">
            {hasAiTactics
              ? (isDefense ? '🛡️ AI Agent 실시간 설계 수비 전술' : '⚔️ AI Agent 실시간 설계 공격 전술')
              : (aiStatus === 'loading'
                ? '⏳ AI Agent 전술 분석 진행 중'
                : (isDefense ? '🛡️ 수비 전술 코트 시뮬레이션' : '⚔️ 공격 전술 코트 시뮬레이션'))}
          </span>
          <h3>
            {team.nameKo} · {tacticTitle}
          </h3>
          {hasAiTactics && tacticData.tacticalConcept ? (
            <p className="strategy-concept-desc">{tacticData.tacticalConcept}</p>
          ) : (
            <p className="strategy-concept-desc">
              {aiStatus === 'loading'
                ? 'AI Agent가 상대 팀 기록을 분석해 최적의 전술 배치와 이동 동선을 계산하고 있습니다.'
                : '우측의 [AI 전략 분석 실행]을 누르면 상대 팀 기록에 맞춘 전술 동선 화살표와 역할이 코트에 그려집니다.'}
            </p>
          )}
        </div>
        <span className="strategy-season-tag">
          {hasAiTactics
            ? (isDefense ? 'AI 수비 전술' : 'AI 공격 전술')
            : (summary.isCustomLineup ? '맞춤 라인업 적용됨' : `${CURRENT_SEASON - 1}–${String(CURRENT_SEASON).slice(-2)}`)}
        </span>
      </div>

      <div className="strategy-court-stage">
        <svg className={`strategy-court-svg ${!hasAiTactics ? 'court-is-blurred' : ''}`} viewBox="0 0 600 425" role="img" aria-label={`${team.nameKo} 전술 배치`}>
          <defs>
            <linearGradient id="strategy-floor" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff4d8" />
              <stop offset="100%" stopColor="#f0d9a8" />
            </linearGradient>

            {/* AI 분석 중 코트 레이저 스캐너 그라데이션 */}
            <linearGradient id="scanner-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7657dc" stopOpacity="0" />
              <stop offset="25%" stopColor="#a78bfa" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="1" />
              <stop offset="75%" stopColor="#a78bfa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#7657dc" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="scanner-glow-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7657dc" stopOpacity="0" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
            </linearGradient>

            {/* 작고 가벼운 쉐브론 화살촉 */}
            <marker id="marker-ai-dribble" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="marker-ai-pass" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="marker-ai-screen" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="marker-ai-cut" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>

            {/* AI 수비 전술 화살표 마커 */}
            <marker id="marker-ai-closeout" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="marker-ai-rotation" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="marker-ai-trap" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="marker-ai-drop" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M1 1 L7 4 L1 7" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>

            {/* 콤팩트 아바타 원형 클리핑 */}
            <clipPath id="strategy-avatar-clip-compact">
              <circle cx="0" cy="0" r="19" />
            </clipPath>
          </defs>

          {/* 2D 농구 하프코트 베이스라인/키/3점라인 */}
          <rect x="10" y="10" width="580" height="405" rx="22" fill="url(#strategy-floor)" stroke="#bd905c" strokeWidth="3" />
          <path d="M 42 415 L 42 238 C 42 84 558 84 558 238 L 558 415" fill="none" stroke="#9a7045" strokeWidth="3" opacity="0.7" />
          <rect x="220" y="210" width="160" height="195" fill="rgba(118,87,220,0.06)" stroke="#9a7045" strokeWidth="2.5" />
          <path d="M 220 210 A 80 80 0 0 1 380 210" fill="none" stroke="#9a7045" strokeWidth="2" />
          <path d="M 220 210 A 80 80 0 0 0 380 210" fill="none" stroke="#9a7045" strokeWidth="2" strokeDasharray="8 7" opacity="0.65" />
          <circle cx="300" cy="205" r="60" fill="none" stroke="#9a7045" strokeWidth="2" opacity="0.55" />
          <line x1="266" y1="373" x2="334" y2="373" stroke="#684a30" strokeWidth="5" strokeLinecap="round" />
          <circle cx="300" cy="365" r="10" fill="#f06a35" stroke="#fff6e4" strokeWidth="3" />

          {/* AI 로딩 중: 하이테크 레이저 스캔 빔 애니메이션 */}
          {aiStatus === 'loading' && (
            <g className="court-scanner-beam">
              <line x1="20" y1="0" x2="580" y2="0" stroke="url(#scanner-line-grad)" strokeWidth="3.5" />
              <rect x="20" y="-35" width="560" height="35" fill="url(#scanner-glow-grad)" />
            </g>
          )}

          {/* 경로를 넓고 옅은 색으로 깔아 전술이 전개되는 공간을 표시 */}
          {hasAiTactics && tacticData.routes?.length > 0 && (
            <g className="court-tactics-zones-layer" pointerEvents="none">
              {tacticData.routes.map((rt, idx) => {
                const cfg = ROUTE_CONFIG[rt.type] || ROUTE_CONFIG.dribble;
                return (
                  <path
                    key={`route-space-${idx}`}
                    d={rt.path}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="52"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.2"
                  />
                );
              })}
            </g>
          )}

          {/* 선수 5인 노드 렌더링 */}
          {summary.lineup.map(({ position, player, isReplaced }) => {
            const [x, y] = coordinates[position] || [300, 200];
            const shortName = player?.name?.split(' ').pop() || '공석';
            const aiRole = hasAiTactics ? tacticData?.playerPlacements?.[position]?.role : null;
            const compactRole = compactCourtRole(aiRole, isReplaced ? 6 : 8);
            const strokeColor = isReplaced ? '#f59e0b' : (isDefense ? '#0ea5e9' : (team.color || '#7657dc'));

            return (
              <g
                key={position}
                className="court-player-group"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  transition: 'transform 0.85s cubic-bezier(0.34, 1.25, 0.64, 1)'
                }}
              >
                <circle cx="0" cy="0" r="23" fill="#fff" opacity="0.9" />
                <circle
                  cx="0"
                  cy="0"
                  r="21"
                  fill="#fff"
                  stroke={strokeColor}
                  strokeWidth={isReplaced ? 3.5 : 3}
                />
                {player?.imgUrl ? (
                  <image
                    href={player.imgUrl}
                    x="-19"
                    y="-19"
                    width="38"
                    height="38"
                    preserveAspectRatio="xMidYMid meet"
                    clipPath="url(#strategy-avatar-clip-compact)"
                  />
                ) : (
                  <text x="0" y="5" textAnchor="middle" fontSize={13} fontWeight="800" fill="#606a7c">
                    {position}
                  </text>
                )}

                <rect x="-14" y="-35" width="28" height="15" rx="5" fill={isReplaced ? '#b45309' : (isDefense ? '#0369a1' : '#20263a')} />
                <text x="0" y="-24" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">
                  {position}
                </text>

                <rect x="-38" y="24" width="76" height="19" rx="6" fill="#1e2433" opacity="0.95" />
                <text x="0" y="37" textAnchor="middle" fontSize={10} fontWeight="800" fill="#fff">
                  {shortName}
                </text>

                {hasAiTactics && aiRole ? (
                  <g className="court-role-badge-group">
                    <title>{aiRole}</title>
                    <rect
                      x="-40"
                      y="45"
                      width="80"
                      height="16"
                      rx="4"
                      fill={isReplaced ? '#fef3c7' : (isDefense ? '#eff6ff' : '#f5f3ff')}
                      stroke={isReplaced ? '#f59e0b' : (isDefense ? '#38bdf8' : '#a78bfa')}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="56.5"
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="800"
                      fill={isReplaced ? '#92400e' : (isDefense ? '#0369a1' : '#6d28d9')}
                    >
                      {isReplaced ? `★ ${compactRole}` : compactRole}
                    </text>
                  </g>
                ) : isReplaced ? (
                  <g>
                    <rect x="-25" y="45" width="50" height="14" rx="4" fill="#f59e0b" />
                    <text x="0" y="55" textAnchor="middle" fontSize="8" fontWeight="900" fill="#1e1b4b">
                      대체 영입
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* 선수 노드 위에 반투명 전술 동선을 그려 경로를 또렷하게 표시 */}
          {hasAiTactics && tacticData.routes?.length > 0 && (
            <g className="court-tactics-routes-layer">
              {tacticData.routes.map((rt, idx) => {
                const cfg = ROUTE_CONFIG[rt.type] || ROUTE_CONFIG.dribble;
                const markerName = `marker-ai-${rt.type || 'dribble'}`;
                const isPass = rt.type === 'pass';
                return (
                  <g key={`ai-route-${idx}`}>
                    <path
                      d={rt.path}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={cfg.strokeWidth + 2.2}
                      strokeLinecap="round"
                      opacity="0.58"
                    />
                    <path
                      d={rt.path}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth={cfg.strokeWidth}
                      strokeLinecap="round"
                      className={isPass ? 'tactical-route-pass' : 'tactical-route-draw'}
                      style={{ animationDelay: `${idx * 0.22}s` }}
                      markerEnd={`url(#${markerName})`}
                      opacity="0.9"
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* AI 전술 생성 전: 코트 블러 & 모던 플로팅 상태 안내 카드 */}
        {!hasAiTactics && (
          <div className="court-standby-floating-overlay" onClick={onRequestAi} role="button" tabIndex={0}>
            <div className="standby-glass-card">
              <div className="standby-glass-icon-wrap">
                {aiStatus === 'loading' ? (
                  <LoaderCircle size={26} className="matchup-ai-spinner" />
                ) : (
                  <Sparkles size={26} />
                )}
              </div>
              <div className="standby-glass-content">
                <span className="standby-glass-badge">
                  {aiStatus === 'loading' ? 'ANALYZING TACTICS' : 'AI TACTICAL SIMULATOR'}
                </span>
                <h4>
                  {aiStatus === 'loading'
                    ? `AI ${isDefense ? '수비' : '공격'} 전술 및 동선 계산 중...`
                    : `✨ AI ${isDefense ? '수비' : '공격'} 전술 대기 상태`}
                </h4>
                <p>
                  {aiStatus === 'loading'
                    ? '상대 구단 기록과 선수 매치업 상성을 기반으로 최적의 코트 배치를 도출하고 있습니다.'
                    : '우측 상단의 [AI 전략 생성] 버튼을 누르면 AI가 실시간으로 분석한 코트 동선이 그려집니다.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 동선 범례 표시 */}
      {hasAiTactics && tacticData.routes?.length > 0 && (
        <div className="strategy-routes-legend">
          <span className="legend-title"><Zap size={12} /> AI {isDefense ? '수비' : '공격'} 전술 동선:</span>
          {tacticData.routes.map((rt, idx) => {
            const cfg = ROUTE_CONFIG[rt.type] || ROUTE_CONFIG.dribble;
            return (
              <span key={`rt-leg-${idx}`} className="route-legend-pill">
                <i style={{ backgroundColor: cfg.color }} />
                <strong>{cfg.label}:</strong> {rt.label}
              </span>
            );
          })}
          <span className="route-zone-legend"><i />색 영역: 전술 전개 공간</span>
        </div>
      )}

      <div className="strategy-diagram-caption">
        <span className="strategy-team-dot" style={{ background: isDefense ? '#0ea5e9' : (team.color || '#7657dc') }} />
        <span>
          {hasAiTactics
            ? `AI 에이전트가 상대 팀 상성을 분석해 생성한 맞춤형 ${isDefense ? '수비 매치업 및 로테이션' : '공격 배치 및 득점'} 동선입니다.`
            : (summary.isCustomLineup
              ? `머신러닝으로 구성한 5인 라인업입니다. 상단 AI 전략 생성을 누르면 AI가 ${isDefense ? '수비' : '공격'} 전술을 직접 그립니다.`
              : `현재 기본 대기 상태입니다. AI 전략 생성을 실행하면 맞춤 ${isDefense ? '수비' : '공격'} 코트 동선이 표시됩니다.`)}
        </span>
      </div>
    </div>
  );
}

function StrategyCard({ title, icon: Icon, items, tone, className = '', isHighlighted = false }) {
  return (
    <section className={`strategy-plan-card strategy-plan-${tone} ${className} ${isHighlighted ? 'is-card-highlighted' : ''}`}>
      <div className="strategy-plan-heading">
        <span className="strategy-plan-icon"><Icon size={17} /></span>
        <h3>{title} {isHighlighted && <span className="card-focus-tag">현재 코트 표시 중</span>}</h3>
      </div>
      <div className="strategy-plan-list">
        {items.map((item, index) => (
          <article className="strategy-plan-item" key={`${item.title}-${index}`}>
            <div className="strategy-plan-item-top">
              <strong>{item.title}</strong>
              <span>{item.evidence}</span>
            </div>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function MatchupStrategyView({ onBack, customLineupData, onClearCustomLineup }) {
  const teams = useMemo(() => [...NBA_TEAMS_2026].sort((a, b) => a.overallRank - b.overallRank), []);

  const customSummary = useMemo(() => {
    return customLineupData ? summarizeCustomLineup(customLineupData) : null;
  }, [customLineupData]);

  const customTeam = useMemo(() => {
    if (!customLineupData) return null;
    return {
      ...customLineupData.team,
      id: 'CUSTOM',
      nameKo: `${customLineupData.team.nameKo} (맞춤 라인업)`,
      name: `${customLineupData.team.name} (Custom)`,
      isCustom: true
    };
  }, [customLineupData]);

  const [teamAId, setTeamAId] = useState(() => (customLineupData ? 'CUSTOM' : 'OKC'));
  const [teamBId, setTeamBId] = useState('BOS');
  const [activeSide, setActiveSide] = useState('A');
  const [activeTacticMode, setActiveTacticMode] = useState('offense'); // 'offense' | 'defense'
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiStrategy, setAiStrategy] = useState(null);
  const [aiStrategyKey, setAiStrategyKey] = useState('');
  const [aiProvider, setAiProvider] = useState('');

  const allSummaries = useMemo(() => teams.map((team) => summarizeTeam(team.id, PLAYERS)), [teams]);
  const benchmarks = useMemo(() => getLeagueBenchmarks(teams.map((team) => team.id), PLAYERS), [teams]);

  const teamA = teamAId === 'CUSTOM' && customTeam
    ? customTeam
    : (teams.find((team) => team.id === teamAId) || teams[0]);
  const teamB = teams.find((team) => team.id === teamBId) || teams[1];

  const summaryA = teamAId === 'CUSTOM' && customSummary
    ? customSummary
    : (allSummaries.find((item) => item.teamId === teamAId) || summarizeTeam(teamAId, PLAYERS));
  const summaryB = allSummaries.find((item) => item.teamId === teamBId) || summarizeTeam(teamBId, PLAYERS);

  const selectedTeam = activeSide === 'A' ? teamA : teamB;
  const selectedSummary = activeSide === 'A' ? summaryA : summaryB;
  const opposingTeam = activeSide === 'A' ? teamB : teamA;
  const opposingSummary = activeSide === 'A' ? summaryB : summaryA;
  const plan = buildMatchupPlan(selectedSummary, opposingSummary, benchmarks);
  const currentMatchupKey = `${selectedTeam.id}:${opposingTeam.id}:${selectedSummary.isCustomLineup ? 'custom' : 'standard'}`;
  const hasCurrentAiStrategy = Boolean(aiStrategyKey === currentMatchupKey && aiStrategy);

  const metricRows = [
    { key: 'threePointAttempts', label: '3점 시도', unit: '회', precision: 1 },
    { key: 'threePointPct', label: '3점 성공률', unit: '%', percent: true, precision: 1 },
    { key: 'assists', label: '어시스트', unit: '회', precision: 1 },
    { key: 'rebounds', label: '리바운드', unit: '개', precision: 1 }
  ];

  const updateTeamA = (nextId) => {
    if (nextId === teamBId) setTeamBId(teamAId === 'CUSTOM' ? 'BOS' : teamAId);
    setTeamAId(nextId);
  };
  const updateTeamB = (nextId) => {
    if (nextId === teamAId) setTeamAId(teamBId);
    setTeamBId(nextId);
  };

  const requestAiStrategy = async () => {
    setAiStatus('loading');
    setAiStrategy(null);
    setAiStrategyKey('');
    setAiProvider('');

    const serializeSummary = (team, summary) => ({
      name: team.nameKo,
      code: team.id,
      sampleSize: summary.playerCount,
      isCustomLineup: Boolean(summary.isCustomLineup),
      tacticStyle: summary.tacticLayout?.label || plan.style.label,
      replacedPlayers: summary.replacedPlayers || [],
      lineup: (summary.lineup || []).map((item) => ({
        position: item.position,
        name: item.player?.name || '공석',
        clusterId: item.player?.clusterId,
        isReplaced: Boolean(item.isReplaced)
      })),
      stats: {
        pointsPerGame: Number(summary.stats.points.toFixed(1)),
        reboundsPerGame: Number(summary.stats.rebounds.toFixed(1)),
        assistsPerGame: Number(summary.stats.assists.toFixed(1)),
        blocksPerGame: Number(summary.stats.blocks.toFixed(1)),
        stealsPerGame: Number(summary.stats.steals.toFixed(1)),
        threePointAttemptsPerGame: Number(summary.stats.threePointAttempts.toFixed(1)),
        threePointPercentage: Number((summary.stats.threePointPct * 100).toFixed(1)),
        threePointAttemptShare: Number((summary.stats.threePointShare * 100).toFixed(1)),
      },
      scoringLeader: summary.topScorer
        ? { name: summary.topScorer.name, pointsPerGame: Number(summary.topScorer.stats?.pts || 0) }
        : null,
    });

    try {
      const response = await fetch('/api/matchup-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: '2025-26',
          team: serializeSummary(selectedTeam, selectedSummary),
          opponent: serializeSummary(opposingTeam, opposingSummary),
        }),
      });
      const result = await response.json();
      if (response.status === 503 && result.error === 'AI_NOT_CONFIGURED') {
        setAiStatus('not-configured');
        return;
      }
      if (!response.ok || !result.strategy) throw new Error(result.error || 'AI_REQUEST_FAILED');
      setAiStrategy(result.strategy);
      setAiStrategyKey(currentMatchupKey);
      setAiProvider(result.provider || 'gemini');
      setAiStatus('success');
    } catch {
      setAiStatus('error');
    }
  };

  // 표시할 전술 데이터 (AI 전술 우선, 미생성 시 룰 기반 전술)
  const displayedPlan = hasCurrentAiStrategy
    ? { ...plan, offense: aiStrategy.offense, defense: aiStrategy.defense }
    : plan;

  return (
    <div className="view-container matchup-strategy-view">
      <button className="matchup-back-button" onClick={onBack}>
        <ArrowLeft size={17} /> {customLineupData ? '전술판으로 돌아가기' : '팀 순위로 돌아가기'}
      </button>

      {/* 맞춤 라인업 적용 시 상단 하이라이트 배너 */}
      {customLineupData && teamAId === 'CUSTOM' && (
        <section className="matchup-custom-banner">
          <div className="matchup-custom-banner-left">
            <span className="matchup-custom-banner-icon"><Sparkles size={16} /></span>
            <div>
              <strong>내가 구성한 맞춤 5인 라인업 분석 모드</strong>
              <p>
                {customLineupData.team?.nameKo} 기반 · {customSummary?.replacedPlayers?.length > 0 ? `대체 영입 ${customSummary.replacedPlayers.length}명 투입 완료` : '기본 선발 5인'} · 전술 배치: <strong>{customLineupData.tacticLayout?.label || '밸런스'}</strong>
              </p>
            </div>
          </div>
          {onClearCustomLineup && (
            <button
              type="button"
              className="btn-switch-to-base"
              onClick={() => {
                setTeamAId(customLineupData.team?.id || 'OKC');
                onClearCustomLineup();
              }}
            >
              <RotateCcw size={13} /> 기본 구단 모드로 전환
            </button>
          )}
        </section>
      )}

      <header className="matchup-hero">
        <span className="matchup-eyebrow"><Sparkles size={14} /> MATCHUP STRATEGY LAB</span>
        <h1>두 팀의 기록으로<br /><strong>경기 전략을 세워보세요.</strong></h1>
        <p>팀을 선택하면 현재 보유한 선수 박스스코어를 비교해 공격·수비 우선순위와 코트 배치를 만듭니다.</p>
      </header>

      <section className="matchup-select-panel" aria-label="분석할 팀 선택">
        <TeamPicker
          team={teamA}
          teams={teams}
          onChange={updateTeamA}
          side="A"
          excludedTeamId={teamBId}
          customTeamOption={customTeam}
        />
        <div className="matchup-vs-mark">VS</div>
        <TeamPicker
          team={teamB}
          teams={teams}
          onChange={updateTeamB}
          side="B"
          excludedTeamId={teamAId === 'CUSTOM' ? null : teamAId}
        />
      </section>

      <section className="matchup-data-note">
        <CircleAlert size={17} />
        <p>
          <strong>현재 분석 범위:</strong> {summaryA.isCustomLineup ? '분석 팀은 전술판에서 직접 구성한 5인 라인업이며, 상대 팀은' : '로컬 2025–26 선수 박스스코어의'} 출전 시간 상위 로테이션 평균입니다. 슛 구역·Synergy 플레이 유형·실제 수비 매치업 자료는 추정치로 채우지 않았습니다.
        </p>
      </section>

      <section className="matchup-comparison-card">
        <div className="matchup-section-title">
          <div>
            <span>TEAM PROFILE</span>
            <h2>{summaryA.isCustomLineup ? '맞춤 5인 vs 상대 로테이션 기록 비교' : '상위 로테이션 기록 비교'}</h2>
          </div>
          <span className="matchup-avg-tag">선수별 경기당 평균</span>
        </div>
        <div className="matchup-metric-grid">
          {metricRows.map((metric) => {
            const valueA = summaryA.stats[metric.key] * (metric.percent ? 100 : 1);
            const valueB = summaryB.stats[metric.key] * (metric.percent ? 100 : 1);
            const maxValue = Math.max(valueA, valueB, 0.01);
            const scaleMax = metric.percent ? 100 : maxValue;
            const teamValues = [
              { id: teamA.id === 'CUSTOM' ? '맞춤' : teamA.id, value: valueA, color: teamA.color || '#7657dc' },
              { id: teamB.id === 'CUSTOM' ? '맞춤' : teamB.id, value: valueB, color: teamB.color || '#7657dc' }
            ];
            return (
              <div className="matchup-metric-row" key={metric.key}>
                <strong className="matchup-metric-title">{metric.label}</strong>
                <div className="matchup-metric-bars">
                  {teamValues.map((item) => (
                    <div className="matchup-metric-bar-row" key={item.id}>
                      <span className="matchup-metric-team">
                        <i style={{ backgroundColor: item.color }} />
                        {item.id}
                      </span>
                      <div
                        className="matchup-metric-track"
                        role="img"
                        aria-label={`${item.id} ${item.value.toFixed(metric.precision)}${metric.unit}`}
                      >
                        <span
                          className="matchup-metric-fill"
                          style={{ width: `${Math.min((item.value / scaleMax) * 100, 100)}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <strong className="matchup-metric-value">{item.value.toFixed(metric.precision)}{metric.unit}</strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="matchup-legend">
          <span><i style={{ backgroundColor: teamA.color || '#7657dc' }} />{teamA.id === 'CUSTOM' ? '맞춤 5인 라인업' : teamA.id} ({summaryA.playerCount}명 표본)</span>
          <span><i style={{ backgroundColor: teamB.color || '#7657dc' }} />{teamB.id} ({summaryB.playerCount}명 표본)</span>
        </div>
      </section>

      {/* 4분할 전략 탭 스위처: Team A (공격/수비) | Team B (공격/수비) */}
      <div className="matchup-side-switch-wrap">
        <div className="matchup-side-switch" role="tablist" aria-label="전략 유형 선택">
          <button
            className={`tab-btn-tactic ${activeSide === 'A' && activeTacticMode === 'offense' ? 'active active-offense' : ''}`}
            onClick={() => { setActiveSide('A'); setActiveTacticMode('offense'); }}
            role="tab"
            aria-selected={activeSide === 'A' && activeTacticMode === 'offense'}
          >
            <img src={teamA.logoUrl} alt="" />
            <span>{teamA.id === 'CUSTOM' ? '맞춤' : teamA.id} 공격 전략</span>
          </button>

          <button
            className={`tab-btn-tactic ${activeSide === 'A' && activeTacticMode === 'defense' ? 'active active-defense' : ''}`}
            onClick={() => { setActiveSide('A'); setActiveTacticMode('defense'); }}
            role="tab"
            aria-selected={activeSide === 'A' && activeTacticMode === 'defense'}
          >
            <ShieldCheck size={16} className="tactic-tab-icon defense-icon" />
            <span>{teamA.id === 'CUSTOM' ? '맞춤' : teamA.id} 수비 전략</span>
          </button>

          <div className="matchup-tab-divider" aria-hidden="true" />

          <button
            className={`tab-btn-tactic ${activeSide === 'B' && activeTacticMode === 'offense' ? 'active active-offense' : ''}`}
            onClick={() => { setActiveSide('B'); setActiveTacticMode('offense'); }}
            role="tab"
            aria-selected={activeSide === 'B' && activeTacticMode === 'offense'}
          >
            <img src={teamB.logoUrl} alt="" />
            <span>{teamB.id} 공격 전략</span>
          </button>

          <button
            className={`tab-btn-tactic ${activeSide === 'B' && activeTacticMode === 'defense' ? 'active active-defense' : ''}`}
            onClick={() => { setActiveSide('B'); setActiveTacticMode('defense'); }}
            role="tab"
            aria-selected={activeSide === 'B' && activeTacticMode === 'defense'}
          >
            <ShieldCheck size={16} className="tactic-tab-icon defense-icon" />
            <span>{teamB.id} 수비 전략</span>
          </button>
        </div>
      </div>

      <section className="matchup-strategy-grid">
        {/* 좌측: 2D 농구 코트 */}
        <div className="matchup-court-card">
          <CourtStrategyDiagram
            team={selectedTeam}
            summary={selectedSummary}
            style={plan.style}
            aiTactics={hasCurrentAiStrategy ? aiStrategy.courtTactics : null}
            tacticMode={activeTacticMode}
            aiStatus={aiStatus}
            onRequestAi={requestAiStrategy}
          />
          <div className="matchup-lineup-caption">
            <Users size={15} />{' '}
            {hasCurrentAiStrategy
              ? `AI Agent가 계산한 ${selectedTeam.nameKo}의 실시간 ${activeTacticMode === 'defense' ? '수비 매치업 및 로테이션' : '공격 세트피스'} 동선입니다.`
              : `현재 ${activeTacticMode === 'defense' ? '수비' : '공격'} 전술 코트 시뮬레이션입니다. 상단 [AI 전략 분석 실행]을 누르면 AI가 동선을 계산합니다.`}
          </div>
        </div>

        {/* 우측: 전략 카드 영역 (전술 내용으로 풍부하게 상시 채워짐) */}
        <div className="matchup-plan-column">
          <div className={`matchup-plan-summary ${hasCurrentAiStrategy ? 'is-generated' : ''} strategy-plan-card-cascade`}>
            <div className="matchup-plan-summary-top">
              <span className="matchup-plan-label">
                <Zap size={14} /> {hasCurrentAiStrategy ? `AI Agent 전략 리포트 (${aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'})` : '전술 분석 엔진'}
              </span>
              <button className="matchup-ai-button" onClick={requestAiStrategy} disabled={aiStatus === 'loading'}>
                {aiStatus === 'loading' ? <LoaderCircle size={15} className="matchup-ai-spinner" /> : <Sparkles size={15} />}
                {aiStatus === 'loading' ? '전략 분석 중' : (hasCurrentAiStrategy ? 'AI 전략 재분석' : 'AI 전략 분석 실행')}
              </button>
            </div>
            <h2>{selectedTeam.nameKo} <strong>{hasCurrentAiStrategy ? aiStrategy.headline : plan.style.label}</strong></h2>
            <p>
              {selectedSummary.isCustomLineup && '머신러닝으로 구성된 라인업의 전술 특성과 '}
              {opposingTeam.nameKo}의 상위 로테이션 지표를 함께 비교해 도출한 핵심 전술입니다.
            </p>
            {aiStatus === 'not-configured' && (
              <p className="matchup-ai-status">
                AI 심층 분석을 원하시면 <code>.env</code> 파일에 <code>GEMINI_API_KEY</code>를 설정하세요. (현재는 통계 기반 분석 제공 중)
              </p>
            )}
            {aiStatus === 'error' && (
              <p className="matchup-ai-status matchup-ai-error">
                AI 분석 요청에 실패했습니다. 현재는 통계 분석 엔진 결과를 표시하고 있습니다.
              </p>
            )}
            {hasCurrentAiStrategy && aiStrategy.caution && <p className="matchup-ai-status">{aiStrategy.caution}</p>}
          </div>

          {/* 공격 / 수비 모드에 따른 우선순위 전술 제안 카드 */}
          {activeTacticMode === 'offense' ? (
            <>
              <StrategyCard
                title="공격 전술 제안"
                icon={Target}
                items={displayedPlan.offense}
                tone="offense"
                className="strategy-plan-card-cascade card-1"
                isHighlighted={true}
              />
              <StrategyCard
                title="수비 전술 제안"
                icon={ShieldCheck}
                items={displayedPlan.defense}
                tone="defense"
                className="strategy-plan-card-cascade card-2"
              />
            </>
          ) : (
            <>
              <StrategyCard
                title="수비 전술 제안"
                icon={ShieldCheck}
                items={displayedPlan.defense}
                tone="defense"
                className="strategy-plan-card-cascade card-1"
                isHighlighted={true}
              />
              <StrategyCard
                title="공격 전술 제안"
                icon={Target}
                items={displayedPlan.offense}
                tone="offense"
                className="strategy-plan-card-cascade card-2"
              />
            </>
          )}

          <div className="matchup-key-players strategy-plan-card-cascade card-3">
            <span className="matchup-key-players-title"><ChartNoAxesCombined size={15} /> 주요 기록 매치업 포인트</span>
            <div className="matchup-key-player-row">
              <span>{selectedTeam.id === 'CUSTOM' ? '맞춤팀' : selectedTeam.id} 득점 상위</span>
              <strong>{selectedSummary.topScorer?.name || '선수 정보 없음'}</strong>
              <b>{selectedSummary.topScorer ? `${Number(selectedSummary.topScorer.stats?.pts || 0).toFixed(1)} PTS` : '—'}</b>
            </div>
            <div className="matchup-key-player-row">
              <span>{opposingTeam.id} 득점 상위</span>
              <strong>{opposingSummary.topScorer?.name || '선수 정보 없음'}</strong>
              <b>{opposingSummary.topScorer ? `${Number(opposingSummary.topScorer.stats?.pts || 0).toFixed(1)} PTS` : '—'}</b>
            </div>
          </div>
        </div>
      </section>

      <footer className="matchup-method-note">
        <ArrowRight size={15} />
        <span>전술 문구와 코트 배치는 박스스코어 및 AI 에이전트 분석에서 도출한 제안입니다. 실제 플레이 유형, 슛 좌표, 경기별 수비 배정과는 다를 수 있습니다.</span>
      </footer>
    </div>
  );
}
