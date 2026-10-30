import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  Users,
  Shield,
  ArrowRight,
  Sparkles,
  Trophy
} from 'lucide-react';
import { getSalaryDisplay } from '../data/mockPlayers';

/**
 * 2단계: 선택된 구단의 선수 로스터 뷰
 * 선택된 팀의 공식 로고 및 스탠딩 정보가 상단에 표시되고,
 * 소속 선수들의 공식 NBA 프로필 사진과 스탯이 나열됩니다.
 * 선수를 클릭하면 3단계(대체 선수 스카우팅 비교 분석 뷰)로 전환됩니다.
 */
export default function TeamRosterView({
  team,
  players,
  clusters,
  onSelectPlayer,
  onBackToTeams
}) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [clusterFilter, setClusterFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const positions = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

  // 해당 팀의 선수들 필터링
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (posFilter !== 'ALL' && p.pos !== posFilter) return false;
      if (clusterFilter !== 'ALL' && p.clusterId !== Number(clusterFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q);
      }
      return true;
    });
  }, [players, posFilter, clusterFilter, searchQuery]);

  return (
    <div className="view-container roster-view">
      {/* 상단 네비게이션 바: 뒤로가기 & 브레드크럼 */}
      <div className="roster-top-nav">
        <button className="btn-back-to-teams" onClick={onBackToTeams}>
          <ArrowLeft size={18} />
          <span>전체 팀 순위 목록으로 돌아가기</span>
        </button>

        <div className="view-step-indicator">
          <span className="step-pill completed" onClick={onBackToTeams} style={{ cursor: 'pointer' }}>
            STEP 1: 팀 선택 ({team.id})
          </span>
          <span className="step-divider">›</span>
          <span className="step-pill active">
            STEP 2: 선수 로스터 선택
          </span>
          <span className="step-divider">›</span>
          <span className="step-pill disabled">
            STEP 3: 대체 선수 비교
          </span>
        </div>
      </div>

      {/* 선택된 팀 배너 */}
      <section className="selected-team-banner" style={{ borderLeft: `6px solid ${team.color}` }}>
        <div className="banner-team-identity">
          <div className="banner-logo-wrap">
            <img
              src={team.logoUrl}
              alt={team.id}
              className="banner-logo-img"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <div className="banner-text-info">
            <div className="banner-title-row">
              <h1 className="banner-team-code" style={{ color: team.color }}>
                {team.id}
              </h1>
              <span className="banner-team-en">{team.name}</span>
            </div>
            <div className="banner-stats-row">
              <span className="b-tag conf-tag">{team.conference} 컨퍼런스 {team.confRank}위</span>
              <span className="b-tag overall-tag">리그 전체 {team.overallRank}위</span>
              <span className="b-tag record-tag">2026 시즌: {team.wins}승 {team.losses}패 (승률 {(team.pct * 100).toFixed(1)}%)</span>
              <span className="b-tag count-tag">로스터 {players.length}명</span>
            </div>
          </div>
        </div>

        <div className="banner-prompt-box">
          <span className="prompt-badge">
            <Sparkles size={14} /> 스카우팅 타깃 선택
          </span>
          <p className="prompt-desc">
            결장 선수를 클릭해 <strong>대체 선수</strong>를 찾아보세요.
          </p>
        </div>
      </section>

      {/* 포지션 & 군집 & 검색 필터 바 */}
      <section className="roster-filters-bar">
        <div className="filter-group-wrap">
          <span className="filter-label">포지션 필터:</span>
          <div className="pill-buttons">
            {positions.map((pos) => (
              <button
                key={pos}
                className={`filter-pill ${posFilter === pos ? 'active' : ''}`}
                onClick={() => setPosFilter(pos)}
              >
                {pos === 'ALL' ? '전체' : pos}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group-wrap">
          <span className="filter-label">머신러닝 군집:</span>
          <div className="pill-buttons">
            <button
              className={`filter-pill ${clusterFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setClusterFilter('ALL')}
            >
              전체
            </button>
            {clusters.map((c) => (
              <button
                key={c.id}
                className={`filter-pill ${clusterFilter === String(c.id) ? 'active' : ''}`}
                style={{
                  borderColor: clusterFilter === String(c.id) ? c.color : undefined,
                  color: clusterFilter === String(c.id) ? c.color : undefined
                }}
                onClick={() => setClusterFilter(String(c.id))}
              >
                {c.shortName}
              </button>
            ))}
          </div>
        </div>

        <div className="roster-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="선수명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="roster-search-input"
          />
        </div>
      </section>

      {/* 선수 카드 그리드 */}
      <section className="roster-cards-section">
        <div className="roster-cards-grid">
          {filteredPlayers.map((player) => {
            const cluster = clusters[player.clusterId];

            return (
              <div
                key={player.id}
                className="roster-interactive-card"
                style={{
                  borderTop: `3px solid ${cluster.color}`
                }}
                onClick={() => onSelectPlayer(player.id)}
              >
                {/* 상단 포지션 & 군집 & 신장 */}
                <div className="card-top-tags">
                  <span className="pos-badge">{player.pos}</span>
                  <span className="age-badge">만 {player.age}세</span>
                  {player.height_cm && (
                    <span className="age-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }} title={`공식 신장: ${player.height_cm}cm (${player.height_ft_in || ''})`}>
                      📏 {player.height_cm}cm
                    </span>
                  )}
                  <span
                    className="cluster-mini-badge"
                    style={{
                      backgroundColor: `${cluster.color}15`,
                      color: cluster.color,
                      border: `1px solid ${cluster.borderColor}`
                    }}
                  >
                    군집 {cluster.id}
                  </span>
                </div>

                {/* 중앙: 공식 NBA 헤드샷 이미지 */}
                <div className="player-photo-showcase">
                  <img
                    src={player.imgUrl || 'https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png'}
                    alt={player.name}
                    className="player-photo-lg"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement.querySelector('.player-photo-fallback');
                      if (fallback) fallback.hidden = false;
                    }}
                  />
                  <div className="player-photo-fallback" hidden aria-hidden="true">
                    {player.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}
                  </div>
                </div>

                {/* 선수명 및 연봉 */}
                <div className="player-name-block">
                  <h3 className="player-name-text">{player.name}</h3>
                  <div className="player-cluster-salary-line">
                    <span className="cluster-name-sub" style={{ color: cluster.color }} title={cluster.name}>
                      {cluster.name}
                    </span>
                    <span
                      className="roster-salary-pill"
                      title={getSalaryDisplay(player)}
                    >
                      💰 {player.salaryShort && player.salaryShort !== '-' ? player.salaryShort : '연봉 정보 없음'}
                    </span>
                  </div>
                </div>

                {/* 36분 환산 핵심 스탯 */}
                <div className="player-key-stats">
                  <div className="p-stat">
                    <span className="p-stat-label">득점</span>
                    <span className="p-stat-val pts">{player.stats.pts}</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-label">리바운드</span>
                    <span className="p-stat-val">{player.stats.trb}</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-label">어시스트</span>
                    <span className="p-stat-val">{player.stats.ast}</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-label">3P%</span>
                    <span className="p-stat-val">{(player.stats.x3p_pct * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* CTA 버튼 */}
                <button className="btn-start-scout">
                  <span>대체 선수 비교 분석 시작</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="no-players-matched">
            <p>선택하신 조건에 일치하는 선수가 없습니다.</p>
            <button
              className="btn-clear-roster-filters"
              onClick={() => { setPosFilter('ALL'); setClusterFilter('ALL'); setSearchQuery(''); }}
            >
              필터 초기화
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
