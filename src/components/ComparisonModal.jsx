import React, { useState } from 'react';
import RadarChart from './RadarChart';
import { CLUSTERS, calculateKNNDistance, getSalaryDisplay, getPhysicalFitAnalysis, getHeightDisplay } from '../data/mockPlayers';
import { X, CheckCircle, AlertTriangle, TrendingUp, Sparkles, SlidersHorizontal, BarChart2, Cpu, ChevronDown } from 'lucide-react';

export default function ComparisonModal({ target, candidate, allPlayers = [], onClose }) {
  if (!target || !candidate) return null;

  // 현재 비교 대상 선수 (사용자가 다른 군집 선수로 실시간 교체 가능)
  const [activeCandidate, setActiveCandidate] = useState(candidate);

  // 비교 모드 상태: 'DERIVED' (도메인 7대 파생변수 & 핵심 피처) | 'TRADITIONAL' (기본 원본 스탯)
  const [metricMode, setMetricMode] = useState('DERIVED');

  // 군집 테스트 패널 열림/닫힘 (기본값: false로 숨김 처리, 버튼 클릭 시 노출)
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [testClusterTab, setTestClusterTab] = useState(() => {
    // 타깃 선수와 다른 군집을 기본 탭으로 추천
    return target.clusterId === 2 ? 1 : 2;
  });
  const [searchQuery, setSearchQuery] = useState('');

  const targetCluster = CLUSTERS[target.clusterId] || CLUSTERS[0];
  const candidateCluster = CLUSTERS[activeCandidate.clusterId] || CLUSTERS[0];
  const isDifferentCluster = target.clusterId !== activeCandidate.clusterId;

  // 1) 원본 기본 스탯 비교 지표
  const traditionalMetrics = [
    { label: '36분 환산 득점 (PTS)', key: 'pts', max: 32, unit: '점', desc: '36분당 평균 득점' },
    { label: '3점 성공률 (3P%)', key: 'x3p_pct', max: 0.5, unit: '%', isPct: true, desc: '3점슛 성공 효율성' },
    { label: '36분 리바운드 (TRB)', key: 'trb', max: 15, unit: '개', desc: '36분당 총 리바운드' },
    { label: '36분 어시스트 (AST)', key: 'ast', max: 12, unit: '개', desc: '36분당 플레이메이킹' },
    { label: '36분 블록슛 (BLK)', key: 'blk', max: 3.0, unit: '개', desc: '36분당 림 보호' },
    { label: '36분 스틸 (STL)', key: 'stl', max: 2.5, unit: '개', desc: '36분당 앞선 볼 스틸' },
    { label: '필드골 성공률 (FG%)', key: 'fg_pct', max: 0.65, unit: '%', isPct: true, desc: '야투 종합 성공률' }
  ];

  // 2) kdt_project3.ipynb에서 직접 설계한 9대 도메인 핵심 파생변수
  const derivedMetrics = [
    { label: '3점 성향 (3PAr)', key: 'three_point_share', max: 0.85, isPct: true, desc: '전체 야투 중 3점슛 시도 비율 (외곽 공간 창출)' },
    { label: '자유투 획득력 (FTr)', key: 'ft_rate', max: 0.80, unit: '', desc: '야투 대비 자유투 획득 (림 어택 & 파울 유도)' },
    { label: '패스 vs 슛 성향', key: 'pass_vs_shoot', max: 1.5, unit: '', desc: '직접 야투 대비 어시스트 비율 (리딩 vs 스코어링)' },
    { label: '볼 안정성 (A/T Ratio)', key: 'ast_to_tov', max: 4.5, unit: '', desc: '턴오버 대비 어시스트 비율 (리딩 안정성)' },
    { label: '공격 리바운드 비중', key: 'orb_share', max: 0.45, isPct: true, desc: '총 리바운드 중 공격 리바운드 비율 (골밑 경합)' },
    { label: '외곽 수비 성향', key: 'perimeter_def_ratio', max: 1.0, isPct: true, desc: '스틸 대 블록 비중 (앞선 압박 vs 골밑 림 보호)' },
    { label: '종합 수비 기여도 (Stocks)', key: 'stocks', max: 4.5, unit: '개', desc: '36분당 스틸 + 블록 종합 수비 활동량' },
    { label: '야투 시도 볼륨 (FGA)', key: 'fga_per_36_min', max: 25, unit: '회', desc: '36분당 야투 시도량 (팀 1옵션 주포 여부)' },
    { label: '골밑 장악 볼륨 (TRB)', key: 'trb_per_36_min', max: 16, unit: '개', desc: '36분당 총 리바운드 (피지컬 골밑 장악력)' }
  ];

  const currentMetrics = metricMode === 'DERIVED' ? derivedMetrics : traditionalMetrics;

  // 값 추출 헬퍼 (stats 객체 또는 features 객체)
  const getValue = (player, metricKey) => {
    if (metricMode === 'DERIVED') {
      if (player.features && player.features[metricKey] !== undefined) {
        return player.features[metricKey];
      }
      if (metricKey === 'three_point_share') return player.stats.x3pa / Math.max(1, player.stats.pts / 2);
      if (metricKey === 'stocks') return player.stats.stl + player.stats.blk;
      if (metricKey === 'trb_per_36_min') return player.stats.trb;
      return 0;
    }
    return player.stats[metricKey] ?? 0;
  };

  // 군집별 대표 선수 추천 퀵 리스트
  const clusterBenchmarkPlayers = React.useMemo(() => {
    if (!allPlayers || allPlayers.length === 0) return {};
    const map = { 0: [], 1: [], 2: [], 3: [] };
    // 우선 출전 시간(mp)이나 득점이 높은 유명 선수들 위주로 필터링
    const sorted = [...allPlayers].sort((a, b) => (b.stats?.pts || 0) - (a.stats?.pts || 0));
    for (const p of sorted) {
      if (map[p.clusterId] && map[p.clusterId].length < 6) {
        if (!map[p.clusterId].some(x => x.name === p.name)) {
          map[p.clusterId].push(p);
        }
      }
    }
    return map;
  }, [allPlayers]);

  // 검색 결과 선수 목록 (최대 8명)
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim() || !allPlayers) return [];
    const q = searchQuery.toLowerCase();
    return allPlayers.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, allPlayers]);

  // AI 스카우터 코멘트 생성
  const generateScoutingReport = () => {
    const isSameCluster = target.clusterId === activeCandidate.clusterId;

    // 파생변수 기반 전술적 격차 분석
    const t3p = getValue(target, 'three_point_share');
    const c3p = getValue(activeCandidate, 'three_point_share');
    const diff3p = (c3p - t3p) * 100;

    const tPass = getValue(target, 'pass_vs_shoot');
    const cPass = getValue(activeCandidate, 'pass_vs_shoot');
    const diffPass = cPass - tPass;

    const tStocks = getValue(target, 'stocks');
    const cStocks = getValue(activeCandidate, 'stocks');
    const diffStocks = cStocks - tStocks;

    const tTrb = getValue(target, 'trb_per_36_min');
    const cTrb = getValue(activeCandidate, 'trb_per_36_min');
    const diffTrb = cTrb - tTrb;

    const heightDiff = (activeCandidate.height_cm || 0) - (target.height_cm || 0);
    const heightFeedback = Math.abs(heightDiff) <= 2
      ? `신장 완벽 일치 (${activeCandidate.height_cm}cm): 포지션 높이 손실 없음`
      : heightDiff > 2
      ? `사이즈 우위 (+${heightDiff}cm): 포지션 시야 및 수비 컨테스트 확장`
      : `언더사이즈 주의 (${heightDiff}cm): 미스매치 수비 및 골밑 경합 리스크`;

    return {
      isSameCluster,
      clusterMatchText: isSameCluster
        ? `동일 롤 [${targetCluster.name}] 소속으로 핵심 전술적 성향(Role)이 완벽히 일치합니다.`
        : `⚠️ 이종 롤 대결: [${targetCluster.name}] vs [${candidateCluster.name}] — 군집화 모델이 두 선수를 완전히 다른 역할로 분류했습니다.`,
      strengths: [
        heightFeedback,
        diff3p >= 0
          ? `3점 외곽 스페이싱 성향 우위 (+${diff3p.toFixed(1)}% 3PAr)`
          : `외곽 3점슛 비중 현저히 낮음 (${diff3p.toFixed(1)}% 3PAr)`,
        diffPass >= 0
          ? `플레이메이킹/패스 분배 성향 우세 (+${diffPass.toFixed(2)} AST/FGA)`
          : `직접 슛 해결 성향이 더 높음 (${diffPass.toFixed(2)} AST/FGA)`,
        diffTrb >= 0
          ? `골밑 리바운드 장악력 우위 (+${diffTrb.toFixed(1)} TRB/36)`
          : `골밑 리바운드 관여도 낮음 (${diffTrb.toFixed(1)} TRB/36)`,
        diffStocks >= 0
          ? `종합 수비 활동량(Stocks) 우세 (+${diffStocks.toFixed(2)} STL+BLK)`
          : `수비 활동량 격차 (${diffStocks.toFixed(2)} STL+BLK)`
      ],
      recommendation: isSameCluster
        ? `현재 ${target.name}의 결장 공백을 메우기에 팀 전술 변경 없이 가장 직관적으로 녹아들 수 있는 1순위 대체 카드입니다.`
        : `[군집화 모델 검증 결과] 두 선수의 플레이스타일이 상극이거나 역할이 다르므로 단순 1:1 대체 시 전술 시스템 전면 재설계가 필요합니다.`
    };
  };

  const report = generateScoutingReport();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '980px', width: '95%' }}>
        {/* 모달 상단 헤더 */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="badge-comparison">HEAD-TO-HEAD SCOUTING ANALYSIS</span>
            <h2 className="modal-title">1:1 선수 정밀 전술 비교 분석</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 🧪 군집 검증 테스트 토글 버튼 (별도 버튼 클릭 시에만 패널 노출) */}
            <button
              type="button"
              className="btn-toggle-cluster-test"
              onClick={() => setIsTestPanelOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: isTestPanelOpen ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                background: isTestPanelOpen ? '#e0f2fe' : '#ffffff',
                color: isTestPanelOpen ? '#0284c7' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isTestPanelOpen ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none'
              }}
              title="타 군집 선수와 즉석 맞대결 테스트 패널 열기/닫기"
            >
              <span>🧪 다른 군집과 비교 테스트</span>
              <ChevronDown
                size={14}
                style={{
                  transform: isTestPanelOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>

            <button className="btn-close" onClick={onClose} aria-label="닫기">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 🧪 군집화 모델 검증 테스트 인터랙티브 컨트롤 패널 (버튼 클릭 시에만 노출) */}
        {isTestPanelOpen && (
          <div className="cluster-test-banner" style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(99, 102, 241, 0.08))',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#0ea5e9',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.04em'
              }}>
                🧪 군집 검증 VS 테스트
              </span>
              <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>
                다른 군집(Role) 선수와 맞대결하여 군집화 분리 성능을 테스트해보세요:
              </strong>
            </div>

            {/* 원래 추천 선수로 복귀 버튼 (다른 선수를 골랐을 때만 노출) */}
            {activeCandidate.id !== candidate.id && (
              <button
                onClick={() => setActiveCandidate(candidate)}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#0284c7',
                  background: '#e0f2fe',
                  border: '1px solid #bae6fd',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ↩ 원래 추천 선수({candidate.name})로 복귀
              </button>
            )}
          </div>

          {/* 군집 선택 탭 버튼들 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>비교 군집 선택:</span>
            {CLUSTERS.map((cl) => {
              const isTargetCluster = target.clusterId === cl.id;
              const isActive = testClusterTab === cl.id;
              return (
                <button
                  key={cl.id}
                  onClick={() => setTestClusterTab(cl.id)}
                  style={{
                    padding: '4px 9px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: isActive ? `2px solid ${cl.color}` : '1px solid #cbd5e1',
                    background: isActive ? `${cl.color}15` : '#ffffff',
                    color: isActive ? cl.color : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cl.color }} />
                  {cl.name} {isTargetCluster && '(기준 동일)'}
                </button>
              );
            })}
          </div>

          {/* 선택된 군집의 대표 스타 선수 퀵 칩 & 검색창 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>대표 스타 즉시 매칭:</span>
            {(clusterBenchmarkPlayers[testClusterTab] || []).map((star) => {
              const isSelected = activeCandidate.id === star.id;
              return (
                <button
                  key={star.id}
                  onClick={() => setActiveCandidate(star)}
                  style={{
                    padding: '3px 9px',
                    fontSize: '0.73rem',
                    fontWeight: isSelected ? 800 : 600,
                    borderRadius: '14px',
                    border: isSelected ? '1px solid #059669' : '1px solid #e2e8f0',
                    background: isSelected ? '#10b981' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 4px rgba(16, 185, 129, 0.3)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {star.name} ({star.pos})
                </button>
              );
            })}

            {/* 선수 검색 인풋 */}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <input
                type="text"
                placeholder="전체 선수명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  width: '150px'
                }}
              />
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  width: '200px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setActiveCandidate(p);
                        setSearchQuery('');
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        color: '#1e293b'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <strong>{p.name}</strong> <span style={{ color: '#64748b' }}>({p.team}·{CLUSTERS[p.clusterId]?.shortName})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* 이종 군집 비교 시 시각적 알림 배너 */}
        {isDifferentCluster && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1))',
            borderLeft: '4px solid #f59e0b',
            padding: '8px 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.4 }}>
              <strong>[이종 군집 비교 분석 중]</strong> {target.name}은(는) <strong>[{targetCluster.name}]</strong>이고, {activeCandidate.name}은(는) <strong>[{candidateCluster.name}]</strong>입니다. 레이더 차트 형태와 9대 파생변수의 확연한 차이를 통해 군집화 모델이 플레이스타일을 어떻게 분리해냈는지 확인해보세요.
            </span>
          </div>
        )}

        {/* 모달 내용 */}
        <div className="modal-body">
          {/* 선수 요약 카드 대결 뷰 */}
          <div className="versus-header">
            <div className="versus-card target-side">
              <span className="side-label">결장 선수 (대체 대상)</span>
              <div className="versus-photo-wrap">
                <img
                  src={target.imgUrl || 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png'}
                  alt={target.name}
                  className="versus-photo-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png';
                  }}
                />
              </div>
              <h3 className="versus-name" style={{ color: '#0284c7' }}>{target.name}</h3>
              <p className="versus-sub">
                {target.team} · {target.pos} · {target.age}세
                {target.height_cm && ` · 📏 ${target.height_cm}cm (${target.height_ft_in || ''})`}
              </p>
              <span className="versus-cluster" style={{ borderColor: targetCluster.color, color: targetCluster.color }}>
                {targetCluster.name}
              </span>
              <div style={{ marginTop: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                연봉: {getSalaryDisplay(target)}
              </div>
            </div>

            {/* 중앙 VS 및 KNN 전술 거리 배지 */}
            <div className="versus-badge" style={{ minWidth: '110px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>VS</span>
              {(() => {
                const knnRes = calculateKNNDistance(target, activeCandidate);
                const sameSalaryYear = target.salaryYear && target.salaryYear === activeCandidate.salaryYear;
                const salDiff = (sameSalaryYear && target.salaryNum && activeCandidate.salaryNum)
                  ? target.salaryNum - activeCandidate.salaryNum
                  : null;
                const fit = getPhysicalFitAnalysis(target, activeCandidate);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4, gap: 2 }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      background: isDifferentCluster ? '#f59e0b' : '#10b981',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      {isDifferentCluster ? '⚠️ 이종 군집' : '🎯 동일 롤'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
                      전술 거리: <strong style={{ color: isDifferentCluster ? '#d97706' : '#059669', fontSize: '0.78rem' }}>{knnRes.distance}</strong>
                    </span>
                    <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                      ({knnRes.tier.split(' ')[0]})
                    </span>
                    {salDiff !== null && (
                      <span style={{
                        marginTop: '2px',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: salDiff > 0 ? '#ecfdf5' : '#fef2f2',
                        color: salDiff > 0 ? '#059669' : '#dc2626',
                        border: `1px solid ${salDiff > 0 ? '#a7f3d0' : '#fecaca'}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {salDiff > 0
                          ? `절감 -$${(salDiff / 1000000).toFixed(1)}M`
                          : `추가 +$${(Math.abs(salDiff) / 1000000).toFixed(1)}M`}
                      </span>
                    )}
                    <span style={{
                      marginTop: '2px',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: fit.bgColor,
                      color: fit.color,
                      border: `1px solid ${fit.borderColor}`,
                      whiteSpace: 'nowrap'
                    }} title={fit.desc}>
                      {fit.badge} ({fit.diffCm > 0 ? `+${fit.diffCm}` : fit.diffCm === 0 ? '일치' : `${fit.diffCm}cm`})
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="versus-card candidate-side">
              <span className="side-label">
                {activeCandidate.id === candidate.id ? '영입 추천 후보' : '테스트 비교 대상'}
              </span>
              <div className="versus-photo-wrap">
                <img
                  src={activeCandidate.imgUrl || 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png'}
                  alt={activeCandidate.name}
                  className="versus-photo-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png';
                  }}
                />
              </div>
              <h3 className="versus-name" style={{ color: '#059669' }}>{activeCandidate.name}</h3>
              <p className="versus-sub">
                {activeCandidate.team} · {activeCandidate.pos} · {activeCandidate.age}세
                {activeCandidate.height_cm && ` · 📏 ${activeCandidate.height_cm}cm (${activeCandidate.height_ft_in || ''})`}
              </p>
              <span className="versus-cluster" style={{ borderColor: candidateCluster.color, color: candidateCluster.color }}>
                {candidateCluster.name}
              </span>
              <div style={{ marginTop: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                연봉: {getSalaryDisplay(activeCandidate)}
              </div>
            </div>
          </div>

          {/* 현실적 스카우팅 타당성 3대 핵심 지표 (전술 유사도 · 재정 타당성 · 피지컬 적합도) */}
          {(() => {
            const knnRes = calculateKNNDistance(target, activeCandidate);
            const sameSalaryYear = target.salaryYear && target.salaryYear === activeCandidate.salaryYear;
            const salDiff = (sameSalaryYear && target.salaryNum && activeCandidate.salaryNum)
              ? target.salaryNum - activeCandidate.salaryNum
              : null;
            const fit = getPhysicalFitAnalysis(target, activeCandidate);
            const tH = target.height_cm || 198;
            const cH = activeCandidate.height_cm || 198;
            const maxH = 225;

            return (
              <div style={{
                margin: '0.9rem 0 1.1rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.8rem 1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={14} color="#0ea5e9" />
                    현실적 스카우팅 3대 타당성 종합 진단 (Feasibility Check)
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    플레이 스타일 유사도뿐만 아니라 연봉과 피지컬 높이의 현실적 트레이드오프를 평가합니다.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {/* 지표 1: 전술 일치도 */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                      1. 전술/플레이스타일 일치도
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: isDifferentCluster ? '#d97706' : '#059669' }}>
                        {knnRes.score}점
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        거리 {knnRes.distance} · {knnRes.tier.split(' ')[0]}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>
                      {isDifferentCluster ? '군집 분리로 인한 전술 변경 필요' : '팀 공격 시스템 변동 없이 즉시 투입 가능'}
                    </div>
                  </div>

                  {/* 지표 2: 재정적 타당성 */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                      2. 재정적 타당성 (Salary Gap)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        color: salDiff === null ? '#64748b' : salDiff >= 0 ? '#059669' : '#e11d48'
                      }}>
                        {salDiff !== null
                          ? (salDiff >= 0 ? `-$${(salDiff / 1000000).toFixed(1)}M 절감` : `+$${(Math.abs(salDiff) / 1000000).toFixed(1)}M 지출`)
                          : '연봉 비교 불가'}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        후보 {activeCandidate.salaryShort || '-'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>
                      {salDiff !== null && salDiff >= 0
                        ? '샐러리 캡 여유 확보로 재정적 가성비 우수'
                        : salDiff !== null && Math.abs(salDiff) > 8000000
                        ? '⚠️ 과도한 추가 연봉 지출로 캡 공간 부담 우려'
                        : '적정 재정 범위 내 영입 가능'}
                    </div>
                  </div>

                  {/* 지표 3: 피지컬 높이 적합도 */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                        3. 피지컬 높이 적합도 (Height Match)
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: fit.color,
                        background: fit.bgColor,
                        border: `1px solid ${fit.borderColor}`,
                        padding: '1px 5px',
                        borderRadius: '4px'
                      }}>
                        {fit.badge}
                      </span>
                    </div>

                    {/* 신장 바 비교 시각화 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                        <span style={{ width: '45px', color: '#0284c7', fontWeight: 700 }}>{target.name.split(' ').pop()}</span>
                        <div style={{ flex: 1, height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (tH / maxH) * 100)}%`, height: '100%', background: '#38bdf8' }} />
                        </div>
                        <span style={{ width: '38px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{tH}cm</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                        <span style={{ width: '45px', color: '#059669', fontWeight: 700 }}>{activeCandidate.name.split(' ').pop()}</span>
                        <div style={{ flex: 1, height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (cH / maxH) * 100)}%`, height: '100%', background: fit.color }} />
                        </div>
                        <span style={{ width: '38px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{cH}cm</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.68rem', color: fit.color, marginTop: '4px', lineHeight: 1.3 }}>
                      {fit.desc}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="modal-grid">
            {/* 좌측: 레이더 차트 */}
            <div className="chart-panel">
              <h4 className="panel-title">6각 다각도 밸런스 비교</h4>
              <p className="panel-desc">공수 주요 6대 항목 정규화 역량 지수</p>

              <RadarChart p1={target} p2={activeCandidate} size={280} />

              <div className="chart-legend-horizontal">
                <div className="legend-entry">
                  <span className="legend-indicator" style={{ backgroundColor: '#38bdf8' }} />
                  <span>{target.name} (기준)</span>
                </div>
                <div className="legend-entry">
                  <span className="legend-indicator" style={{ backgroundColor: '#10b981' }} />
                  <span>{activeCandidate.name} (비교)</span>
                </div>
              </div>
            </div>

            {/* 우측: 스탯 바 상세 비교 (탭 전환 지원) */}
            <div className="stats-panel">
              <div className="stats-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <div>
                  <h4 className="panel-title" style={{ margin: 0 }}>
                    {metricMode === 'DERIVED' ? '🧠 머신러닝 전술 파생변수 비교' : '📊 36분 환산 기본 스탯 격차'}
                  </h4>
                  <p className="panel-desc" style={{ margin: '2px 0 0' }}>
                    {metricMode === 'DERIVED' ? 'kdt_project3에서 설계한 7대 도메인 롤 파생변수' : '기본 볼륨 및 성공률 비교'}
                  </p>
                </div>

                {/* 모드 전환 탭 버튼 */}
                <div className="metric-toggle-group" style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    className={`metric-tab-btn ${metricMode === 'DERIVED' ? 'active' : ''}`}
                    onClick={() => setMetricMode('DERIVED')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: metricMode === 'DERIVED' ? '#0ea5e9' : 'transparent',
                      color: metricMode === 'DERIVED' ? '#ffffff' : '#64748b'
                    }}
                  >
                    <Cpu size={13} /> 전술 파생변수
                  </button>
                  <button
                    className={`metric-tab-btn ${metricMode === 'TRADITIONAL' ? 'active' : ''}`}
                    onClick={() => setMetricMode('TRADITIONAL')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: metricMode === 'TRADITIONAL' ? '#0ea5e9' : 'transparent',
                      color: metricMode === 'TRADITIONAL' ? '#ffffff' : '#64748b'
                    }}
                  >
                    <BarChart2 size={13} /> 기본 스탯
                  </button>
                </div>
              </div>

              {/* 스탯 비교 리스트 */}
              <div className="stat-bars-list" style={{ maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                {currentMetrics.map((m) => {
                  const v1 = getValue(target, m.key);
                  const v2 = getValue(activeCandidate, m.key);
                  const diff = v2 - v1;
                  const isBetter = diff >= 0;

                  const p1Percent = Math.min(100, Math.max(0, (v1 / m.max) * 100));
                  const p2Percent = Math.min(100, Math.max(0, (v2 / m.max) * 100));

                  const displayV1 = m.isPct ? `${(v1 * 100).toFixed(1)}%` : (typeof v1 === 'number' ? v1.toFixed(2) : v1);
                  const displayV2 = m.isPct ? `${(v2 * 100).toFixed(1)}%` : (typeof v2 === 'number' ? v2.toFixed(2) : v2);
                  const displayDiff = m.isPct ? `${(diff * 100).toFixed(1)}%` : (diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));

                  return (
                    <div key={m.key} className="stat-compare-row" title={m.desc}>
                      <div className="row-header">
                        <span className="stat-row-label">
                          {m.label}
                          {m.desc && <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>({m.desc})</span>}
                        </span>
                        <span className={`stat-diff-badge ${isBetter ? 'diff-positive' : 'diff-negative'}`}>
                          {displayDiff}
                        </span>
                      </div>

                      <div className="stat-dual-bar">
                        <div className="bar-sub-row">
                          <span
                            className="bar-sub-name"
                            style={{ color: '#0284c7' }}
                            title={target.name}
                          >
                            {target.name.includes('-') ? target.name.split('-').pop() : (target.name.split(' ').slice(1).join(' ') || target.name)}
                          </span>
                          <div className="bar-track">
                            <div className="bar-fill fill-target" style={{ width: `${p1Percent}%` }} />
                          </div>
                          <span className="bar-val">{displayV1}</span>
                        </div>

                        <div className="bar-sub-row">
                          <span
                            className="bar-sub-name"
                            style={{ color: '#059669' }}
                            title={activeCandidate.name}
                          >
                            {activeCandidate.name.includes('-') ? activeCandidate.name.split('-').pop() : (activeCandidate.name.split(' ').slice(1).join(' ') || activeCandidate.name)}
                          </span>
                          <div className="bar-track">
                            <div className="bar-fill fill-candidate" style={{ width: `${p2Percent}%` }} />
                          </div>
                          <span className="bar-val">{displayV2}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 하단: AI 스카우터 분석 브리핑 */}
          <div className="scouting-summary-box">
            <div className="scouting-summary-header">
              <Sparkles size={18} style={{ color: '#38bdf8' }} />
              <strong>COURT RUSH 전술적 대체 평가 리포트</strong>
            </div>
            <p className="summary-match-reason">{report.clusterMatchText}</p>
            <div className="summary-tags">
              {report.strengths.map((str, idx) => (
                <span key={idx} className="summary-tag-item">
                  <TrendingUp size={14} style={{ marginRight: 4 }} /> {str}
                </span>
              ))}
            </div>
            <div className="summary-recommendation">
              <strong>스카우터 결론:</strong> {report.recommendation}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
