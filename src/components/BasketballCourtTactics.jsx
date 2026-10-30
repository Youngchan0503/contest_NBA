import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Shield,
  Zap,
  Info,
  Globe,
  ChevronDown,
  Filter,
  AlertTriangle,
  DollarSign,
  ArrowUpDown
} from 'lucide-react';
import { calculateSimilarity, calculateKNNDistance, getSalaryDisplay, getPhysicalFitAnalysis, getHeightDisplay } from '../data/mockPlayers';

const POSITION_SLOTS = [
  {
    pos: 'PG',
    name: '포인트 가드 (Point Guard)',
    roleClusterId: 1,
    desc: '공격을 운반하고 팀 플레이를 조율하는 가드'
  },
  {
    pos: 'SG',
    name: '슈팅 가드 (Shooting Guard)',
    roleClusterId: 0,
    desc: '외곽 득점과 볼 핸들링을 맡는 가드'
  },
  {
    pos: 'SF',
    name: '스몰 포워드 (Small Forward)',
    roleClusterId: 3,
    desc: '윙에서 공간을 만들고 공격을 마무리하는 포워드'
  },
  {
    pos: 'PF',
    name: '파워 포워드 (Power Forward)',
    roleClusterId: 0,
    desc: '스크린·득점·리바운드를 맡는 포워드'
  },
  {
    pos: 'C',
    name: '센터 (Center)',
    roleClusterId: 2,
    desc: '골밑 수비와 리바운드를 맡는 센터'
  }
];

const TACTIC_LAYOUTS = {
  balanced: {
    key: 'balanced',
    label: '밸런스 배치',
    positions: { PG: [50, 24], SG: [18, 42], SF: [82, 42], PF: [35, 78], C: [65, 78] }
  },
  spacing: {
    key: 'spacing',
    label: '5-out 스페이싱',
    positions: { PG: [50, 24], SG: [17, 40], SF: [83, 40], PF: [28, 78], C: [72, 78] }
  },
  pickAndRoll: {
    key: 'pick-and-roll',
    label: '픽앤롤',
    positions: { PG: [50, 42], SG: [18, 42], SF: [82, 42], PF: [29, 78], C: [71, 72] }
  },
  inside: {
    key: 'inside',
    label: '골밑 중심',
    positions: { PG: [50, 24], SG: [18, 40], SF: [82, 40], PF: [39, 78], C: [61, 80] }
  }
};
const TACTIC_LAYOUT_OPTIONS = Object.values(TACTIC_LAYOUTS);

function getThreePointShare(player) {
  const value = Number(player?.features?.three_point_share ?? player?.stats?.three_point_share);
  return Number.isFinite(value) ? value : 0;
}

function isPerimeterShooter(player) {
  const stats = player?.stats || {};
  return getThreePointShare(player) >= 0.3 && Number(stats.x3pa || 0) >= 2.5;
}

function inferTacticLayout(lineup) {
  const players = Object.values(lineup || {}).filter(Boolean);
  if (players.length < 3) return TACTIC_LAYOUTS.balanced;

  const perimeterShooters = players.filter(isPerimeterShooter).length;
  const shootingBigs = [lineup.PF, lineup.C].filter(isPerimeterShooter).length;
  if (perimeterShooters >= 5 || (perimeterShooters >= 4 && shootingBigs === 2)) {
    return TACTIC_LAYOUTS.spacing;
  }

  const bigs = [lineup.PF, lineup.C].filter(Boolean);
  const bigsAverageRebounds = bigs.length
    ? bigs.reduce((sum, player) => sum + Number(player.stats?.trb || 0), 0) / bigs.length
    : 0;
  const bigsAverageShootingShare = bigs.length
    ? bigs.reduce((sum, player) => sum + getThreePointShare(player), 0) / bigs.length
    : 1;
  if (bigs.length === 2 && bigsAverageRebounds >= 8 && bigsAverageShootingShare < 0.25) {
    return TACTIC_LAYOUTS.inside;
  }

  const pointGuardAssists = Number(lineup.PG?.stats?.ast || 0);
  const centerStats = lineup.C?.stats || {};
  const centerIsInterior = getThreePointShare(lineup.C) < 0.27
    && (Number(centerStats.trb || 0) >= 5 || Number(centerStats.blk || 0) >= 0.8);
  if (pointGuardAssists >= 4 && centerIsInterior) return TACTIC_LAYOUTS.pickAndRoll;

  return TACTIC_LAYOUTS.balanced;
}

/**
 * 2D 인터랙티브 농구 경기장 전술판 (Basketball Court Tactics Board)
 * 1. 2D 하프코트 위에 5개 포지션(PG, SG, SF, PF, C)의 팀 선발 라인업을 배치합니다.
 * 2. 결장 선수가 위치한 포지션(또는 원하는 포지션)을 클릭하면 해당 군집의 대체 선수 리스트가 나타납니다.
 * 3. 오른쪽에 토글 버튼을 제공하여 [타 팀 영입 후보] vs [같은 팀 내 대체 자원]을 자유롭게 전환할 수 있습니다.
 * 4. 리스트에서 대체 선수를 클릭하면 해당 선수가 즉시 2D 농구 코트의 해당 포지션으로 투입됩니다.
 */
export default function BasketballCourtTactics({
  targetPlayer,
  recommendations,
  clusters,
  allPlayers,
  onCompare,
  onAnalyzeMatchup
}) {
  // 현재 코트에서 클릭하여 선택한 포지션 (기본값: 결장 타깃 선수의 포지션)
  const [activePos, setActivePos] = useState(targetPlayer?.pos || 'PG');
  
  // 토글 상태: true = 같은 팀 내 대체 자원, false = 타 팀 영입 후보 (리그 전체)
  const [sameTeamOnly, setSameTeamOnly] = useState(false);

  // 후보 목록 정렬: 전술 적합도순 또는 기준 선수와 연봉 차이가 작은 순
  const [sortBy, setSortBy] = useState('tactical');

  // 코트 각 포지션별 현재 투입된 선수 상태 객체
  // { PG: playerObj, SG: playerObj, SF: playerObj, PF: playerObj, C: playerObj }
  const [courtLineup, setCourtLineup] = useState(() => {
    return initializeLineup(targetPlayer, allPlayers);
  });

  // 결장 선수가 교체 투입된 이력 추적 { [pos]: replacedPlayerObj }
  const [replacedSlots, setReplacedSlots] = useState({});
  const [manualTacticKey, setManualTacticKey] = useState(null);
  const [isTacticMenuOpen, setIsTacticMenuOpen] = useState(false);
  const tacticSelectorRef = useRef(null);

  // 타깃 선수가 바뀌었을 때 초기 라인업 재설정
  React.useEffect(() => {
    setActivePos(targetPlayer?.pos || 'PG');
    setCourtLineup(initializeLineup(targetPlayer, allPlayers));
    setReplacedSlots({});
    setSameTeamOnly(false);
    setManualTacticKey(null);
    setIsTacticMenuOpen(false);
  }, [targetPlayer?.id]);

  // 5인 라인업의 기록에 맞춰 공격 배치 프리셋을 추정합니다.
  const inferredTacticLayout = useMemo(() => inferTacticLayout(courtLineup), [courtLineup]);
  const tacticLayout = manualTacticKey
    ? TACTIC_LAYOUT_OPTIONS.find((layout) => layout.key === manualTacticKey) || inferredTacticLayout
    : inferredTacticLayout;
  const positionSlots = POSITION_SLOTS.map((slot) => {
    const [x, y] = tacticLayout.positions[slot.pos];
    return { ...slot, x, y };
  });

  useEffect(() => {
    if (!isTacticMenuOpen) return undefined;
    const closeWhenOutside = (event) => {
      if (!tacticSelectorRef.current?.contains(event.target)) setIsTacticMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsTacticMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isTacticMenuOpen]);

  // 현재 활성화된 포지션에 해당하는 군집 정보
  const activeSlotMeta = positionSlots.find((s) => s.pos === activePos) || positionSlots[0];
  const activeCluster = clusters[activeSlotMeta.roleClusterId] || clusters[0];

  // 같은 팀 내 대체 가능한 총 선수 수 (타깃 선수 제외)
  const sameTeamCandidatesCount = useMemo(() => {
    if (!targetPlayer) return 0;
    return allPlayers.filter(
      (p) => p.season === targetPlayer.season && p.team === targetPlayer.team && p.id !== targetPlayer.id
    ).length;
  }, [allPlayers, targetPlayer?.id, targetPlayer?.season, targetPlayer?.team]);

  // 활성화된 포지션에 매칭되는 추천 대체 선수 후보군 필터링 (토글 상태에 따라 팀 내 vs 리그 전체)
  const availableCandidates = useMemo(() => {
    const currentOccupant = courtLineup[activePos];
    const compareBase = targetPlayer || currentOccupant;

    // 1) 토글 활성화 시: [같은 팀 내 대체 선수 목록]
    if (sameTeamOnly) {
      if (!targetPlayer) return [];
      const teammates = allPlayers.filter(
        (p) => p.season === targetPlayer.season && p.team === targetPlayer.team && p.id !== (currentOccupant?.id || targetPlayer.id)
      );

      const scoredTeammates = teammates.map((p) => {
        // 코트 다른 슬롯에 이미 배치되어 있는지 확인
        const placedEntry = Object.entries(courtLineup).find(
          ([posKey, courtP]) => posKey !== activePos && courtP?.id === p.id
        );

        const knn = calculateKNNDistance(compareBase, p);

        return {
          ...p,
          knnData: knn,
          tacticalDistance: knn.distance,
          similarityScore: knn.score.toFixed(1),
          otherSlot: placedEntry ? placedEntry[0] : null
        };
      });

      // 전술 거리 가까운 순으로 정렬 (오름차순)
      scoredTeammates.sort((a, b) => a.tacticalDistance - b.tacticalDistance);
      return scoredTeammates;
    }

    // 2) 토글 비활성화 시: [타 팀 영입 후보군 (리그 전체)]
    // 만약 클릭한 포지션이 타깃 선수의 원래 포지션이면, 기계산된 recommendations 사용
    if (activePos === targetPlayer.pos) {
      return recommendations.slice(0, 25);
    }

    // 다른 포지션을 클릭한 경우: 해당 포지션 또는 해당 군집의 타팀 선수들 매칭
    const basePlayer = currentOccupant || targetPlayer;
    const candidates = allPlayers.filter(
      (p) => p.season === targetPlayer.season && p.team !== targetPlayer.team && (p.pos === activePos || p.clusterId === activeSlotMeta.roleClusterId)
    );

    const scored = candidates.map((p) => {
      const knn = calculateKNNDistance(basePlayer, p);
      return {
        ...p,
        knnData: knn,
        tacticalDistance: knn.distance,
        similarityScore: knn.score.toFixed(1)
      };
    });

    scored.sort((a, b) => a.tacticalDistance - b.tacticalDistance);
    return scored.slice(0, 25);
  }, [activePos, targetPlayer, recommendations, allPlayers, sameTeamOnly, courtLineup, activeSlotMeta]);

  // 후보 리스트 스크롤 컨테이너 참조
  const candidateListRef = useRef(null);

  // 전술순 또는 연봉 근접순 / 신장 근접순으로 정렬
  const sortedCandidates = useMemo(() => {
    const list = [...availableCandidates];
    const compareBase = targetPlayer || courtLineup[activePos];
    const targetHeight = compareBase?.height_cm || 0;

    if (sortBy === 'salary_closest') {
      const targetSalary = targetPlayer?.salaryNum || 0;
      const targetYear = targetPlayer?.salaryYear;
      const salaryDifference = (player) => (
        targetSalary > 0 && targetYear && player.salaryNum > 0 && player.salaryYear === targetYear
          ? Math.abs(player.salaryNum - targetSalary)
          : Infinity
      );
      list.sort((a, b) => {
        const difference = salaryDifference(a) - salaryDifference(b);
        return Number.isNaN(difference) || difference === 0
          ? (a.tacticalDistance ?? Infinity) - (b.tacticalDistance ?? Infinity)
          : difference;
      });
    } else if (sortBy === 'height_closest') {
      list.sort((a, b) => {
        const diffA = Math.abs((a.height_cm || 0) - targetHeight);
        const diffB = Math.abs((b.height_cm || 0) - targetHeight);
        if (diffA !== diffB) return diffA - diffB;
        return (a.tacticalDistance ?? Infinity) - (b.tacticalDistance ?? Infinity);
      });
    }
    return list;
  }, [availableCandidates, sortBy, targetPlayer?.salaryNum, targetPlayer?.salaryYear, targetPlayer?.height_cm, courtLineup, activePos]);

  // 기존 결장 선수와 연봉이 가장 가까운 후보 선수 ID 탐색
  const closestCandidateId = useMemo(() => {
    const targetSal = targetPlayer?.salaryNum || 0;
    if (!targetSal || !targetPlayer?.salaryYear || sortedCandidates.length === 0) return null;
    let minDiff = Infinity;
    let closestId = null;
    for (const c of sortedCandidates) {
      if (c.salaryNum && c.salaryNum > 0 && c.salaryYear === targetPlayer.salaryYear) {
        const diff = Math.abs(c.salaryNum - targetSal);
        if (diff < minDiff) {
          minDiff = diff;
          closestId = c.id;
        }
      }
    }
    return closestId;
  }, [targetPlayer?.salaryNum, targetPlayer?.salaryYear, sortedCandidates]);

  // 기존 결장 선수와 신장(Height)이 가장 가까운 후보 선수 ID 탐색
  const closestHeightCandidateId = useMemo(() => {
    const targetH = targetPlayer?.height_cm || courtLineup[activePos]?.height_cm;
    if (!targetH || sortedCandidates.length === 0) return null;
    let minDiff = Infinity;
    let closestId = null;
    for (const c of sortedCandidates) {
      if (c.height_cm) {
        const diff = Math.abs(c.height_cm - targetH);
        if (diff < minDiff) {
          minDiff = diff;
          closestId = c.id;
        }
      }
    }
    return closestId;
  }, [targetPlayer?.height_cm, courtLineup, activePos, sortedCandidates]);

  // 연봉/신장 근접순 전환 시 가장 근접한 후보로 자동 스크롤
  useEffect(() => {
    const targetId = sortBy === 'salary_closest' ? closestCandidateId : sortBy === 'height_closest' ? closestHeightCandidateId : null;
    if (targetId && candidateListRef.current) {
      const timer = setTimeout(() => {
        const container = candidateListRef.current;
        const el = document.getElementById(`cand-item-${targetId}`);
        if (container && el) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const targetTop = container.scrollTop + (elRect.top - containerRect.top) - (container.clientHeight / 2) + (elRect.height / 2);
          container.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth'
          });
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [sortBy, closestCandidateId, closestHeightCandidateId]);

  // 코트 내 동일 선수가 복수 포지션에 중복 기용되었는지 실시간 감지
  // { [posKey]: { otherPoses: ['PF'], playerName: 'Mobley' } }
  const duplicateSlotsMap = useMemo(() => {
    const map = {};
    for (const [posKey, p] of Object.entries(courtLineup)) {
      if (p?.id) {
        if (!map[p.id]) map[p.id] = [];
        map[p.id].push(posKey);
      }
    }
    const result = {};
    for (const [id, poses] of Object.entries(map)) {
      if (poses.length > 1) {
        for (const p of poses) {
          result[p] = {
            otherPoses: poses.filter((x) => x !== p),
            playerName: courtLineup[p]?.name?.split(' ').pop() || ''
          };
        }
      }
    }
    return result;
  }, [courtLineup]);

  // 대체 선수를 코트 포지션으로 투입하는 액션
  // (동일 선수 중복을 원천 차단하지 않고, 기존 위치에는 주의/보강 표시를 띄워 추후 다른 선수를 충원할 수 있게 허용)
  const handleInsertToCourt = (candidatePlayer) => {
    setCourtLineup((prev) => ({
      ...prev,
      [activePos]: candidatePlayer
    }));

    setReplacedSlots((prev) => ({
      ...prev,
      [activePos]: candidatePlayer
    }));
  };

  // 코트 라인업 원래대로 복원 (초기화)
  const handleResetLineup = () => {
    setCourtLineup(initializeLineup(targetPlayer, allPlayers));
    setReplacedSlots({});
    setManualTacticKey(null);
    setIsTacticMenuOpen(false);
  };

  // 교체 전 최초 라인업과 현재 라인업의 평균 스탯을 같은 기준으로 비교
  const originalCourtStats = useMemo(
    () => calculateLineupStats(initializeLineup(targetPlayer, allPlayers)),
    [targetPlayer?.id, allPlayers]
  );
  const courtStats = useMemo(() => calculateLineupStats(courtLineup), [courtLineup]);
  const lineupHeightDelta = Number(((courtStats.height || 0) - (originalCourtStats.height || 0)).toFixed(1));
  const lineupChartMetrics = [
    { key: 'pts', label: '득점 PTS', unit: 'PTS', max: 35 },
    { key: 'reb', label: '리바운드', unit: 'TRB', max: 16 },
    { key: 'ast', label: '어시스트', unit: 'AST', max: 12 },
    { key: 'x3p', label: '3점 성공률', unit: '%', max: 50 },
    { key: 'height', label: '평균 신장', unit: 'cm', max: 220 }
  ];

  return (
    <div className="court-tactics-container">
      {/* 전술판 헤더 바 */}
      <div className="court-header-bar">
        <div className="court-title-group">
          <div className="tactics-badge">
            <Zap size={14} />
            <span>2D 전술 시뮬레이터</span>
          </div>
          <h3 className="court-main-title">
            2D 농구 경기장 포지션 배치 & 실시간 대체 선수 투입 전술판
          </h3>
          <p className="court-subtitle">
            코트 위의 포지션을 클릭하면 해당 군집의 최적 영입 자원 리스트가 열리며, 선수를 클릭하면 즉시 경기장으로 투입되어 5인 라인업 시너지를 시뮬레이션합니다.
          </p>
          <div className="tactic-selector-wrap" ref={tacticSelectorRef}>
            <button
              type="button"
              className={`tactic-estimate-pill tactic-${tacticLayout.key} ${manualTacticKey ? 'is-manual' : ''}`}
              title="전술 배치 유형 선택"
              aria-label={`현재 ${manualTacticKey ? '직접 선택' : '기록 추정'} 전술: ${tacticLayout.label}. 눌러 전술 변경`}
              aria-haspopup="menu"
              aria-expanded={isTacticMenuOpen}
              onClick={() => setIsTacticMenuOpen((open) => !open)}
            >
              <span className="tactic-estimate-type">{manualTacticKey ? '직접 선택' : '추정 전술'} · {tacticLayout.label}</span>
              <span className="tactic-estimate-caption">{manualTacticKey ? '눌러 전술 변경' : '선수 기록 기반 · 눌러 변경'}</span>
              <ChevronDown size={14} className={`tactic-estimate-chevron ${isTacticMenuOpen ? 'is-open' : ''}`} />
            </button>
            {isTacticMenuOpen && (
              <div className="tactic-selector-menu" role="menu" aria-label="전술 배치 선택">
                <button
                  type="button"
                  className={`tactic-selector-option ${manualTacticKey === null ? 'is-selected' : ''}`}
                  role="menuitemradio"
                  aria-checked={manualTacticKey === null}
                  onClick={() => {
                    setManualTacticKey(null);
                    setIsTacticMenuOpen(false);
                  }}
                >
                  <span><strong>선수 기록으로 자동 추정</strong><small>현재 5인 라인업 기록에 따라 선택</small></span>
                  {manualTacticKey === null && <CheckCircle2 size={16} />}
                </button>
                <div className="tactic-selector-divider" />
                {TACTIC_LAYOUT_OPTIONS.map((layout) => {
                  const isSelected = manualTacticKey === layout.key;
                  return (
                    <button
                      type="button"
                      key={layout.key}
                      className={`tactic-selector-option ${isSelected ? 'is-selected' : ''}`}
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setManualTacticKey(layout.key);
                        setIsTacticMenuOpen(false);
                      }}
                    >
                      <span><strong>{layout.label}</strong><small>{layout.key === 'balanced' ? '포지션 간격을 고르게 배치' : layout.key === 'spacing' ? '외곽 공간을 넓게 확보' : layout.key === 'pick-and-roll' ? '가드와 빅맨의 스크린 전개' : '인사이드 득점과 리바운드 공략'}</small></span>
                      {isSelected && <CheckCircle2 size={16} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="court-header-actions">
          {onAnalyzeMatchup && (
            <button
              type="button"
              className="btn-analyze-matchup"
              onClick={() => onAnalyzeMatchup({ lineup: courtLineup, replacedSlots, tacticLayout })}
              title="현재 5인 라인업으로 두 팀 경기 전략 분석하기"
            >
              <Sparkles size={14} /> 이 라인업으로 경기 전략 분석
            </button>
          )}
          <button className="btn-reset-court" onClick={handleResetLineup} title="원래 선발 라인업으로 복원">
            <RotateCcw size={14} /> 라인업 초기화
          </button>
        </div>
      </div>

      {/* 메인 작업 영역: 좌측 2D 농구 코트 + 우측 실시간 대체 선수 후보 리스트 */}
      <div className="court-tactics-layout">
        {/* =========================================================
            좌측: 2D 농구 경기장 (Hardwood Court Board)
            ========================================================= */}
        <div className="court-board-panel">
          <div className="court-canvas-wrap">
            {/* 2D 농구 코트 SVG 그래픽 */}
            <svg
              className="court-svg"
              viewBox="0 0 600 480"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* 코트 원목 바닥 배경 */}
              <defs>
                <linearGradient id="hardwoodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f8edcf" />
                  <stop offset="52%" stopColor="#f2dfb4" />
                  <stop offset="100%" stopColor="#ead19b" />
                </linearGradient>
                <pattern id="woodPlanks" width="600" height="30" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="30" x2="600" y2="30" stroke="#aa8050" strokeWidth="0.7" opacity="0.16" />
                </pattern>
              </defs>

              {/* 경기장 바닥 */}
              <rect x="15" y="15" width="570" height="450" rx="12" fill="url(#hardwoodGrad)" />
              <rect x="15" y="15" width="570" height="450" rx="12" fill="url(#woodPlanks)" />
              <rect x="15" y="15" width="570" height="450" rx="12" fill="none" stroke="#93683f" strokeWidth="2.5" opacity="0.72" />

              {/* 하프코트 라인 (상단 중앙) */}
              <line x1="15" y1="30" x2="585" y2="30" stroke="#93683f" strokeWidth="2" opacity="0.62" />
              <circle cx="300" cy="30" r="60" fill="none" stroke="#93683f" strokeWidth="2" opacity="0.62" />

              {/* 3점 라인 (아크 + 양 사이드 코너) */}
              <path
                d="M 65 465 L 65 375 C 65 210, 535 210, 535 375 L 535 465"
                fill="none"
                stroke="#805d3b"
                strokeWidth="2.4"
                opacity="0.74"
              />

              {/* 페인트 존 (Key / Lane Area) */}
              <rect x="209" y="285" width="182" height="180" fill="rgba(118, 87, 220, 0.08)" stroke="#805d3b" strokeWidth="2.2" opacity="0.86" />

              {/* 자유투 원: 라인 위쪽은 실선, 페인트존 안쪽은 점선 */}
              <path d="M 240 285 A 60 60 0 0 1 360 285" fill="none" stroke="#805d3b" strokeWidth="2.2" opacity="0.8" />
              <path d="M 240 285 A 60 60 0 0 0 360 285" fill="none" stroke="#805d3b" strokeWidth="2" strokeDasharray="7 6" opacity="0.55" />

              {/* 골밑 제한구역 아크 (Restricted Area) */}
              <path d="M 265 442 A 35 35 0 0 1 335 442" fill="none" stroke="#805d3b" strokeWidth="2" opacity="0.68" />

              {/* 백보드 & 림 (Basket Hoop) */}
              <line x1="265" y1="452" x2="335" y2="452" stroke="#6d4d31" strokeWidth="4" strokeLinecap="round" />
              <circle cx="300" cy="442" r="10" fill="rgba(234, 88, 12, 0.08)" stroke="#df6b32" strokeWidth="3" />
              <line x1="300" y1="452" x2="300" y2="442" stroke="#df6b32" strokeWidth="2.4" />
            </svg>

            {/* 5개 포지션 인터랙티브 노드 레이어 */}
            <div className="court-nodes-layer">
              {positionSlots.map((slot) => {
                const currentPlayer = courtLineup[slot.pos];
                const isTargetPos = targetPlayer?.pos === slot.pos;
                const isReplaced = !!replacedSlots[slot.pos];
                const isSelectedSlot = activePos === slot.pos;
                const dupInfo = duplicateSlotsMap[slot.pos];
                const isDuplicate = !!dupInfo;

                return (
                  <div
                    key={slot.pos}
                    className={`court-position-node ${isSelectedSlot ? 'slot-focused' : ''} ${isTargetPos ? 'is-target-slot' : ''} ${isReplaced ? 'is-replaced-slot' : ''} ${isDuplicate ? 'has-duplicate-warning' : ''}`}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`
                    }}
                    onClick={() => setActivePos(slot.pos)}
                  >
                    {/* 포지션 핀 태그 */}
                    <div className="node-pos-pill">
                      <span className="node-pos-name">{slot.pos}</span>
                      {isDuplicate ? (
                        <span className="tag-duplicate-alert" title={`동일 선수가 ${dupInfo.otherPoses.join('/')} 포지션에도 임시 기용 중입니다. 클릭하여 이 자리에 새 선수를 채워보세요!`}>
                          ⚠️ 중복 ({dupInfo.otherPoses.join('/')})
                        </span>
                      ) : isReplaced ? (
                        <span className="tag-replaced">교체완료</span>
                      ) : isTargetPos ? (
                        <span className="tag-absent">결장</span>
                      ) : null}
                    </div>

                    {/* 선수 아바타 프레임 */}
                    <div className={`node-avatar-frame ${isDuplicate ? 'node-avatar-duplicate' : ''}`}>
                      {currentPlayer ? (
                        <>
                        <img
                          src={currentPlayer.imgUrl || 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png'}
                          alt={currentPlayer.name}
                          className="node-player-img"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement.querySelector('.node-photo-fallback');
                            if (fallback) fallback.hidden = false;
                          }}
                        />
                        <span className="node-photo-fallback" hidden aria-hidden="true">
                          {currentPlayer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}
                        </span>
                        </>
                      ) : (
                        <div className="node-empty-avatar">?</div>
                      )}

                      {/* 동일 선수 중복 기용 시 주의 펄스 링 */}
                      {isDuplicate && (
                        <div className="node-duplicate-pulse-ring" />
                      )}
                      {/* 타깃 결장 선수 펄스 경고 링 */}
                      {!isDuplicate && isTargetPos && !isReplaced && (
                        <div className="node-alert-pulse" />
                      )}
                      {/* 교체 투입 완료 시 에메랄드 링 */}
                      {!isDuplicate && isReplaced && (
                        <div className="node-success-ring" />
                      )}
                    </div>

                    {/* 선수 이름 및 소속/신장 (중복 기용 시 주의 경고 안내 표시) */}
                    <div className={`node-info-plate ${isDuplicate ? 'node-info-duplicate' : ''}`}>
                      <span
                        className="node-player-name"
                        title={currentPlayer
                          ? `${currentPlayer.name} · ${currentPlayer.team} · ${currentPlayer.height_cm ? currentPlayer.height_cm + 'cm' : ''} · ${currentPlayer.stats?.pts || 0} PTS`
                          : '공석'}
                      >
                        {currentPlayer ? currentPlayer.name.split(' ').pop() : '공석'}
                      </span>
                      {currentPlayer?.height_cm && (
                        <span style={{
                          display: 'block',
                          fontSize: '0.62rem',
                          color: '#38bdf8',
                          fontWeight: 700,
                          lineHeight: 1,
                          marginTop: '1px'
                        }}>
                          {currentPlayer.height_cm}cm
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 코트 하단 실시간 5인 라인업 전술 스탯 비교 그래프 */}
          <div className={`court-lineup-stats-bar ${Math.abs(lineupHeightDelta) >= 0.5 ? 'has-height-insight' : ''}`}>
            {Object.keys(duplicateSlotsMap).length > 0 && (
              <div className="court-duplicate-banner">
                <ShieldAlert size={14} className="banner-alert-icon" />
                <span>
                  <strong>동일 선수 중복 기용 주의:</strong> {Object.values(duplicateSlotsMap)[0]?.playerName} 선수가 복수 포지션에 임시 기용되었습니다. 주의 표시(⚠️)가 뜬 포지션을 클릭하여 새로운 대체 선수를 충원해주세요.
                </span>
              </div>
            )}
            <div className="court-lineup-stats-inner">
              <div className="lineup-chart-heading">
                <div className="lineup-title">
                  <Shield size={18} />
                  <span>라인업 평균 스탯 변화</span>
                </div>
                <div className="lineup-chart-legend" aria-label="그래프 범례">
                  <span><i className="lineup-legend-swatch before" />기존 라인업</span>
                  <span><i className="lineup-legend-swatch positive" />증가</span>
                  <span><i className="lineup-legend-swatch negative" />감소</span>
                </div>
              </div>
              <div className="lineup-chart" role="list" aria-label="교체 전후 라인업 평균 스탯">
                {lineupChartMetrics.map((metric) => {
                  const before = originalCourtStats[metric.key];
                  const after = courtStats[metric.key];
                  const delta = Number((after - before).toFixed(1));
                  const beforeWidth = Math.min((before / metric.max) * 100, 100);
                  const afterWidth = Math.min((after / metric.max) * 100, 100);
                  const valueSuffix = metric.key === 'x3p' ? '%' : metric.key === 'height' ? 'cm' : '';
                  const deltaLabel = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${metric.key === 'x3p' ? '%p' : metric.key === 'height' ? 'cm' : ''}`;

                  return (
                    <div className="lineup-chart-row" role="listitem" key={metric.key}>
                      <span className="lineup-chart-label">{metric.label}</span>
                      <div
                        className="lineup-chart-track"
                        role="img"
                        aria-label={`${metric.label}: 기존 ${before.toFixed(1)}${valueSuffix}, 교체 후 ${after.toFixed(1)}${valueSuffix}`}
                      >
                        <span className={`lineup-chart-bar before ${delta < 0 ? 'negative' : ''}`} style={{ width: `${beforeWidth}%` }} />
                        <span
                          className={`lineup-chart-bar after ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'unchanged'}`}
                          style={{ width: `${delta > 0 ? beforeWidth : afterWidth}%` }}
                        />
                        {delta > 0 && (
                          <span
                            className="lineup-chart-bar increase-delta"
                            style={{
                              width: `${afterWidth}%`
                            }}
                          />
                        )}
                      </div>
                      <span className={`lineup-chart-values ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}`}>
                        <span className="before-value">{before.toFixed(1)}{valueSuffix}</span>
                        <span className="lineup-chart-arrow" aria-hidden="true">→</span>
                        <strong>{after.toFixed(1)}{valueSuffix}</strong>
                      </span>
                      <span className={`lineup-chart-change ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}`}>
                        {deltaLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {(() => {
                if (Math.abs(lineupHeightDelta) < 0.5) return null;
                const isSmallBall = lineupHeightDelta < 0;
                return (
                  <div className="lineup-height-insight" style={{
                    borderRadius: '6px',
                    background: isSmallBall ? '#eff6ff' : '#f0fdf4',
                    border: `1px solid ${isSmallBall ? '#bfdbfe' : '#bbf7d0'}`,
                    color: isSmallBall ? '#1e40af' : '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Sparkles size={14} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>{isSmallBall ? '⚡ 스몰볼 라인업 가속' : '🛡️ 빅 라인업 높이 보강'}:</strong>{' '}
                      평균 신장이 <strong>{Math.abs(lineupHeightDelta)}cm</strong> {isSmallBall ? '감소하여 볼 전환 속도와 외곽 공간 창출이 유리해지나, 골밑 리바운드 박스아웃에 집중해야 합니다.' : '증가하여 림 프로텍션과 골밑 페인트존 장악력이 한층 강화됩니다.'}
                    </span>
                  </div>
                );
              })()}

              {onAnalyzeMatchup && (
                <div className="lineup-chart-actions">
                  <button
                    type="button"
                    className="btn-matchup-cta-full"
                    onClick={() => onAnalyzeMatchup({ lineup: courtLineup, replacedSlots, tacticLayout })}
                  >
                    <Sparkles size={16} />
                    <span><strong>이 5인 라인업으로 경기 전략 분석</strong> (AI 맞대결 시뮬레이션)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================
            우측: 해당 포지션/군집 추천 대체 선수 투입 리스트
            ========================================================= */}
        <div className="tactics-candidate-panel">


          {/* 토글 바: 타 팀 영입 후보 vs 동일 팀 내 대체 자원 */}
          <div className="candidate-toggle-bar">
            <div className="tactics-source-tabs">
              <button
                type="button"
                className={`source-tab-btn ${!sameTeamOnly ? 'active' : ''}`}
                onClick={() => setSameTeamOnly(false)}
              >
                <Globe size={13} />
                <span>타 팀 영입 후보</span>
              </button>
              <button
                type="button"
                className={`source-tab-btn ${sameTeamOnly ? 'active' : ''}`}
                onClick={() => {
                  setSameTeamOnly(true);
                  setSortBy('tactical');
                }}
              >
                <Users size={13} />
                <span>팀 내 대체 자원</span>
                <span className="source-count-pill">{sameTeamCandidatesCount}명</span>
              </button>
            </div>

            {/* 우측: 전술 적합도순 / 기준 선수와 연봉 근접순 / 신장 근접순 정렬 */}
            {!sameTeamOnly && (
              <div className="tactics-sort-toggle-group">
                <button
                  type="button"
                  className={`sort-toggle-pill ${sortBy === 'tactical' ? 'active' : ''}`}
                  onClick={() => setSortBy('tactical')}
                  title="기본 전술 적합도(거리) 기준 추천순 정렬"
                >
                  전술순
                </button>
                <button
                  type="button"
                  className={`sort-toggle-pill salary-pill ${sortBy === 'salary_closest' ? 'active' : ''}`}
                  onClick={() => setSortBy(sortBy === 'salary_closest' ? 'tactical' : 'salary_closest')}
                  title="기준 선수와 연봉 연도가 같은 후보를 연봉 차이가 작은 순서로 정렬합니다."
                >
                  <DollarSign size={13} />
                  <span>연봉 근접순</span>
                </button>
                <button
                  type="button"
                  className={`sort-toggle-pill height-pill ${sortBy === 'height_closest' ? 'active' : ''}`}
                  onClick={() => setSortBy(sortBy === 'height_closest' ? 'tactical' : 'height_closest')}
                  title="포지션 높이 유지를 위해 기준 결장 선수와 신장 차이가 가장 작은 순서로 정렬합니다."
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <ArrowUpDown size={13} />
                  <span>신장 근접순</span>
                </button>
              </div>
            )}
          </div>

          {/* 1:1 비교 안내 및 기준 결장 선수 연봉/신장 바 */}
          <div className="cand-compare-hint-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={12} className="hint-icon" />
              <span>선수 <strong>사진 또는 이름</strong>을 클릭하면 결장 선수와 <strong>1:1 스탯 비교</strong>가 열립니다.</span>
            </div>
            {targetPlayer && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.73rem',
                fontWeight: 700,
                color: '#0369a1',
                background: '#e0f2fe',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #bae6fd'
              }}>
                <span>기준 결장 선수: <strong>{targetPlayer.name}</strong></span>
                <span style={{ color: '#94a3b8' }}>·</span>
                <span style={{ color: '#059669', fontWeight: 800 }} title={getSalaryDisplay(targetPlayer)}>
                  💰 {getSalaryDisplay(targetPlayer, true)}
                </span>
                {targetPlayer.height_cm && (
                  <>
                    <span style={{ color: '#94a3b8' }}>·</span>
                    <span style={{ color: '#0284c7', fontWeight: 800 }} title={`공식 신장: ${getHeightDisplay(targetPlayer)}`}>
                      📏 {targetPlayer.height_cm}cm
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 후보 선수 리스트 스크롤 영역 */}
          <div className="tactics-candidate-list" ref={candidateListRef}>
            {sortedCandidates.length === 0 ? (
              <div className="tactics-empty-state">
                <Users size={32} className="empty-icon" />
                <h5 className="empty-title">팀 내 가용 대체 선수가 없습니다</h5>
                <p className="empty-desc">
                  현재 {targetPlayer?.team} 팀 로스터에 등록된 추가 가용 선수가 없습니다. 상단 토글을 눌러 타 팀 영입 후보를 확인해보세요.
                </p>
                <button
                  type="button"
                  className="btn-switch-league"
                  onClick={() => setSameTeamOnly(false)}
                >
                  <Globe size={13} /> 타 팀 영입 후보 보기
                </button>
              </div>
            ) : (
              sortedCandidates.map((cand, idx) => {
                const isCurrentlyOnCourt = courtLineup[activePos]?.id === cand.id;
                const candCluster = clusters ? clusters[cand.clusterId] : null;
                const stocks = ((cand.stats?.stl || 0) + (cand.stats?.blk || 0)).toFixed(1);

                const targetSal = targetPlayer?.salaryNum || 0;
                const candSal = cand.salaryNum || 0;
                const sameSalaryYear = targetPlayer?.salaryYear && targetPlayer.salaryYear === cand.salaryYear;
                const salDiff = (sameSalaryYear && targetSal > 0 && candSal > 0) ? (candSal - targetSal) : null;
                const absDiff = salDiff !== null ? Math.abs(salDiff) : null;
                // 연봉 차이가 심한 기준 (1500만 달러 이상 혹은 800만 달러 이상이면서 40% 이상 차이)
                const isSevereDiff = absDiff !== null && (absDiff >= 15000000 || (targetSal > 0 && absDiff >= 8000000 && absDiff / targetSal >= 0.4));
                const isClosest = closestCandidateId === cand.id && sortBy === 'salary_closest';
                const isHeightClosest = closestHeightCandidateId === cand.id && sortBy === 'height_closest';
                const fitAnalysis = getPhysicalFitAnalysis(targetPlayer, cand);

                return (
                  <div
                    key={cand.id}
                    id={`cand-item-${cand.id}`}
                    className={`candidate-tactics-item ${isCurrentlyOnCourt ? 'is-active-on-court' : ''} ${isClosest ? 'is-closest-salary-match' : ''}`}
                  >
                    <div className="cand-rank-num">#{idx + 1}</div>

                    <div
                      className="cand-photo-wrap clickable-photo"
                      onClick={() => onCompare && onCompare(cand)}
                      title={`${cand.name} 클릭 시 1:1 스탯 비교 모달 열기`}
                    >
                      <img
                        src={cand.imgUrl || 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png'}
                        alt={cand.name}
                        className="cand-photo-img"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement.querySelector('.cand-photo-fallback');
                          if (fallback) fallback.hidden = false;
                        }}
                      />
                      <span className="cand-photo-fallback" hidden aria-hidden="true">
                        {cand.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}
                      </span>
                      <span className="photo-vs-badge">VS</span>
                    </div>

                    <div className="cand-info-col">
                      {/* 1행: 선수명, 팀, 포지션 */}
                      <div className="cand-name-row">
                        <span
                          className="cand-name-text clickable-name"
                          title={`${cand.name} (클릭 시 1:1 스탯 비교)`}
                          onClick={() => onCompare && onCompare(cand)}
                        >
                          {cand.name}
                        </span>
                        <span className="cand-team-pill">{cand.team}</span>
                        <span className="cand-pos-pill">{cand.pos}</span>
                      </div>

                      {/* 2행: 선수 군집 */}
                      {candCluster && (
                        <div className="cand-profile-row">
                          <span
                            className="cand-cluster-badge"
                            style={{
                              color: candCluster.color,
                              background: `${candCluster.color}15`,
                              border: `1px solid ${candCluster.borderColor || candCluster.color + '40'}`
                            }}
                            title={`군집 ${candCluster.id}: ${candCluster.name}`}
                          >
                            {candCluster.name}
                          </span>
                        </div>
                      )}

                      {/* 3행: 연봉, 신장 및 비교 배지 */}
                      <div className="cand-meta-badges-row">
                        {cand.salaryNum > 0 && cand.salaryShort && cand.salaryShort !== '-' && (
                          <span
                            className={`cand-salary-pill ${isSevereDiff ? 'severe-diff' : ''}`}
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: !candSal ? '#64748b' : isSevereDiff ? '#e11d48' : '#059669',
                              background: !candSal ? '#f1f5f9' : isSevereDiff ? '#fff1f2' : '#ecfdf5',
                              border: `1px solid ${!candSal ? '#cbd5e1' : isSevereDiff ? '#fecdd3' : '#a7f3d0'}`,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              marginRight: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                            title={`${getSalaryDisplay(cand)}${absDiff !== null ? ` (같은 연도 기준, 기존 대비 ${salDiff > 0 ? '+' : '-'}$${(absDiff / 1000000).toFixed(1)}M ${isSevereDiff ? '⚠️ 연봉 격차 심함' : ''})` : ''}`}
                          >
                            💰 {cand.salaryShort}
                            {absDiff !== null && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>
                                ({salDiff > 0 ? `+${(absDiff / 1000000).toFixed(1)}M` : `-${(absDiff / 1000000).toFixed(1)}M`})
                              </span>
                            )}
                          </span>
                        )}
                        {cand.height_cm && (
                          <span
                            className="cand-height-pill"
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: fitAnalysis.color,
                              background: fitAnalysis.bgColor,
                              border: `1px solid ${fitAnalysis.borderColor}`,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              marginRight: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title={`공식 신장: ${cand.height_cm}cm (${cand.height_ft_in || ''}) - ${fitAnalysis.desc}`}
                          >
                            📏 {cand.height_cm}cm
                            {targetPlayer?.height_cm && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>
                                ({fitAnalysis.diffCm > 0 ? `+${fitAnalysis.diffCm}cm` : fitAnalysis.diffCm === 0 ? '일치' : `${fitAnalysis.diffCm}cm`})
                              </span>
                            )}
                          </span>
                        )}
                        {isClosest && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: '#0284c7',
                              background: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              marginRight: '2px',
                              whiteSpace: 'nowrap'
                            }}
                            title={`기존 결장 선수(${targetPlayer?.name})와 연봉 차이가 가장 적음 ($${(absDiff / 1000000).toFixed(1)}M 차이)`}
                          >
                            🎯 연봉 최단차
                          </span>
                        )}
                        {isHeightClosest && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: '#0284c7',
                              background: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              marginRight: '2px',
                              whiteSpace: 'nowrap'
                            }}
                            title={`기존 결장 선수(${targetPlayer?.name})와 신장 차이가 가장 적음 (${Math.abs(fitAnalysis.diffCm)}cm 차이)`}
                          >
                            🎯 신장 최단차
                          </span>
                        )}
                        {cand.otherSlot && (
                          <span
                            className="cand-warning-icon-pill"
                            title={`현재 ${cand.otherSlot} 출전 중 (투입 시 ${cand.otherSlot} 위치에 중복 주의 표시)`}
                          >
                            <AlertTriangle size={12} />
                          </span>
                        )}
                      </div>

                      {/* 2행: 핵심 스탯 칩 (득점, 리바운드, 어시스트, 3P%, FG%) */}
                      <div className="cand-stat-chips-row">
                        <span className="cand-stat-chip">
                          <span className="chip-lbl">PTS</span>
                          <strong className="chip-val">{cand.stats?.pts || 0}</strong>
                        </span>
                        <span className="cand-stat-chip">
                          <span className="chip-lbl">TRB</span>
                          <strong className="chip-val">{cand.stats?.trb || 0}</strong>
                        </span>
                        <span className="cand-stat-chip">
                          <span className="chip-lbl">AST</span>
                          <strong className="chip-val">{cand.stats?.ast || 0}</strong>
                        </span>
                        <span className="cand-stat-chip">
                          <span className="chip-lbl">3P</span>
                          <strong className="chip-val">{((cand.stats?.x3p_pct || 0) * 100).toFixed(0)}%</strong>
                        </span>
                        <span className="cand-stat-chip">
                          <span className="chip-lbl">FG</span>
                          <strong className="chip-val">{((cand.stats?.fg_pct || 0) * 100).toFixed(0)}%</strong>
                        </span>
                      </div>

                      {/* 3행: 프로필 메타 정보 (나이, 시즌 출전수, 종합 수비 Stocks) */}
                      <div className="cand-meta-line">
                        <span>만 {cand.age}세</span>
                        <span>·</span>
                        <span>시즌 {cand.g || 0}경기 출전</span>
                        <span>·</span>
                        <span>수비 기여 <strong>{stocks} Stocks</strong></span>
                      </div>
                    </div>

                    <div className="cand-action-col">
                      <div className="cand-sim-badge">
                        <span className="sim-lbl">전술 거리</span>
                        <span
                          className="sim-num"
                          style={{
                            color: (cand.tacticalDistance ?? cand.knnData?.distance ?? 1.5) < 1.5
                              ? '#059669'
                              : (cand.tacticalDistance ?? cand.knnData?.distance ?? 1.5) < 2.5
                              ? '#0284c7'
                              : '#d97706'
                          }}
                        >
                          {(cand.tacticalDistance ?? cand.knnData?.distance ?? 1.25).toFixed(2)}
                        </span>
                      </div>

                      <button
                        className={`btn-insert-court ${isCurrentlyOnCourt ? 'btn-inserted' : ''}`}
                        onClick={() => handleInsertToCourt(cand)}
                        disabled={isCurrentlyOnCourt}
                        title={cand.otherSlot ? `현재 ${cand.otherSlot} 출전 중인 선수입니다. 투입 후 기존 ${cand.otherSlot} 위치에 중복 주의 표시가 나타나며, 그 자리에 새로운 선수를 채울 수 있습니다.` : undefined}
                      >
                        {isCurrentlyOnCourt ? (
                          <>
                            <CheckCircle2 size={13} /> 코트 투입중
                          </>
                        ) : (
                          <>
                            <Zap size={13} /> 코트에 투입
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateLineupStats(lineup) {
  const players = Object.values(lineup || {}).filter(Boolean);
  if (players.length === 0) return { pts: 0, reb: 0, ast: 0, x3p: 0, height: 0 };

  return {
    pts: players.reduce((sum, player) => sum + (player.stats?.pts || 0), 0) / players.length,
    reb: players.reduce((sum, player) => sum + (player.stats?.trb || 0), 0) / players.length,
    ast: players.reduce((sum, player) => sum + (player.stats?.ast || 0), 0) / players.length,
    x3p: (players.reduce((sum, player) => sum + (player.stats?.x3p_pct || 0), 0) / players.length) * 100,
    height: players.reduce((sum, player) => sum + (player.height_cm || 198), 0) / players.length
  };
}

/**
 * 헬퍼 함수: 타깃 선수의 팀 소속 선수들을 기반으로 5개 포지션 선발 라인업 자동 초기화
 */
function initializeLineup(targetPlayer, allPlayers) {
  if (!targetPlayer) return {};
  const team = targetPlayer.team;
  const teammates = allPlayers
    .filter((p) => p.team === team && p.id !== targetPlayer.id)
    .sort((a, b) => (Number(b.mp) || 0) - (Number(a.mp) || 0));

  const lineup = {
    PG: null,
    SG: null,
    SF: null,
    PF: null,
    C: null
  };

  // 1) 타깃 선수는 본인 포지션에 우선 배치
  lineup[targetPlayer.pos] = targetPlayer;

  // 2) 팀 내 동료 선수들로 나머지 포지션 우선 채우기
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  for (const pos of positions) {
    if (!lineup[pos]) {
      const match = teammates.find((p) => p.pos === pos);
      if (match) {
        lineup[pos] = match;
      }
    }
  }

  // 3) 만약 특정 포지션이 비어있으면 팀 내 출전 시간(MP) 높은 동료나 기본 선수로 채움
  const remaining = teammates.filter((p) => !Object.values(lineup).some((lp) => lp && lp.id === p.id));
  for (const pos of positions) {
    if (!lineup[pos] && remaining.length > 0) {
      lineup[pos] = remaining.shift();
    }
  }

  return lineup;
}
