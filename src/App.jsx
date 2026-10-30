import React, { useState, useMemo } from 'react';
import { PLAYERS, CLUSTERS, calculateKNNDistance, getSalaryDisplay, getHeightDisplay } from './data/mockPlayers';
import { NBA_TEAMS_2026, getTeamStanding } from './data/teamStandings2026';
import TeamListView from './components/TeamListView';
import TeamRosterView from './components/TeamRosterView';
import RadarChart from './components/RadarChart';
import BasketballCourtTactics from './components/BasketballCourtTactics';
import MatchupStrategyView from './components/MatchupStrategyView';
import ComparisonModal from './components/ComparisonModal';
import {
  ArrowLeft,
  Home,
  Target,
  ShieldCheck
} from 'lucide-react';
import './App.css';

const CURRENT_PLAYER_SEASON = Math.max(...PLAYERS.map((player) => player.season || 0));

export default function App() {
  // 3단계 드릴다운 네비게이션 상태: 'TEAMS' (1단계) | 'ROSTER' (2단계) | 'SCOUT' (3단계)
  const [currentStep, setCurrentStep] = useState('TEAMS');
  
  // 선택된 팀 (예: 'GSW', 'OKC', 'BOS' 등)
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  
  // 선택된 대체 대상 선수 (기본값: 'curryst01')
  const [targetPlayerId, setTargetPlayerId] = useState('curryst01');
  
  // 1:1 비교 모달 대상 선수
  const [comparingCandidate, setComparingCandidate] = useState(null);

  // 코트 전술판에서 구성한 맞춤 5인 라인업 데이터
  const [customLineupData, setCustomLineupData] = useState(null);

  // 1) 1단계 -> 2단계: 팀 선택 핸들러
  const handleSelectTeam = (teamId) => {
    setSelectedTeamId(teamId);
    setCurrentStep('ROSTER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 2) 2단계 -> 3단계: 선수 선택 핸들러
  const handleSelectPlayer = (playerId) => {
    setTargetPlayerId(playerId);
    setCurrentStep('SCOUT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 3) 뒤로가기 핸들러들
  const handleBackToTeams = () => {
    setCurrentStep('TEAMS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMatchupStrategy = () => {
    setCurrentStep('MATCHUP');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnalyzeMatchupFromCourt = (lineupInfo) => {
    setCustomLineupData({
      ...lineupInfo,
      team: currentTeamObj
    });
    setCurrentStep('MATCHUP');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackFromMatchup = () => {
    if (customLineupData && selectedTeamId) {
      setCurrentStep('SCOUT');
    } else {
      setCurrentStep('TEAMS');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToRoster = () => {
    setCurrentStep('ROSTER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 현재 타깃 선수 객체
  const targetPlayer = useMemo(() => {
    return PLAYERS.find((p) => p.id === targetPlayerId) || PLAYERS[0];
  }, [targetPlayerId]);

  // 현재 선택된 팀 정보 객체
  const currentTeamObj = useMemo(() => {
    if (selectedTeamId) {
      return getTeamStanding(selectedTeamId) || NBA_TEAMS_2026[0];
    }
    return getTeamStanding(targetPlayer.team) || NBA_TEAMS_2026[0];
  }, [selectedTeamId, targetPlayer]);

  // 선택된 팀의 소속 선수 목록
  const teamPlayers = useMemo(() => {
    const tId = selectedTeamId || targetPlayer.team;
    return PLAYERS.filter((p) => p.season === CURRENT_PLAYER_SEASON && p.team === tId);
  }, [selectedTeamId, targetPlayer]);

  // 대체 추천 선수 목록 계산 (KNN 전술 거리 오름차순)
  const recommendations = useMemo(() => {
    if (!targetPlayer) return [];

    // 타겟 선수 본인 및 동일 팀 소속 선수 제외 (타 팀 영입 대상 탐색)
    const candidates = PLAYERS.filter((p) => (
      p.season === targetPlayer.season && p.id !== targetPlayer.id && p.team !== targetPlayer.team
    ));

    // 각 후보 선수별 KNN 전술 거리 및 매칭 스코어 계산
    const scored = candidates.map((candidate) => {
      const knnData = calculateKNNDistance(targetPlayer, candidate);
      return {
        ...candidate,
        knnData,
        similarityScore: knnData.score.toString(),
        tacticalDistance: knnData.distance
      };
    });

    // 정렬 (KNN 최근접 전술 거리 오름차순)
    scored.sort((a, b) => a.knnData.distance - b.knnData.distance);

    return scored;
  }, [targetPlayer]);

  const targetCluster = CLUSTERS[targetPlayer.clusterId];

  return (
    <div className="app-container">
      {/* 1. 글로벌 네비게이션 헤더 */}
      <header className="navbar">
        <div className="nav-left">
          <div className="logo-badge" onClick={handleBackToTeams} style={{ cursor: 'pointer' }}>
            <span className="logo-icon" role="img" aria-label="COURT RUSH 농구공 로고">
              <span aria-hidden="true">🏀</span>
            </span>
            <div className="logo-text">
              <span className="brand-name">COURT RUSH</span>
              <span className="brand-sub">NBA 머신러닝 군집화 기반 대체 선수 스카우팅</span>
            </div>
          </div>
        </div>

      </header>

      {/* 2. 단계별 뷰 렌더링 */}
      <main className="main-content">
        {/* =========================================================
            VIEW 1: 초기 진입 화면 - 2026 시즌 팀 순위 뷰 (STEP 1)
            팀 목록만 크고 깔끔하게 표시됨 (로고 & 3자리 알파벳 약칭)
            ========================================================= */}
        {currentStep === 'TEAMS' && (
          <TeamListView onSelectTeam={handleSelectTeam} onOpenMatchup={handleOpenMatchupStrategy} />
        )}

        {currentStep === 'MATCHUP' && (
          <MatchupStrategyView
            onBack={handleBackFromMatchup}
            customLineupData={customLineupData}
            onClearCustomLineup={() => setCustomLineupData(null)}
          />
        )}

        {/* =========================================================
            VIEW 2: 팀 클릭 시 화면 - 선택된 팀의 선수 로스터 뷰 (STEP 2)
            선수 목록이 공식 사진과 함께 쫙 보임
            ========================================================= */}
        {currentStep === 'ROSTER' && (
          <TeamRosterView
            team={currentTeamObj}
            players={teamPlayers}
            clusters={CLUSTERS}
            onSelectPlayer={handleSelectPlayer}
            onBackToTeams={handleBackToTeams}
          />
        )}

        {/* =========================================================
            VIEW 3: 선수 클릭 시 화면 - 대체 선수 비교 분석 뷰 (STEP 3)
            타깃 선수 프로필, 2D PCA 군집 맵, 최적 대체 추천 카드 그리드
            ========================================================= */}
        {currentStep === 'SCOUT' && (
          <div className="view-container scout-analysis-view">
            {/* 상단 브레드크럼 & 복귀 네비게이션 바 */}
            <div className="scout-analysis-top-nav">
              <div className="scout-nav-buttons">
                <button className="btn-scout-back" onClick={handleBackToRoster}>
                  <ArrowLeft size={16} />
                  <span>{currentTeamObj.id} 선수 로스터로 돌아가기</span>
                </button>
                <button className="btn-scout-back home-btn" onClick={handleBackToTeams}>
                  <Home size={15} />
                  <span>팀 순위 목록 (처음으로)</span>
                </button>
              </div>

              <div className="view-step-indicator">
                <span className="step-pill completed" onClick={handleBackToTeams} style={{ cursor: 'pointer' }}>
                  STEP 1: {currentTeamObj.id}
                </span>
                <span className="step-divider">›</span>
                <span className="step-pill completed" onClick={handleBackToRoster} style={{ cursor: 'pointer' }}>
                  STEP 2: {targetPlayer.name}
                </span>
                <span className="step-divider">›</span>
                <span className="step-pill active">
                  STEP 3: 대체 선수 비교 분석
                </span>
              </div>
            </div>

            {/* 메인 전술 대시보드: 좌측(선택한 선수 데이터) + 우측(2D 농구 코트 전술판) */}
            <section className="tactics-main-dashboard">
              {/* 좌측: 선택한 선수에 대한 단일 통합 데이터 카드 */}
              <div className="dashboard-player-column">
                <div className="target-spotlight-card">
                  {/* 1. 상단 프로필 헤더 (선수 사진 + 결장 타깃 뱃지 + 이름 + 태그) */}
                  <div className="spotlight-header">
                    <div className="spotlight-profile-group">
                      <div className="spotlight-photo-frame" style={{ borderColor: targetCluster.color }}>
                        <img
                          src={targetPlayer.imgUrl || 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png'}
                          alt={targetPlayer.name}
                          className="spotlight-headshot-img"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement.querySelector('.spotlight-photo-fallback');
                            if (fallback) fallback.hidden = false;
                          }}
                        />
                        <span className="spotlight-photo-fallback" hidden aria-hidden="true">
                          {targetPlayer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}
                        </span>
                        <span className="spotlight-team-tag">{targetPlayer.team}</span>
                      </div>

                      <div className="spotlight-title-group">
                        <span className="badge-target-highlight">
                          <Target size={14} /> 현재 팀 결장 선수 (스카우팅 기준점)
                        </span>
                        <h1 className="target-name" title={targetPlayer.name}>{targetPlayer.name}</h1>
                        <div className="target-tags">
                          <span className="tag-pill">{targetPlayer.team} 소속</span>
                          <span className="tag-pill">{targetPlayer.pos} 포지션</span>
                          <span className="tag-pill">만 {targetPlayer.age}세</span>
                          <span className="tag-pill">36분당 {targetPlayer.stats.pts}득점</span>
                          <span className="tag-pill salary" style={{
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }} title={targetPlayer.salaryShort && targetPlayer.salaryShort !== '-' ? targetPlayer.salaryShort : '연봉 정보 없음'}>
                            💰 연봉: {targetPlayer.salaryShort && targetPlayer.salaryShort !== '-' ? targetPlayer.salaryShort : '정보 없음'}
                          </span>
                          <span className="tag-pill height" style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }} title={`공식 신장: ${getHeightDisplay(targetPlayer)}`}>
                            📏 신장: {getHeightDisplay(targetPlayer)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. 선수 이름 바로 아래: 방사형 역량 차트 */}
                  <div className="spotlight-radar-wrapper">
                    <div className="spotlight-radar-label">
                      <span>선수 고유 6대 지표 역량 방사형 차트</span>
                    </div>
                    <RadarChart p1={targetPlayer} size={360} visualScale={1.1} />
                  </div>

                  {/* 3. 그 아래: 군집 뱃지 (군집 2 등) 및 설명 */}
                  <div
                    className="cluster-badge-lg"
                    style={{
                      backgroundColor: `${targetCluster.color}18`,
                      border: `1px solid ${targetCluster.borderColor}`,
                      color: targetCluster.color
                    }}
                  >
                    <ShieldCheck size={18} />
                    <div>
                      <div className="cluster-num">군집 {targetCluster.id}</div>
                      <div className="cluster-name-text">{targetCluster.name}</div>
                    </div>
                  </div>

                  <div className="cluster-description">
                    <p>{targetCluster.desc}</p>
                  </div>

                  {/* 4. 주요 스탯 그리드 (3x2 컴팩트 레이아웃) */}
                  <div className="spotlight-stats-row">
                    <div className="mini-stat-card">
                      <span className="label">36분 득점</span>
                      <span className="val">{targetPlayer.stats.pts}</span>
                    </div>
                    <div className="mini-stat-card">
                      <span className="label">리바운드</span>
                      <span className="val">{targetPlayer.stats.trb}</span>
                    </div>
                    <div className="mini-stat-card">
                      <span className="label">어시스트</span>
                      <span className="val">{targetPlayer.stats.ast}</span>
                    </div>
                    <div className="mini-stat-card">
                      <span className="label">3P 성공률</span>
                      <span className="val">{(targetPlayer.stats.x3p_pct * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mini-stat-card">
                      <span className="label">블록슛</span>
                      <span className="val">{targetPlayer.stats.blk}</span>
                    </div>
                    <div className="mini-stat-card">
                      <span className="label">스틸</span>
                      <span className="val">{targetPlayer.stats.stl}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측: 2D 농구 경기장 포지션 배치 & 실시간 대체 선수 투입 전술판 */}
              <div className="dashboard-court-column">
                <BasketballCourtTactics
                  targetPlayer={targetPlayer}
                  recommendations={recommendations}
                  clusters={CLUSTERS}
                  allPlayers={PLAYERS}
                  onCompare={(cand) => setComparingCandidate(cand)}
                  onAnalyzeMatchup={handleAnalyzeMatchupFromCourt}
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* 1:1 비교 모달 */}
      {comparingCandidate && (
        <ComparisonModal
          target={targetPlayer}
          candidate={comparingCandidate}
          allPlayers={PLAYERS}
          onClose={() => setComparingCandidate(null)}
        />
      )}

      {/* 푸터 */}
      <footer className="footer">
        <div>
          <strong>COURT RUSH</strong> — NBA Player Similarity & Replacement Recommendation System
        </div>
      </footer>
    </div>
  );
}
